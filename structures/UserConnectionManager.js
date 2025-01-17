import UserConnection from './UserConnection.js';
import ConnectionManager from './ConnectionManager.js';
import * as utils from '../api/utils.js';
import Discord from 'discord.js';

export default class UserConnectionManager extends ConnectionManager {

    /**
     * Creates a new UserConnectionManager instance.
     * @param {MCLinker} client - The client to create the manager for.
     * @param {CollectionName} collectionName - The name of the database collection that this manager controls.
     * @returns {UserConnectionManager} - A new UserConnectionManager instance.
     */
    constructor(client, collectionName = 'UserConnection') {
        super(client, UserConnection, collectionName);
    }

    /**
     * @typedef {object} UserResponse
     * @property {?string} uuid - The uuid of the user.
     * @property {?string} username - The username of the user.
     * @property {?'nullish'|?'fetch'|?'cache'} error - The error that occurred.
     */

    /**
     * Returns the uuid and name of a minecraft user from a mention/username.
     * @param {string} arg - The argument to get the uuid and name from.
     * @param {ServerConnectionResolvable} server - The server to resolve the uuid and name from.
     * @returns {Promise<UserResponse>} - The uuid and name of the user.
     */
    async userFromArgument(arg, server) {
        if(!arg) return { error: 'nullish', uuid: null, username: null };

        const id = Discord.MessageMentions.UsersPattern.exec(arg)?.[1];
        if(id) {
            /** @type {UserConnection} */
            const cacheConnection = this.cache.get(id);
            if(cacheConnection) {
                return {
                    uuid: cacheConnection.getUUID(server),
                    username: cacheConnection.username,
                    error: null,
                };
            }
            return { error: 'cache', uuid: null, username: null };
        }

        server = this.client.serverConnections.resolve(server);

        let uuid;
        if(server.floodgatePrefix && arg.startsWith(server.floodgatePrefix)) {
            const usernameWithoutPrefix = arg.slice(server.floodgatePrefix.length);
            uuid = await utils.fetchFloodgateUUID(usernameWithoutPrefix);
        } else uuid = server.online ? await utils.fetchUUID(arg) : utils.createUUIDv3(arg);

        if(uuid) return { uuid: uuid, username: arg, error: null };
        return { error: 'fetch', uuid: null, username: null };
    }
}
