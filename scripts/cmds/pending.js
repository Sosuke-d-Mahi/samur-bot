const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "pending",
    version: "3.0",
    author: "Mahi--",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Manage pending threads" },
    longDescription: { 
      en: "Approve or cancel pending threads with multi-select, filters, and auto-approve\n\n" +
         "Commands:\n" +
         "- pending: Show all pending threads\n" +
         "- pending search [keyword]: Search threads\n" +
         "- pending filter [large|new]: Filter threads\n" +
         "- pending trust [threadID]: Add to trusted\n" +
         "- pending untrust [threadID]: Remove from trusted"
    },
    category: "admin"
  },

  langs: {
    en: {
      invaildNumber: "⚠️ | %1 is not a valid number",
      cancelSuccess: "❌ | Refused %1 thread(s)!",
      approveSuccess: "✅ | Approved %1 thread(s)!",
      cantGetPendingList: "⚠️ | Failed to fetch pending list!",
      returnListPending: "📩 𝗣𝗘𝗡𝗗𝗜𝗡𝗚 𝗧𝗛𝗥𝗘𝗔𝗗𝗦\n\n𝗧𝗼𝘁𝗮𝗹: %1\n\n%2\n\n" +
                        "Reply with:\n" +
                        "- Numbers to approve (e.g. 1,3,5 or 1-5)\n" +
                        "- 'c' + numbers to cancel (e.g. c1,3 or c1-5)",
      returnListClean: "✨ 𝗡𝗼 𝗽𝗲𝗻𝗱𝗶𝗻𝗴 𝘁𝗵𝗿𝗲𝗮𝗱𝘀 𝘁𝗼 𝗱𝗶𝘀𝗽𝗹𝗮𝘆",
      approvedMessage: "━━━━━━━━━━━━━━━━━━\n" +
                       "   🎊 𝗧𝗛𝗥𝗘𝗔𝗗 𝗔𝗣𝗣𝗥𝗢𝗩𝗘𝗗  \n" +
                       "━━━━━━━━━━━━━━━━━━\n\n" +
                       "✅ 𝗬𝗼𝘂𝗿 𝗴𝗿𝗼𝘂𝗽 𝗵𝗮𝘀 𝗯𝗲𝗲𝗻 𝗮𝗽𝗽𝗿𝗼𝘃𝗲𝗱!\n\n" +
                       "𝗡𝗼𝘁𝗲: 𝗣𝗹𝗲𝗮𝘀𝗲 𝗸𝗲𝗲𝗽 𝘁𝗵𝗶𝘀 𝗴𝗿𝗼𝘂𝗽 𝗮𝗰𝘁𝗶𝘃𝗲 𝘁𝗼 𝗮𝘃𝗼𝗶𝗱 𝗯𝗲𝗶𝗻𝗴 𝗿𝗲𝗺𝗼𝘃𝗲𝗱."
    }
  },

  onReply: async function ({ api, event, Reply, getLang }) {
    if (String(event.senderID) !== String(Reply.author)) return;

    const { body, threadID, messageID } = event;
    let count = 0;

    const parseIndexes = (str) => {
      const result = new Set();
      const parts = str.split(",");
      for (const part of parts) {
        if (part.includes("-")) {
          const [start, end] = part.split("-").map(n => parseInt(n));
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) result.add(i);
          }
        } else {
          const num = parseInt(part);
          if (!isNaN(num)) result.add(num);
        }
      }
      return [...result];
    };

    if (/^c(ancel)?/i.test(body)) {
      const indexes = parseIndexes(body.replace(/^c(ancel)?/i, "").trim());
      for (const idx of indexes) {
        if (idx <= 0 || idx > Reply.pending.length) return api.sendMessage(getLang("invaildNumber", idx), threadID, messageID);
        api.removeUserFromGroup(api.getCurrentUserID(), Reply.pending[idx - 1].threadID);
        count++;
      }
      return api.sendMessage(getLang("cancelSuccess", count), threadID, messageID);
    } else {
      const indexes = parseIndexes(body);
      for (const idx of indexes) {
        if (idx <= 0 || idx > Reply.pending.length) return api.sendMessage(getLang("invaildNumber", idx), threadID, messageID);

        const approvedThread = Reply.pending[idx - 1];
        api.sendMessage(getLang("approvedMessage"), approvedThread.threadID);
        count++;
      }
      return api.sendMessage(getLang("approveSuccess", count), threadID, messageID);
    }
  },

  onStart: async function ({ api, event, args, getLang, commandName }) {
    const { threadID, messageID } = event;

    // Trusted Threads Auto-Approve
    const trustedPath = path.join(__dirname, "trustedThreads.json");
    if (!fs.existsSync(trustedPath)) fs.writeFileSync(trustedPath, JSON.stringify([]));
    const trustedThreads = JSON.parse(fs.readFileSync(trustedPath, "utf8"));

    try {
      const spam = (await api.getThreadList(100, null, ["OTHER"])) || [];
      const pending = (await api.getThreadList(100, null, ["PENDING"])) || [];
      let list = [...spam, ...pending].filter(group => group.isSubscribed && group.isGroup);

      // Safety Check - Minimum member requirement
      list = list.filter(group => {
        const memberCount = group.participantIDs?.length || 0;
        return memberCount >= 3; // Skip groups with less than 3 members
      });

      // Filter/Search
      if (args[0] === "search" && args[1]) {
        const keyword = args.slice(1).join(" ").toLowerCase();
        list = list.filter(group => group.name.toLowerCase().includes(keyword));
      }
      // Enhanced Filtering
      else if (args[0] === "filter") {
        if (args[1] === "large") {
          list = list.filter(g => g.participantIDs.length > 50);
        } 
        else if (args[1] === "new") {
          list = list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
        }
      }

      // Auto-Approve trusted
      const autoApproved = [];
      list = list.filter(group => {
        if (trustedThreads.includes(group.threadID)) {
          api.sendMessage(getLang("approvedMessage"), group.threadID);
          autoApproved.push(group.threadID);
          return false;
        }
        return true;
      });

      // Build detailed output list
      let msg = "";
      list.forEach((single, index) => {
        const memberCount = single.participantIDs?.length || 0;
        const statusEmoji = pending.some(p => p.threadID === single.threadID) ? "🆕" : "📤";
        const waitTime = single.timestamp ? 
          `${Math.floor((Date.now() - single.timestamp) / (1000 * 60 * 60))}h ago` : "N/A";
        
        msg += `〔 ${index + 1} 〕━━━━━━━━━━━━━━━━━━\n` +
               `🔹 𝗡𝗮𝗺𝗲: ${single.name || 'No Name'}\n` +
               `🔹 𝗜𝗗: ${single.threadID}\n` +
               `🔹 𝗠𝗲𝗺𝗯𝗲𝗿𝘀: ${memberCount}\n` +
               `🔹 𝗦𝘁𝗮𝘁𝘂𝘀: ${statusEmoji}\n` +
               `🔹 𝗪𝗮𝗶𝘁 𝗧𝗶𝗺𝗲: ${waitTime}\n\n`;
      });

      if (list.length > 0) {
        return api.sendMessage(getLang("returnListPending", list.length, msg), threadID, (err, info) => {
          global.GoatBot.onReply.set(info.messageID, {
            commandName,
            messageID: info.messageID,
            author: event.senderID,
            pending: list
          });
        }, messageID);
      } else {
        return api.sendMessage(getLang("returnListClean"), threadID, messageID);
      }
    } catch (e) {
      console.error("Pending Command Error:", e);
      return api.sendMessage(getLang("cantGetPendingList"), threadID, messageID);
    }
  }
};