const axios = require("axios");

const envAPI = 'https://connect-foxapi.onrender.com';
const key = 'terash1';
module.exports = {
  config: {
    name: "prompt",
    aliases: [],
    version: "1.1",
    author: "SiAM",
    countDown: 10,
    role: 0,
    shortDescription: "Generate a prompt from an image or text",
    longDescription: "Generate a prompt from an image or text using an AI",
    category: "Image",
    guide: {
      en: "/prompt (with a reply to an image)\nor\n/prompt [image URL]\nor\n/prompt [prompt text]",
    },
  },

  onStart: async function ({ api, args, message, event }) {
    try {
      message.reaction("⏰", event.messageID);
      let imageUrl;
      let promptText;

      if (event.type === "message_reply") {
        if (["photo", "sticker"].includes(event.messageReply.attachments[0].type)) {
          imageUrl = event.messageReply.attachments[0].url;
        }
      } else if (args[0]?.match(/(https?:\/\/.*\.(?:png|jpg|jpeg))/g)) {
        imageUrl = args[0];
      } else if (args[0]) {
        promptText = args.join(" ");
      } else {
        return message.reply("Please provide an image URL, reply to an image, or provide a prompt text.⚠");
      }

      let apiUrl;
      let response;

      if (imageUrl) {
        apiUrl = `${envAPI}/simoAI/getPrompt?imageUrl=${encodeURIComponent(imageUrl)}&type=image&apikey=${key}`;
      } else if (promptText) {
        apiUrl = `${envAPI}/simoAI/getPrompt?prompt=${encodeURIComponent(promptText)}&type=text&apikey=${key}`;
      }

      response = await axios.get(apiUrl);

      if (response.data.success) {
        const answer = response.data.prompt;
        message.reply(answer);
        await message.reaction("✅", event.messageID);
      } else {
        message.reply("Prompt generation failed. Please try again later.⚠");
        await message.reaction("❌", event.messageID);
      }

    } catch (error) {
      console.error(error);
      message.reply("Error⚠");
      await message.reaction("❌", event.messageID);
    }
  },
};