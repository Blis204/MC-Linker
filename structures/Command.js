const { CommandInteraction, Message } = require('discord.js');

class Command {

    constructor(name, defer = true, ephemeral = false) {

        /**
         * The name of this command.
         * @type {string}
         */
        this.name = name;

        /**
         * Indicates whether to defer this command.
         * @type {boolean}
         */
        this.defer = defer;

        /**
         * Indicates whether to defer this command as ephemeral.
         * @type {boolean}
         */
        this.ephemeral = ephemeral;
    }

    /**
     * Handles the execution of a command.
     * @param {(Message|CommandInteraction) & TranslatedResponses} interaction - The message/slash command interaction.
     * @param {MCLinker} client - The MCLinker client.
     * @param {String[]} args - The command arguments set by the user.
     * @returns {void|Promise<void>}
     * @abstract
     */
    execute(interaction, client, args) {
        throw new Error('Not implemented');
    }
}

module.exports = Command;
