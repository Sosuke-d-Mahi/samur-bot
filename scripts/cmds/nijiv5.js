const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

module.exports = {
  config: {
    name: "nijiv5",
    aliases: [],
    author: "Vincenzo",
    version: "1.0",
    cooldowns: 5,
    role: 0,
    shortDescription: "Generate images using Rimon API.",
    longDescription: "Generates AI images with optional ratio and single image option.",
    category: "𝗔𝗜",
    guide: {
      en: "{pn} <prompt> [--ar <ratio>] [--1]",
      ar: "{pn} <الموجه> [--ar <نسبة>] [--1]"
    }
  },

  onStart: async function ({ message, globalData, args, api, event }) {
    const vipMembers = await globalData.get("vipMembers", "data", []);
    const senderID = event.senderID;
    const isAdmin = global.GoatBot.config.adminBot.includes(senderID);

    if (!vipMembers.includes(senderID) && !isAdmin) {
      return message.reply("❌ | Only admins and VIP members have permission");
    }

    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      let prompt = "";
      let ratio = "1:1";
      let singleImage = false;

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--ar" && args[i + 1]) {
          ratio = args[i + 1];
          i++;
        } else if (arg === "--1") {
          singleImage = true;
        } else {
          prompt += arg + " ";
        }
      }

      prompt = prompt.trim();
      if (!prompt) return message.reply('Missing required parameters: prompt');

      const cacheFolderPath = path.join(__dirname, "/tmp");
      if (!fs.existsSync(cacheFolderPath)) fs.mkdirSync(cacheFolderPath);

      const apiConfig = await axios.get("https://raw.githubusercontent.com/Savage-Army/extras/refs/heads/main/api.json");
      const { token: tokenUrl } = apiConfig.data;
      const tokenResponse = await axios.get(tokenUrl);
      const token = tokenResponse.data.bearer;

      const params = { prompt, ratio, token };
      let imageUrls = [];

      if (singleImage) {
        const res = await axios.get("https://vincenzojin-hub-1.onrender.com/nijiv5/gen", { params });
        imageUrls = res.data.imageUrls;
      } else {
        const firstBatch = await Promise.all([
          axios.get("https://vincenzojin-hub-1.onrender.com/nijiv5/gen", { params }),
          axios.get("https://vincenzojin-hub-1.onrender.com/nijiv5/gen", { params })
        ]);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const secondBatch = await Promise.all([
          axios.get("https://vincenzojin-hub-1.onrender.com/nijiv5/gen", { params }),
          axios.get("https://vincenzojin-hub-1.onrender.com/nijiv5/gen", { params })
        ]);
        imageUrls = [...firstBatch, ...secondBatch].flatMap(res => res.data.imageUrls);
      }

      const images = await Promise.all(
        imageUrls.map(async (imageURL, index) => {
          const imagePath = path.join(cacheFolderPath, `image_${index + 1}_${Date.now()}.jpg`);
          const writer = fs.createWriteStream(imagePath);
          const imageResponse = await axios({ url: imageURL, method: "GET", responseType: "stream" });
          imageResponse.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });
          return imagePath;
        })
      );

      if (singleImage) {
        api.setMessageReaction("✅", event.messageID, () => {}, true);
        return message.reply({
          body: "✅ | Here is your generated image.",
          attachment: fs.createReadStream(images[0])
        });
      }

      const loadedImages = await Promise.all(images.map(img => loadImage(img)));
      const width = loadedImages[0].width;
      const height = loadedImages[0].height;
      const canvas = createCanvas(width * 2, height * 2);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(loadedImages[0], 0, 0, width, height);
      ctx.drawImage(loadedImages[1], width, 0, width, height);
      ctx.drawImage(loadedImages[2], 0, height, width, height);
      ctx.drawImage(loadedImages[3], width, height, width, height);

      const combinedImagePath = path.join(cacheFolderPath, `combined_${Date.now()}.jpg`);
      const buffer = canvas.toBuffer("image/jpeg");
      fs.writeFileSync(combinedImagePath, buffer);

      api.setMessageReaction("✅", event.messageID, () => {}, true);
      const reply = await message.reply({
        body: "Select an image by replying with 1, 2, 3, or 4.",
        attachment: fs.createReadStream(combinedImagePath)
      });

      const data = {
        commandName: this.config.name,
        messageID: reply.messageID,
        images,
        combinedImage: combinedImagePath,
        author: event.senderID
      };

      global.GoatBot.onReply.set(reply.messageID, data);
    } catch (error) {
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      console.error("Error:", error.response ? error.response.data : error.message);
      message.reply("❌ | Failed to generate image.");
    }
  },

  onReply: async function ({ message, event }) {
    const replyData = global.GoatBot.onReply.get(event.messageReply.messageID);
    if (!replyData || replyData.author !== event.senderID) return;

    try {
      const index = parseInt(event.body.trim());
      if (isNaN(index) || index < 1 || index > 4) {
        return message.reply("❌ | Invalid selection. Please reply with a number between 1 and 4.");
      }

      const selectedImagePath = replyData.images[index - 1];
      await message.reply({ attachment: fs.createReadStream(selectedImagePath) });
    } catch (error) {
      console.error("Error:", error.message);
      message.reply("❌ | Failed to send selected image.");
    }
  }
};