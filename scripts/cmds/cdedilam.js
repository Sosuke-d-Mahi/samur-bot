const { findUid } = global.utils;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  config: {
    name: "cdedilam",
    aliases: ["Ameen", " bismillah"],
    version: "2.0",
    author: "Mahi--",
    countDown: 0,
    role: 1,
    shortDescription: {
      en: "Add fixed members and rename group"
    },
    longDescription: {
      en: "Adds fixed users to the group and modifies its name with 'fu-ked'"
    },
    category: "box chat",
    guide: {
      en: "{pn} [optional threadID]"
    }
  },

  onStart: async function ({ api, event, args, threadsData, message }) {
    const threadID = args[0] || event.threadID;
    const fixedMembers = [
      "61568425442088",
      "https://www.facebook.com/arifnotes.co",
      "61558559288827",
      "100077553281922"
    ];

    const success = [];
    const failed = [];

    for (const item of fixedMembers) {
      let uid;

      if (isNaN(item) && item.includes("facebook.com")) {
        try {
          uid = await findUid(item);
        } catch (err) {
          failed.push(`${item} (Resolve error: ${err.message})`);
          continue;
        }
      } else {
        uid = item;
      }

      let retries = 3;
      while (retries--) {
        try {
          await api.addUserToGroup(uid, threadID);
          success.push(uid);
          break;
        } catch (err) {
          if (retries === 0) failed.push(`${uid} (Add error: ${err.message || "unknown"})`);
          else await sleep(1000);
        }
      }
    }

    try {
      const info = await api.getThreadInfo(threadID);
      const newName = `${info.threadName} fu-ked`.slice(0, 50);
      await api.setTitle(newName, threadID);
    } catch (err) {
      failed.push(`Group Rename Failed (${err.message})`);
    }

    let msg = `🧠 CDedilam executed for thread ${threadID}\n\n✅ Success: ${success.length}\n❌ Failed: ${failed.length}`;
    if (failed.length) msg += `\n🔎 Issues:\n- ` + failed.join("\n- ");
    message.reply(msg);
  }
};