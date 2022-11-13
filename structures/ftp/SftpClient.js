const Sftp = require('ssh2-sftp-client');
const BaseClient = require('./BaseClient');
const fs = require('fs-extra');

class SftpClient extends BaseClient {

    constructor(credentials) {
        super(credentials);
        this.credentials.host ??= credentials.ip;

        delete this.credentials.user;
        delete this.credentials.ip;

        /**
         * The sftp client.
         * @type {import('ssh2-sftp-client')}
         */
        this.client = new Sftp();
    }

    async connect() {
            await this.client.connect(this.credentials);
            await this.client.end();
            return true;
    }

    async find(name, start, maxDepth) {
        await this.client.connect(this.credentials);
        const foundFile = await this._findFile(name, start, maxDepth);
        await this.client.end();
        return foundFile;
    }

    async get(source, destination) {
        await fs.ensureFile(destination);

        await this.client.connect(this.credentials);
        await this.client.get(source, destination);
        await this.client.end();
        return true;
    }

    async list(folder) {
        await this.client.connect(this.credentials);
        const listing = await this.client.list(folder);
        await this.client.end();

        return listing.map(item => { return { name: item.name, isDirectory: item.type === 'd' }; });
    }

    async put(source, destination) {
        await this.client.connect(this.credentials);
        await this.client.put(source, destination);
        await this.client.end();
        return true;
    }

    async _findFile(name, path, maxDepth) {
        return new Promise(async resolve => {
            if(path.split('/').length - 1 >= maxDepth) return resolve(undefined);
            const listing = await this.client.list(path);
            const foundFile = listing.find(item => item.name === name && item.type === '-');
            if(foundFile) return resolve(path);

            for(const item of listing) {
                if(item.type === 'd') {
                    return resolve(await this._findFile(name, `${path}/${item.name}`, maxDepth));
                }
            }
        });
    }
}

module.exports = SftpClient;