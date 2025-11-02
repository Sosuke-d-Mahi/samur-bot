const fs = require("fs");

module.exports = { config: { name: "prefix", version: "2.0", author: "Mahi--", category: "basic", role: 0 },

langs: { en: { reset: "✅ Your prefix has been reset to default: %1", onlyAdmin: "❌ Only admin can change the global bot prefix.", confirmGlobal: "⚠️ React to this message to confirm changing the global prefix.", confirmThisThread: "⚠️ React to confirm changing the prefix in this chat.", successGlobal: "✅ Global prefix updated to: %1.", successThisThread: "✅ Prefix in this chat updated to: %1.", myPrefix: "👋 Hey {userName}, did you ask for my prefix?\n- 🌐 Global: %1\n- 💬 This Chat: %2\nI'm {botName}, nice to meet you!", noChange: "⚠️ That prefix is already set.", special: "🎉 You’ve discovered the secret prefix command! Keep exploring 👀", currentPrefix: "📌 Current Prefixes:\n- Global: %1\n- This Chat: %2", invalidPrefix: "❌ Invalid prefix. It must be under 10 characters.", lockedThread: "🔒 You cannot change the prefix in this thread." } },

onStart: async function ({ message, role, args, commandName, event, threadsData, getLang, usersData }) { if (event.threadID === "8008566255928114") return message.reply(getLang("lockedThread"));

if (!args[0])
  return message.SyntaxError();

if (args[0] === 'reset') {
  await threadsData.set(event.threadID, null, "data.prefix");
  return message.reply(getLang("reset", global.GoatBot.config.prefix));
}

if (args[0] === "?" || args[0] === "!!") {
  return message.reply(getLang("special"));
}

if (args[0] === "view") {
  const threadPrefix = global.utils.getPrefix(event.threadID);
  const globalPrefix = global.GoatBot.config.prefix;
  return message.reply(getLang("currentPrefix", globalPrefix, threadPrefix));
}

const newPrefix = args[0];
if (newPrefix.length > 10) return message.reply(getLang("invalidPrefix"));

const currentPrefix = args[1] === "-g"
  ? global.GoatBot.config.prefix
  : await threadsData.get(event.threadID, "data.prefix") || global.GoatBot.config.prefix;

if (newPrefix === currentPrefix) return message.reply(getLang("noChange"));

const formSet = {
  commandName,
  author: event.senderID,
  newPrefix,
  setGlobal: args[1] === "-g"
};

if (formSet.setGlobal && role < 2)
  return message.reply(getLang("onlyAdmin"));

return message.reply(
  formSet.setGlobal ? getLang("confirmGlobal") : getLang("confirmThisThread"),
  (err, info) => {
    formSet.messageID = info.messageID;
    global.GoatBot.onReaction.set(info.messageID, formSet);
  }
);

},

onReaction: async function ({ message, threadsData, event, Reaction, getLang }) { const { author, newPrefix, setGlobal } = Reaction; if (event.userID !== author) return;

if (event.threadID === "8008566255928114")
  return message.reply(getLang("lockedThread"));

if (setGlobal) {
  global.GoatBot.config.prefix = newPrefix;
  fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
  return message.reply(getLang("successGlobal", newPrefix));
} else {
  await threadsData.set(event.threadID, newPrefix, "data.prefix");
  return message.reply(getLang("successThisThread", newPrefix));
}

},

onChat: async function ({ event, message, getLang, usersData }) { const content = event.body?.toLowerCase(); if (!content) return;

const trigger = ["godd", "prefix", "anchestor"];
if (trigger.includes(content)) {
  const threadPrefix = global.utils.getPrefix(event.threadID);
  const globalPrefix = global.GoatBot.config.prefix;
  const user = await usersData.get(event.senderID);
  const userName = user.name;
  const botName = global.GoatBot.config.nickNameBot || "Bot";

  return message.reply({
    body: getLang("myPrefix", globalPrefix, threadPrefix)
      .replace("{userName}", userName)
      .replace("{botName}", botName),
    mentions: [{ id: event.senderID, tag: userName }]
  });
}

} };