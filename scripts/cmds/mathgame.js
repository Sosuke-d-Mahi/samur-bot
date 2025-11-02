const name = "mathgame";
const axios = require("axios");

module.exports = {
  config: {
    name,
    version: "1.1",
    author: "Mahi--",
    countDown: 5,
    role: 0,
    shortDescription: "Solve a random math problem.",
    longDescription: "Test your math skills with a randomly generated question and earn rewards!",
    category: "game",
    guide: "{pn}",
    envConfig: {
      reward: 500
    }
  },

  langs: {
    en: {
      reply: "Solve this:\n%1\n\n1️⃣ %2\n2️⃣ %3\n3️⃣ %4\n4️⃣ %5\n\nReply with 1, 2, 3, or 4.",
      notPlayer: "⚠ You are not the player of this question.",
      correct: "🎉 Correct! You earned %1$.",
      wrong: "❌ Wrong answer. Try again!"
    }
  },

  onStart: async function ({ message, event, commandName, getLang }) {
    const ops = ["+", "-", "*", "/"];
    const n1 = Math.floor(Math.random() * 100) + 1;
    const n2 = Math.floor(Math.random() * 100) + 1;
    const op = ops[Math.floor(Math.random() * ops.length)];

    let ans, q;
    if (op === "/") {
      const d = n1 * n2;
      ans = d / n2;
      q = `${d} / ${n2}`;
    } else {
      q = `${n1} ${op} ${n2}`;
      ans = eval(q);
    }
    ans = parseFloat(ans.toFixed(2));

    const choices = new Set();
    choices.add(ans);
    while (choices.size < 4) {
      let inc = (ans + Math.floor(Math.random() * 20) - 10).toFixed(2);
      choices.add(parseFloat(inc));
    }

    const opts = Array.from(choices).sort(() => Math.random() - 0.5);
    const correctIdx = opts.indexOf(ans) + 1;

    message.reply({
      body: getLang("reply", q, ...opts)
    }, (err, info) => {
      let replyStore = global.GoatBot.onReply;
      replyStore.set(info.messageID, {
        commandName,
        messageID: info.messageID,
        author: event.senderID,
        correctIdx
      });
    });
  },

  onReply: async function ({ message, Reply, event, getLang, usersData, envCommands, commandName }) {
    const { author, correctIdx, messageID } = Reply;
    if (event.senderID !== author) return message.reply(getLang("notPlayer"));

    const choice = parseInt(event.body);
    if (choice === correctIdx) {
      let replyStore = global.GoatBot.onReply;
      replyStore.delete(messageID);
      await usersData.addMoney(event.senderID, envCommands[commandName].reward);
      message.reply(getLang("correct", envCommands[commandName].reward));
    } else {
      message.reply(getLang("wrong"));
    }
  }
};