const axios = require("axios");
const ytdlp = require("youtube-dl-exec");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "alldl",
    aliases: [],
    version: "2.1",
    author: "Mahi--",
    countDown: 5,
    role: 0,
    category: "media",
    guide: { en: { body: "{pn} <url>" } }
  },

  onStart: async function ({ message, args, event, threadsData, role }) {
    let videoUrl = args.join(" ");
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    if (
      (args[0] === "chat" && (args[1] === "on" || args[1] === "off")) ||
      args[0] === "on" ||
      args[0] === "off"
    ) {
      if (role >= 1) {
        const choice = args[0] === "on" || args[1] === "on";
        await threadsData.set(event.threadID, { data: { autoDownload: choice } });
        return message.reply(`Auto-download has been turned ${choice ? "on" : "off"} for this group.`);
      } else {
        return message.reply("You don't have permission to toggle auto-download.");
      }
    }

    if (!videoUrl) {
      if (event.messageReply?.body) {
        const found = event.messageReply.body.match(urlRegex);
        if (found && found.length > 0) videoUrl = found[0];
        else return message.reply("No URL found. Please provide a valid URL.");
      } else return message.reply("Please provide a URL to start downloading.");
    }

    message.reaction("🔄", event.messageID);
    await downloadHandler({ videoUrl, message, event });
  },

  onChat: async function ({ event, message, threadsData }) {
    const threadData = await threadsData.get(event.threadID);
    if (!threadData.data.autoDownload || event.senderID === global.botID) return;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const found = event.body?.match(urlRegex);
    if (!found || found.length === 0) return;

    const videoUrl = found[0];
    message.reaction("🔄", event.messageID);
    await downloadHandler({ videoUrl, message, event });
  }
};

async function downloadHandler({ videoUrl, message, event }) {
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i;

  try {
    // ---- YOUTUBE ----
    if (youtubeRegex.test(videoUrl)) {
      const tempDir = path.join(__dirname, "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const filePath = path.join(tempDir, `yt_${Date.now()}.mp4`);

      const cookiesPath = "cookies.txt";
      if (!fs.existsSync(cookiesPath))
        console.warn("⚠️ No cookies.txt file found — some YouTube videos may fail.");

      await ytdlp(videoUrl, {
        output: filePath,
        format: "bestvideo+bestaudio/best",
        mergeOutputFormat: "mp4",
        noCheckCertificates: true,
        geoBypass: true,
        preferFreeFormats: true,
        addHeader: [
          "referer:https://www.youtube.com/",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        ],
        cookies: fs.existsSync(cookiesPath) ? cookiesPath : undefined
      });

      if (!fs.existsSync(filePath)) throw new Error("Downloaded file not found.");

      const sizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);
      message.reaction("✅", event.messageID);
      await message.reply({
        body: `🎬 YouTube Video\n💾 Size: ${sizeMB} MB`,
        attachment: fs.createReadStream(filePath)
      });
      fs.unlinkSync(filePath);
      return;
    }

    // ---- OTHER LINKS ----
    const res = await axios.get(`https://noobs-api.top/dipto/alldl?url=${encodeURIComponent(videoUrl)}`);
    const data = res.data || {};
    const title = data.title || data.caption || "Downloaded File";
    const link =
      data.result ||
      data.url ||
      data.link ||
      data.download ||
      (data.data && (data.data.url || data.data.link)) ||
      null;

    if (!link) throw new Error("API returned no downloadable URL.");

    message.reaction("✅", event.messageID);
    await message.reply({
      body: title,
      attachment: await global.utils.getStreamFromURL(link, "video.mp4")
    });
  } catch (error) {
    message.reaction("❌", event.messageID);
    console.error("Download Error:", error);
    message.reply(`❌ Failed to download: ${error.message}`);
  }
}