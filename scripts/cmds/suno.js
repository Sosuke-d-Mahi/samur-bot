const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class SunoAPI {
  constructor() {
    this.baseURL = "https://suno.exomlapi.com";
    this.interval = 3000;
    this.timeout = 480000; // 8 minutes
  }

  randomCryptoIP() {
    const bytes = crypto.randomBytes(4);
    return Array.from(bytes).map(b => b % 256).join(".");
  }

  randomID(length = 16) {
    return crypto.randomBytes(length).toString("hex");
  }

  buildHeaders(extra = {}) {
    const ip = this.randomCryptoIP();
    const headers = {
      accept: "*/*",
      "content-type": "application/json",
      origin: this.baseURL,
      referer: `${this.baseURL}/`,
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua": `"Chromium";v="131", "Not_A Brand";v="24", "Microsoft Edge Simulate";v="131", "Lemur";v="131"`,
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": `"Android"`,
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": ip,
      "x-real-ip": ip,
      "x-request-id": this.randomID(8),
      ...extra
    };
    return headers;
  }

  async generate({ prompt }) {
    let taskId, token;
    try {
      const generateResponse = await axios.post(`${this.baseURL}/generate`, { prompt }, { headers: this.buildHeaders() });
      ({ taskId, token } = generateResponse.data);
      const startTime = Date.now();
      while (Date.now() - startTime < this.timeout) {
        await new Promise(resolve => setTimeout(resolve, this.interval));
        const statusResponse = await axios.post(`${this.baseURL}/check-status`, { taskId, token }, { headers: this.buildHeaders() });
        if (statusResponse.data.results?.every(res => res.audio_url && res.image_url && res.lyrics)) {
          return statusResponse.data;
        }
      }
      return { status: "timeout" };
    } catch (error) {
      return { status: "error", error: error.message };
    }
  }
}

module.exports = {
  config: {
    name: "suno",
    version: "2.1",
    author: "vincenzo X MarianCross",
    role: 0,
    shortDescription: "Generate music with Suno",
    longDescription: "Generates music from a text prompt via Suno. First sends the cover and lyrics, then the audio separately.",
    category: "audio",
    guide: {
      prompt: "{p}suno <prompt>",
      example: "{p}suno a sad song about a cat"
    }
  },

  onStart: async function ({ api, event, args }) {
    try {
      const waitMsg = await api.sendMessage("🎵 Generating music...", event.threadID);

      const prompt = args.join(" ").trim();
      if (!prompt) {
        await api.unsendMessage(waitMsg.messageID);
        return api.sendMessage("✏️ Usage: /suno <prompt>", event.threadID);
      }

      const suno = new SunoAPI();
      const data = await suno.generate({ prompt });

      if (data.status === "timeout") {
        await api.unsendMessage(waitMsg.messageID);
        return api.sendMessage("⏰ Time exceeded for Suno generation (max 8 minutes).", event.threadID);
      }
      if (data.status === "error" || !data.results || data.results.length === 0) {
        await api.unsendMessage(waitMsg.messageID);
        return api.sendMessage("❌ Error during Suno generation: " + (data.error || "No data received"), event.threadID);
      }

      const res = data.results[0];

      // Download cover (optional)
      let coverPath = null;
      if (res.image_url) {
        coverPath = path.join(__dirname, `suno_cover_${Date.now()}.jpg`);
        try {
          const coverResponse = await axios.get(res.image_url, { responseType: "arraybuffer" });
          fs.writeFileSync(coverPath, Buffer.from(coverResponse.data));
        } catch {
          coverPath = null;
        }
      }

      // Send lyrics + cover
      let body = `🎶 Music generated with Suno!\nPrompt: "${prompt}"`;
      if (res.lyrics) body += `\n\n📝 Lyrics:\n${res.lyrics}`;

      const attachments = [];
      if (coverPath) attachments.push(fs.createReadStream(coverPath));

      await api.unsendMessage(waitMsg.messageID);
      await api.sendMessage({ body, attachment: attachments }, event.threadID);

      // Download and send audio separately
      const audioPath = path.join(__dirname, `suno_${Date.now()}.mp3`);
      const audioResponse = await axios.get(res.audio_url, { responseType: "arraybuffer" });
      fs.writeFileSync(audioPath, Buffer.from(audioResponse.data));

      await api.sendMessage({
        body: "▶️ Here is the generated audio!",
        attachment: fs.createReadStream(audioPath)
      }, event.threadID);

      // Clean up temp files
      if (coverPath) fs.unlinkSync(coverPath);
      fs.unlinkSync(audioPath);

    } catch (error) {
      console.error("Suno Error:", error);
      api.sendMessage(`❌ Suno Error: ${error.message}`, event.threadID, event.messageID);
    }
  }
};