const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_BASE_URL = "https://egret-driving-cattle.ngrok-free.app";
const USAGE_LOG = path.join(__dirname, "midj_usage.json");
if (!fs.existsSync(USAGE_LOG)) fs.writeFileSync(USAGE_LOG, "{}");

module.exports = {
  config: {
    name: "midjourney",
    aliases: ["midj", "mj"],
    author: "Mahi--",
    version: "3.0",
    role: 0,
    shortDescription: "Generate Midjourney-style images via API",
    longDescription: "AI image generator integrated with Express API endpoints.",
    category: "image",
    guide: "{pn} <prompt>"
  },

  onStart: async function ({ args, message, event }) {
    try {
      const adminUID = "61568425442088";
      const senderID = event.senderID;
      const isAdmin = senderID === adminUID;

      if (!isAdmin) {
        const now = Date.now();
        const usageData = JSON.parse(fs.readFileSync(USAGE_LOG, "utf8")) || {};
        let userUsage = usageData[senderID] || { count: 0, lastUsed: 0 };

        const lastUsed = new Date(userUsage.lastUsed);
        const nowDate = new Date();

        if (
          lastUsed.getDate() !== nowDate.getDate() ||
          lastUsed.getMonth() !== nowDate.getMonth() ||
          lastUsed.getFullYear() !== nowDate.getFullYear()
        ) {
          userUsage.count = 0;
        }

        if (userUsage.count >= 5) {
          return message.reply("❌ You've reached your daily limit of 5 MidJourney generations.");
        }

        const cooldown = 5 * 60 * 1000;
        if (now - userUsage.lastUsed < cooldown) {
          const remaining = Math.ceil((cooldown - (now - userUsage.lastUsed)) / 60000);
          return message.reply(`⏳ Wait ${remaining} more minute(s) before using this command again.`);
        }

        userUsage.count += 1;
        userUsage.lastUsed = now;
        usageData[senderID] = userUsage;
        fs.writeFileSync(USAGE_LOG, JSON.stringify(usageData, null, 2));
      }

      const prompt = args.join(" ").trim();
      if (!prompt) return message.reply("⚠️ Please provide a prompt.");

      const processing = await message.reply("🎨 Generating your image... Please wait.");

      const { data } = await axios.get(`${API_BASE_URL}/api/mj2?prompt=${encodeURIComponent(prompt)}`);

      if (!Array.isArray(data) || !data[0]) {
        await message.unsend(processing.messageID);
        return message.reply("❌ Invalid API response.");
      }

      const result = data[0];
      const imageUrl = result.imageUrl;
      const buttonMessageId = result.buttonMessageId;
      const buttons = result.buttons || [];

      if (!imageUrl || !buttonMessageId) {
        await message.unsend(processing.messageID);
        return message.reply("❌ Generation failed (missing image or ID).");
      }

      const stream = await global.utils.getStreamFromURL(imageUrl);
      await message.unsend(processing.messageID);

      const buttonText = buttons.length
        ? `💬 Reply with: ${buttons.join(" | ")}`
        : "No buttons available.";

      let body = `🖼️ Here is your image!\n\n${buttonText}`;
      if (!isAdmin) {
        const usageData = JSON.parse(fs.readFileSync(USAGE_LOG, "utf8")) || {};
        const userUsage = usageData[senderID] || { count: 0 };
        const remaining = 5 - userUsage.count;
        body += `\n\n📊 Usage: ${userUsage.count}/5 (${remaining} left today)`;
      }

      const sentMsg = await message.reply({ body, attachment: stream });

      global.GoatBot.onReply.set(sentMsg.messageID, {
        commandName: this.config.name,
        buttonMessageId: buttonMessageId,
        threadID: event.threadID,
        messageID: sentMsg.messageID,
        isAdmin
      });
    } catch (err) {
      console.error("Generation Error:", err.response?.data || err.message);
      message.reply("❌ An error occurred. API might be down or the request failed.");
    }
  },

  onReply: async function ({ event, Reply, message }) {
    try {
      let action = event.body.trim().toUpperCase();
      const validPrefixes = ["U1","U2","U3","U4","V1","V2","V3","V4","🔄"];
      if (!validPrefixes.includes(action)) return;

      const { isAdmin, buttonMessageId } = Reply;

      if (!isAdmin) {
        const now = Date.now();
        const usageData = JSON.parse(fs.readFileSync(USAGE_LOG, "utf8")) || {};
        const senderID = event.senderID;
        let userUsage = usageData[senderID] || { lastUsed: 0 };

        const cooldown = 5 * 60 * 1000;
        if (now - userUsage.lastUsed < cooldown) {
          const remaining = Math.ceil((cooldown - (now - userUsage.lastUsed)) / 60000);
          return message.reply(`⏳ Wait ${remaining} more minute(s) before next action.`);
        }

        userUsage.lastUsed = now;
        usageData[senderID] = userUsage;
        fs.writeFileSync(USAGE_LOG, JSON.stringify(usageData, null, 2));
      }

      const processing = await message.reply(`🔄 Processing ${action}...`);

      const { data } = await axios.get(
        `${API_BASE_URL}/api/mj2-button?buttonType=${action}&buttonMessageId=${buttonMessageId}`
      );

      if (!data || !data.imageUrl) {
        await message.unsend(processing.messageID);
        return message.reply("❌ Failed to process action. Invalid response.");
      }

      const stream = await global.utils.getStreamFromURL(data.imageUrl);
      await message.unsend(processing.messageID);

      const body = `🎯 ${action} Result\n(You can reply again with any U1-U4 / V1-V4 / 🔄)`;

      const sentMsg = await message.reply({ body, attachment: stream });

      global.GoatBot.onReply.set(sentMsg.messageID, {
        commandName: "midjourney",
        buttonMessageId: data.buttonMessageId || buttonMessageId,
        threadID: event.threadID,
        messageID: sentMsg.messageID,
        isAdmin
      });
    } catch (err) {
      console.error("Button Error:", err.response?.data || err.message);
      message.reply("❌ Failed to process the button action.");
    }
  }
};