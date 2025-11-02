const axios = require("axios");

module.exports = {
  config: {
    name: "fluxpro",
    aliases: [],
    version: "1.0",
    author: "Mahi--",
    countDown: 15,
    role: 0,
    shortDescription: "Generate anime-style image using Flux model",
    longDescription: "Generate a stunning anime-style image using Flux.1-pro model from Exoml.",
    category: "ai",
    guide: "{pn} <prompt>"
  },

  onStart: async function ({ message, args }) {
    const prompt = args.join(" ");
    if (!prompt) return message.reply("❗ Please provide a prompt.\nExample: /fluxpro boy with blue hair flying in sky");

    try {
      const response = await axios.post(
        "https://exomlapi.com/api/images/generate",
        {
          prompt: prompt,
          model: "flux.1-pro",
          size: "1024x1024"
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
            "Referer": "https://exomlapi.com/image-gen"
          }
        }
      );

      const imageUrl = response.data?.data?.[0]?.url;
      if (!imageUrl) return message.reply("⚠️ Failed to retrieve image.");

      const stream = await global.utils.getStreamFromURL(imageUrl);
      return message.reply({
        body: `✨ Image Generated from FluxPro Model\n📌 Prompt: ${prompt}`,
        attachment: stream
      });
    } catch (error) {
      console.error("FluxPro error:", error.message);
      return message.reply("❌ An error occurred while generating the image.");
    }
  }
};