const axios = require("axios");

if (!global.temp) global.temp = {}; if (!global.temp.uncensoredMemory) global.temp.uncensoredMemory = {};

const memory = global.temp.uncensoredMemory;

module.exports = { config: { name: "uncensored-ai", aliases: ["unai", "ugpt"], version: "1.4", author: "Mahi--", countDown: 3, role: 0, shortDescription: { en: "Talk to uncensored AI model (Dolphin 3.0)" }, longDescription: { en: "Uses Anchestor Uncensored API to have raw, unrestricted AI conversations." }, category: "AI", guide: { en: "{pn} <your message>\nThen reply to continue the conversation.\nUse {pn} clear to reset memory." } },

onStart: async function ({ args, message, event }) { const senderID = event.senderID;

if (args[0]?.toLowerCase() === "clear") {
  memory[senderID] = [];
  return message.reply("🧠 Your conversation memory with AI has been cleared.");
}

if (!args[0]) return message.reply("Please enter a message to send.");
const input = args.join(" ");
event.body = input;
return this.sendToVenice({ event, message, prompt: input });

},

onReply: async function ({ event, Reply, message }) { if (Reply.commandName !== this.config.name || Reply.author !== event.senderID) return; return this.sendToVenice({ event, message, prompt: event.body }); },

sendToVenice: async function ({ event, message, prompt }) { const senderID = event.senderID; if (!memory[senderID]) memory[senderID] = []; memory[senderID].push(prompt); if (memory[senderID].length > 10) memory[senderID] = memory[senderID].slice(-10);

const conversation = memory[senderID].map(m => ({ content: m, role: "user" }));

const payload = {
  requestId: "AcQje3C",
  conversationType: "text",
  type: "text",
  modelId: "dolphin-3.0-mistral-24b",
  modelName: "Venice Uncensored",
  modelType: "text",
  prompt: conversation,
  systemPrompt: "",
  messageId: "GJdVqlC",
  includeVeniceSystemPrompt: true,
  isCharacter: false,
  userId: "user_anon_" + senderID,
  simpleMode: false,
  characterId: "",
  id: "",
  textToSpeech: {
    voiceId: "af_sky",
    speed: 1
  },
  webEnabled: true,
  reasoning: true,
  clientProcessingTime: 6
};

try {
  const response = await axios({
    method: 'POST',
    url: 'https://outerface.venice.ai/api/inference/chat',
    headers: {
      'Content-Type': 'application/json',
      'X-Venice-Version': 'interface@20250619.214544+97d3b0a',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
      'Referer': 'https://venice.ai/chat/MFT6B2s'
    },
    data: payload
  });

  let chunks = [];
  if (Array.isArray(response.data)) {
    chunks = response.data;
  } else if (typeof response.data === 'string') {
    try {
      chunks = response.data.match(/\{[^{}]*\}/g)?.map(s => JSON.parse(s)) || [];
    } catch (_) {
      return message.reply("🛑 Failed to parse response from Venice AI.");
    }
  } else if (typeof response.data === 'object' && response.data !== null) {
    chunks = response.data.data || [];
  }

  if (!chunks.length) return message.reply("I didn't get a response from the AI. Please try again.");

  const output = chunks.map(c => c.content).join('').trim();
  if (!output) return message.reply("🧠 AI responded with empty content.");

  message.reply(output, (err, info) => {
    if (info) global.GoatBot.onReply.set(info.messageID, {
      commandName: this.config.name,
      author: senderID
    });
  });

} catch (err) {
  console.error("Uncensored AI Error:", err?.response?.data || err);
  return message.reply("❌ Anchestor uncensored AI is not responding or returned unexpected data.");
}

} };