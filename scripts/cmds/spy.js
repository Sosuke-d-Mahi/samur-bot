const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment-timezone");

module.exports = {
  config: {
    name: "spy",
    aliases: ["getinfo", "stalk"],
    version: "3.0",
    author: "Mahi--",
    countDown: 15,
    role: 0,
    shortDescription: "Get comprehensive user information",
    longDescription: "Retrieve detailed user info including profile data, activity, and common groups",
    category: "tools",
    guide: "{pn} @mention or reply or uid"
  },

  onStart: async function ({ event, message, args, api, usersData, threadsData }) {
    try {
      const uid = Object.keys(event.mentions)[0] || args[0] || (event.type === "message_reply" && event.messageReply.senderID) || event.senderID;
      
      // Get basic Facebook info
      const fbInfo = await api.getUserInfo(uid);
      const user = fbInfo[uid];
      
      // Get extended bot data
      const userData = await usersData.get(uid);
      const threads = await threadsData.getAll();
      
      // Calculate first seen
      const firstSeen = userData?.createdAt 
        ? `${moment().diff(moment(userData.createdAt), 'days')} days ago` 
        : "Unknown";
      
      // Get common groups (max 5)
      const commonGroups = threads
        .filter(thread => 
          thread.members?.some(m => m.userID === uid && m.inGroup)
        )
        .slice(0, 5)
        .map(thread => thread.threadName || `ID: ${thread.threadID}`);

      // Get profile and cover photos
      const avatar = await usersData.getAvatarUrl(uid);
      let coverURL = await this.getCoverPhoto(uid, user.profileUrl || `https://facebook.com/${user.vanity || uid}`);
      
      // Prepare attachments
      const attachments = [await global.utils.getStreamFromURL(avatar)];
      if (coverURL) {
        try {
          attachments.push(await global.utils.getStreamFromURL(coverURL));
        } catch (e) {
          console.error("Cover photo error:", e);
        }
      }

      // Format the report
      const report = `
🕵️‍♂️ 𝗖𝗢𝗠𝗣𝗥𝗘𝗛𝗘𝗡𝗦𝗜𝗩𝗘 𝗨𝗦𝗘𝗥 𝗥𝗘𝗣𝗢𝗥𝗧
━━━━━━━━━━━━━━━━━━━

🔹 𝗕𝗮𝘀𝗶𝗰 𝗜𝗻𝗳𝗼:
👤 Name: ${user.name || "N/A"}
🆔 UID: ${uid}
🔗 Profile: ${user.profileUrl || `https://facebook.com/${user.vanity || uid}`}
🧬 Gender: ${user.gender == 2 ? "Male" : user.gender == 1 ? "Female" : "Unknown"}
🎂 Birthday: ${user.isBirthday ? "🎂 TODAY" : user.birthday || "Not set"}

🔹 𝗦𝗼𝗰𝗶𝗮𝗹 𝗦𝘁𝗮𝘁𝘀:
👥 Friends: ${user.isFriend ? "✅ Yes" : "❌ No"}
📅 First Seen: ${firstSeen}
💰 Money: $${userData?.money?.toLocaleString() || "0"}

🔹 𝗔𝗰𝘁𝗶𝘃𝗶𝘁𝘆:
📝 Search Tags: ${user.searchTokens?.join(", ") || "None"}
👥 Common Groups: ${commonGroups.length > 0 ? commonGroups.join("\n                   ") : "None"}

🖼️ Attachments: Profile Photo ${coverURL ? "+ Cover Photo" : ""}
━━━━━━━━━━━━━━━━━━━
      `.trim();

      await message.reply({
        body: report,
        attachment: attachments
      });

    } catch (err) {
      console.error("SPY Error:", err);
      await message.reply("❌ Failed to gather user information. Please try again later.");
    }
  },

  getCoverPhoto: async function(uid, profileURL) {
    try {
      const cookiePath = path.join(process.cwd(), 'account.txt');
      if (!fs.existsSync(cookiePath)) return null;
      
      const cookie = fs.readFileSync(cookiePath, 'utf8');
      const response = await axios.get(profileURL, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
          'cookie': cookie
        },
        timeout: 10000
      });

      const matches = response.data.match(/https:\/\/scontent\.[^"\s]+\.fbcdn\.net\/[^\s"']+/g) || [];
      const cleanUrls = matches
        .map(url => url.replace(/&amp;/g, '&'))
        .filter(url => !url.includes('stp=dst-jpg_fb50_s320x320_tt6'));
      
      return cleanUrls[0] || null;
    } catch (e) {
      console.error("Cover photo fetch error:", e.message);
      return null;
    }
  }
};