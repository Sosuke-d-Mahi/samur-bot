const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { MongoClient } = require("mongodb");

const MONGO_URI = "mongodb+srv://Easirmahi:01200120mahi@anchestor.wmvrhcb.mongodb.net";
const DB_NAME = "GoatBotV2_AdvBank";
const USERS_COLLECTION = "advBankData";

let mongoClient;
async function getDb() {
    if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
    }
    return mongoClient.db(DB_NAME);
}

async function getAvatar(userID) {
    try {
        const url = `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        return loadImage(res.data);
    } catch (e) {
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

function formatMoney(money) {
    if (money >= 1e12) return (money / 1e12).toFixed(2) + " T";
    if (money >= 1e9) return (money / 1e9).toFixed(2) + " B";
    if (money >= 1e6) return (money / 1e6).toFixed(2) + " M";
    if (money >= 1e3) return (money / 1e3).toFixed(2) + " K";
    return money.toString();
}

module.exports = {
    config: {
        name: "top",
        aliases: ["leaderboard", "lb"],
        version: "3.1", // Bumped version for the redesign
        author: "Mahi-- (Redesigned by AI)",
        role: 0,
        shortDescription: { en: "Top 15 Richest Users" },
        longDescription: { en: "Displays the top 15 users by their total combined bank and cash balance on a neon-themed canvas." },
        category: "economy",
        guide: { en: "{pn}" }
    },

    onStart: async function ({ api, message, usersData }) {
        try {
            await message.reply("Fetching data and generating the new leaderboard, please wait...");

            const db = await getDb();
            const usersCollection = db.collection(USERS_COLLECTION);
            const allBankUsers = await usersCollection.find({}).toArray();

            if (allBankUsers.length === 0) return message.reply("No users found with bank data.");

            const combinedData = await Promise.all(
                allBankUsers.map(async (user) => {
                    let userId = user.userId;
                    if (typeof userId === 'string') userId = Number(userId.trim());
                    if (isNaN(userId)) return null;

                    const cash = await usersData.get(userId, "money").catch(() => 0);
                    const bank = user.bank || 0;

                    return { userId, total: (bank || 0) + (cash || 0) };
                })
            );

            const filteredData = combinedData.filter(Boolean).sort((a, b) => b.total - a.total).slice(0, 15);
            if (!filteredData.length) return message.reply("No valid user balances found.");

            // --- CANVAS REDESIGN STARTS HERE ---

            // Themes (Kept your original themes)
            const themes = [
                { primary: '#00FFFF', bg: '#0A192F', name: 'Cyan Pulse' },
                { primary: '#F472B6', bg: '#1D132D', name: 'Orchid Pink' },
                { primary: '#34D399', bg: '#06251E', name: 'Emerald Glow' },
                { primary: '#A78BFA', bg: '#1E1B4B', name: 'Violet Ray' },
                { primary: '#FBBF24', bg: '#3A2508', name: 'Amber Shine' }
            ];
            const theme = themes[Math.floor(Math.random() * themes.length)];

            const canvas = createCanvas(800, 1200);
            const ctx = canvas.getContext('2d');

            // Modern Gradient Background
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, theme.bg);
            gradient.addColorStop(1, '#000000'); // Fades to black at the bottom
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Glowing Title (Kept your original, it's good)
            ctx.font = 'bold 48px Arial';
            ctx.fillStyle = theme.primary;
            ctx.shadowColor = theme.primary;
            ctx.shadowBlur = 20;
            ctx.textAlign = 'center';
            ctx.fillText('TOP 15 RICHEST USERS', canvas.width / 2, 80);
            ctx.shadowBlur = 0; // Reset shadow

            // Fetch names and avatars (Your logic, unchanged)
            const userNames = await Promise.all(
                filteredData.map(async (u) => {
                    const id = Number(u.userId);
                    const name = await usersData.getName(id).catch(() => null);
                    return name || `User ${id}`;
                })
            );
            const avatars = await Promise.all(filteredData.map(u => getAvatar(u.userId)));

            // --- New Row Layout ---
            let currentY = 150;
            const rowHeight = 65; // Height of the card
            const rowGap = 15; // Space between cards
            const avatarSize = 50;
            const margin = 40; // Canvas side margin
            const rowWidth = canvas.width - (margin * 2);
            const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

            for (let i = 0; i < filteredData.length; i++) {
                const u = filteredData[i];
                const rank = i + 1;
                const name = userNames[i];
                const avatar = avatars[i];
                const rowCenterY = currentY + (rowHeight / 2);

                // Draw the semi-transparent card background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.fillRect(margin, currentY, rowWidth, rowHeight);

                // Add glowing border for Top 3
                if (rank <= 3) {
                    ctx.shadowColor = rankColors[i];
                    ctx.shadowBlur = 15;
                    ctx.strokeStyle = rankColors[i];
                    ctx.lineWidth = 2;
                    ctx.strokeRect(margin, currentY, rowWidth, rowHeight);
                    ctx.shadowBlur = 0; // Reset shadow
                }

                // --- Draw Row Content ---

                // 1. Rank
                const rankColor = rank <= 3 ? rankColors[i] : '#E5E7EB';
                ctx.fillStyle = rankColor;
                ctx.font = 'bold 30px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`#${rank}`, margin + 20, rowCenterY);

                // 2. Avatar (with glowing border for Top 3)
                const avatarX = margin + 80;
                const avatarY = currentY + (rowHeight - avatarSize) / 2;
                
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                
                if (rank <= 3) {
                    ctx.strokeStyle = rankColors[i];
                    ctx.shadowColor = rankColors[i];
                    ctx.shadowBlur = 10;
                    ctx.lineWidth = 3;
                    ctx.stroke(); // Draw the glowing stroke
                    ctx.shadowBlur = 0;
                }
                
                ctx.clip(); // Clip to the arc path
                ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore(); // Restore context to remove clip

                // 3. Name (Bolded as requested)
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 24px Arial'; // Made bold
                ctx.textAlign = 'left';
                ctx.fillText(name.substring(0, 20), avatarX + avatarSize + 15, rowCenterY);

                // 4. Money (with subtle glow)
                ctx.fillStyle = theme.primary;
                ctx.font = 'bold 26px Arial';
                ctx.shadowColor = theme.primary;
                ctx.shadowBlur = 10; // Added glow
                ctx.textAlign = 'right';
                ctx.fillText(`$${formatMoney(u.total)}`, canvas.width - margin - 20, rowCenterY);
                ctx.shadowBlur = 0; // Reset shadow

                // Move to next row position
                currentY += rowHeight + rowGap;
            }

            // Footer (with glow)
            ctx.textAlign = 'center';
            ctx.fillStyle = theme.primary;
            ctx.shadowColor = theme.primary;
            ctx.shadowBlur = 10;
            ctx.font = 'italic 20px Arial';
            ctx.fillText(`Theme: ${theme.name}`, canvas.width / 2, canvas.height - 30);

            // --- CANVAS REDESIGN ENDS HERE ---

            // Save and send (Your logic, unchanged)
            const outputPath = path.join(__dirname, 'cache', `leaderboard_${Date.now()}.png`);
            await fs.ensureDir(path.dirname(outputPath));
            fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

            await message.reply({ attachment: fs.createReadStream(outputPath) });
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error("Error generating leaderboard:", err);
            message.reply("❌ Error while generating leaderboard.");
        } finally {
            if (mongoClient) {
                await mongoClient.close();
                mongoClient = null;
            }
        }
    }
};