const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "edit",
    author: "Vincenzo ¢",
    version: "2.1",
    cooldowns: 5,
    role: 2,
    shortDescription: "Generate or edit images using Google Gemini 2.5 Flash with OpenRouter",
    longDescription: "Generates or modifies AI images with Gemini 2.5 Flash through OpenRouter. Supports prompt only, image input + prompt, or text-only answers.",
    category: "𝗔𝗜",
    guide: "{pn} <prompt> (reply with or without an image)"
  },

  onStart: async function ({ message, args, api, event }) {
    if (!args[0]) return message.reply("❌ | Please provide a prompt.");
    const prompt = args.join(" ");

    // ✅ Your OpenRouter API Key
    const OPENROUTER_API_KEY = "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";  
    
    const cacheFolder = path.join(__dirname, "/tmp");
    if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder);

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      let content = [{ type: "text", text: prompt }];

      // If the user replied with an image, attach it
      if (event.messageReply?.attachments?.length > 0) {
        for (const attachment of event.messageReply.attachments) {
          if (attachment.type === "photo") {
            content.push({
              type: "image_url",
              image_url: { url: attachment.url }
            });
          }
        }
      }

      // Request to OpenRouter
      const res = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "google/gemini-2.5-flash-image-preview:free",
          messages: [{ role: "user", content }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`
          }
        }
      );

      const candidateMessage = res.data.choices?.[0]?.message;
      if (!candidateMessage) return message.reply("❌ | No response from OpenRouter API.");

      let textReply = candidateMessage.content ? candidateMessage.content.trim() : "";
      let imageUrl = null;

      // Look for generated image
      if (candidateMessage.images && Array.isArray(candidateMessage.images) && candidateMessage.images.length > 0) {
        if (candidateMessage.images[0].image_url && candidateMessage.images[0].image_url.url) {
          imageUrl = candidateMessage.images[0].image_url.url;
        }
      }

      api.setMessageReaction("✅", event.messageID, () => {}, true);

      if (imageUrl) {
        let imageBuffer;
        if (imageUrl.startsWith("data:image")) {
          const base64Data = imageUrl.split(',')[1];
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          const imgRes = await axios.get(imageUrl, { responseType: "arraybuffer" });
          imageBuffer = Buffer.from(imgRes.data, "binary");
        }
        
        const imagePath = path.join(cacheFolder, `gemini_gen_${Date.now()}.png`);
        fs.writeFileSync(imagePath, imageBuffer);

        return message.reply({
          body: textReply || "✅ | Here is your generated image:",
          attachment: fs.createReadStream(imagePath)
        });
      } else if (textReply) {
        return message.reply(textReply);
      } else {
        return message.reply("❌ | No valid content (text or image) found in the response.");
      }

    } catch (error) {
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      console.error("OpenRouter Error:", error.response ? error.response.data : error.message);
      let errorMessage = "❌ | Failed to generate content. Please check your prompt or try again later.";
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage += `\nError details: ${error.response.data.error.message}`;
      }
      message.reply(errorMessage);
    }
  }
};