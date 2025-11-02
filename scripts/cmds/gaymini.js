const name = "gaymini";

const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI('AIzaSyDGkH6Evi1hUs4uGvAUH0t98l1PiYypsNM');
const cacheFolder = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheFolder)) fs.mkdirSync(cacheFolder);

module.exports = {
  config: {
    name,
    version: "4.0",
    author: "Mahi",
    countDown: 0,
    category: "all-in-one",
    role: 0,
    guide: {
      en: `
/${name} <text> → Gemini AI
/${name} <text> (reply image) → Gemini explain image
/${name} sing <query> → Audio fetcher
/${name} gen/create/imagine/generate <prompt> → Image Generator`
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const input = args.join(" ").trim();
    const lowerInput = args[0]?.toLowerCase();

    if (!input) return message.reply("Please provide some text or command.");

    // 1. Handle Audio Fetcher
    if (lowerInput === "sing") {
      const query = args.slice(1).join(" ");
      if (!query) return message.reply("❌ | Enter a song name to search.");

      try {
        const res = await axios.get(`https://mahi-apis.onrender.com/api/sing?query=${encodeURIComponent(query)}`);
        if (!res.data || !res.data.download_url) return message.reply("❌ | No audio found for the given query.");

        const { title, duration, upload_date, download_url } = res.data;
        const fileName = `gaymini_audio_${Date.now()}.mp3`;
        const filePath = path.join(cacheFolder, fileName);
        const audioStream = await axios.get(download_url, { responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        audioStream.data.pipe(writer);

        writer.on("finish", () => {
          api.sendMessage({
            body: `✅ Title: ${title}\n⏱ Duration: ${duration}\n📅 Uploaded: ${upload_date}`,
            attachment: fs.createReadStream(filePath)
          }, event.threadID, event.messageID);
        });

        writer.on("error", () => message.reply("❌ | Failed to download the audio file."));
      } catch (err) {
        console.error("Sing error:", err.message);
        return message.reply("❌ | Error occurred while processing audio.");
      }
      return;
    }

    // 2. Handle Image Generation via Giz
    if (["gen", "create", "imagine", "generate"].includes(lowerInput)) {
      let prompt = args.slice(1).join(" ");
      let width = 1024, height = 1024;

      const arMatch = prompt.match(/--ar\s+(\d+):(\d+)/);
      if (arMatch) {
        const ratio = arMatch[1] / arMatch[2];
        if (ratio > 1) {
          width = 1024; height = Math.round(1024 / ratio);
        } else {
          width = Math.round(1024 * ratio); height = 1024;
        }
        prompt = prompt.replace(arMatch[0], "").trim();
      }

      if (!prompt) return message.reply("Please provide a prompt!\nExample: /gaymini imagine A mystical dragon --ar 16:9");

      try {
        const data = await generateImage(prompt, width, height);
        const imageUrl = data.output?.[0];
        if (imageUrl) {
          message.reply({
            body: `Here is your image based on: "${prompt}" (Aspect Ratio ${width}:${height})`,
            attachment: await global.utils.getStreamFromURL(imageUrl)
          });
        } else {
          message.reply("Image generation failed.");
        }
      } catch (err) {
        message.reply("❌ | Error occurred during image generation.");
      }
      return;
    }

    // 3. Gemini AI Mode (Text / Image Explanation)
    try {
      const imageURLs = [];
      if (event.type === "message_reply") {
        const att = event.messageReply?.attachments || [];
        for (let file of att) {
          if (["photo", "video"].includes(file?.type)) imageURLs.push(file.url);
          if (imageURLs.length >= 16) break;
        }
        if (!imageURLs.length) return message.reply("❌ No valid image found.");
        const imageParts = await Promise.all(imageURLs.map(url => urlToGenerativePart(url)));
        await generateContent(message, input, "gemini-1.5-flash", imageParts);
      } else {
        await generateContent(message, input, "gemini-1.5-flash-latest");
      }
    } catch (err) {
      console.error("Gemini error:", err.message);
      message.reply("❌ | Failed to generate response.");
    }
  }
};

async function generateContent(message, promptText, modelName, additionalParts = []) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([promptText, ...additionalParts]);
  const text = result.response.text();
  message.reply(text);
}

async function urlToGenerativePart(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const buffer = Buffer.from(res.data, "binary");
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: getImageMimeType(buffer)
    }
  };
}

function getImageMimeType(buffer) {
  const sig = new Uint8Array(buffer).slice(0, 4);
  const check = (arr1, arr2) => arr1.every((v, i) => v === arr2[i]);
  if (check(sig, [0x89, 0x50, 0x4E, 0x47])) return "image/png";
  if (check(sig, [0xFF, 0xD8, 0xFF, 0xE0])) return "image/jpeg";
  if (check(sig, [0x52, 0x49, 0x46, 0x46])) return "image/webp";
  return "application/octet-stream";
}

async function generateImage(prompt, width, height) {
  const url = "https://app.giz.ai/api/data/users/inferenceServer.infer";
  const body = {
    model: "image-generation",
    baseModel: "flux1",
    input: {
      settings: {
        character: "AI", responseMode: "text", voice: "tts-1:onyx", ttsSpeed: "1", imageModel: "sdxl"
      },
      baseModel: "flux1",
      width: width.toString(), height: height.toString(), batch_size: "1",
      style: "undefined", checkpoint: "shuttle-jaguar-fp8.safetensors", steps: 4,
      growMask: 30, face_detailer: false, upscale: false, mode: "image-generation",
      prompt: prompt
    },
    subscribeId: "Z38kB6lv9YDrIQ0bp_ubx",
    instanceId: "eNXI7QLLCD9d5jTpi57kY"
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      "Referer": `https://app.giz.ai/assistant?mode=image-generation&prompt=${encodeURIComponent(prompt)}`
    },
    body: JSON.stringify(body)
  });
  return await res.json();
}