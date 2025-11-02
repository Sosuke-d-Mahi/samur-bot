const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "cgen",
    aliases: [],
    author: "Vincenzo nigga",
    version: "1.2",
    cooldowns: 5,
    role: 0,
    shortDescription: "Generate a single image using Mahi or Rimon.",
    longDescription: "Generates a single AI image based on a prompt. Use --rimon to switch to Rimon engine.",
    category: "𝗔𝗜",
    guide: {
      en: "{pn} <prompt> [--ar <ratio>] [--rimon]",
      ar: "{pn} <الموجه> [--ar <نسبة>] [--rimon]"
    }
  },

  onStart: async function ({ message, args, api, event }) {
    const senderID = event.senderID;
    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      let prompt = "";
      let ratio = "1:1";
      let engine = "mahi";

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--ar" && args[i + 1]) {
          ratio = args[i + 1];
          i++;
        } else if (arg === "--rimon") {
          engine = "rimonv2";
        } else {
          prompt += arg + " ";
        }
      }

      prompt = prompt.trim();
      if (!prompt) return message.reply('❌ | Missing required parameters: prompt');

      const endpoint = `https://vincenzojin-hub-1.onrender.com/${engine}/generate`;
      const apiUrl = `${endpoint}?prompt=${encodeURIComponent(prompt)}&ratio=${ratio}`;

      const res = await axios.get(apiUrl);
      const imageUrls = res.data.imageUrls;

      if (!imageUrls || imageUrls.length === 0) {
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        return message.reply("❌ | No image generated. Please try again later.");
      }

      const imageUrl = imageUrls[0];
      const cacheFolderPath = path.join(__dirname, "/tmp");
      if (!fs.existsSync(cacheFolderPath)) fs.mkdirSync(cacheFolderPath);

      const imagePath = path.join(cacheFolderPath, `image_${Date.now()}.jpg`);
      const writer = fs.createWriteStream(imagePath);

      const imageResponse = await axios({ url: imageUrl, method: "GET", responseType: "stream" });
      imageResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      api.setMessageReaction("✅", event.messageID, () => {}, true);
      return message.reply({
        body: "✅ | Here is your generated image.",
        attachment: fs.createReadStream(imagePath)
      });

    } catch (error) {
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      console.error("Image generation error:", error.response?.data || error.message);
      return message.reply("❌ | Failed to generate image. Please try again later.");
    }
  }
};