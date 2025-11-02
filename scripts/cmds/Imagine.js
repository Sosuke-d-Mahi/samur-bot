const axios = require("axios");
const { getStreamFromURL } = global.utils;

module.exports = {
  config: {
    name: "imagine",
    version: "1.1.0",
    author: "Mahi--",
    countDown: 10,
    role: 0,
    shortDescription: "Text-based image generation",
    longDescription: "Generate AI images using prompt with all optional parameters (--ar, --sref, --ccref, --model, --steps, --cfg, --sampler, --scheduler, --seed). Includes admin commands.",
    category: "image",
    guide: "{pn} <prompt> [--ar 16:9] [--sref url] [--ccref url] [--model 1] [--steps 25] [--cfg 7] [--sampler euler_ancestral] [--scheduler karras] [--seed 123456]\n{pn} -a force\n{pn} -a info"
  },

  langs: {
    en: {
      error: "❌ An error occurred: %1",
      success: "✅ Image Generated!\n📌 Prompt: %1\n📐 Dimensions: %2\n📬 Account: %3\n🔄 Uses: %4",
      created: "✅ New Piclumen account created:\n📧 %1\n🔑 Token: %2\n🔁 Uses: %3",
      info: "📊 Account Info:\n%1",
      usage: "⚠️ You must provide a prompt. Example: /imagine a dragon flying above mountains",
      invalidAdmin: "⚠️ Invalid admin command. Use -a force or -a info."
    }
  },

  onStart: async function ({ message, args, event, getLang }) {
    const senderID = event.senderID.toString();
    const OWNER_UIDS = ["100089495797706", "61568425442088"];
    const { homo } = (await axios.get("https://raw.githubusercontent.com/h-anchestor/mahi-apis/refs/heads/main/Raw/mahi-apis.json")).data;

    if (args[0] === "-a" && OWNER_UIDS.includes(senderID)) {
      const action = args[1];
      if (action === "force") {
        try {
          const { data } = await axios.post(`${homo}/api/force-picl`);
          return message.reply(getLang("created", data.new_account_info.email, data.new_account_info.tokenSnippet, data.new_account_info.uses));
        } catch (err) {
          return message.reply(getLang("error", err.response?.data || err.message));
        }
      } else if (action === "info") {
        try {
          const { data } = await axios.get(`${homo}/api/picl-info`);
          return message.reply(getLang("info", JSON.stringify(data, null, 2)));
        } catch (err) {
          return message.reply(getLang("error", err.response?.data || err.message));
        }
      } else {
        return message.reply(getLang("invalidAdmin"));
      }
    }

    if (!args.length) return message.reply(getLang("usage"));

    const options = {
      ar: "1:1",
      sref: null,
      ccref: null,
      model: null,
      steps: null,
      cfg: null,
      sampler: null,
      scheduler: null,
      seed: null
    };

    // Parse --options
    const parsedArgs = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith("--")) {
        const key = args[i].substring(2);
        if (options.hasOwnProperty(key) && args[i + 1]) {
          options[key] = args[i + 1];
          i++;
        }
      } else {
        parsedArgs.push(args[i]);
      }
    }

    const prompt = parsedArgs.join(" ");
    if (!prompt) return message.reply(getLang("usage"));

    try {
      const payload = { prompt, ratio: options.ar };

      if (options.sref) payload.sref = options.sref;
      if (options.ccref) payload.ccref = options.ccref;
      if (options.model) payload.model = options.model;
      if (options.steps) payload.steps = parseInt(options.steps);
      if (options.cfg) payload.cfg = parseFloat(options.cfg);
      if (options.sampler) payload.sampler = options.sampler;
      if (options.scheduler) payload.scheduler = options.scheduler;
      if (options.seed) payload.seed = parseInt(options.seed);

      const res = await axios.post(`${homo}/api/mgen`, payload, {
        headers: { "Content-Type": "application/json" }
      });

      const { generatedImageUrl, uses_for_token, account_email, dimensions } = res.data;
      const img = await getStreamFromURL(generatedImageUrl);

      return message.reply({
        body: getLang("success", prompt, dimensions, account_email, uses_for_token),
        attachment: img
      });

    } catch (err) {
      return message.reply(getLang("error", err.response?.data || err.message));
    }
  }
};