const axios = require("axios");

module.exports = {
  config: {
    name: "quiz",
    version: "1.1",
    author: "Mahi--",
    countDown: 10,
    role: 0,
    shortDescription: "Trivia quiz game",
    longDescription: "Answer a trivia question and earn money for correct answers",
    category: "🎮 Games",
    guide: "{pn}"
  },

  onStart: async function ({ api, event, message }) {
    try {
      const res = await axios.get("https://the-trivia-api.com/v2/questions?limit=1&difficulties=easy%2Cmedium%2Chard", {
        headers: {
          "Accept": "application/json",
          "cache-control": "no-cache",
          "X-Requested-With": "@trivia-api/fetch",
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://the-trivia-api.com/"
        }
      });

      const data = res.data[0];
      const question = data.question.text;
      const correct = data.correctAnswer;
      const choices = [...data.incorrectAnswers, correct];
      const shuffled = choices.sort(() => Math.random() - 0.5);
      const correctIndex = shuffled.indexOf(correct) + 1;

      let display = `🧠 Trivia Time!\n\n📌 ${question}\n`;
      shuffled.forEach((ans, i) => display += `${i + 1}. ${ans}\n`);
      display += `\nReply with 1-4 to answer.`;

      const replyMessage = await message.reply(display);

      global.GoatBot.onReply.set(replyMessage.messageID, {
        commandName: this.config.name,
        messageID: replyMessage.messageID,
        correct: correctIndex,
        reward: 100
      });

    } catch (e) {
      console.error(e);
      return message.reply("❌ Failed to fetch a trivia question. Please try again.");
    }
  },

  onReply: async function ({ api, message, event, Reply, usersData }) {
    const userAnswer = parseInt(event.body);
    if (isNaN(userAnswer) || userAnswer < 1 || userAnswer > 4)
      return message.reply("❗ Please reply with a number between 1 and 4.");

    // Remove the original quiz message
    try {
      await api.unsendMessage(Reply.messageID);
    } catch (e) {
      console.warn("⚠ Failed to unsend quiz message:", e.message);
    }

    const userID = event.senderID;
    const reward = Reply.reward;

    if (userAnswer === Reply.correct) {
      const currentMoney = await usersData.get(userID, "money") || 0;
      await usersData.set(userID, { money: currentMoney + reward });
      return message.reply(`✅ Correct! You've been awarded $${reward}.`);
    } else {
      return message.reply(`❌ Wrong! Better luck next time.`);
    }
  }
};