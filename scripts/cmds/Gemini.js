const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI('AIzaSyDGkH6Evi1hUs4uGvAUH0t98l1PiYypsNM');

module.exports = {
  config: {
    name: "gemini",
    version: "1.1",
    author: "Duck",
    shortDescription: { en: "Short description" },
    longDescription: { en: "Long description" },
    category: "GoogleGenerativeAI",
    countDown: 5,
    role: 0,
    guide: { en: "nothing" }
  },

  onStart: async function ({ event, args, message }) {
    try {
      const imageURLs = [];

      if (!args.length) {
        throw new Error("Please provide a prompt.");
      }

      if (event.type === "message_reply") {
        if (!event.messageReply.attachments || !event.messageReply.attachments.length) {
          throw new Error("No valid attachments found.");
        }

        for (let i = 0; i < event.messageReply.attachments.length; i++) {
          if (["photo", "video"].includes(event.messageReply.attachments[i]?.type)) {
            const imageUrl = event.messageReply.attachments[i].url;
            imageURLs.push(imageUrl);

            if (imageURLs.length >= 16) {
              break;
            }
          }
        }

        if (!imageURLs.length) {
          throw new Error("No valid attachments found.");
        }

        const promptText = args.join(" ");

        if (!promptText) {
          return message.reply("Please provide a prompt");
        }

        await processImagesAndGenerate(message, promptText, imageURLs);
      } else {
        const promptText = args.join(" ");
        await generateContent(message, promptText, "gemini-1.5-flash-latest");
      }
    } catch (error) {
      message.reply(error.message);
      console.error(error);
    }
  }
};

async function processImagesAndGenerate(message, promptText, imageURLs) {
  try {
    const imageParts = await Promise.all(
      imageURLs.map(async (url) => await urlToGenerativePart(url))
    );

    imageURLs.length = 0;

    await generateContent(message, promptText, "gemini-1.5-flash", imageParts);
  } catch (error) {
    message.reply(error.message);
    console.error(error);
  }
}

async function generateContent(message, promptText, modelName, additionalParts = []) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent([promptText, ...additionalParts]);
    const response = await result.response;
    const text = response.text();
    message.reply(text);
  } catch (error) {
    message.reply("ERROR");
    console.error(error);
  }
}

async function urlToGenerativePart(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data, "binary");

  const mimeType = getImageMimeType(buffer);

  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

function getImageMimeType(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const signature = uint8Array.slice(0, 4);

  if (compareBytes(signature, [0x89, 0x50, 0x4E, 0x47])) {
    return "image/png";
  } else if (compareBytes(signature, [0xFF, 0xD8, 0xFF, 0xE0])) {
    return "image/jpeg";
  } else if (compareBytes(signature, [0x52, 0x49, 0x46, 0x46]) && compareBytes(uint8Array.slice(8, 12), [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  } else if (compareBytes(signature, [0x00, 0x00, 0x00, 0x14]) && compareBytes(uint8Array.slice(8, 12), [0x66, 0x74, 0x79, 0x70])) {
    return "image/heic";
  } else if (compareBytes(signature, [0x00, 0x00, 0x00, 0x1F]) && compareBytes(uint8Array.slice(8, 12), [0x66, 0x74, 0x79, 0x70])) {
    return "image/heif";
  } else if (compareBytes(signature, [0x00, 0x00, 0x00, 0x20]) && compareBytes(uint8Array.slice(8, 12), [0x66, 0x74, 0x79, 0x70])) {
    return "video/mp4";
  } else {
    return "application/octet-stream";
  }
}

function compareBytes(arr1, arr2) {
  return arr1.every((value, index) => value === arr2[index]);
}