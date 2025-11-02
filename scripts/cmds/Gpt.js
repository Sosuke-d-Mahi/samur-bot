const fetch = require("node-fetch");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const OWNER_UIDS = ["61568425442088", "61568425442088"];
const maxStorageMessage = 69;

if (!global.temp) {
  global.temp = {};
}
if (!global.temp.voicePreference) {
  global.temp.voicePreference = {};
}
if (!global.temp.conversationHistroy) {
  global.temp.conversationHistroy = {};
}
if (!global.utils || !global.utils.getStreamFromURL) {
  console.error("global.utils.getStreamFromURL is not defined! Features requiring it may fail.");
  global.utils = global.utils || {};
  global.utils.getStreamFromURL = async (url) => {
    const response = await axios.get(url, { responseType: 'stream' });
    return response.data;
  };
}

const { voicePreference, conversationHistroy } = global.temp;

async function enhancePrompt(originalPrompt) {
  try {
    const enhancementInstruction = `You are a prompt enhancer for an AI image generator. Rewrite the following user prompt to be more vivid, detailed, and descriptive. Only return the enhanced prompt itself, with no extra text or explanation. Original prompt: "${originalPrompt}"`;
    const response = await axios.get(`http://193.149.164.168:2115/api/gemini?text=${encodeURIComponent(enhancementInstruction)}`);
    const enhanced = response.data?.response?.trim();
    return enhanced && enhanced.length > 0 ? enhanced : originalPrompt;
  } catch (error) {
    console.error("Error enhancing prompt:", error);
    return originalPrompt;
  }
}

async function checkIfImageGenerationNeeded(text) {
  try {
    const response = await axios.get(`http://193.149.164.168:2115/api/gemini?text=${encodeURIComponent(`Analyze this text and respond only with "yes" if it's requesting image generation or "no" if it's normal chat. Text: "${text}"`)}`);
    return response.data?.response?.trim().toLowerCase() === "yes";
  } catch (error) {
    console.error("Error checking image generation need:", error);
    return false;
  }
}

async function getChatResponse(history) {
  try {
    const headers = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'authorization': 'Bearer sk-ced4516241824d3e677fb2a127ea1d32f4bfbd67f138e917',
      'content-type': 'application/json',
      'cookie': 'cf_clearance=ieALUex.pYgnUZ8UpXmBG3iRLmu6WOmAaFdMOBdNnF0-1753807911-1.2.1.1-dQEn93MoFYP_eiJhTIPyYe3zHrSGNFagLOSY1KyaSU76RGiVvBnPSXbaEJ4dTnJ7LmF08l6S_NVV20MCaXaoB94geAkZY9P3cdNdOdmK3BDRZDYIOiLoTJ_gQMkrd7d6HUFxzOGvmltkefQqg.QI4oQEHWfBueS42mhh0HHFguEUsKRYNKsLPt62kaRM1eJKzHawR1SwMhI37t583XVC7CXrl8GPCEjsCL81bAMr8CM',
      'origin': 'https://exomlapi.com',
      'referer': 'https://exomlapi.com/chat',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
    };
    const payload = {
      model: "gpt-5-chat",
      messages: [
        { "role": "system", "content": "You are a helpful assistant." },
        ...history
      ],
      stream: false
    };
    const response = await axios.post('https://exomlapi.com/v1/chat/completions', payload, { headers });
    if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    } else {
      console.error("Chat API response format is invalid:", response.data);
      return "❌ The AI returned an unexpected response format.";
    }
  } catch (error) {
    console.error("Chat API Error:", error.response ? error.response.data : error.message);
    return "❌ An error occurred while communicating with the AI service. Please try again later.";
  }
}

module.exports = {
  config: {
    name: "gpt",
    version: "2.3",
    author: "Mahi--",
    countDown: 25,
    role: 0,
    shortDescription: "AI chat, image generation/editing, and TTS.",
    longDescription: "Chat with AI, generate/edit images with prompt enhancement, convert text to speech, and toggle voice responses.",
    category: "ai",
    guide: {
      en: "• /gpt <text>: Chat with AI, or let the AI detect if you want an image.\n" +
        "• /gpt imagine <prompt> --ar <ratio>: Generate an image with an enhanced prompt.\n" +
        "• /gpt (reply to image) <edit_prompt>: Edit the replied image.\n" +
        "• /gpt speak <text>: Convert text to speech.\n" +
        "• /gpt voice on/off: Toggle voice responses for chat.\n" +
        "• /gpt clear: Clear conversation history"
    }
  },

  langs: {
    en: {
      error: "❌ An error occurred: %1",
      downloading_edit: "✨ Editing your image with prompt \"%1\"...",
      invalid_reply_image: "⚠️ Please reply to an image to edit.",
      usage_edit_prompt: "⚠️ You must provide a prompt for image editing. Example: /gpt make background red (while replying to an image)",
      clearHistory: "🗑️ Conversation history cleared successfully.",
      invalid_aspect_ratio: "⚠️ Invalid aspect ratio format. Use --ar W:H (e.g., --ar 16:9)"
    }
  },

  onStart: async function ({ api, event, args, message, getLang }) {
    const senderID = event.senderID.toString();
    let text_args = args.join(" ").trim();
    const reply = event.messageReply;

    if (args[0]?.toLowerCase() === "clear") {
      conversationHistroy[senderID] = [];
      return message.reply(getLang("clearHistory"));
    }

    if (reply && reply.attachments && reply.attachments[0]?.type === "photo" && args.length > 0) {
      try {
        const prompt = text_args;
        if (!prompt) return message.reply(getLang("usage_edit_prompt"));
        api.setMessageReaction("⏳", event.messageID, () => {}, true);
        const images = reply.attachments.slice(0, 5);
        const base64Imgs = [];
        for (const att of images) {
          if (att.type === "photo" || att.type === "image") {
            const res = await axios.get(att.url, { responseType: "arraybuffer" });
            base64Imgs.push(Buffer.from(res.data, "binary").toString("base64"));
          }
        }
        if (base64Imgs.length === 0) {
          api.setMessageReaction("⚠️", event.messageID, () => {}, true);
          return message.reply("⚠️ No valid images found in the replied message.");
        }
        const payload = { prompt, images: base64Imgs, ratio: "1:1", format: "jpg" };
        const res = await axios.post("https://gpt-1-m8mx.onrender.com/edit", payload, { responseType: "arraybuffer", timeout: 180000 });
        const outPath = path.join(__dirname, "cache", "edit_output.jpg");
        fs.writeFileSync(outPath, res.data);
        await message.reply({ body: `✅ Edited Image\nPrompt: ${prompt}`, attachment: fs.createReadStream(outPath) });
        fs.unlinkSync(outPath);
        api.setMessageReaction("✅", event.messageID, () => {}, true);
      } catch (err) {
        console.error(err);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        return message.reply(`❌ Error during image editing: ${err.message}`);
      }
      return;
    }

    const isVoiceToggle = /^(voice)\s(on|off)$/i.test(text_args);
    if (isVoiceToggle) {
      const toggle = args[1]?.toLowerCase();
      if (toggle === "on") {
        voicePreference[senderID] = true;
        return message.reply("✅ | Voice mode enabled.");
      } else if (toggle === "off") {
        voicePreference[senderID] = false;
        return message.reply("❌ | Voice mode disabled.");
      }
      return;
    }

    const isImageGenCommand = /^(gen|imagine|create\simage|draw)/i.test(args[0]);
    let autoDetectedImageRequest = false;
    if (!isImageGenCommand && args.length > 0 && !isVoiceToggle) {
        autoDetectedImageRequest = await checkIfImageGenerationNeeded(text_args);
    }
    
    if (isImageGenCommand || autoDetectedImageRequest) {
      try {
        let aspectRatio = "1:1";
        let prompt = text_args;

        if(isImageGenCommand) {
            const arRegex = /--ar\s+(\d+:\d+)/i;
            const arMatch = text_args.match(arRegex);
            if (arMatch) {
                aspectRatio = arMatch[1];
                prompt = text_args.replace(arRegex, '').trim();
            }
            prompt = prompt.replace(/^(gen|imagine|create\simage|draw)\s+/i, "");
        }

        if (!prompt) return message.reply("🖼️ | Please provide a prompt for image generation.");

        api.setMessageReaction("🧠", event.messageID, () => {}, true);
        const statusMsg = await message.reply(`Enhancing your prompt: "${prompt}"...`);
        
        const enhancedPrompt = await enhancePrompt(prompt);

        api.editMessage(`Generating image with enhanced prompt:\n\n✨ ${enhancedPrompt}`, statusMsg.messageID);
        api.setMessageReaction("🎨", event.messageID, () => {}, true);

        const payload = { prompt: enhancedPrompt, images: [], ratio: aspectRatio, format: "jpg" };
        const res = await axios.post("https://gpt-1-m8mx.onrender.com/edit", payload, { responseType: "arraybuffer", timeout: 180000 });
        const outPath = path.join(__dirname, "cache", "gen_output.jpg");
        fs.writeFileSync(outPath, res.data);

        await message.reply({
          body: `🖼️ Here is your image:\n\nOriginal prompt: ${prompt}\nEnhanced prompt: ${enhancedPrompt}`,
          attachment: fs.createReadStream(outPath)
        });

        fs.unlinkSync(outPath);
        api.unsendMessage(statusMsg.messageID);
        api.setMessageReaction("✅", event.messageID, () => {}, true);

      } catch (error) {
        console.error("Image Generation Error:", error);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        message.reply(`❌ | Image generation failed: ${error.message}`);
      }
      return;
    }

    const isTTS = /^(speak|say|tts|voice)/i.test(args[0]);
    if (isTTS && args.length > 1 && !isVoiceToggle) {
      const speechText = text_args.replace(/^(speak|say|tts|voice)\s+/i, "");
      if (!speechText) return message.reply("🗣️ | Please provide text to convert to speech.");
      const ttsUrl = `https://tts-siam-apiproject.vercel.app/speech?text=${encodeURIComponent(speechText)}`;
      try {
        message.reply({ body: `🗣️ | Speech for: "${speechText}"`, attachment: await global.utils.getStreamFromURL(ttsUrl) });
      } catch (error) {
        console.error("TTS Error:", error);
        message.reply("❌ | Failed to generate speech. Try again.");
      }
      return;
    }

    if (args.length === 0 && !reply) return message.reply("❓ | Provide a message, image prompt, or text for TTS.");
    if (args.length === 0 && reply && (!reply.attachments || reply.attachments[0]?.type !== "photo")) {
      return message.reply("💬 | Please provide a message to chat about, or a prompt if replying to an image for editing.");
    }
    if (args.length === 0 && reply && reply.attachments && reply.attachments[0]?.type === "photo") {
      return message.reply(getLang("usage_edit_prompt"));
    }

    let userQuery = text_args;
    const ownerPassword = "01200120";
    let isChatOwnerMode = false;
    if (userQuery.startsWith(ownerPassword) && OWNER_UIDS.includes(senderID)) {
      isChatOwnerMode = true;
      userQuery = userQuery.substring(ownerPassword.length).trim();
    }
    if (!userQuery && isChatOwnerMode) {
      return message.reply("🔑 | Owner chat mode: Please provide a prompt after the password.");
    }
    if (!userQuery && !isChatOwnerMode && args.length > 0) {
      userQuery = text_args;
    } else if (!userQuery && !isChatOwnerMode) {
      return message.reply("💬 | Please provide a message to chat about.");
    }

    if (!conversationHistroy[senderID]) {
      conversationHistroy[senderID] = [];
    }
    if (conversationHistroy[senderID].length >= maxStorageMessage) {
      conversationHistroy[senderID].shift();
    }
    conversationHistroy[senderID].push({ role: "user", content: userQuery });
    api.setMessageReaction("⏳", event.messageID, () => {}, true);
    const aiReply = await getChatResponse(conversationHistroy[senderID]);
    api.setMessageReaction("✅", event.messageID, () => {}, true);
    conversationHistroy[senderID].push({ role: "assistant", content: aiReply });

    if (voicePreference[senderID]) {
      const ttsUrl = `https://tts-siam-apiproject.vercel.app/speech?text=${encodeURIComponent(aiReply)}`;
      try {
        message.reply({ body: aiReply, attachment: await global.utils.getStreamFromURL(ttsUrl) }, (err, info) => {
          if (err) return console.error(err);
          global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
        });
      } catch (ttsError) {
        console.error("TTS Conversion Error for AI reply:", ttsError);
        message.reply(aiReply, (err, info) => {
          if (err) return console.error(err);
          global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
        });
      }
    } else {
      message.reply(aiReply, (err, info) => {
        if (err) return console.error(err);
        global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
      });
    }
  },

  onReply: async function ({ Reply, message, event, args, api }) {
    const { author, commandName } = Reply;
    if (author !== event.senderID || commandName !== "gpt") return;
    const userInput = args.join(" ");
    const senderID = event.senderID.toString();
    if (!conversationHistroy[senderID]) {
      conversationHistroy[senderID] = [];
    }
    if (conversationHistroy[senderID].length >= maxStorageMessage) {
      conversationHistroy[senderID].shift();
    }
    conversationHistroy[senderID].push({ role: "user", content: userInput });
    api.setMessageReaction("⏳", event.messageID, () => {}, true);
    const aiReply = await getChatResponse(conversationHistroy[senderID]);
    api.setMessageReaction("✅", event.messageID, () => {}, true);
    conversationHistroy[senderID].push({ role: "assistant", content: aiReply });

    if (voicePreference[senderID]) {
      const ttsUrl = `https://tts-siam-apiproject.vercel.app/speech?text=${encodeURIComponent(aiReply)}`;
      try {
        message.reply({ body: aiReply, attachment: await global.utils.getStreamFromURL(ttsUrl) }, (err, info) => {
          if (err) return console.error(err);
          global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
        });
      } catch (ttsError) {
        console.error("TTS Conversion Error for AI reply:", ttsError);
        message.reply(aiReply, (err, info) => {
          if (err) return console.error(err);
          global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
        });
      }
    } else {
      message.reply(aiReply, (err, info) => {
        if (err) return console.error(err);
        global.GoatBot.onReply.set(info.messageID, { commandName: "gpt", author: event.senderID, messageID: info.messageID });
      });
    }
  }
};