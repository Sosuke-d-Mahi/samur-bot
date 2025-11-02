const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "fcp",
    version: "1.1",
    author: "Mahi-- × Akash",
    description: "Fetch Facebook cover photo by replying to a user, providing UID, or fetching your own",
    category: "utility",
    usage: "/fcp {uid} or reply to a message",
  },

  onStart: async function({ api, event, args, message }) {
    let uid = "";

    // If the command is a reply to another user's message
    if (event.messageReply) {
      uid = event.messageReply.senderID;
    } 
    // If a UID is provided via arguments
    else if (args.length > 0) {
      uid = args[0];
    } 
    // If no UID is provided, use the event sender's UID
    else {
      uid = event.senderID;
    }

    // Load cookies from account.txt file in the main folder
    const accountFilePath = './account.txt';  // Set the correct path for the root folder

    fs.readFile(accountFilePath, 'utf8', async (err, data) => {
      if (err) {
        return message.reply("Error reading account.txt: " + err);
      }

      let cookies = {};
      try {
        const json = JSON.parse(data);

        // Convert cookies from JSON to the appropriate format
        json.forEach(cookie => {
          if (cookie.key && cookie.value) {
            cookies[cookie.key] = cookie.value;
          }
        });

      } catch (parseError) {
        return message.reply("Error parsing account.txt: " + parseError);
      }

      // Set the Facebook URL for the given user UID
      const url = "https://www.facebook.com/" + uid;

      try {
        // Fetch the user's Facebook page
        const response = await axios.get(url, {
          headers: {
            Cookie: Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join('; ')
          }
        });

        const $ = cheerio.load(response.data);

        // Locate the profile cover photo container
        const coverContainer = $('#profile_cover_photo_container');

        if (coverContainer.length) {
          const imgTag = coverContainer.find('img');

          if (imgTag.length) {
            const imgSrc = imgTag.attr('src');
            
            // Send the cover image to the group/chat
            await message.send({
              body: `Facebook Cover Image of UID: ${uid}`,
              attachment: await axios.get(imgSrc, { responseType: 'stream' })
                .then(response => response.data)
            });
          } else {
            return message.reply("No cover image found for this user.");
          }
        } else {
          return message.reply("Profile cover photo container not found for this user.");
        }

      } catch (error) {
        // Handle different error scenarios
        if (error.response) {
          message.reply(`Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          message.reply('Error: No response received from the server');
        } else {
          message.reply('Error: ' + error.message);
        }
      }
    });
  }
};