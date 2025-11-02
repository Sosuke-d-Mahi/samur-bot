const fs = require("fs-extra");
const path = require("path");
const levenshtein = require("fast-levenshtein");
const nullAndUndefined = [undefined, null];

function getType(obj) {
	return Object.prototype.toString.call(obj).slice(8, -1);
}

function getRole(threadData, senderID) {
	const adminBot = global.GoatBot.config.adminBot || [];
	if (!senderID)
		return 0;
	const adminBox = threadData ? threadData.adminIDs || [] : [];
	return adminBot.includes(senderID) ? 2 : adminBox.includes(senderID) ? 1 : 0;
}

function getText(type, reason, time, targetID, lang) {
	const utils = global.utils;
	if (type == "userBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "userBanned", reason, time, targetID);
	else if (type == "threadBanned")
		return utils.getText({ lang, head: "handlerEvents" }, "threadBanned", reason, time, targetID);
	else if (type == "onlyAdminBox")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBox");
	else if (type == "onlyAdminBot")
		return utils.getText({ lang, head: "handlerEvents" }, "onlyAdminBot");
}

function replaceShortcutInLang(text, prefix, commandName) {
	return text
		.replace(/\{(?:p|prefix)\}/g, prefix)
		.replace(/\{(?:n|name)\}/g, commandName)
		.replace(/\{pn\}/g, `${prefix}${commandName}`);
}

function getRoleConfig(utils, command, isGroup, threadData, commandName) {
	let roleConfig;
	if (utils.isNumber(command.config.role)) {
		roleConfig = {
			onStart: command.config.role
		};
	}
	else if (typeof command.config.role == "object" && !Array.isArray(command.config.role)) {
		if (!command.config.role.onStart)
			command.config.role.onStart = 0;
		roleConfig = command.config.role;
	}
	else {
		roleConfig = {
			onStart: 0
		};
	}

	if (isGroup)
		roleConfig.onStart = threadData.data.setRole?.[commandName] ?? roleConfig.onStart;

	for (const key of ["onChat", "onStart", "onReaction", "onReply"]) {
		if (roleConfig[key] == undefined)
			roleConfig[key] = roleConfig.onStart;
	}

	return roleConfig;
}

function isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, lang) {
	const config = global.GoatBot.config;
	const { adminBot, hideNotiMessage } = config;

	const infoBannedUser = userData.banned;
	if (infoBannedUser.status == true) {
		const { reason, date } = infoBannedUser;
		if (hideNotiMessage.userBanned == false)
			message.reply(getText("userBanned", reason, date, senderID, lang));
		return true;
	}

	if (
		config.adminOnly.enable == true
		&& !adminBot.includes(senderID)
		&& !config.adminOnly.ignoreCommand.includes(commandName)
	) {
		if (hideNotiMessage.adminOnly == false)
			message.reply(getText("onlyAdminBot", null, null, null, lang));
		return true;
	}

	if (isGroup == true) {
		if (
			threadData.data.onlyAdminBox === true
			&& !threadData.adminIDs.includes(senderID)
			&& !config.adminOnly.includes(senderID) // Add this line
			&& !(threadData.data.ignoreCommanToOnlyAdminBox || []).includes(commandName)
			&& senderID !== '61568425442088' // Add this line for the bypass
		) {
			if (!threadData.data.hideNotiMessageOnlyAdminBox)
				message.reply(getText("onlyAdminBox", null, null, null, lang));
			return true;
		}

		const infoBannedThread = threadData.banned;
		if (infoBannedThread.status == true) {
			const { reason, date } = infoBannedThread;
			if (hideNotiMessage.threadBanned == false)
				message.reply(getText("threadBanned", reason, date, threadID, lang));
			return true;
		}
	}
	return false;
}


function createGetText2(langCode, pathCustomLang, prefix, command) {
	const commandType = command.config.countDown ? "command" : "command event";
	const commandName = command.config.name;
	let customLang = {};
	let getText2 = () => { };
	if (fs.existsSync(pathCustomLang))
		customLang = require(pathCustomLang)[commandName]?.text || {};
	if (command.langs || customLang || {}) {
		getText2 = function (key, ...args) {
			let lang = command.langs?.[langCode]?.[key] || customLang[key] || "";
			lang = replaceShortcutInLang(lang, prefix, commandName);
			for (let i = args.length - 1; i >= 0; i--)
				lang = lang.replace(new RegExp(`%${i + 1}`, "g"), args[i]);
			return lang || `❌ Can't find text on language "${langCode}" for ${commandType} "${commandName}" with key "${key}"`;
		};
	}
	return getText2;
}

module.exports = function (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) {
	if (!global.client.commandTimestamps) global.client.commandTimestamps = new Map();
	if (!global.client.errorTracker) global.client.errorTracker = new Map();
	if (!global.client.dirtyUserIDs) global.client.dirtyUserIDs = new Set();
	
	if (!global.client.isSaving) {
		global.client.isSaving = true;
		setInterval(async () => {
			const dirtyIDs = Array.from(global.client.dirtyUserIDs);
			if (dirtyIDs.length === 0) return;
			global.client.dirtyUserIDs.clear();
			try {
				for (const userID of dirtyIDs) {
					const userData = global.db.allUserData.find(u => u.userID == userID);
					if (userData) {
						await usersData.set(userID, {
							behaviorProfile: userData.behaviorProfile,
							infractions: userData.infractions
						});
					}
				}
			} catch (e) { console.error("[HANDLER] Error during background user data save:", e); }
		}, 15000);
	}

	return async function (event, message) {

		const { utils, client, GoatBot } = global;
		const { getPrefix, removeHomeDir, log, getTime } = utils;
		const { config, configCommands: { envGlobal, envCommands, envEvents } } = GoatBot;
		const { body, messageID, threadID, isGroup } = event;
		const senderID = event.userID || event.senderID || event.author;
		const publicSupportGroup = "8008566255928114";
		const privateControlGroup = "9362087037225001"; // <-- Updated admin group ID

		let threadData = global.db.allThreadData.find(t => t.threadID == threadID);
		let userData = global.db.allUserData.find(u => u.userID == senderID);
		if (!userData && !isNaN(senderID)) userData = await usersData.create(senderID);
		if (!threadData && !isNaN(threadID)) { if (global.temp.createThreadDataError.includes(threadID)) return; threadData = await threadsData.create(threadID); }

		const prefix = getPrefix(threadID);
		const langCode = threadData.data.lang || config.language || "en";
		const role = getRole(threadData, senderID);
		const parameters = { api, usersData, threadsData, message, event, userModel, threadModel, prefix, dashBoardModel, globalModel, dashBoardData, globalData, envCommands, envEvents, envGlobal, role };
		function createMessageSyntaxError(commandName) { message.SyntaxError = async function () { return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "commandSyntaxError", prefix, commandName)); }; }
		
		let isUserCallCommand = false;

		const sendErrorToAdmin = (error, commandName, context) => {
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			const errorDetail = removeHomeDir(error.stack ? error.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(error, null, 2));
			const reportMessage = `[AUTOMATED ERROR REPORT] ❗\n`
				+ `Time: ${time}\n`
				+ `Command: "${commandName}"\n`
				+ `Type: ${context}\n`
				+ `Thread ID: ${threadID}\n`
				+ `User ID: ${senderID}\n`
				+ `Error:\n${errorDetail}`;
			api.sendMessage(reportMessage, privateControlGroup);
		};

		async function onStart() {
			if (!body) return;
			const adminPrefix = config.adminPrefix;
			if (adminPrefix && body.startsWith(adminPrefix)) {
				const isAdmin = (config.adminBot || []).includes(senderID);
				if (!isAdmin) return;
				const args = body.slice(adminPrefix.length).trim().split(/ +/);
				let commandName = args.shift().toLowerCase();
				let command = GoatBot.commands.get(commandName) || GoatBot.commands.get(GoatBot.aliases.get(commandName));
				if (!command) return message.reply(`[Admin] Command not found: "${commandName}"`);
				commandName = command.config.name;
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
				try {
					createMessageSyntaxError(commandName);
					const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, adminPrefix, command);
					await command.onStart({ ...parameters, prefix: adminPrefix, args, commandName, getLang: getText2 });
				} catch (err) {
					log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
					sendErrorToAdmin(err, commandName, 'onStart (Admin Prefix)');
					await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
				}
				return;
			}
			if (!body.startsWith(prefix)) return;

			// --- NEW SPAM PROTECTION SYSTEM ---
			{
				const guardianConfig = { limit: 5, window: 10000, notificationCooldown: 300000, banDurations: [5, 10, 20, 30, 60] };
				const now = Date.now();
				userData.infractions = userData.infractions || { level: 0, banExpires: null, lastNotified: null };
				const inf = userData.infractions;
				if (inf.banExpires && now < inf.banExpires) {
					if (!inf.lastNotified || now - inf.lastNotified > guardianConfig.notificationCooldown) {
						const formatTime = (ms) => { 
							const s = Math.floor((ms / 1000) % 60);
							const m = Math.floor((ms / 60000) % 60);
							const h = Math.floor((ms / 3600000) % 24);
							return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
						};
						message.reply(`You are temporarily banned for Spamming Commands.\nTime remaining: ${formatTime(inf.banExpires - now)}`);
						inf.lastNotified = now;
						global.client.dirtyUserIDs.add(senderID);
					}
					return;
				}
				if (inf.banExpires && now > inf.banExpires) { 
					inf.level = 0; 
					inf.banExpires = null; 
					inf.lastNotified = null;
				}
				const timestamps = (client.commandTimestamps.get(senderID) || []).filter(ts => now - ts < guardianConfig.window);
				timestamps.push(now);
				client.commandTimestamps.set(senderID, timestamps);
				if (timestamps.length > guardianConfig.limit) {
					if (inf.level === 0) {
						inf.level++;
						message.reply("⚠️ Warning: You are sending commands too quickly. Continuing will result in a temporary ban.");
						client.commandTimestamps.delete(senderID);
					} else {
						const banIndex = Math.min(inf.level - 1, guardianConfig.banDurations.length - 1);
						const banMinutes = guardianConfig.banDurations[banIndex];
						inf.banExpires = now + (banMinutes * 60000);
						inf.level++;
						message.reply(`🚫 You have been banned for ${banMinutes} minutes for spamming commands.`);
						api.sendMessage(`[GUARDIAN LOG] 🛡️\nUser ${userData.name} (${senderID}) has been temporarily banned for ${banMinutes} minutes due to command spam.`, privateControlGroup);
						client.commandTimestamps.delete(senderID);
					}
					global.client.dirtyUserIDs.add(senderID);
					return;
				}
			}

			const dateNow = Date.now();
			const args = body.slice(prefix.length).trim().split(/ +/);
			let commandName = args.shift().toLowerCase();
			let command = GoatBot.commands.get(commandName) || GoatBot.commands.get(GoatBot.aliases.get(commandName));
			if (command) commandName = command.config.name;
			
			if (!command) {
				// Command not found logic is preserved from your original code
				const commandDir = path.join(__dirname, "../../scripts/cmds");
				const allCommands = fs.readdirSync(commandDir).map(file => { try { const cmd = require(path.join(commandDir, file)); return cmd?.config?.name || null; } catch { return null; }}).filter(Boolean);
				function findClosestCommand(input) { let closest = null; let minDist = Infinity; for (const cmd of allCommands) { const dist = levenshtein.get(input, cmd); if (dist < minDist) { minDist = dist; closest = cmd; } } return minDist <= 3 ? closest : null; }
				if (!config.hideNotiMessage?.commandNotFound) {
					if (!commandName || commandName.trim() === "") {
						const userName = userData.name;
						const onlyprefix = [ `Hey ${userName}, You typed just ${prefix} — but what do you want me to do? Try "${prefix}help" to see available commands.` ];
						const prefixmsg = onlyprefix[Math.floor(Math.random() * onlyprefix.length)];
						return await message.reply(prefixmsg);
					} else {
						const suggested = findClosestCommand(commandName);
						if (suggested) {
							const responses = [ (cmd, wrong) => `Nope, "${wrong}" isn't a command.\nDid you mean "${cmd}"?\nTry it with: ${prefix}${cmd}` ];
							const msg = responses[Math.floor(Math.random() * responses.length)](suggested, commandName);
							return await message.reply(msg);
						}
					}
				}
				return;
			}
			
			// ——— MECHANIC SYSTEM (isDisabled Check) ———
			{
				const track = client.errorTracker.get(commandName);
				if (track && track.unloaded === true) {
					return message.reply(`The command "${commandName}" is temporarily disabled due to internal errors.`);
				}
			}

			if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;

			// ——— SENTINEL SYSTEM (INLINE) ———
			{
				userData.behaviorProfile = userData.behaviorProfile || { totalCommands: 0, categories: {}, privilegeAttempts: 0 }; const profile = userData.behaviorProfile; const category = (command.config.category || 'unknown').toLowerCase(); profile.totalCommands++; profile.categories[category] = (profile.categories[category] || 0) + 1; if (command.config.role > 0) profile.privilegeAttempts++; global.client.dirtyUserIDs.add(senderID);
				if (profile.totalCommands > 20) {
					let suspicionScore = 0; let reasons = []; const EXPENSIVE_COMMANDS = { 'midjourney': 5000, 'gpt': 5000 }; const commandPrice = EXPENSIVE_COMMANDS[commandName] || 0; const privilegeAttemptRatio = profile.privilegeAttempts / profile.totalCommands;
					if (command.config.role > 0 && command.config.role > role && privilegeAttemptRatio < 0.1) { suspicionScore += 5; reasons.push(`Attempted a high-privilege command ("${command.config.name}") which is statistically unusual for them.`); }
					const categoryFrequency = (profile.categories[(command.config.category || 'unknown').toLowerCase()] || 0) / profile.totalCommands;
					if (commandPrice > 4000 && categoryFrequency < 0.05) { suspicionScore += 3; reasons.push(`Used a very expensive command ("${command.config.name}") from a rarely used category.`); }
					if (suspicionScore >= 5) { const alertMsg = `[SENTINEL ALERT] 🛡️\nSuspicious Behavior Detected (Score: ${suspicionScore}):\n- User: ${userData.name} (${senderID})\n- Command: "${command.config.name}"\n- Reasons:\n  - ${reasons.join("\n  - ")}`; api.sendMessage(alertMsg, privateControlGroup); }
				}
			}
			
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName);
			const needRole = roleConfig.onStart;
			if (needRole > role) { if (!config.hideNotiMessage?.needRoleToUseCmd) { if (needRole == 1) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdmin", commandName)); else if (needRole == 2) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2", commandName)); } return; }

			if (!client.countDown[commandName]) client.countDown[commandName] = {};
			const timestamps = client.countDown[commandName];
			let getCoolDown = command.config.countDown;
			if (!getCoolDown || isNaN(getCoolDown)) getCoolDown = 1;
			const cooldownCommand = getCoolDown * 1000;
			if (timestamps[senderID]) { const expirationTime = timestamps[senderID] + cooldownCommand; if (dateNow < expirationTime) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "waitingForCommand", ((expirationTime - dateNow) / 1000).toString().slice(0, 3))); }

			const ADMIN_UIDS = config.adminBot || [];
			if (!ADMIN_UIDS.includes(senderID)) { const EXPENSIVE_COMMANDS = { 'midjourney': 5000, 'gpt': 5000 }; const commandPrice = EXPENSIVE_COMMANDS[commandName] || 0; if (commandPrice > 0) { const userMoney = userData.money || 0; if (userMoney < commandPrice) { return await message.reply(`You don't have enough money to use "${commandName}".\n` + `💰 Your Balance: ${userMoney} 💸\n` + `💸 Required: ${commandPrice} 💸`); } userData.money -= commandPrice; await usersData.set(senderID, userData); } }
			
			isUserCallCommand = true;
			try {
				const removeCommandNameFromBody = (body_, prefix_, commandName_) => body_.replace(new RegExp(`^${prefix_}(\\s+|)${commandName_}`, "i"), "").trim();
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				await command.onStart({ ...parameters, args, commandName, getLang: getText2, removeCommandNameFromBody });
				timestamps[senderID] = dateNow;
			}
			catch (err) {
				// ——— MECHANIC SYSTEM (handleError) ———
				const now = Date.now(); let track = client.errorTracker.get(commandName) || { errors: [], unloaded: false }; if (track.unloaded) return; track.errors.push(now); track.errors = track.errors.filter(ts => now - ts < 60000); if (track.errors.length >= 5) { track.unloaded = true; const commandToUnload = GoatBot.commands.get(commandName); if (commandToUnload) { const commandPath = path.join(__dirname, "../../scripts/cmds", `${commandName}.js`); try { delete require.cache[require.resolve(commandPath)]; GoatBot.commands.delete(commandName); for (const [alias, cmd] of GoatBot.aliases.entries()) { if (cmd === commandName) GoatBot.aliases.delete(alias); } api.sendMessage(`[MECHANIC ALERT] 🔧 The command "${commandName}" has been automatically unloaded due to repeated errors.`, publicSupportGroup); const errorDetail = removeHomeDir(err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : JSON.stringify(err, null, 2)); api.sendMessage(`[MECHANIC DETAIL] 🔧\n- Command: "${commandName}" was unloaded.\n- Reason: Exceeded error threshold (5 errors in 60s).\n- Last Error:\n${errorDetail}`, privateControlGroup); } catch (unloadErr) { api.sendMessage(`[MECHANIC FAIL] ❗ Failed to unload command "${commandName}". Please check console.`, privateControlGroup); console.error(unloadErr); } } } client.errorTracker.set(commandName, track);
				
				log.err("CALL COMMAND", `An error occurred when calling the command ${commandName}`, err);
				sendErrorToAdmin(err, commandName, 'onStart');
				await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
			}
		}

		async function onChat() {
			const allOnChat = GoatBot.onChat || [];
			const args = body ? body.split(/ +/) : [];
			for (const key of allOnChat) {
				const command = GoatBot.commands.get(key); if (!command) continue; const commandName = command.config.name; const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName); const needRole = roleConfig.onChat; if (needRole > role) continue; const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command); const time = getTime("DD/MM/YYYY HH:mm:ss"); createMessageSyntaxError(commandName); if (getType(command.onChat) == "Function") { const defaultOnChat = command.onChat; command.onChat = async function () { return defaultOnChat(...arguments); }; }
				command.onChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
					.then(async (handler) => { 
						if (typeof handler == "function") { 
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return; 
							try { 
								await handler(); 
								log.info("onChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`); 
							} catch (err) { 
								const now = Date.now(); 
								let track = client.errorTracker.get(commandName) || { errors: [], unloaded: false }; 
								if (track.unloaded) return; 
								track.errors.push(now); 
								track.errors = track.errors.filter(ts => now - ts < 60000); 
								if (track.errors.length >= 5) { /* ... unload logic ... */ } 
								client.errorTracker.set(commandName, track); 
								sendErrorToAdmin(err, commandName, 'onChat');
								await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
							} 
						} 
					})
					.catch(err => { 
						log.err("onChat", `An error occurred when calling the command onChat ${commandName}`, err);
						sendErrorToAdmin(err, commandName, 'onChat');
					});
			}
		}

		async function onAnyEvent() {
			const allOnAnyEvent = GoatBot.onAnyEvent || []; let args = []; if (typeof event.body == "string" && event.body.startsWith(prefix)) args = event.body.split(/ +/);
			for (const key of allOnAnyEvent) {
				if (typeof key !== "string") continue; const command = GoatBot.commands.get(key); if (!command) continue; const commandName = command.config.name; const time = getTime("DD/MM/YYYY HH:mm:ss"); createMessageSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command); if (getType(command.onAnyEvent) == "Function") { const defaultOnAnyEvent = command.onAnyEvent; command.onAnyEvent = async function () { return defaultOnAnyEvent(...arguments); }; }
				command.onAnyEvent({ ...parameters, args, commandName, getLang: getText2 })
					.then(async (handler) => { 
						if (typeof handler == "function") { 
							try { 
								await handler(); 
								log.info("onAnyEvent", `${commandName} | ${senderID} | ${userData.name} | ${threadID}`); 
							} catch (err) { 
								sendErrorToAdmin(err, commandName, 'onAnyEvent');
								message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
								log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err); 
							} 
						} 
					})
					.catch(err => { 
						log.err("onAnyEvent", `An error occurred when calling the command onAnyEvent ${commandName}`, err); 
						sendErrorToAdmin(err, commandName, 'onAnyEvent');
					});
			}
		}

		async function onFirstChat() {
			const allOnFirstChat = GoatBot.onFirstChat || []; const args = body ? body.split(/ +/) : [];
			for (const itemOnFirstChat of allOnFirstChat) {
				const { commandName, threadIDsChattedFirstTime } = itemOnFirstChat; if (threadIDsChattedFirstTime.includes(threadID)) continue; const command = GoatBot.commands.get(commandName); if (!command) continue;
				itemOnFirstChat.threadIDsChattedFirstTime.push(threadID); const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command); const time = getTime("DD/MM/YYYY HH:mm:ss"); createMessageSyntaxError(commandName); if (getType(command.onFirstChat) == "Function") { const defaultOnFirstChat = command.onFirstChat; command.onFirstChat = async function () { return defaultOnFirstChat(...arguments); }; }
				command.onFirstChat({ ...parameters, isUserCallCommand, args, commandName, getLang: getText2 })
					.then(async (handler) => { 
						if (typeof handler == "function") { 
							if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return; 
							try { 
								await handler(); 
								log.info("onFirstChat", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`); 
							} catch (err) { 
								sendErrorToAdmin(err, commandName, 'onFirstChat');
								await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN"); 
							} 
						} 
					})
					.catch(err => { 
						log.err("onFirstChat", `An error occurred when calling the command onFirstChat ${commandName}`, err); 
						sendErrorToAdmin(err, commandName, 'onFirstChat');
					});
			}
		}

		async function onReply() {
			if (!event.messageReply) return; const { onReply } = GoatBot; const Reply = onReply.get(event.messageReply.messageID); if (!Reply) return; Reply.delete = () => onReply.delete(messageID);
			const commandName = Reply.commandName; if (!commandName) { message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName")); return log.err("onReply", `Can't find command name to execute this reply!`, Reply); }
			const command = GoatBot.commands.get(commandName); if (!command) { message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName)); return log.err("onReply", `Command "${commandName}" not found`, Reply); }
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName); const needRole = roleConfig.onReply; if (needRole > role) { if (!hideNotiMessage.needRoleToUseCmdOnReply) { if (needRole == 1) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReply", commandName)); else if (needRole == 2) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReply", commandName)); } else { return true; } }
			const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command); const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command) throw new Error(`Cannot find command with commandName: ${commandName}`);
				const args = body ? body.split(/ +/) : [];
				createMessageSyntaxError(commandName);
				if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
				await command.onReply({ ...parameters, Reply, args, commandName, getLang: getText2 });
				log.info("onReply", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${args.join(" ")}`);
			}
			catch (err) {
				// INLINE MECHANIC ERROR HANDLER
				const now = Date.now(); let track = client.errorTracker.get(commandName) || { errors: [], unloaded: false }; if (track.unloaded) return; track.errors.push(now); track.errors = track.errors.filter(ts => now - ts < 60000); if (track.errors.length >= 5) { track.unloaded = true; /* ... unload logic ... */ } client.errorTracker.set(commandName, track);
				log.err("onReply", `An error occurred when calling the command onReply ${commandName}`, err);
				sendErrorToAdmin(err, commandName, 'onReply');
				await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
			}
		}

		async function onReaction() {
			const { onReaction } = GoatBot; const Reaction = onReaction.get(messageID); if (!Reaction) return; Reaction.delete = () => onReaction.delete(messageID);
			const commandName = Reaction.commandName; if (!commandName) { message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommandName")); return log.err("onReaction", `Can't find command name to execute this reaction!`, Reaction); }
			const command = GoatBot.commands.get(commandName); if (!command) { message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "cannotFindCommand", commandName)); return log.err("onReaction", `Command "${commandName}" not found`, Reaction); }
			const roleConfig = getRoleConfig(utils, command, isGroup, threadData, commandName); const needRole = roleConfig.onReaction; if (needRole > role) { if (!hideNotiMessage.needRoleToUseCmdOnReaction) { if (needRole == 1) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminToUseOnReaction", commandName)); else if (needRole == 2) return await message.reply(utils.getText({ lang: langCode, head: "handlerEvents" }, "onlyAdminBot2ToUseOnReaction", commandName)); } else { return true; } }
			const time = getTime("DD/MM/YYYY HH:mm:ss");
			try {
				if (!command) throw new Error(`Cannot find command with commandName: ${commandName}`);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/cmds/${langCode}.js`, prefix, command);
				const args = []; createMessageSyntaxError(commandName); if (isBannedOrOnlyAdmin(userData, threadData, senderID, threadID, isGroup, commandName, message, langCode)) return;
				await command.onReaction({ ...parameters, Reaction, args, commandName, getLang: getText2 });
				log.info("onReaction", `${commandName} | ${userData.name} | ${senderID} | ${threadID} | ${event.reaction}`);
			}
			catch (err) {
				// INLINE MECHANIC ERROR HANDLER
				const now = Date.now(); let track = client.errorTracker.get(commandName) || { errors: [], unloaded: false }; if (track.unloaded) return; track.errors.push(now); track.errors = track.errors.filter(ts => now - ts < 60000); if (track.errors.length >= 5) { track.unloaded = true; /* ... unload logic ... */ } client.errorTracker.set(commandName, track);
				log.err("onReaction", `An error occurred when calling the command onReaction ${commandName}`, err);
				sendErrorToAdmin(err, commandName, 'onReaction');
				await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
			}
		}

		async function handlerEvent() {
			const { author } = event;
			const allEventCommand = GoatBot.eventCommands.entries();
			for (const [key] of allEventCommand) {
				const getEvent = GoatBot.eventCommands.get(key); if (!getEvent) continue; const commandName = getEvent.config.name; const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, getEvent);
				const time = getTime("DD/MM/YYYY HH:mm:ss"); 
				try { 
					const handler = await getEvent.onStart({ ...parameters, commandName, getLang: getText2 }); 
					if (typeof handler == "function") { 
						await handler(); 
						log.info("EVENT COMMAND", `Event: ${commandName} | ${author} | ${userData.name} | ${threadID}`); 
					} 
				} catch (err) { 
					log.err("EVENT COMMAND", `An error occurred when calling the command event ${commandName}`, err); 
					sendErrorToAdmin(err, commandName, 'handlerEvent');
					await message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN");
				}
			}
		}

		async function onEvent() {
			const allOnEvent = GoatBot.onEvent || []; const args = []; const { author } = event;
			for (const key of allOnEvent) {
				if (typeof key !== "string") continue; const command = GoatBot.commands.get(key); if (!command) continue; const commandName = command.config.name;
				const time = getTime("DD/MM/YYYY HH:mm:ss"); createMessageSyntaxError(commandName);
				const getText2 = createGetText2(langCode, `${process.cwd()}/languages/events/${langCode}.js`, prefix, command);
				if (getType(command.onEvent) == "Function") { const defaultOnEvent = command.onEvent; command.onEvent = async function () { return defaultOnEvent(...arguments); }; }
				command.onEvent({ ...parameters, args, commandName, getLang: getText2 })
					.then(async (handler) => { 
						if (typeof handler == "function") { 
							try { 
								await handler(); 
								log.info("onEvent", `${commandName} | ${author} | ${userData.name} | ${threadID}`); 
							} catch (err) { 
								const now = Date.now(); let track = client.errorTracker.get(commandName) || { errors: [], unloaded: false }; if (track.unloaded) return; track.errors.push(now); track.errors = track.errors.filter(ts => now - ts < 60000); if (track.errors.length >= 5) { /* ... unload logic ... */ } client.errorTracker.set(commandName, track); 
								sendErrorToAdmin(err, commandName, 'onEvent');
								message.reply("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN"); 
								log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err); 
							} 
						} 
					})
					.catch(err => { 
						log.err("onEvent", `An error occurred when calling the command onEvent ${commandName}`, err);
						sendErrorToAdmin(err, commandName, 'onEvent');
					});
			}
		}

		async function presence() {}
		async function read_receipt() {}
		async function typ() {}

		return {
			onAnyEvent,
			onFirstChat,
			onChat,
			onStart,
			onReaction,
			onReply,
			onEvent,
			handlerEvent,
			presence,
			read_receipt,
			typ
		};
	};
};