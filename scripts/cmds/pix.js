const axios = require("axios");

module.exports = {
  config: {
    name: "pix",
    aliases: [],
    version: "1.3",
    author: "Eijah Noah",
    countDown: 5,
    role: 0,
    shortDescription: "Generate Pix video",
    longDescription: "Reply to an image and use a style index to generate Pix video",
    category: "ai",
    guide: "{p}pix <templateIndex> (must reply to an image)\nExample: {p}pix 1\n{p}pixlist"
  },

  onStart: async function ({ message, event, args }) {
    const reply = event.messageReply;
    if (!reply || !reply.attachments || reply.attachments[0]?.type !== "photo") {
      return message.reply("❌ Please reply to an image.\nExample: !pix 1");
    }

    const imageUrl = reply.attachments[0].url;
    const templateIndex = args[0] ? parseInt(args[0]) : null;

    if (!templateIndex || isNaN(templateIndex) || templateIndex < 1) {
      return message.reply("❌ Invalid template index. Use a number starting from 1.\nExample: !pix 1");
    }

    try {
      const templateRes = await axios.get("http://140.238.246.35:2000/pix/templates");
      const templates = templateRes.data.templates || [];
      const selected = templates.find(t => t.index === templateIndex);

      if (!selected) {
        return message.reply(`❌ Template #${templateIndex} not found. Use !pixlist to see available templates.`);
      }

      const res = await axios.post("http://140.238.246.35:2000/pix/generate-video", {
        imageUrl,
        templateIndex
      }, {
        headers: { "Content-Type": "application/json" }
      });

      const { videoUrl, availableAccounts, availableCredits } = res.data;

      if (!videoUrl) {
        return message.reply("⚠ The API did not return a video.");
      }

      const stream = await global.utils.getStreamFromURL(videoUrl);

      return message.reply({
        body: `🎬 Pix Video Generated!\nStyle: #${templateIndex} (${selected.name})\nAccounts: ${availableAccounts} | Credits: ${availableCredits}`,
        attachment: stream
      });

    } catch (error) {
      return message.reply("❌ Failed to generate video:\n" + (error?.error || error.message));
    }
  }
};