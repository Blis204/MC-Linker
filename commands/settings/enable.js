const utils = require('../../api/utils');
const settings = require('../../api/settings');
const Discord = require('discord.js');

async function autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focused = interaction.options.getFocused().toLowerCase();

    const disabled = await settings.getDisabled(interaction.guildId, subcommand);
    const matchingDisabled = disabled.filter(disable => disable.includes(focused));
    if (matchingDisabled.length >= 25) matchingDisabled.length = 25;

    const respondArray = [];
    for (let disable of matchingDisabled) {
        disable = disable.replaceAll(`${interaction.guildId}_`, '');
        let formattedDisable;
        if (subcommand === 'advancements') {
            const matchingTitle = await utils.searchAllAdvancements(disable, true, 1);
            formattedDisable = matchingTitle.shift()?.name ?? disable.cap();

        } else if (subcommand === 'stats') formattedDisable = disable.split('_').map(word => word.cap()).join(' ');
        else formattedDisable = disable.cap();

        respondArray.push({
            name: formattedDisable,
            value: disable,
        });
    }

    interaction.respond(respondArray).catch(err => console.log(`Could not respond to autocomplete ${interaction.commandName}`, err));
}

async function execute(message, args) {
    let type = args?.shift();
    let toEnable = args?.join(' ').toLowerCase();

    if(!type) {
        console.log(`${message.member.user.tag} executed /enable without type in ${message.guild.name}`);
        message.reply(':warning: Please specify the type you want to enable (`commands`, `stats`, `advancements`).');
        return;
    } else if(!toEnable) {
        console.log(`${message.member.user.tag} executed /enable without toEnable in ${message.guild.name}`);
        message.reply(':warning: Please specify the command, stat or advancement you want to enable.');
        return;
    } else if(!message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
        console.log(`${message.member.user.tag} executed /enable ${type} without admin in ${message.guild.name}`);
        message.reply(':no_entry: This command can only be executed by admins.');
        return;
    }

    console.log(`${message.member.user.tag} executed /enable ${type} ${toEnable} in ${message.guild.name}`);

    if (type === 'command' || type === 'cmd' || type === 'commands' || type === 'cmds') type = 'commands';
    else if (type === 'advancements' || message.client.commands.get('advancements').aliases.includes(type)) type = 'advancements';
    else if (type === 'stats' || message.client.commands.get('stats').aliases.includes(type)) type = 'stats';
    else {
        console.log(`${message.member.user.tag} executed /enable with wrong type in ${message.guild.name}`);
        message.reply(':warning: You can only enable `commands`, `stats` or `advancement`.');
        return;
    }

    let formattedToEnable;
    if(type === 'commands') {
        const command = message.client.commands.get(toEnable) ?? message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(toEnable));

        if(!command) {
            console.log(`Command [${toEnable}] doesn't exist.`);
            message.reply(`:warning: Command [**${toEnable}**] doesn't exist.`);
            return;
        }

        toEnable = command.name;
        formattedToEnable = toEnable.cap();
    } else if(type === 'advancements') {
        const matchingTitle = await utils.searchAllAdvancements(toEnable, true, 1);
        formattedToEnable = matchingTitle.shift()?.name ?? toEnable.cap();
    } else if(type === 'stats') formattedToEnable = toEnable.split('_').map(word => word.cap()).join(' ');

    if(!await settings.enable(message.guildId, type, toEnable)) {
        console.log(`Could not enable ${type} [${toEnable}].`);
        message.reply(`:warning: ${type.cap()} [**${toEnable}**] is already enabled.`);
        return;
    }
    console.log(`Successfully enabled ${type} [${toEnable}].`);
    message.reply(`<:Checkmark:849224496232660992> Successfully enabled ${type.cap()} [**${formattedToEnable}**].`);
}

module.exports = { execute, autocomplete };