const axios = require("axios");

module.exports = {
  config: {
    name: "omaigotto",
    aliases: ["momoi", "vit"],
    version: "1.2",
    author: "Mahi--",
    shortDescription: "Generate audio using omaigotto API",
    longDescription: "Send text or reply to a message and receive playable audio directly from omaigotto endpoint.",
    category: "audio",
    guide: "{p}omaigotto <text> or reply to a message with {p}omaigotto",
  },

  onStart: async function ({ api, event, message, args }) {
    try {
      const text = args.join(" ") || event.messageReply?.body;
      if (!text) return message.reply("❌ Please provide some text for the TTS conversion.");

      // Safely set reaction (ignore errors)
      try {
        api.setMessageReaction("🔄", event.messageID, () => {}, true);
      } catch (_) {}

      const audioUrl = `https://egret-driving-cattle.ngrok-free.app/api/omg?txt=${encodeURIComponent(text)}`;

      const response = await axios({
        url: audioUrl,
        method: "GET",
        responseType: "stream"
      });

      await message.reply({
        body: `🎙 Here’s your generated audio:`,
        attachment: response.data,
      });

      try {
        api.setMessageReaction("✅", event.messageID, () => {}, true);
      } catch (_) {}

    } catch (error) {
      console.error("omaigotto error:", error);
      try {
        api.setMessageReaction("❌", event.messageID, () => {}, true);
      } catch (_) {}
      return message.reply("❌ Failed to generate audio. Please try again.");
    }
  },
};