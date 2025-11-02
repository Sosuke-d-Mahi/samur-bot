const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

module.exports = {
  config: {
    name: "ins",
    version: "1.0",
    author: "mahi--",
    description: "Install files from URL or text to any location",
    category: "owner",
    guide: {
      en: "{p}ins <url|text> | <destination>"
    }
  },

  onStart: async function ({ api, event, args, message }) {
    // Allowed user IDs including the new one you requested
    const allowedUsers = [
      "100072881080249", 
      "100094357823033", 
      "61568446251173", 
      "100007244055983", 
      "61563659249443", 
      "517122843",
      "61568425442088", 
      "61564947369834", 
      "604987426", // Added this UID as requested
      "100060340563670"
    ];

    if (!allowedUsers.includes(event.senderID.toString())) {
      return message.reply("❌ You don't have permission to use this command.");
    }

    const input = args.join(" ");
    const separatorIndex = input.indexOf("|");
    
    if (separatorIndex === -1) {
      return message.reply("❌ Invalid format. Use: /ins <url|text> | <destination>");
    }

    const source = input.slice(0, separatorIndex).trim();
    let destination = input.slice(separatorIndex + 1).trim();

    try {
      let content;
      
      // Handle URL source
      if (source.startsWith("http")) {
        const response = await axios.get(source);
        content = response.data;
      } 
      // Handle raw text
      else {
        content = source;
      }

      // Normalize destination path
      if (!destination.startsWith("/")) {
        destination = path.join(process.cwd(), destination);
      }

      // Check if file exists
      if (fs.existsSync(destination)) {
        await message.reply("⚠️ File exists. Overwrite? (Reply 'yes' to confirm)", (err, info) => {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "ins",
            author: event.senderID,
            content,
            destination
          });
        });
      } else {
        await this.saveFile(content, destination);
        message.reply(`✅ Installed successfully to:\n${destination}`);
      }
    } catch (error) {
      console.error("Install Error:", error);
      message.reply(`❌ Failed to install: ${error.message}`);
    }
  },

  onReply: async function ({ event, message, Reply }) {
    if (event.body?.toLowerCase() === "yes" && event.senderID === Reply.author) {
      try {
        await this.saveFile(Reply.content, Reply.destination);
        message.reply(`✅ Overwritten successfully:\n${Reply.destination}`);
      } catch (error) {
        message.reply(`❌ Failed to overwrite: ${error.message}`);
      }
      global.GoatBot.onReply.delete(event.messageID);
    }
  },

  saveFile: async function (content, destination) {
    await fs.ensureDir(path.dirname(destination));
    await fs.writeFile(destination, content);
    
    // If it's a JS file, attempt to install dependencies
    if (destination.endsWith('.js')) {
      const regex = /require\(['"]([^'"]+)['"]\)/g;
      let match;
      const packages = new Set();
      
      while ((match = regex.exec(content)) !== null) {
        if (!match[1].startsWith('.') && !match[1].startsWith('/')) {
          packages.add(match[1].split('/')[0]); // Get package name only
        }
      }
      
      if (packages.size > 0) {
        execSync(`npm install ${[...packages].join(' ')} --save`, { stdio: 'inherit' });
      }
    }
  }
};