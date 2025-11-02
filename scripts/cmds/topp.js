const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { MongoClient } = require("mongodb");

const AVATAR_CACHE_DIR = path.join(__dirname, '..', '..', 'cache', 'avatars');
fs.ensureDirSync(AVATAR_CACHE_DIR);

const USERS_PER_PAGE = 10;
const FONT_FAMILY = 'MainFont';
let fontsLoaded = false;

const themes = {
    'cyan': {
        bg: '#0A192F',
        card: 'rgba(255, 255, 255, 0.05)',
        primary: '#00E5FF',
        text: '#FFFFFF',
        subtext: '#a8b2d1',
        rankGold: '#FFD700',
        rankSilver: '#C0C0C0',
        rankBronze: '#CD7F32'
    },
    'orchid': {
        bg: '#1D132D',
        card: 'rgba(255, 255, 255, 0.05)',
        primary: '#F472B6',
        text: '#FFFFFF',
        subtext: '#d1a8c4',
        rankGold: '#FFD700',
        rankSilver: '#C0C0C0',
        rankBronze: '#CD7F32'
    },
    'emerald': {
        bg: '#06251E',
        card: 'rgba(255, 255, 255, 0.05)',
        primary: '#34D399',
        text: '#FFFFFF',
        subtext: '#a8d1c4',
        rankGold: '#FFD700',
        rankSilver: '#C0C0C0',
        rankBronze: '#CD7F32'
    },
    'violet': {
        bg: '#1E1B4B',
        card: 'rgba(255, 255, 255, 0.05)',
        primary: '#A78BFA',
        text: '#FFFFFF',
        subtext: '#c4a8d1',
        rankGold: '#FFD700',
        rankSilver: '#C0C0C0',
        rankBronze: '#CD7F32'
    }
};

async function loadFonts() {
    if (fontsLoaded) return;
    try {
        const fontPath = path.join(__dirname, 'assets', 'fonts', 'Urbanist-Bold.ttf');
        if (fs.existsSync(fontPath)) {
            registerFont(fontPath, { family: FONT_FAMILY });
            fontsLoaded = true;
        } else {
            console.warn(`Custom font not found at ${fontPath}. Falling back to Arial.`);
            throw new Error("Font not found");
        }
    } catch (e) {
        console.error("Font loading failed:", e.message);
        fontsLoaded = true;
    }
}

function getFont(style = 'bold', size = '24px') {
    const family = (fontsLoaded && FONT_FAMILY) ? FONT_FAMILY : 'Arial';
    return `${style} ${size} ${family}`;
}

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
    const cachePath = path.join(AVATAR_CACHE_DIR, `${userID}.png`);
    
    try {
        if (fs.existsSync(cachePath)) {
            return loadImage(cachePath);
        }
    } catch (e) { }

    try {
        const url = `https://graph.facebook.com/${userID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        
        try {
            fs.writeFileSync(cachePath, res.data);
        } catch (e) { }
        
        return loadImage(res.data);

    } catch (e) {
        const fallbackAvatarPath = path.join(__dirname, '..', '..', 'cache', 'default-avatar.png'); 
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
    if (money === undefined || money === null) return "0";
    const absMoney = Math.abs(money);
    if (absMoney >= 1e12) return (money / 1e12).toFixed(2) + " T";
    if (absMoney >= 1e9) return (money / 1e9).toFixed(2) + " B";
    if (absMoney >= 1e6) return (money / 1e6).toFixed(2) + " M";
    if (absMoney >= 1e3) return (money / 1e3).toFixed(2) + " K";
    return money.toFixed(0).toString();
}


function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

async function drawLeaderboard(ctx, canvas, usersWithDetails, theme, title, page, totalPages) {
    const PADDING = 50;
    const ROW_HEIGHT = 80;
    const ROW_GAP = 20;
    const AVATAR_SIZE = 60;
    const TOP_3_HEIGHT = 100;

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, theme.bg);
    gradient.addColorStop(1, '#000000');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = getFont('bold', '48px');
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 20;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(title, canvas.width / 2, PADDING + 30);
    ctx.shadowBlur = 0;

    let currentY = 150;

    for (const user of usersWithDetails) {
        const isTop3 = user.rank <= 3 && page === 1;
        const rankColor = 
            user.rank === 1 ? theme.rankGold :
            user.rank === 2 ? theme.rankSilver :
            user.rank === 3 ? theme.rankBronze :
            theme.subtext;
        
        const cardHeight = isTop3 ? TOP_3_HEIGHT : ROW_HEIGHT;
        
        ctx.fillStyle = theme.card;
        drawRoundedRect(ctx, PADDING, currentY, canvas.width - PADDING * 2, cardHeight, 15);
        ctx.fill();

        if (isTop3) {
            ctx.shadowColor = rankColor;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = rankColor;
            ctx.lineWidth = 2;
            drawRoundedRect(ctx, PADDING, currentY, canvas.width - PADDING * 2, cardHeight, 15);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const rowCenterY = currentY + cardHeight / 2;

        ctx.fillStyle = rankColor;
        ctx.font = getFont('bold', isTop3 ? '38px' : '30px');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${user.rank}`, PADDING + 25, rowCenterY);

        const avatarX = PADDING + (isTop3 ? 100 : 90);
        const avatarSize = isTop3 ? AVATAR_SIZE + 10 : AVATAR_SIZE;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, rowCenterY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(user.avatar, avatarX, rowCenterY - avatarSize / 2, avatarSize, avatarSize);
        ctx.restore();

        const nameMaxX = canvas.width - PADDING - 200; // Adjusted for smaller money text
        ctx.fillStyle = theme.text;
        ctx.font = getFont('bold', isTop3 ? '28px' : '24px');
        ctx.textAlign = 'left';
        ctx.fillText(user.name.substring(0, 20), avatarX + avatarSize + 20, rowCenterY - 10, nameMaxX - (avatarX + avatarSize + 20));

        ctx.fillStyle = theme.subtext;
        ctx.font = getFont('bold', '16px');
        ctx.fillText(`Bank: $${formatMoney(user.bank)} | Cash: $${formatMoney(user.cash)}`, avatarX + avatarSize + 20, rowCenterY + 18); // Adjusted Y for subtext

        const totalMoneyText = `$${formatMoney(user.total)}`;
        ctx.fillStyle = theme.primary;
        ctx.font = getFont('bold', isTop3 ? '22px' : '18px'); // SIGNIFICANTLY REDUCED FONT SIZE
        ctx.shadowColor = theme.primary;
        ctx.shadowBlur = 8; // Slightly reduced glow
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(totalMoneyText, canvas.width - PADDING - 25, rowCenterY);
        ctx.shadowBlur = 0;

        currentY += cardHeight + ROW_GAP;
    }
    
    ctx.fillStyle = theme.subtext;
    ctx.font = getFont('bold', '20px');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Page ${page} / ${totalPages}`, canvas.width / 2, canvas.height - PADDING / 2 - 10);
}

module.exports = {
    config: {
        name: "top",
        aliases: ["leaderboard", "lb", "rich"],
        version: "4.4", // Further reduced glowing text size and refined positioning
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Advanced user leaderboard" },
        longDescription: { en: "Shows the richest users. Features global/thread modes, bank/cash sorting, pagination, user rank checking, and themes." },
        category: "economy",
        guide: { 
            en: "Usage:\n" +
                "  {pn} [--page <n>] [--thread] [--bank | --cash] [--theme <name>] [@mention | me]\n\n" +
                "Examples:\n" +
                "  {pn}                 - Shows global page 1 (total $)\n" +
                "  {pn} --thread       - Richest users in this chat\n" +
                "  {pn} --page 2       - Shows page 2 of the global list\n" +
                "  {pn} --bank         - Top users by bank balance only\n" +
                "  {pn} --cash         - Top users by cash on hand only\n" +
                "  {pn} me             - Shows your global rank\n" +
                "  {pn} @mention     - Shows a user's global rank\n" +
                "  {pn} --thread me    - Shows your rank in this thread\n" +
                "  {pn} --theme orchid - Use the 'orchid' theme"
        }
    },

    onStart: async function ({ api, message, usersData, event, args }) {
        try {
            await loadFonts();
            
            const parsedArgs = {
                isThread: args.includes('--thread'),
                isBankOnly: args.includes('--bank'),
                isCashOnly: args.includes('--cash'),
                theme: args.find(a => a.startsWith('--theme='))?.split('=')[1] || args.find(a => Object.keys(themes).includes(a)) || 'cyan',
                page: parseInt(args.find(a => a.startsWith('--page='))?.split('=')[1] || '1')
            };
            
            let targetUserID = null;
            if (Object.keys(event.mentions).length > 0) {
                targetUserID = Object.keys(event.mentions)[0];
            } else if (args.includes('me')) {
                targetUserID = message.senderID;
            }

            const db = await getDb();
            const usersCollection = db.collection(USERS_COLLECTION);
            const allBankUsers = await usersCollection.find({}).toArray();

            if (allBankUsers.length === 0) return message.reply("No users found with bank data.");

            let userPool = allBankUsers;
            let titleScope = "GLOBAL";
            if (parsedArgs.isThread) {
                const threadInfo = await api.getThreadInfo(event.threadID);
                const threadUserIDs = threadInfo.participantIDs.map(String);
                userPool = allBankUsers.filter(u => threadUserIDs.includes(String(u.userId)));
                titleScope = "THREAD";
                if (userPool.length === 0) return message.reply("No users in this thread have bank data.");
            }

            const combinedData = await Promise.all(
                userPool.map(async (user) => {
                    let userId = user.userId;
                    if (typeof userId === 'string') userId = Number(userId.trim());
                    if (isNaN(userId)) return null;

                    const cash = await usersData.get(userId, "money").catch(() => 0);
                    const bank = user.bank || 0;
                    
                    let total;
                    if (parsedArgs.isBankOnly) total = bank;
                    else if (parsedArgs.isCashOnly) total = cash;
                    else total = (bank || 0) + (cash || 0);

                    return { userId, total, cash, bank };
                })
            );

            const sortedData = combinedData.filter(Boolean).sort((a, b) => b.total - a.total);
            if (!sortedData.length) return message.reply("No valid user balances found.");

            const scopeText = parsedArgs.isThread ? "in this thread" : "globally";
            let titleType = " (TOTAL)";
            if (parsedArgs.isBankOnly) titleType = " (BANK)";
            else if (parsedArgs.isCashOnly) titleType = " (CASH)";

            if (targetUserID) {
                const userRankIndex = sortedData.findIndex(u => String(u.userId) === String(targetUserID));
                
                if (userRankIndex === -1) {
                    const name = await usersData.getName(targetUserID);
                    return message.reply(`User ${name} is not ranked ${scopeText}${titleType.toLowerCase()}.`);
                }
                
                const userRank = userRankIndex + 1;
                const userData = sortedData[userRankIndex];
                const name = await usersData.getName(targetUserID);
                
                const replyMsg = `--- User Rank ${titleType} ---\n` +
                                 `Name: ${name}\n` +
                                 `Rank: #${userRank} ${scopeText}\n` +
                                 `Total: $${formatMoney(userData.total)}\n` +
                                 `Bank: $${formatMoney(userData.bank)}\n` +
                                 `Cash: $${formatMoney(userData.cash)}`;
                
                return message.reply(replyMsg);
            }

            const totalUsers = sortedData.length;
            const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);
            const page = parsedArgs.page;

            if (page < 1 || page > totalPages) {
                return message.reply(`Invalid page. Please choose a page between 1 and ${totalPages}.`);
            }

            const startIndex = (page - 1) * USERS_PER_PAGE;
            const endIndex = page * USERS_PER_PAGE;
            const usersForPage = sortedData.slice(startIndex, endIndex);

            const usersWithDetails = await Promise.all(
                usersForPage.map(async (u, i) => {
                    const rank = startIndex + i + 1;
                    const name = await usersData.getName(u.userId).catch(() => `User ${u.userId}`);
                    const avatar = await getAvatar(u.userId);
                    return { ...u, rank, name, avatar };
                })
            );

            const themeName = parsedArgs.theme;
            const theme = themes[themeName] || themes.cyan;
            if (!themes[themeName] && themeName !== 'cyan') {
                await message.reply(`Theme "${themeName}" not found. Falling back to 'cyan'.`);
            }
            
            const title = titleScope + " LEADERBOARD" + titleType.toUpperCase();
            
            const HEADER_HEIGHT = 150;
            const FOOTER_HEIGHT = 100;
            const ROW_GAP = 20;
            const TOP_3_HEIGHT = 100;
            const ROW_HEIGHT = 80;

            let dynamicHeight = HEADER_HEIGHT + FOOTER_HEIGHT;
            for(let i = 0; i < usersWithDetails.length; i++) {
                if (usersWithDetails[i].rank <= 3 && page === 1) {
                    dynamicHeight += TOP_3_HEIGHT + ROW_GAP;
                } else {
                    dynamicHeight += ROW_HEIGHT + ROW_GAP;
                }
            }
            
            const canvas = createCanvas(900, dynamicHeight);
            const ctx = canvas.getContext('2d');
            
            await drawLeaderboard(ctx, canvas, usersWithDetails, theme, title, page, totalPages);

            const outputPath = path.join(__dirname, '..', '..', 'cache', `leaderboard_${Date.now()}.png`);
            fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));

            await message.reply({ 
                attachment: fs.createReadStream(outputPath) 
            });
            fs.unlinkSync(outputPath);

        } catch (err) {
            console.error("Error generating advanced leaderboard:", err);
            message.reply("❌ An unexpected error occurred while generating the leaderboard.");
        } finally {
            if (mongoClient) {
                await mongoClient.close();
                mongoClient = null;
            }
        }
    }
};