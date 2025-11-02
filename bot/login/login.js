process.stdout.write("\x1b]2;🦊 Fox 🦊\x1b\x5c");
const defaultRequire = require;

const gradient = defaultRequire("gradient-string");
const axios = defaultRequire("axios");
const path = defaultRequire("path");
const fs = defaultRequire("fs-extra");
const login = defaultRequire(`${process.cwd()}/.homohost/index.js`);
const https = defaultRequire("https");

function compareVersion(version1, version2) {
	const v1 = version1.split(".");
	const v2 = version2.split(".");
	for (let i = 0; i < 3; i++) {
		if (parseInt(v1[i]) > parseInt(v2[i]))
			return 1; // version1 > version2
		if (parseInt(v1[i]) < parseInt(v2[i]))
			return -1; // version1 < version2
	}
	return 0; // version1 = version2
}

const { writeFileSync, readFileSync, existsSync, watch } = require("fs-extra");
const handlerWhenListenHasError = require("./handlerWhenListenHasError.js");
const check_live_appstate = require("./check_live_appstate.js");
const { callbackListenTime, storage5Message } = global.GoatBot;
const { log, logColor, getPrefix, createOraDots, jsonStringifyColor, getText, convertTime, colors, randomString } = global.utils;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const currentVersion = require(`${process.cwd()}/package.json`).version;

function centerText(text, length) {
	const width = process.stdout.columns;
	const leftPadding = Math.floor((width - (length || text.length)) / 2);
	const rightPadding = width - leftPadding - (length || text.length);
	// Build the padded string using the calculated padding values
	const paddedString = ' '.repeat(leftPadding > 0 ? leftPadding : 0) + text + ' '.repeat(rightPadding > 0 ? rightPadding : 0);
	// Print the padded string to the terminal
	console.log(paddedString);
}

// logo
const titles = [
	[
	"Alu is Gay"
	],
	[
		"ok",
		"ok"
	],
	[
		"Fox" + currentVersion
	],
	[
		"GoatBot V2"
	]
];
const maxWidth = 40;
const title = maxWidth > 58 ?
	titles[0] :
	maxWidth > 36 ?
		titles[1] :
		maxWidth > 26 ?
			titles[2] :
			titles[3];

console.log(gradient("#f5af19", "#f12711")(createLine(null, true)));
console.log();
for (const text of title) {
	const textColor = gradient("#FA8BFF", "#2BD2FF", "#2BFF88")(text);
	centerText(textColor, text.length);
}
let subTitle = `GoatBot V2@${currentVersion}- A simple Bot chat messenger use personal account`;
const subTitleArray = [];
if (subTitle.length > maxWidth) {
	while (subTitle.length > maxWidth) {
		let lastSpace = subTitle.slice(0, maxWidth).lastIndexOf(' ');
		lastSpace = lastSpace == -1 ? maxWidth : lastSpace;
		subTitleArray.push(subTitle.slice(0, lastSpace).trim());
		subTitle = subTitle.slice(lastSpace).trim();
	}
	subTitle ? subTitleArray.push(subTitle) : '';
}
else {
	subTitleArray.push(subTitle);
}
const author = ("Created by Allou Mohamed with ♡");
const srcUrl = ("Contact: https://facebook.com/proarcoder");
const fakeRelease = ("Source Code By Ntkhang03 improved By Allou Mohamed");
for (const t of subTitleArray) {
	const textColor2 = gradient("#9F98E8", "#AFF6CF")(t);
	centerText(textColor2, t.length);
}
centerText(gradient("#9F98E8", "#AFF6CF")(author), author.length);
centerText(gradient("#9F98E8", "#AFF6CF")(srcUrl), srcUrl.length);
centerText(gradient("#f5af19", "#f12711")(fakeRelease), fakeRelease.length);

let widthConsole = process.stdout.columns;
if (widthConsole > 50)
	widthConsole = 50;

function createLine(content, isMaxWidth = false) {
	if (!content)
		return Array(isMaxWidth ? process.stdout.columns : widthConsole).fill("─").join("");
	else {
		content = ` ${content.trim()} `;
		const lengthContent = content.length;
		const lengthLine = isMaxWidth ? process.stdout.columns - lengthContent : widthConsole - lengthContent;
		let left = Math.floor(lengthLine / 2);
		if (left < 0 || isNaN(left))
			left = 0;
		const lineOne = Array(left).fill("─").join("");
		return lineOne + content + lineOne;
	}
}
const character = createLine();
const clearLines = (n) => {
	for (let i = 0; i < n; i++) {
		const y = i === 0 ? null : -1;
		process.stdout.moveCursor(0, y);
		process.stdout.clearLine(1);
	}
	process.stdout.cursorTo(0);
	process.stdout.write('');
};
const { dirAccount } = global.client;
function responseUptimeSuccess(req, res) {
	res.type('json').send({
		status: "success",
		uptime: process.uptime(),
		unit: "seconds"
	});
}

function responseUptimeError(req, res) {
	res.status(500).type('json').send({
		status: "error",
		uptime: process.uptime(),
		statusAccountBot: global.statusAccountBot
	});
}

function checkAndTrimString(string) {
	if (typeof string == "string")
		return string.trim();
	return string;
}

function filterKeysAppState(appState) {
	return appState.filter(item => ["c_user", "xs", "datr", "fr", "sb", "i_user"].includes(item.key));
}

global.responseUptimeCurrent = responseUptimeSuccess;
global.responseUptimeSuccess = responseUptimeSuccess;
global.responseUptimeError = responseUptimeError;

global.statusAccountBot = 'good';
let changeFbStateByCode = false;
let latestChangeContentAccount = fs.statSync(dirAccount).mtimeMs;
let dashBoardIsRunning = false;

function isNetScapeCookie(cookie) {
	if (typeof cookie !== 'string')
		return false;
	return /(.+)\t(1|TRUE|true)\t([\w\/.-]*)\t(1|TRUE|true)\t\d+\t([\w-]+)\t(.+)/i.test(cookie);
}

function netScapeToCookies(cookieData) {
	const cookies = [];
	const lines = cookieData.split('\n');
	lines.forEach((line) => {
		if (line.trim().startsWith('#')) {
			return;
		}
		const fields = line.split('\t').map((field) => field.trim()).filter((field) => field.length > 0);
		if (fields.length < 7) {
			return;
		}
		const cookie = {
			key: fields[5],
			value: fields[6],
			domain: fields[0],
			path: fields[2],
			hostOnly: fields[1] === 'TRUE',
			creation: new Date(fields[4] * 1000).toISOString(),
			lastAccessed: new Date().toISOString()
		};
		cookies.push(cookie);
	});
	return cookies;
}

let spin;
async function getAppStateToLogin() {
	let appState = [];
	if (!existsSync(dirAccount))
		return log.error("LOGIN FACEBOOK", getText('login', 'notFoundDirAccount', colors.green(dirAccount)));
	const accountText = readFileSync(dirAccount, "utf8");

	try {
		const splitAccountText = accountText.replace(/\|/g, '\n').split('\n').map(i => i.trim()).filter(i => i); 
		// is cookie string
			if (accountText.match(/^(?:\s*\w+\s*=\s*[^;]*;?)+/)) {
				spin = createOraDots(getText('login', 'loginCookieString'));
				spin._start();
				appState = accountText.split(';')
					.map(i => {
						const [key, value] = i.split('=');
						return {
							key: (key || "").trim(),
							value: (value || "").trim(),
							domain: "facebook.com",
							path: "/",
							hostOnly: true,
							creation: new Date().toISOString(),
							lastAccessed: new Date().toISOString()
						};
					})
					.filter(i => i.key && i.value && i.key != "x-referer");
			}
			// is netscape cookie
			else if (isNetScapeCookie(accountText)) {
				spin = createOraDots(getText('login', 'loginCookieNetscape'));
				spin._start();
				appState = netScapeToCookies(accountText);
			}
			else if (
				(splitAccountText.length == 2 || splitAccountText.length == 3) &&
				!splitAccountText.slice(0, 2).map(i => i.trim()).some(i => i.includes(' '))
			) {
				//useless '-'
			}
			// is json (cookies or appstate)
			else {
				try {
					spin = createOraDots(getText('login', 'loginCookieArray'));
					spin._start();
					appState = JSON.parse(accountText);
				}
				catch (err) {
					const error = new Error(`${path.basename(dirAccount)} is invalid`);
					error.name = "ACCOUNT_ERROR";
					throw error;
				}
				if (appState.some(i => i.name))
					appState = appState.map(i => {
						i.key = i.name;
						delete i.name;
						return i;
					});
				else if (!appState.some(i => i.key)) {
					const error = new Error(`${path.basename(dirAccount)} is invalid`);
					error.name = "ACCOUNT_ERROR";
					throw error;
				}
				appState = appState
					.map(item => ({
						...item,
						domain: "facebook.com",
						path: "/",
						hostOnly: false,
						creation: new Date().toISOString(),
						lastAccessed: new Date().toISOString()
					}))
					.filter(i => i.key && i.value && i.key != "x-referer");
			}
		spin && spin._stop();
			const isLiveAppstate = await check_live_appstate(appState);
			if (!isLiveAppstate.success) {
    			const err = new Error(isLiveAppstate.error);
    			err.name = "COOKIE_INVALID";
    			throw err;
			}
	}
	catch (err) {
		spin && spin._stop();
	    if (err.name === "COOKIE_INVALID")
		log.err("LOGIN FACEBOOK", getText('login', 'cookieError'), err);
		process.exit();
	}
	return appState;
}

function stopListening(keyListen) {
	keyListen = keyListen || Object.keys(callbackListenTime).pop();
	return new Promise((resolve) => {
		global.GoatBot.fcaApi.stopListening?.(() => {
			if (callbackListenTime[keyListen]) {
	        	callbackListenTime[keyListen] = () => { };
			}
			resolve();
		}) || resolve();
	});
}

async function startBot() {
	console.log(colors.hex("#f5ab00")(createLine("START LOGGING IN", true)));
	const currentVersion = require("../../package.json").version;
	const tooOldVersion = (await axios.get("https://raw.githubusercontent.com/ntkhang03/Goat-Bot-V2-Storage/main/tooOldVersions.txt")).data || "0.0.0";
	
	if ([-1, 0].includes(compareVersion(currentVersion, tooOldVersion))) {
		log.err("VERSION", getText('version', 'tooOldVersion', colors.yellowBright('node update')));
		process.exit();
	}

	if (global.GoatBot.Listening)
		await stopListening();

	log.info("LOGIN FACEBOOK", getText('login', 'currentlyLogged'));

	let appState = await getAppStateToLogin();
	changeFbStateByCode = true;
	appState = filterKeysAppState(appState);
	writeFileSync(dirAccount, JSON.stringify(appState, null, 2));
	setTimeout(() => changeFbStateByCode = false, 1000);
	// ——————————————————— LOGIN ———————————————————— //
	(function loginBot(appState) {
		global.GoatBot.commands = new Map();
		global.GoatBot.eventCommands = new Map();
		global.GoatBot.aliases = new Map();
		global.GoatBot.onChat = [];
		global.GoatBot.onEvent = [];
		global.GoatBot.onReply = new Map();
		global.GoatBot.onReaction = new Map();
		clearInterval(global.intervalRestartListenMqtt);
		delete global.intervalRestartListenMqtt;
		let isSendNotiErrorMessage = false;
		login({ appState }, global.GoatBot.config.optionsFca, async function (error, api) {
			 // Handle error
			if (error) {
				log.err("LOGIN FACEBOOK", getText('login', 'loginError'), error);
				global.statusAccountBot = 'can\'t login';
                                process.exit();
			}

			global.GoatBot.fcaApi = api;
			global.GoatBot.botID = api.getCurrentUserID();
			log.info("LOGIN FACEBOOK", getText('login', 'loginSuccess'));
			let hasBanned = false;
			global.botID = api.getCurrentUserID();
			logColor("#f5ab00", createLine("BOT INFO"));
			log.info("NODE VERSION", process.version);
			log.info("PROJECT VERSION", currentVersion);
			log.info("BOT ID", `${global.botID} - GoatBot`);
			log.info("PREFIX", global.GoatBot.config.prefix);
			log.info("LANGUAGE", global.GoatBot.config.language);
			log.info("BOT NICK NAME", global.GoatBot.config.nickNameBot || "Yuki BOT");
			// ———————————————————— GBAN ————————————————————— //
			
                                          //add your code '-'
            
			// ——————————————————— LOAD DATA ——————————————————— //
			const { threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, sequelize } = await require(process.env.NODE_ENV === 'development' ? "./loadData.dev.js" : "./loadData.js")(api, createLine);
			// ————————————————— CUSTOM SCRIPTS ————————————————— //
			await require("../custom.js")({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getText });
			// —————————————————— LOAD SCRIPTS —————————————————— //
			await require(process.env.NODE_ENV === 'development' ? "./loadScripts.dev.js" : "./loadScripts.js")(api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, createLine);
			// ———————————— CHECK AUTO LOAD SCRIPTS ———————————— //
			if (global.GoatBot.config.autoLoadScripts?.enable == true) {
				const ignoreCmds = global.GoatBot.config.autoLoadScripts.ignoreCmds?.replace(/[ ,]+/g, ' ').trim().split(' ') || [];
				const ignoreEvents = global.GoatBot.config.autoLoadScripts.ignoreEvents?.replace(/[ ,]+/g, ' ').trim().split(' ') || [];

				watch(`${process.cwd()}/scripts/cmds`, async (event, filename) => {
					if (filename.endsWith('.js')) {
						if (ignoreCmds.includes(filename) || filename.endsWith('.eg.js'))
							return;
						if ((event == 'change' || event == 'rename') && existsSync(`${process.cwd()}/scripts/cmds/${filename}`)) {
							try {
								const contentCommand = global.temp.contentScripts.cmds[filename] || "";
								const currentContent = readFileSync(`${process.cwd()}/scripts/cmds/${filename}`, 'utf-8');
								if (contentCommand == currentContent)
									return;
								global.temp.contentScripts.cmds[filename] = currentContent;
								filename = filename.replace('.js', '');

								const infoLoad = global.utils.loadScripts("cmds", filename, log, global.GoatBot.configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData);
								if (infoLoad.status == "success")
									log.master("AUTO LOAD SCRIPTS", `Command ${filename}.js (${infoLoad.command.config.name}) has been reloaded`);
								else
									log.err("AUTO LOAD SCRIPTS", `Error when reload command ${filename}.js`, infoLoad.error);
							}
							catch (err) {
								log.err("AUTO LOAD SCRIPTS", `Error when reload command ${filename}.js`, err);
							}
						}
					}
				});

				watch(`${process.cwd()}/scripts/events`, async (event, filename) => {
					if (filename.endsWith('.js')) {
						if (ignoreEvents.includes(filename) || filename.endsWith('.eg.js'))
							return;
						if ((event == 'change' || event == 'rename') && existsSync(`${process.cwd()}/scripts/events/${filename}`)) {
							try {
								const contentEvent = global.temp.contentScripts.events[filename] || "";
								const currentContent = readFileSync(`${process.cwd()}/scripts/events/${filename}`, 'utf-8');
								if (contentEvent == currentContent)
									return;
								global.temp.contentScripts.events[filename] = currentContent;
								filename = filename.replace('.js', '');

								const infoLoad = global.utils.loadScripts("events", filename, log, global.GoatBot.configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData);
								if (infoLoad.status == "success")
									log.master("AUTO LOAD SCRIPTS", `Event ${filename}.js (${infoLoad.command.config.name}) has been reloaded`);
								else
									log.err("AUTO LOAD SCRIPTS", `Error when reload event ${filename}.js`, infoLoad.error);
							}
							catch (err) {
								log.err("AUTO LOAD SCRIPTS", `Error when reload event ${filename}.js`, err);
							}
						}
					}
				});
			}
			// ——————————————————— DASHBOARD ——————————————————— //
			if (global.GoatBot.config.dashBoard?.enable == true && dashBoardIsRunning == false) {
				logColor('#f5ab00', createLine('DASHBOARD'));
				try {
					await require("../../dashboard/app.js")(api);
					log.info("DASHBOARD", getText('login', 'openDashboardSuccess'));
					dashBoardIsRunning = true;
				}
				catch (err) {
					log.err("DASHBOARD", getText('login', 'openDashboardError'), err);
				}
			}
			// ———————————————————— ADMIN BOT ———————————————————— //
			logColor('#f5ab00', character);
			let i = 0;
			const adminBot = global.GoatBot.config.adminBot
				.filter(item => !isNaN(item))
				.map(item => item = item.toString());
			for (const uid of adminBot) {
				try {
					const userName = await usersData.getName(uid);
					log.master("ADMINBOT", `[${++i}] ${uid} | ${userName}`);
				}
				catch (e) {
					log.master("ADMINBOT", `[${++i}] ${uid}`);
				}
			}
			log.master("NOTIFICATION", ("Respect khang bro (:" || "").trim());
			log.master("SUCCESS", getText('login', 'runBot'));
			log.master("LOAD TIME", `${convertTime(Date.now() - global.GoatBot.startTime)}`);
			logColor("#f5ab00", createLine("COPYRIGHT"));
			// —————————————————— COPYRIGHT INFO —————————————————— //
			console.log(`\x1b[1m\x1b[33m${("COPYRIGHT:")}\x1b[0m\x1b[1m\x1b[37m \x1b[0m\x1b[1m\x1b[36m${("Project GoatBot based on goat bot v2 created by ntkhang03 (https://github.com/ntkhang03) <3")}\x1b[0m`);
			logColor("#f5ab00", character);
			global.GoatBot.config.adminBot = adminBot;
			writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
			writeFileSync(global.client.dirConfigCommands, JSON.stringify(global.GoatBot.configCommands, null, 2));

			// ——————————————————————————————————————————————————— //
			const { restartListenMqtt } = global.GoatBot.config;
			let intervalCheckLiveCookieAndRelogin = false;
			// —————————————————— CALLBACK LISTEN —————————————————— //
			async function callBackListen(error, event) {
					global.responseUptimeCurrent = responseUptimeError;
				if (error) {
		        // ------------------ IF FB SCRAP NOTIFICATION ---------//
		                const { status } = await check_live_appstate(appState, true);
		                if (status) {
    		                // Bypass function for scraping warning
  		                  async function bypass_fb_scrap_warn_mutation() {
    		                    const form = {
       		                     av: api.getCurrentUserID(),
    		                        fb_api_caller_class: "RelayModern",
   		                         fb_api_req_friendly_name: "FBScrapingWarningMutation",
    		                        variables: "{}",
     		                       server_timestamps: "true",
     		                       doc_id: "6339492849481770",
   		                     };

  		                      return new Promise((resolve, reject) => {
  		                          api.httpPost("https://www.facebook.com/api/graphql/", form, (e, i) => {
      		                          if (e) return reject(new Error("HTTP error"));
    		                            const res = JSON.parse(i);
        		                        if (res.errors) return reject(new Error("API error"));
      		                          if (res.data.fb_scraping_warning_clear.success) {
    		                                resolve(true);
    		                            } else {
    		                                reject(new Error("Failed to bypass scraping warning"));
   		                             }
   		                         });
 		                       });
 		                   }

 		                   const r = await bypass_fb_scrap_warn_mutation();
		                    if (!r) return log.err("FB SCRAP", "Can't bypass FB scraping warning noti.");

 		                   // Restart listener after bypass
 		                   async function restart_listen_after_bypass() {
 		                       try {
   		                         await stopListening();
     		                       await sleep(1000);
      		                      global.GoatBot.Listening = api.listenMqtt(createCallBackListen());
  		                          log.info("LISTEN_MQTT", getText('login', 'restartListenMessage2'));
      		                  } catch (e) {
		                            log.err("LISTEN_MQTT", getText('login', 'restartListenMessageError'), e);
  		                      }
		                    }

		                    await restart_listen_after_bypass();
		                }
		              	else if (
						error.error == "Not logged in" ||
						error.error == "Not logged in." ||
						error.error == "Connection refused: Server unavailable"
					) {
						log.err("NOT LOGGEG IN", getText('login', 'notLoggedIn'), error);
						global.responseUptimeCurrent = responseUptimeError;
						global.statusAccountBot = 'can\'t login';
						if (!isSendNotiErrorMessage) {
							await handlerWhenListenHasError({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, error });
							isSendNotiErrorMessage = true;
						}

						if (global.GoatBot.config.autoRestartWhenListenMqttError)
							process.exit(2);
						else {
							const keyListen = Object.keys(callbackListenTime).pop();
							if (callbackListenTime[keyListen])
								callbackListenTime[keyListen] = () => { };
							const cookieString = appState.map(i => i.key + "=" + i.value).join("; ");
							let times = 5;

							const spin = createOraDots(getText('login', 'retryCheckLiveCookie', times));
							const countTimes = setInterval(() => {
								times--;
								if (times == 0)
									times = 5;
								spin.text = getText('login', 'retryCheckLiveCookie', times);
							}, 1000);
						}
						return;
					}
					else if (error == "Connection closed." || error == "Connection closed by user.") /* by stopListening; */ {
						return;
					}
					else {
						await handlerWhenListenHasError({ api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, error });
						return log.err("LISTEN_MQTT", getText('login', 'callBackError'), error);
					}
				}
				global.responseUptimeCurrent = responseUptimeSuccess;
				global.statusAccountBot = 'good';
				const configLog = global.GoatBot.config.logEvents;
				if (isSendNotiErrorMessage == true)
					isSendNotiErrorMessage = false;
					if (
					global.GoatBot.config.whiteListMode?.enable == true
					&& global.GoatBot.config.whiteListModeThread?.enable == true
					// admin
					&& !global.GoatBot.config.adminBot.includes(event.senderID)
				) {
					if (
						!global.GoatBot.config.whiteListMode.whiteListIds.includes(event.senderID)
						&& !global.GoatBot.config.whiteListModeThread.whiteListThreadIds.includes(event.threadID)
						// admin
						&& !global.GoatBot.config.adminBot.includes(event.senderID)
					)
						return;
				}
				else if (
					global.GoatBot.config.whiteListMode?.enable == true
					&& !global.GoatBot.config.whiteListMode.whiteListIds.includes(event.senderID)
					// admin
					&& !global.GoatBot.config.adminBot.includes(event.senderID)
				)
					return;
				else if (
					global.GoatBot.config.whiteListModeThread?.enable == true
					&& !global.GoatBot.config.whiteListModeThread.whiteListThreadIds.includes(event.threadID)
					// admin
					&& !global.GoatBot.config.adminBot.includes(event.senderID)
				)
					return;

				// check if listenMqtt loop
				if (event.messageID && event.type == "message") {
					if (storage5Message.includes(event.messageID))
						Object.keys(callbackListenTime).slice(0, -1).forEach(key => {
							callbackListenTime[key] = () => { };
						});
					else
						storage5Message.push(event.messageID);
					if (storage5Message.length > 5)
						storage5Message.shift();
				}

				if (configLog.disableAll === false && configLog[event.type] !== false) {
					const participantIDs_ = [...event.participantIDs || []];
					if (event.participantIDs)
						event.participantIDs = 'Array(' + event.participantIDs.length + ')';

					console.log(colors.green((event.type || "").toUpperCase() + ":"), jsonStringifyColor(event, null, 2));

					if (event.participantIDs)
						event.participantIDs = participantIDs_;
				}

				const handlerAction = require("../handler/handlerAction.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

				//add gban here also
					handlerAction(event);
			}
			// ————————————————— CREATE CALLBACK ————————————————— //
			function createCallBackListen(key) {
				key = randomString(10) + (key || Date.now());
				callbackListenTime[key] = callBackListen;
				return function (error, event) {
					callbackListenTime[key](error, event);
				};
			}
			// ———————————————————— START BOT ———————————————————— //
			await stopListening();
			global.GoatBot.Listening = api.listenMqtt(createCallBackListen());
			global.GoatBot.callBackListen = callBackListen;
			// ——————————————————— UPTIME ——————————————————— //
			if (global.GoatBot.config.serverUptime.enable == true && !global.GoatBot.config.dashBoard?.enable && !global.serverUptimeRunning) {
				const http = require('http');
				const express = require('express');
				const app = express();
				const server = http.createServer(app);
				const { data: html } = await axios.get("https://raw.githubusercontent.com/ntkhang03/resources-Goat-bot/master/homepage/home.html");
				const PORT = global.GoatBot.config.dashBoard?.port || (!isNaN(global.GoatBot.config.serverUptime.port) && global.GoatBot.config.serverUptime.port) || 3001;
				app.get('/', (req, res) => res.send(html));
				app.get('/uptime', global.responseUptimeCurrent);
				let nameUpTime;
				try {
					nameUpTime = `https://${process.env.REPL_OWNER ?
						`${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` :
						process.env.API_SERVER_EXTERNAL == "https://api.glitch.com" ?
							`${process.env.PROJECT_DOMAIN}.glitch.me` :
							`localhost:${PORT}`}`;
					nameUpTime.includes('localhost') && (nameUpTime = nameUpTime.replace('https', 'http'));
					await server.listen(PORT);
					log.info("UPTIME", getText('login', 'openServerUptimeSuccess', nameUpTime));
					if (global.GoatBot.config.serverUptime.socket?.enable == true)
						require('./socketIO.js')(server);
					global.serverUptimeRunning = true;
				}
				catch (err) {
					log.err("UPTIME", getText('login', 'openServerUptimeError'), err);
				}
			}


			// ———————————————————— RESTART LISTEN ———————————————————— //
			if (restartListenMqtt.enable == true) {
				if (restartListenMqtt.logNoti == true) {
					log.info("LISTEN_MQTT", getText('login', 'restartListenMessage', convertTime(restartListenMqtt.timeRestart, true)));
					log.info("BOT_STARTED", getText('login', 'startBotSuccess'));

					logColor("#f5ab00", character);
				}
				const restart = setInterval(async function () {
					if (restartListenMqtt.enable == false) {
						clearInterval(restart);
						return log.warn("LISTEN_MQTT", getText('login', 'stopRestartListenMessage'));
					}
					try {
						await stopListening();
						await sleep(1000);
						global.GoatBot.Listening = api.listenMqtt(createCallBackListen());
						log.info("LISTEN_MQTT", getText('login', 'restartListenMessage2'));
					}
					catch (e) {
						log.err("LISTEN_MQTT", getText('login', 'restartListenMessageError'), e);
					}
				}, restartListenMqtt.timeRestart);
				global.intervalRestartListenMqtt = restart;
			}
			require('../autoUptime.js');
		});
	})(appState);

	if (global.GoatBot.config.autoReloginWhenChangeAccount) {
		setTimeout(function () {
			watch(dirAccount, async (type) => {
				if (type == 'change' && changeFbStateByCode == false && latestChangeContentAccount != fs.statSync(dirAccount).mtimeMs) {
					clearInterval(global.intervalRestartListenMqtt);
					global.compulsoryStopLisening = true;
				  latestChangeContentAccount = fs.statSync(dirAccount).mtimeMs;
					startBot();
				}
			});
		}, 10000);
	}
}

global.GoatBot.reLoginBot = startBot;
startBot();
