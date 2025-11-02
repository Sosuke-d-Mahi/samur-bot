const { loadImage, createCanvas } = require("canvas");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");

module.exports = {
  config: {
    name: "hack",
    author: "Mahi--",
    countDown: 0,
    role: 0,
    shortDescription: { en: "Generates a realistic hacking animation with user’s avatar" },
    category: "hock",
  },

  wrapText: async (ctx, name, maxWidth) => {
    return new Promise((resolve) => {
      if (ctx.measureText(name).width < maxWidth) return resolve([name]);
      if (ctx.measureText("W").width > maxWidth) return resolve(null);
      const words = name.split(" ");
      const lines = [];
      let line = "";
      while (words.length > 0) {
        let split = false;
        while (ctx.measureText(words[0]).width >= maxWidth) {
          const temp = words[0];
          words[0] = temp.slice(0, -1);
          if (split) words[1] = `${temp.slice(-1)}${words[1]}`;
          else {
            split = true;
            words.splice(1, 0, temp.slice(-1));
          }
        }
        if (ctx.measureText(`${line}${words[0]}`).width < maxWidth)
          line += `${words.shift()} `;
        else {
          lines.push(line.trim());
          line = "";
        }
        if (words.length === 0) lines.push(line.trim());
      }
      return resolve(lines);
    });
  },

  onStart: async function ({ api, event, message, args }) {
    let id = event.senderID;

    // mention / reply handling
    if (Object.keys(event.mentions).length) {
      id = Object.keys(event.mentions)[0];
    } else if (event.type === "message_reply") {
      if (event.messageReply.senderID) {
        id = event.messageReply.senderID;
      }
    } else if (!isNaN(args[0])) {
      id = args[0];
    }

    const cacheDir = path.join(__dirname, "/cache/");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const randomFileName = `${Date.now()}_${Math.floor(Math.random() * 1000)}.png`;
    let pathImg = path.join(cacheDir, randomFileName);
    let pathAvt1 = path.join(cacheDir, "Avtmot.png");

    const userInfo = await api.getUserInfo(id);
    const name = userInfo[id].name;

    // avatar with timeout
    let getAvtmot = (
      await axios.get(
        `https://graph.facebook.com/${id}/picture?width=300&height=300&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        { responseType: "arraybuffer", timeout: 10000 }
      )
    ).data;
    fs.writeFileSync(pathAvt1, Buffer.from(getAvtmot, "utf-8"));

    let baseImage = await loadImage("https://i.ibb.co.com/zTf5GSs2/Screenshot-2025-03-03-22-28-20-197-com-facebook-lite-1.png");
    let baseAvt1 = await loadImage(pathAvt1);
    let canvas = createCanvas(baseImage.width, baseImage.height);
    let ctx = canvas.getContext("2d");
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    ctx.font = "400 40px Arial";
    ctx.fillStyle = "#1878F3";
    ctx.textAlign = "start";
    const lines = await this.wrapText(ctx, name, 1160);
    ctx.fillText(lines.join("\n"), 280, 746);
    ctx.drawImage(baseAvt1, 120, 655, 142, 148);
    const imageBuffer = canvas.toBuffer();
    fs.writeFileSync(pathImg, imageBuffer);
    fs.removeSync(pathAvt1);

    const phases = [
      "🔍 Initializing breach protocol...",
      "🛰 Scanning target IP...",
      "🔑 Cracking encryption...",
      "⚡ Bypassing firewall...",
      "📡 Extracting account metadata...",
      "✅ Hack complete!"
    ];

    let currentMsg = await message.reply(`🎯 Target Locked: ${name}\n\n${phases[0]}`);

    let i = 1;
    const interval = setInterval(async () => {
      if (i < phases.length) {
        try {
          await api.editMessage(`🎯 Target: ${name}\n\n${phases[i]}`, currentMsg.messageID);
        } catch {}
        i++;
      } else {
        clearInterval(interval);
        try { message.unsend(currentMsg.messageID); } catch {}
      }
    }, 500); // 0.5s fast updates

    const login = [
      "9752855","6268362","3763867","2762638","6256188",
      "7656188","7266386","8727638","8272668","7655078",
      "9273648","3602087","2726636"
    ];
    const passwords = [
      "shadow@123", "rootXploit!", "darknet#77", "hunter2",
      "anon$404", "cypher999", "matrix*code"
    ];
    const pass = login[Math.floor(Math.random() * login.length)];
    const pwd = passwords[Math.floor(Math.random() * passwords.length)];

    const mentionTag = [{ id, tag: `@${name}` }];

    setTimeout(() => {
      return api.sendMessage(
        {
          body: `🕵️ Hack Report for @${name}\n\n📌 Login Code: ${pass}\n🔐 Password: ${pwd}\n\n⚠️ Classified data leak detected!`,
          attachment: fs.createReadStream(pathImg),
          mentions: mentionTag
        },
        event.threadID,
        () => fs.unlinkSync(pathImg),
        event.messageID
      );
    }, phases.length * 500 + 1000);
  },
};