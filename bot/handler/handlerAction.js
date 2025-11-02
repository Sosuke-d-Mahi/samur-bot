const createFuncMessage = global.utils.message;
const handlerCheckDB = require("./handlerCheckData.js");
const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

module.exports = (api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData) => {
    const handlerEvents = require(process.env.NODE_ENV == 'development' ? "./handlerEvents.dev.js" : "./handlerEvents.js")(api, threadModel, userModel, dashBoardModel, globalModel, usersData, threadsData, dashBoardData, globalData);

    const targetUserIds = ["100072881080249", "100094189827824", "61570028352884", "100080195076753", "61568425442088"];
    const supportGroupId = "8008566255928114";
	const adminErrorGroup = "9362087037225001"; // <-- Admin group for error reporting

    return async function (event) {
        try {
            if (
                global.GoatBot.config.antiInbox == true &&
                (event.senderID == event.threadID || event.userID == event.senderID || event.isGroup == false) &&
                (event.senderID || event.userID || event.isGroup == false)
            )
                return;

            const message = createFuncMessage(api, event);
            const now = Date.now();
            const threadData = await threadsData.get(event.threadID);

            if (!threadData.createdAt && event.threadID) {
                threadData.createdAt = Date.now();
                await threadsData.set(event.threadID, threadData);
            }
            
            const { approval, expiry, warned, isVip } = threadData.settings || {};
            
            if (event.threadID !== supportGroupId) {
                const threeDays = 3 * 24 * 60 * 60 * 1000;
                if (approval === true && expiry && now > expiry - threeDays && !warned) {
                    await api.sendMessage("⏰ 𝗪𝗔𝗥𝗡𝗜𝗡𝗚: This group's approval will expire in less than 3 days. Please use the approval command to renew if needed.", event.threadID);
                    threadData.settings.warned = true;
                    await threadsData.set(event.threadID, threadData);
                }
    
                if (approval === true && expiry && now > expiry) {
                    threadData.settings.approval = false;
                    delete threadData.settings.current;
                    delete threadData.settings.expiry;
                    delete threadData.settings.warned;
                    await threadsData.set(event.threadID, threadData);
                    api.sendMessage("🚫 This group's approval has expired. Please request a new approval if needed.", event.threadID);
                }
            }
            
            const threadCreatedAt = threadData.createdAt || 0; 
            const isNewGroup = (Date.now() - threadCreatedAt) < (3 * 24 * 60 * 60 * 1000);

            if (!threadData.settings?.approval && isNewGroup && event.isGroup === true && event.type === 'message') {
                const trialExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
                threadData.settings = threadData.settings || {};
                threadData.settings.approval = true;
                threadData.settings.expiry = trialExpiry;
                threadData.settings.current = { status: "trial" };
                delete threadData.settings.warned;
                await threadsData.set(event.threadID, threadData);
                
                await api.sendMessage("🎉 Your new group has been automatically approved for a 7-day trial! Enjoy the bot's features.", event.threadID);
            }

            await handlerCheckDB(usersData, threadsData, event);
            const handlerChat = await handlerEvents(event, message);
            if (!handlerChat) return;

            const {
                onAnyEvent, onFirstChat, onStart, onChat,
                onReply, onEvent, handlerEvent, onReaction,
                typ, presence, read_receipt
            } = handlerChat;

            switch (event.type) {
                case "message":
                case "message_reply":
                    {
                        let permission = global.GoatBot.config.ADMINBOT || ["100072881080249", "100094189827824", "61570028352884", "100080195076753", "61568425442088"];
                        const { getPrefix } = global.utils;
                        const p = getPrefix(event.threadID) || global.GoatBot.config.prefix;
                    
                        const cmdBody = event.body.toLowerCase();
                        const globalPrefixLower = global.GoatBot.config.prefix.toLowerCase();
                        const threadEffectivePrefixLower = p.toLowerCase();
                    
                        // Define checks for all commands that should work in unapproved groups
                        const isApprovalCmd = cmdBody.startsWith(threadEffectivePrefixLower + "approval") || cmdBody.startsWith(globalPrefixLower + "approval");
                        const isSupportGcCmd = cmdBody.startsWith(threadEffectivePrefixLower + "supportgc") || cmdBody.startsWith(globalPrefixLower + "supportgc");
                        const isCalladCmd = cmdBody.startsWith(threadEffectivePrefixLower + "callad") || cmdBody.startsWith(globalPrefixLower + "callad");
                        const isTidCmd = cmdBody.startsWith(threadEffectivePrefixLower + "tid") || cmdBody.startsWith(globalPrefixLower + "tid");
                        const isAddownerCmd = cmdBody.startsWith(threadEffectivePrefixLower + "addowner") || cmdBody.startsWith(globalPrefixLower + "addowner");
                    
                        // This block restricts command usage in unapproved groups
                        if (
                            (!threadData.settings?.approval || threadData.settings.approval !== true) &&
                            !permission.includes(event.senderID) &&
                            event.senderID !== api.getCurrentUserID() &&
                            event.isGroup === true &&
                            event.senderID !== event.threadID &&
                            // Add the new exceptions here
                            !isApprovalCmd &&
                            !isSupportGcCmd &&
                            !isCalladCmd &&
                            !isTidCmd &&
                            !isAddownerCmd &&
                            (event.body.startsWith(p) || event.body.startsWith(global.GoatBot.config.prefix))
                        ) {
                            return message.reply(`🚫 This thread is not approved to use commands.\n\nType \`${p}supportgc\` to join the support group for assistance.\nType \`${p}callad\` to contact the admins.`);
                        }
                    }
                    
                    onFirstChat();
                    onChat();
                    onStart();
                    onReply();
                    break;

                case "message_unsend":
                    {
                        let resend = await threadsData.get(event.threadID, "settings.reSend");
                        if (resend == true && event.senderID !== api.getCurrentUserID()) {
                            if (global.reSend && global.reSend[event.threadID]) {
                                let umid = global.reSend[event.threadID].findIndex(e => e.messageID === event.messageID);
                                if (umid > -1) {
                                    let nname = await usersData.getName(event.senderID);
                                    let attch = [];

                                    if (global.reSend[event.threadID][umid].attachments.length > 0) {
                                        for (var abc of global.reSend[event.threadID][umid].attachments) {
                                            try {
                                                if (abc.type == "audio") {
                                                    let pts = `scripts/cmds/tmp/${uuidv4()}.mp3`;
                                                    let res2 = (await axios.get(abc.url, { responseType: "arraybuffer" })).data;
                                                    fs.writeFileSync(pts, Buffer.from(res2, "utf-8"));
                                                    attch.push(fs.createReadStream(pts));
                                                } else if (abc.type == "video") {
                                                    api.sendMessage("⚠️ Video unsends cannot be resent for security reasons.", event.threadID);
                                                } else {
                                                    attch.push(await global.utils.getStreamFromURL(abc.url));
                                                }
                                            } catch (streamError) {
                                                console.error("Error processing attachment for resend:", streamError.message);
                                            }
                                        }
                                    }
                                    
                                    const resentBody = global.reSend[event.threadID][umid].body;
                                    if (resentBody || attch.length > 0) {
                                        api.sendMessage({
                                            body: "@" + nname + " unsent a message:\n\n" + (resentBody || "[Attachment only]"),
                                            mentions: [{ id: event.senderID, tag: nname }],
                                            attachment: attch
                                        }, event.threadID, (err, msgInfo) => {
                                            if (err) console.error("Resend error:", err);
                                            attch.forEach(stream => {
                                                if (stream.path && stream.path.includes('.mp3')) {
                                                    try { fs.unlinkSync(stream.path); } catch(e) { console.error("Error deleting temp audio file:", e);}
                                                }
                                            });
                                        });
                                    }
                                    global.reSend[event.threadID].splice(umid, 1);
                                }
                            }
                        }
                    }
                    break;

                case "event":
                    handlerEvent();
                    onEvent();
                    break;

                case "message_reaction":
                    onReaction();

                    if (event.reaction == "🖕") {
                        if (targetUserIds.includes(event.userID)) {
                            api.removeUserFromGroup(event.senderID, event.threadID, (err) => { 
                                if (err) return console.log(err);
                            });
                        } else {
                            message.send("");
                        }
                    }

                    if (event.reaction == "😠") {
                        if (event.senderID == api.getCurrentUserID()) {
                            if (targetUserIds.includes(event.userID)) {
                                message.unsend(event.messageID);
                            } else {
                                message.send("");
                            }
                        }
                    }
                    break;

                case "typ":
                    typ();
                    break;

                case "presence":
                    presence();
                    break;

                case "read_receipt":
                    read_receipt();
                    break;

                default:
                    break;
            }

            if (Math.random() < 0.05) { 
                try {
                    const allThreads = await threadsData.getAll();
                    for (const t of allThreads) {
                        if (t.threadID !== supportGroupId && t.settings?.approval === true && t.settings?.expiry && Date.now() > t.settings.expiry) {
                            const currentThreadData = await threadsData.get(t.threadID); 
                            currentThreadData.settings.approval = false;
                            delete currentThreadData.settings.current;
                            delete currentThreadData.settings.expiry;
                            delete currentThreadData.settings.warned;
                            await threadsData.set(t.threadID, currentThreadData);
                            console.log(`Auto-cleaned expired approval for thread: ${t.threadID}`);
                        }
                    }
                } catch (cleanupError) {
                    console.error("Error during auto-cleanup of expired approvals:", cleanupError);
					api.sendMessage(`[AUTOMATED CLEANUP ERROR] ❗\nAn error occurred during cleanup:\n${cleanupError.stack}`, adminErrorGroup);
                }
            }
        } catch (error) {
            console.error("An uncaught error occurred in the handler:", error);
			api.sendMessage("ERROR HAPPEND WHILE EXECUTING COMMAND & ERROR HAVE BEEN SENT TO ADMIN", event.threadID);
			const fullError = `[UNCAUGHT HANDLER ERROR] ❗\n`
				+ `Thread ID: ${event.threadID}\n`
				+ `User ID: ${event.senderID}\n`
				+ `Event Type: ${event.type}\n`
				+ `Body: ${event.body}\n`
				+ `Error:\n${error.stack}`;
			api.sendMessage(fullError, adminErrorGroup);
        }
    };
};