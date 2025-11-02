const fs = require("fs");
const path = require("path");
const axios = require("axios");

module.exports = {
  config: {
    name: "poli",
    aliases: ["pollination"],
    author: "Mahi--",
    version: "1.0",
    cooldowns: 20,
    role: 2,
    shortDescription: "Generate an image based on a model and prompt.",
    longDescription: "Generates an image using the provided model and prompt.",
    category: "ai-image",
    guide: {
      en: `Enter the command with the prompt and optional parameters to generate an image.\n\nExamples:\n` +
          `/poli a cat --model 3\n` +
          `/poli a dog in a park --ar 3:4 --seed 4567 --model 5\n\nAvailable Models:\n` +
          `1. Flux\n` +
          `2. Flux-Pro\n` +
          `3. Flux-Realism\n` +
          `4. Flux-Anime\n` +
          `5. Flux-3D\n` +
          `6. Flux-CablyAl\n` +
          `7. Turbo`,
    },
  },
  onStart: async function ({ message, args, api, event }) {
    const obfuscatedAuthor = String.fromCharCode(77, 97, 104, 105, 45, 45);
    if (this.config.author !== obfuscatedAuthor) {
      return api.sendMessage("You are not authorized to change the author name.", event.threadID, event.messageID);
    }

    const models = [
      "Flux",
      "Flux-Pro",
      "Flux-Realism",
      "Flux-Anime",
      "Flux-3D",
      "Flux-CablyAl",
      "Turbo",
    ];

    if (args.length === 0 || args[0].toLowerCase() === "models") {
      return api.sendMessage(
        `Available models are:\n${models.map((model, index) => `${index + 1}. ${model}`).join("\n")}`,
        event.threadID,
        event.messageID
      );
    }

    let prompt = args.join(" ");
    let aspectRatio = null;
    let seed = null;
    let model = null;

    const arMatch = prompt.match(/--ar\s+([\d:]+)/);
    if (arMatch) {
      aspectRatio = arMatch[1];
      prompt = prompt.replace(arMatch[0], "").trim();
    }

    const seedMatch = prompt.match(/--seed\s+(\d+)/);
    if (seedMatch) {
      seed = seedMatch[1];
      prompt = prompt.replace(seedMatch[0], "").trim();
    }

    const modelMatch = prompt.match(/--model\s+(\d+)/);
    if (modelMatch) {
      const modelIndex = parseInt(modelMatch[1], 10) - 1;
      if (modelIndex >= 0 && modelIndex < models.length) {
        model = models[modelIndex];
      } else {
        return api.sendMessage(
          `❌ | Invalid model number. Please use a number between 1 and ${models.length}.\n\nAvailable Models:\n${models
            .map((model, index) => `${index + 1}. ${model}`)
            .join("\n")}`,
          event.threadID,
          event.messageID
        );
      }
      prompt = prompt.replace(modelMatch[0], "").trim();
    }

    if (!model) model = models[0];

    let apiUrl = `https://mahi-apis.onrender.com/api/poli?prompt=${encodeURIComponent(prompt)}`;
    if (aspectRatio) apiUrl += ` --ar ${aspectRatio}`;
    if (seed) apiUrl += ` --seed ${seed}`;
    if (model) apiUrl += ` --model ${encodeURIComponent(model)}`;

    api.sendMessage("Please wait, generating your image...", event.threadID, event.messageID);

    try {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });

      const cacheFolderPath = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheFolderPath)) {
        fs.mkdirSync(cacheFolderPath);
      }

      const imagePath = path.join(cacheFolderPath, `${Date.now()}_generated_image.png`);
      fs.writeFileSync(imagePath, Buffer.from(response.data, "binary"));

      const stream = fs.createReadStream(imagePath);
      message.reply({
        body: "",
        attachment: stream,
      });
    } catch (error) {
      console.error("Error:", error);
      message.reply("❌ | An error occurred while generating the image. Please try again later.");
    }
  },
};