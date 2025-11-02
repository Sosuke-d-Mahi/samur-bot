const urban = require('@dmzoneill/urban-dictionary');
const googleDictionaryApi = require('google-dictionary-api');

module.exports = {
  config: {
    name: "define",
    version: "1.2",
    author: "Mahi--",
    countDown: 5,
    shortDescription: {
      en: "Get the definition of a word."
    },
    category: "utility",
    guide: "{prefix}define <word>"
  },

  onStart: async function({ message, args }) {
    const word = args.join(" ");
    if (!word) {
      return message.reply("Please provide a word to define.");
    }

    try {
      // First, try to get an Urban Dictionary definition
      const urbanResult = await urban.define(word);

      if (urbanResult && urbanResult.length > 0) {
        const definition = urbanResult[0];
        let response = `📖 𝗨𝗿𝗯𝗮𝗻 𝗗𝗶𝗰𝘁𝗶𝗼𝗻𝗮𝗿𝘆\n` +
                       `› ${definition.word}\n\n` +
                       `» 𝗠𝗲𝗮𝗻𝗶𝗻𝗴:\n${definition.definition.replace(/[\[\]]/g, '')}\n\n` +
                       `» 𝗘𝘅𝗮𝗺𝗽𝗹𝗲:\n- ${definition.example.replace(/[\[\]]/g, '')}\n\n` +
                       `👍 ${definition.thumbs_up} | 👎 ${definition.thumbs_down}`;
        return message.reply(response);
      }
    } catch (urbanError) {
      // If Urban Dictionary fails, try the standard dictionary
      try {
        const googleResult = await googleDictionaryApi.search(word, 'en');

        if (googleResult && googleResult.length > 0) {
          const definition = googleResult[0];
          let response = `📚 𝗦𝘁𝗮𝗻𝗱𝗮𝗿𝗱 𝗗𝗶𝗰𝘁𝗶𝗼𝗻𝗮𝗿𝘆\n` +
                         `› ${definition.word}\n- ${definition.phonetic || ''}\n\n`;

          for (const meaningType in definition.meaning) {
            response += `✦ ${meaningType.charAt(0).toUpperCase() + meaningType.slice(1)}\n`;
            definition.meaning[meaningType].forEach((item, index) => {
              response += `   ${index + 1}. ${item.definition}\n`;
              if (item.example) {
                response += `   ⇾ 𝘌𝘹𝘢𝘮𝘱𝘭𝘦: ${item.example}\n`;
              }
            });
            response += '\n';
          }
          return message.reply(response);
        }

        // If both fail
        return message.reply(`Sorry, I couldn't find a definition for "${word}".`);

      } catch (googleError) {
        console.error("Google Dictionary Error:", googleError);
        return message.reply("An error occurred while fetching the definition.");
      }
    }
  }
};