const axios = require("axios");

async function getStreamFromURL(url) {
  const response = await axios.get(url, { responseType: "stream" });
  return response.data;
}

async function fetchTikTokVideos(query) {
  try {
    const response = await axios.get(`https://egret-driving-cattle.ngrok-free.app/api/tiktok?search=${query}`);
    return response.data.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

module.exports = {
  config: {
    name: "anisearch",
    aliases: ["animeedit", "tiktoksearch"],
    author: "Mahi--",
    version: "3.0",
    shortDescription: {
      en: "Search TikTok anime edit videos",
    },
    longDescription: {
      en: "Search TikTok anime edit videos. Supports --list to pick from results.",
    },
    category: "fun",
    guide: {
      en: "{p}{n} [query]\n{p}{n} [query] --list",
    },
  },

  onStart: async function ({ api, event, args }) {
    api.setMessageReaction("✨", event.messageID, () => {}, true);

    const query = args.filter(a => a !== "--list").join(" ");
    const listMode = args.includes("--list");

    if (!query) {
      return api.sendMessage({ body: "⚠️ Please provide a search query." }, event.threadID, event.messageID);
    }

    // Force anime edit
    const modifiedQuery = `${query} anime edit`;
    const videos = await fetchTikTokVideos(modifiedQuery);

    if (!videos || videos.length === 0) {
      return api.sendMessage({ body: `❌ No videos found for query: ${query}.` }, event.threadID, event.messageID);
    }

    if (listMode) {
      let msg = `📋 Anime Edit Results for: "${query}"\n\n`;
      videos.forEach((v, i) => {
        msg += `${i + 1}. ${v.title.slice(0, 60)}...\n`;
      });
      msg += `\n👉 Reply with the number to download a video.`;

      return api.sendMessage(msg, event.threadID, (err, info) => {
        if (err) return;
        global.GoatBot.onReply.set(info.messageID, {
          commandName: module.exports.config.name,
          messageID: info.messageID,
          author: event.senderID,
          videos
        });
      });
    }

    // Default random mode
    const selectedVideo = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = selectedVideo.video;
    const title = selectedVideo.title || "No title available";

    if (!videoUrl) {
      return api.sendMessage({ body: "❌ Error: Video not found in API response." }, event.threadID, event.messageID);
    }

    try {
      const videoStream = await getStreamFromURL(videoUrl);

      await api.sendMessage({
        body: `🎥 Video Title: ${title}\n\nHere's your video!`,
        attachment: videoStream,
      }, event.threadID, event.messageID);
    } catch (error) {
      console.error(error);
      api.sendMessage({ body: "❌ An error occurred while processing the video." }, event.threadID, event.messageID);
    }
  },

  onReply: async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const index = parseInt(event.body.trim(), 10) - 1;
    if (isNaN(index) || index < 0 || index >= Reply.videos.length) {
      return api.sendMessage("⚠️ Invalid selection. Please reply with a valid number.", event.threadID, event.messageID);
    }

    const selectedVideo = Reply.videos[index];
    const videoUrl = selectedVideo.video;
    const title = selectedVideo.title || "No title available";

    try {
      const videoStream = await getStreamFromURL(videoUrl);

      await api.sendMessage({
        body: `🎬 You selected #${index + 1}:\n${title}`,
        attachment: videoStream,
      }, event.threadID, event.messageID);

      api.unsendMessage(Reply.messageID);
      global.GoatBot.onReply.delete(Reply.messageID);
    } catch (error) {
      console.error(error);
      api.sendMessage({ body: "❌ An error occurred while fetching the video." }, event.threadID, event.messageID);
    }
  }
};