const { MessageReaction } = require('discord.js');

module.exports = {
    name: 'ban',
    aliases: ['banplayer', 'banuser'],
    usage: 'ban <mention/username>',
    example: 'ban @Lianecx **//** ban cheaterGuy',
    description: 'Ban a player from the **minecraft server**. Can only be used with `Ban member` permission!',
    async execute(message, args) {
		const utils = require('../utils');
		const ftp = require('../ftp');
		const fs = require('fs');
		const rcon = require('../rcon');

		const taggedUser = args.shift();
		if(!taggedUser) {
            console.log(message.member.user.tag + ' executed ^ban without user in ' + message.guild.name);
            message.reply('Please specify the player you want to ban.');
            return;
        }

		let reason = '';
		if(!args[0]) reason = 'Banned by an operator.';
		else reason = args.join(' ');

		if (!message.member.hasPermission("BAN_MEMBERS")) {
			message.reply(':no-entry: ' + "This command can only be used with `Ban member` permission!");
            console.log(message.member.user.tag + ' executed ^ban without banperm in ' + message.guild.name);
            return;
		}

		let taggedName;
		let userName;
		if(!message.mentions.users.size) {
			userName = taggedUser;
            taggedName = taggedUser;
        } else {
			userName = await utils.getUserName(message.mentions.users.first().id, message);
			if(userName === undefined) return;
            taggedName = message.mentions.users.first().tag;
        }
		console.log(message.member.user.tag + ' executed ^ban with taggedUser: ' + taggedName + ' in ' + message.guild.name);

		fs.readFile(`./rcon/${message.guild.id}.json`, 'utf8', async (err, rconData) => {
			if (err) {
				console.log('Could not find rconFile on Disk, creating one...');
				message.reply('<:Error:849215023264169985> Could not read rcon credentials, attempting to create some. (If this errors, do `^rcon connect` or `^ftp connect`)');

				const uuidv4 = await utils.getUUIDv4(taggedUser, message);
				if(uuidv4 === undefined) return;

				const worldPath = await utils.getWorldPath(message);
				if(worldPath === undefined) return;
				const path = worldPath.split('/').slice(0, -1).join('/');

				const propFile = await ftp.get(`${path}/server.properties`, `./properties/${message.guild.id}.properties`, message);
				if(propFile === false) return;
				
				fs.readFile(`./properties/${message.guild.id}.properties`, 'utf8', async (err, propString) => {
					if(err) {
						console.log('Error reading properties file from disk ', err);
						message.reply('<:Error:849215023264169985> Could not read properties file.');
						return;
					}

					const propArr = propString.split('\n');
					const rconEnabled = propArr.find(key => key.startsWith('enable-rcon')).split('=').pop();

					if(rconEnabled === 'false') {
						message.reply('RCON is disabled, do you want the bot to enable it (or use ftp)?')
						.then((msg) => {
							msg.react('👍');
							msg.react('👎');
							const filter = (reaction, user) => {
								return ['👍', '👎'].includes(reaction.emoji.name) && user.id === message.author.id;
							};
							
							msg.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
								.then(async collected => {
									const reaction = collected.first();
									if (reaction.emoji.name === '👍') {
										propString = propString.replace('enable-rcon=false', 'enable-rcon=true');

										fs.writeFile(`./properties/${message.guild.id}.properties`, propString, 'utf8', async (err) => {
											if(err) {
												console.log('Error writing properties file.', err);
												message.reply('<:Error:849215023264169985> Error trying to enable RCON.');
												return;
											}
											console.log('Successfully wrote properties file.');
											
											const propFile = await ftp.put(`./properties/${message.guild.id}.properties`, `${path}/server.properties`, message)
											if(propFile === false) return;

											message.reply('<:Checkmark:849224496232660992> Enabled RCON. Please **restart the server** and try this command again.');
											return;
										});
									} else if (reaction.emoji.name === '👎') {
										const banFile = await ftp.get(`${path}/banned-players.json`, `./bans/${message.guild.id}.json`, message);
										if(banFile === false) return;

										const banReplace = {
											"uuid": uuidv4,
											"name": userName,
											"created": Date.now(),
											"source": "Smp_Minecraft_Bot",
											"expires": "forever",
											"reason": reason
										}
						
										fs.readFile(`./bans/${message.guild.id}.json`, 'utf8', (err, banJson) => {
											if (err) {
												console.log('Error reading ban file from disk ', err);
												message.reply('<:Error:849215023264169985> ' + 'Could not read ban file.');
												return;
											}
											const banData = JSON.parse(banJson);
											for(let i = 0; i<banData.length; i++) {
												if(banData[i].uuid === uuidv4) {
													console.log('Player is already banned.');
													message.reply(':warning: Player [**' + taggedName + '**] is already banned.');
													return;
												}
											}
											banData.splice(0, 0, banReplace);
						
											const banString = JSON.stringify(banData, null, 2);
											fs.writeFile(`./bans/${message.guild.id}.json`, banString, async (err) => {
												if(err) {
													console.log('Error writing banFile', err);
													message.reply('<:Error:849215023264169985> Error trying to ban player.');
													return;
												}

												const banFIle = await ftp.put(`./bans/${message.guild.id}.json`, `${path}/banned-players.json`, message);
												if(banFIle === false) return;

												console.log('Succesfully wrote and put banFile on server.');
												message.reply(':warning: Restart the minecraft server to ban the player [**' + taggedName + '**]. **OR do **`^rcon enable`** to instantly ban the player!**');	
											})
										})
									}
								}).catch(collected => {
										message.reply(':warning: You didnt react in time!');
								});
						});
					} else if (rconEnabled === 'true') {
						const password = propArr.find(key => key.startsWith('rcon.password')).split('=').pop();
						const port = propArr.find(key => key.startsWith('rcon.port')).split('=').pop();
						const ip = propArr.find(key => key.startsWith('server-ip')).split('=').pop();

						if(ip === '' || port === '' || password === '') {
                            console.log('RCON credentials are not specified in server.properties.');
                            message.reply(':warning: Please use `^rcon connect` OR define all RCON credentials in the `server.properties` file.');
                            return;
                        }

						const rconString = {
							"password": password,
							"port": port,
							"ip": ip
						}
						const rconJson = JSON.stringify(rconString, null, 2);

						fs.writeFile(`./rcon/${message.guild.id}.json`, rconJson, 'utf8', (err) => {
							if(err) {
								console.log('Error writing rconFile.', err);
								message.reply('<:Error:849215023264169985> Error trying to connect to the RCON.');
								return;
							}
							console.log('Successfully wrote rconFile.');
							message.reply('<:Checkmark:849224496232660992> Created RCON credentials from the `server.properties` file.')
						});

						await rcon.execute(ip, port, password, `ban ${userName} ${reason}`, message);
					}
				})
				return;
			}

			const rconJson = JSON.parse(rconData);
			const password = rconJson.password;
			const port = rconJson.port;
			const ip = rconJson.ip;

			fs.access('./ftp/' + message.guild.id + '.json', fs.constants.F_OK, async (err) => {
				if (err) {
					await rcon.execute(ip, port, password, `ban ${userName} ${reason}`, message);
				} else {
					const uuidv4 = await utils.getUUIDv4(taggedUser, message);
					if(uuidv4 === undefined) return;

					const worldPath = await utils.getWorldPath(message);
					if(worldPath === undefined) return;
					const path = worldPath.split('/').slice(0, -1).join('/');

					const propFile = await ftp.get(`${path}/server.properties`, `./properties/${message.guild.id}.properties`, message);
					if(propFile === false) return;
					
					fs.readFile(`./properties/${message.guild.id}.properties`, 'utf8', async (err, propString) => {
						if(err) {
							console.log('Error reading properties file from disk ', err);
							message.reply('<:Error:849215023264169985> Could not read properties file.');
							return;
						}

						const propArr = propString.split('\n');
						const rconEnabled = propArr.find(key => key.startsWith('enable-rcon')).split('=').pop();

						if(rconEnabled === 'false') {
								message.reply('RCON is disabled, do you want the bot to enable it (or use ftp)?')
									.then((msg) => {
										msg.react('👍');
										msg.react('👎');
										const filter = (reaction, user) => {
											return ['👍', '👎'].includes(reaction.emoji.name) && user.id === message.author.id;
										};
										
										msg.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
											.then(async collected => {
												const reaction = collected.first();
												if (reaction.emoji.name === '👍') {
													propString = propString.replace('enable-rcon=false', 'enable-rcon=true');

													fs.writeFile(`./properties/${message.guild.id}.properties`, propString, 'utf8', async (err) => {
														if(err) {
															console.log('Error writing properties file.', err);
															message.reply('<:Error:849215023264169985> Error trying to enable RCON.');
															return;
														}
														console.log('Successfully wrote properties file.');

														const propFile = await ftp.put(`./properties/${message.guild.id}.properties`, `${path}/server.properties`, message)
														if(propFile === false) return;

														message.reply('<:Checkmark:849224496232660992> Enabled RCON. Please **restart the server** and try this command again.');
														return;
													});
												} else if (reaction.emoji.name === '👎') {
													const banFIle = await ftp.get(`${path}/banned-players.json`, `./bans/${message.guild.id}.json`, message);
													if(banFIle === false) return;
													
													const banReplace = {
														"uuid": uuidv4,
														"name": userName,
														"created": Date.now(),
														"source": "Smp_Minecraft_Bot",
														"expires": "forever",
														"reason": reason
													}
									
													fs.readFile(`./bans/${message.guild.id}.json`, 'utf8', (err, banJson) => {
														if (err) {
															console.log('Error reading ban file from disk ', err);
															message.reply('<:Error:849215023264169985> ' + 'Could not read ban file.');
															return;
														}
														const banData = JSON.parse(banJson);
														for(let i = 0; i<banData.length; i++) {
															if(banData[i].uuid === uuidv4) {
																console.log('Player is already banned.');
																message.reply(':warning: Player [**' + taggedName + '**] is already banned.');
																return;
															}
														}
														banData.splice(0, 0, banReplace);
									
														const banString = JSON.stringify(banData, null, 2);
														fs.writeFile(`./bans/${message.guild.id}.json`, banString, async (err) => {
															if(err) {
																console.log('Error writing banFile', err);
																message.reply('<:Error:849215023264169985> Error trying to ban player.');
																return;
															}
															await ftp.put(`./bans/${message.guild.id}.json`, `${path}/banned-players.json`, message);
									
															console.log('Succesfully wrote and put banFile on server.');
															message.reply(':warning: Restart the minecraft server to ban the player [**' + taggedName + '**]. **OR do **`^rcon enable`** to instantly ban the player!**');	
														})
													})
												}
											}).catch(collected => {
													message.reply('You didnt react in time!');
											});
									})
						} else if (rconEnabled === 'true') {
							await rcon.execute(ip, port, password, `ban ${userName} ${reason}`, message);
						}
					})
				}
			});
		})
	}
}