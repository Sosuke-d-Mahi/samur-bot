const fs = require("fs-extra");
const request = require("request");

module.exports = {
  config: {
    name: "groupinfo",
    aliases: ["boxinfo"],
    version: "2.0",
    author: "Mahi",
    countDown: 5,
    role: 0,
    shortDescription: "View detailed group chat info with image",
    longDescription: "Displays full group details including name, ID, emoji, approval mode, gender stats, nickname list, admin details, join requests, and message stats with group image.",
    category: "group",
    guide: "{p}groupinfo"
  },

  onStart: async function ({ api, event }) {
    try {
      const threadInfo = await api.getThreadInfo(event.threadID);

      const totalMembers = threadInfo.participantIDs.length;
      let maleCount = 0, femaleCount = 0, unknownCount = 0;
      let nicknames = [];

      threadInfo.userInfo.forEach(user => {
        if (user.gender === "MALE") maleCount++;
        else if (user.gender === "FEMALE") femaleCount++;
        else unknownCount++;

        if (threadInfo.nicknames[user.id]) {
          nicknames.push(`${user.name} → ${threadInfo.nicknames[user.id]}`);
        }
      });

      const adminList = [];
      for (const admin of threadInfo.adminIDs) {
        const userInfo = await api.getUserInfo(admin.id);
        adminList.push(userInfo[admin.id].name);
      }

      const approvalStatus = threadInfo.approvalMode ? "✅ On" : "❌ Off";
      const pendingRequests = threadInfo.approvalQueue ? threadInfo.approvalQueue.length : 0;
      const threadName = threadInfo.threadName || "Unnamed Group";
      const icon = threadInfo.emoji || "❔";
      const imageSrc = threadInfo.imageSrc || null;

      const infoMessage = 
`💫 𝗚𝗿𝗼𝘂𝗽 𝗜𝗻𝗳𝗼
──────────────────
📌 Name: ${threadName}
🆔 ID: ${threadInfo.threadID}
🛡 Approval: ${approvalStatus} (${pendingRequests} pending)
😊 Emoji: ${icon}

👥 Members: ${totalMembers}
♂ Males: ${maleCount}
♀ Females: ${femaleCount}
❓ Unknown: ${unknownCount}

👑 Admins (${adminList.length}):
${adminList.map(name => `• ${name}`).join("\n")}

🏷 Nicknames:
${nicknames.length > 0 ? nicknames.join("\n") : "None set"}

💬 Total Messages: ${threadInfo.messageCount}
──────────────────
By: Mahi`;

      if (imageSrc) {
        const imgPath = __dirname + "/cache/group_image.png";
        request(encodeURI(imageSrc))
          .pipe(fs.createWriteStream(imgPath))
          .on("close", () => {
            api.sendMessage(
              { body: infoMessage, attachment: fs.createReadStream(imgPath) },
              event.threadID,
              () => fs.unlinkSync(imgPath),
              event.messageID
            );
          });
      } else {
        api.sendMessage(infoMessage, event.threadID, event.messageID);
      }

    } catch (err) {
      api.sendMessage(`❌ Error fetching group info: ${err.message}`, event.threadID, event.messageID);
    }
  }
};