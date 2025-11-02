module.exports = {
  config: {
    name: "profile",
    aliases: ["pfp"],
    version: "1.1",
    author: "Mahi--",
    countDown: 5,
    role: 0,
    shortDescription: "Get profile picture",
    longDescription: "Get the profile picture of a user by UID or mention.",
    category: "image",
    guide: {
      en: "   {pn} [@tag|uid]"
    }
  },

  langs: {
    vi: {
      noTag: "Bạn phải tag người bạn muốn tát"
    },
    en: {
      noTag: "You must tag the person or provide a UID to get their profile picture."
    }
  },

  onStart: async function ({ event, message, usersData, args, getLang }) {
    let avt;
    const uid1 = event.senderID; // Default to sender's UID
    const uid2 = Object.keys(event.mentions)[0] || args[0]; // Get UID from mention or argument

    if (event.type === "message_reply") {
      // If the command is a reply, get the profile picture of the replied user
      avt = await usersData.getAvatarUrl(event.messageReply.senderID);
    } else {
      if (!uid2) {
        // If no UID or mention is provided, get the sender's profile picture
        avt = await usersData.getAvatarUrl(uid1);
      } else {
        // Get the profile picture of the mentioned user or provided UID
        avt = await usersData.getAvatarUrl(uid2);
      }
    }

    // Send the profile picture
    message.reply({
      body: "", // Optional: Add a message here if needed
      attachment: await global.utils.getStreamFromURL(avt)
    });
  }
};