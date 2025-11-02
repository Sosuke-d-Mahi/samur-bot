const axios = require('axios');
const { getStreamFromURL } = global.utils;

const allmodels = ["madara", "aizen", "ayanokoji", "jinwoo","nami","nami-ja"];
const Langdata = ["en","ja", "ko"];

module.exports = {
  config: {
    name: "aivoice",
    version: "1.0",
    author: "SiAM",
    countDown: 5,
    role: 0,
    category: "Fun",
    ShortDescription: "AI voice generator with different models",
    LongDescription: "Convert your text into voice using different AI models.",
    guide: {
      en: `{pn} 'your text' --model/--m modelname --lang/--l languageCode\n\n` +
          `Available models:\n${allmodels.map(model => `❏ ${model}`).join("\n")}\n\n` +
          `Supported languages:\n${Langdata.map(lang => `❏ ${lang}`).join("\n")}`
    }
  },

  onStart: async function ({ api, args, message, event }) {
    const { getPrefix, getStreamFromURL } = global.utils;
    const p = getPrefix(event.threadID);

    if (!args || args.length === 0) {
      return message.reply(`Provide some text, model, and language code \n\nExample:\n${p}aivoice 'Hello there' --m madara --lang en`);
    }

    
    let modelName = "aizen"; // default model
    const modelFlagIndex = args.findIndex(arg => arg === "--m" || arg === "--model");
    if (modelFlagIndex !== -1 && args.length > modelFlagIndex + 1) {
      modelName = args[modelFlagIndex + 1].toLowerCase();
      args.splice(modelFlagIndex, 2);
    }
    
    if (!allmodels.includes(modelName)) {
      return message.reply(`Invalid model name. Available models are: ${allmodels.join(", ")}`);
    }

    
    let lang = "en"; // default language
    const langFlagIndex = args.findIndex(arg => arg === "--lang" || arg === "--l");
    if (langFlagIndex !== -1 && args.length > langFlagIndex + 1) {
      lang = args[langFlagIndex + 1].toLowerCase();
      args.splice(langFlagIndex, 2);
    }
    
    if (!Langdata.includes(lang)) {
      return message.reply(`Invalid language code. Supported languages: ${supportedLanguages.join(", ")}`);
    }
    

    
    let text = args.join(" ");
    if (!text) {
      return message.reply("Please provide text.");
    }


    if (lang !== "en") {
      try {
        const res = await axios.get(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`
        );
      
        text = res.data[0].map(item => item[0]).join('');
      } catch (translateError) {
        console.error("Translation error:", translateError);
        return message.reply("Error during translation.");
      }
    }

   
    const apiURL = `https://voice-foxai.onrender.com/clonet?text=${encodeURIComponent(text)}&model=${modelName}&lang=${lang}`;
    message.reaction("⏰", event.messageID);

    try {
     
      const response = await axios.get(apiURL);
      const audioUrl = response.data.url;
      if (!audioUrl) return message.reply("No audio URL returned from API.");

   
      const stream = await getStreamFromURL(audioUrl);
      await message.reaction("✅", event.messageID);

     
      return message.reply({
        body: "",
        attachment: stream
      });
    } catch (err) {
      console.error(err);
      message.reply("Error while processing AI voice.");
    }
  }
};
