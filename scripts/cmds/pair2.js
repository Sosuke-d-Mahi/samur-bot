const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

async function getAvatar(userID) {
    try {
        const url = `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return loadImage(res.data);
    } catch (e) {
        console.error(`Failed to get avatar for userID: ${userID}`);
        const fallbackAvatarPath = path.join(__dirname, 'cache', 'default-avatar.png');
        if (!fs.existsSync(fallbackAvatarPath)) {
             const defaultAvatarCanvas = createCanvas(512, 512);
             const defaultCtx = defaultAvatarCanvas.getContext('2d');
             defaultCtx.fillStyle = '#1c1c1c';
             defaultCtx.fillRect(0, 0, 512, 512);
             defaultCtx.fillStyle = '#fff';
             defaultCtx.font = 'bold 200px Arial';
             defaultCtx.textAlign = 'center';
             defaultCtx.textBaseline = 'middle';
             defaultCtx.fillText('?', 256, 256);
             fs.writeFileSync(fallbackAvatarPath, defaultAvatarCanvas.toBuffer('image/png'));
        }
        return loadImage(fallbackAvatarPath);
    }
}

function drawHeart(ctx, x, y, width, height, color) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    const topCurveHeight = height * 0.3;
    ctx.moveTo(x, y + topCurveHeight);
    ctx.bezierCurveTo(x, y, x - width / 2, y, x - width / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x - width / 2, y + (height + topCurveHeight) / 2, x, y + (height + topCurveHeight) / 2, x, y + height);
    ctx.bezierCurveTo(x, y + (height + topCurveHeight) / 2, x + width / 2, y + (height + topCurveHeight) / 2, x + width / 2, y + topCurveHeight);
    ctx.bezierCurveTo(x + width / 2, y, x, y, x, y + topCurveHeight);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
}

module.exports = {
    config: {
        name: "pair2",
        aliases: ["ship"],
        version: "1.0",
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Create a ship card for two users" },
        longDescription: { en: "Generates a canvas image pairing two users with a compatibility percentage." },
        category: "fun",
        guide: { en: "{pn} [@mention] or {pn} [@user1] [@user2]" }
    },

    onStart: async function ({ api, event, message, usersData }) {
        const processingMessage = await message.reply("💖 Calculating compatibility...");
        try {
            const mentions = Object.keys(event.mentions);
            let user1ID, user2ID;

            if (mentions.length === 2) {
                user1ID = mentions[0];
                user2ID = mentions[1];
            } else if (mentions.length === 1) {
                user1ID = event.senderID;
                user2ID = mentions[0];
            } else {
                user1ID = event.senderID;
                const participants = event.participantIDs.filter(id => id !== user1ID && id !== api.getCurrentUserID());
                if (participants.length === 0) {
                    return message.reply("There's no one else to pair you with in this group.");
                }
                user2ID = participants[Math.floor(Math.random() * participants.length)];
            }

            const name1 = await usersData.getName(user1ID);
            const name2 = await usersData.getName(user2ID);
            
            const avatar1Promise = getAvatar(user1ID);
            const avatar2Promise = getAvatar(user2ID);
            const [avatar1, avatar2] = await Promise.all([avatar1Promise, avatar2Promise]);
            
            const percentage = Math.floor(Math.random() * 101);
            const shipName = name1.slice(0, Math.ceil(name1.length / 2)) + name2.slice(Math.floor(name2.length / 2));
            
            const themes = [
                { primary: '#F472B6', bg: '#1D132D' }, // Pink
                { primary: '#EF4444', bg: '#321010' }, // Red
                { primary: '#A78BFA', bg: '#1E1B4B' }  // Purple
            ];
            const theme = themes[Math.floor(Math.random() * themes.length)];

            const canvas = createCanvas(800, 400);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const avatarSize = 150;
            const avatarY = 100;
            const avatar1X = 100;
            const avatar2X = canvas.width - avatarSize - 100;

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatar1X + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar1, avatar1X, avatarY, avatarSize, avatarSize);
            ctx.restore();

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatar2X + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar2, avatar2X, avatarY, avatarSize, avatarSize);
            ctx.restore();

            ctx.strokeStyle = theme.primary;
            ctx.lineWidth = 4;
            ctx.shadowColor = theme.primary;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(avatar1X + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(avatar2X + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name1.substring(0, 15), avatar1X + avatarSize / 2, avatarY + avatarSize + 30);
            ctx.fillText(name2.substring(0, 15), avatar2X + avatarSize / 2, avatarY + avatarSize + 30);
            
            drawHeart(ctx, canvas.width / 2, 130, 120, 100, theme.primary);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${percentage}%`, canvas.width / 2, 180);

            ctx.font = 'bold 32px "Comic Sans MS", cursive';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(shipName, canvas.width / 2, 350);

            const outputPath = path.join(__dirname, 'cache', `pair_${Date.now()}.png`);
            await fs.ensureDir(path.dirname(outputPath));
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(outputPath, buffer);

            await message.reply({
                body: `💞 Here is your compatibility result! 💞`,
                attachment: fs.createReadStream(outputPath)
            });
            
            fs.unlinkSync(outputPath);
            message.unsend(processingMessage.messageID);

        } catch (error) {
            console.error("Error generating pair card:", error);
            message.reply("An error occurred while creating the pair image.");
            message.unsend(processingMessage.messageID);
        }
    }
};