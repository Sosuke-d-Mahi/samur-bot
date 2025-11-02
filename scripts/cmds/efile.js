const fs = require('fs-extra');
const path = require('path'); // Import path for better path handling

const { getPrefix } = global.utils;

module.exports = {
  config: {
    name: 'efile',
    version: '1.1',
    role: 0,
    coolDown: 5,
    author: 'Mahi--',
    category: 'Admin',
    shortDescription: {
      en: 'sending event file'
    },
    longDescription: {
      en: 'Sending event file from bot scripts',
    },
  },
  onStart: async function ({ api, event, args, message }) {
    const permission = ['100072881080249', '100094357823033'];
    if (!permission.includes(event.senderID)) {
      return api.sendMessage('Only Bot Admin\'s can use this command. My Sensei mahi can do this.', event.threadID, event.messageID);
    }

    const { threadID, messageID } = event;
    const prefix = getPrefix(threadID);
    const commandName = this.config.name;
    const command = prefix + commandName;

    // Check if file name is provided
    if (args.length === 0) {
      return message.reply(`File এর নাম কে দিবে? Use: ${command} <file_name>`);
    }

    let fileName = args[0];

    // Automatically append .js if no extension is provided
    if (!fileName.includes('.')) {
      fileName += '.js';
    }

    // Path to `scripts/events` directory
    const filePath = path.join(__dirname, '..', 'events', fileName);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return message.reply(`File ${fileName} নাই, নাম ঠিক দিছস তো??`);
    }

    try {
      const fileData = fs.readFileSync(filePath, 'utf-8');
      api.sendMessage(fileData, threadID, messageID);
    } catch (error) {
      console.error(error);
      message.reply(`তোর file e problem আছে চেক দে.`);
    }
  }
};