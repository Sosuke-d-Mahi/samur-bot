const { MongoClient, ObjectId } = require("mongodb");
const { createCanvas, registerFont, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');

async function getChatResponse(prompt) {
  try {
    const response = await fetch('https://exomlapi.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        "id": "AFIq6sis1FqpLNO1",
        "messages": [{ "role": "user", "content": "", "parts": [{ "type": "text", "text": prompt }] }],
        "chatId": "chat-1750343203906-699io3j50",
        "userId": "local-user-1750335940442-fqspmyjqr",
        "model": "gpt-4.1",
        "isAuthenticated": true,
        "systemPrompt": "You are a helpful AI assistant integrated into a mobile phone interface.",
        "antiBotId": "U9l0CUaITcZLQlAsSXiKX_KombniEv2u-64fa2e38"
      })
    });
    const data = await response.text();
    const lines = data.split('\n').filter(line => line.trim());
    let fullResponse = '';
    for (const line of lines) {
      if (line.startsWith('0:"')) {
        fullResponse += JSON.parse(line.substring(2));
      }
    }
    return fullResponse.replace(/\\n/g, '\n') || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Chat API Error:", error);
    return "❌ An error occurred while generating the response. Please try again.";
  }
}

const mongoUri = "mongodb+srv://Easirmahi:01200120mahi@anchestor.wmvrhcb.mongodb.net";
const DB_NAME = "GoatBotV2_AdvBank";
const BANK_COLLECTION = "advBankData";
const FONT_FAMILY = 'Arial';
const BOLD_FONT_FAMILY = 'Arial Bold';

const THEME = {
    facebookBlue: '#1877F2',
    googleBlue: '#4285F4',
    amazonOrange: '#FF9900',
    playStoreGreen: '#00875F',
    missedCallRed: '#F04747',
    successGreen: '#43B581',
    primaryText: '#FFFFFF',
    secondaryText: '#AAAAAA',
    darkBg: '#2C2F33',
    lightBg: '#36393F'
};

try {
    const fontPath = path.join(__dirname, '..', 'assets', 'Arial.ttf');
    if (fs.existsSync(fontPath)) registerFont(fontPath, { family: 'Arial' });
    const boldFontPath = path.join(__dirname, '..', 'assets', 'Arial-Bold.ttf');
    if (fs.existsSync(boldFontPath)) registerFont(boldFontPath, { family: 'Arial Bold' });
} catch (e) { console.log("Custom font not found or failed to load. Using system default 'Arial'."); }

let mongoClient;
async function getDb() {
    if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
    }
    return mongoClient.db(DB_NAME);
}

async function getUserBankData(userId, db) {
    const users = db.collection(BANK_COLLECTION);
    let userData = await users.findOne({ userId: String(userId) });
    if (!userData) { return null; }
    userData.messages = userData.messages || [];
    userData.callLog = userData.callLog || [];
    userData.gallery = userData.gallery || [];
    userData.card = userData.card || { number: null, pin: null };
    userData.bank = userData.bank || 0;
    userData.contacts = userData.contacts || {};
    userData.transactions = userData.transactions || [];
    userData.locationOptIn = userData.locationOptIn || false;
    userData.chirperPosts = userData.chirperPosts || [];
    userData.inventory = userData.inventory || [];
    userData.voicemail = userData.voicemail || [];
    userData.installedApps = userData.installedApps || [];
    return userData;
}

async function updateUserBankData(userId, data, db) {
    data.updatedAt = new Date();
    await db.collection(BANK_COLLECTION).updateOne({ userId: String(userId) }, { $set: data }, { upsert: true });
}

function formatKMB(number, isMoney = true, decimals = 2) {
    if (isNaN(parseFloat(number))) return isMoney ? "$0.00" : "0.00";
    number = parseFloat(number);
    const sign = number < 0 ? "-" : "";
    number = Math.abs(number);
    let suffix = "";
    if (number >= 1e12) { number /= 1e12; suffix = "T"; }
    else if (number >= 1e9) { number /= 1e9; suffix = "B"; }
    else if (number >= 1e6) { number /= 1e6; suffix = "M"; }
    else if (number >= 1e3) { number /= 1e3; suffix = "K"; }
    return `${sign}${isMoney ? "$" : ""}${number.toFixed(decimals)}${suffix}`;
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const lines = String(text).split('\n');
    let currentY = y;
    for (const line of lines) {
        let words = line.split(' ');
        let currentLine = '';
        for (let i = 0; i < words.length; i++) {
            let testLine = currentLine + words[i] + ' ';
            let metrics = context.measureText(testLine);
            if (metrics.width > maxWidth && i > 0) {
                context.fillText(currentLine.trim(), x, currentY);
                currentLine = words[i] + ' ';
                currentY += lineHeight;
            } else { currentLine = testLine; }
        }
        context.fillText(currentLine.trim(), x, currentY);
        currentY += lineHeight;
    }
    return currentY;
}

function safeEval(expression) {
    try {
        const sanitized = String(expression).replace(/[^-()\d/*+.]/g, '');
        return new Function(`return ${sanitized}`)();
    } catch (e) { return null; }
}

function fillRoundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'number') radius = { tl: radius, tr: radius, br: radius, bl: radius };
    else {
        const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (let side in defaultRadius) radius[side] = radius[side] || defaultRadius[side];
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    ctx.fill();
}

async function drawPhoneCanvas(state, userData, usersDataService, db) {
    const canvasWidth = 400;
    const canvasHeight = 850;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    try {
        const wallpaper = await loadImage(userData.wallpaperUrl || 'https://i.imgur.com/S7AN2bF.jpeg');
        ctx.drawImage(wallpaper, 0, 0, canvasWidth, canvasHeight);
    } catch (e) {
        const wallpaperGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        wallpaperGradient.addColorStop(0, '#2c3e50');
        wallpaperGradient.addColorStop(1, '#3498db');
        ctx.fillStyle = wallpaperGradient;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const time = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: false });
    ctx.fillStyle = THEME.primaryText;
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
    ctx.fillText(`📶 🔋 ${time}`, canvasWidth / 2, 30);
    ctx.shadowBlur = 0;

    const defaultIcons = [
        { name: 'Anchestor' }, { name: 'Call' }, { name: 'Messages' }, { name: 'Maps' },
        { name: 'Calculator' }, { name: 'Calendar' }, { name: 'Gallery' }, { name: 'Settings' },
        { name: 'Contacts' }, { name: 'App Store' }, { name: 'Chirper' }, { name: 'For Sale' },
        { name: 'Goatgle' }, { name: 'Slots' }
    ];
    const purchasedAppIcons = (userData.installedApps || []).map(name => ({ name }));
    const appMap = new Map();
    [...defaultIcons, ...purchasedAppIcons].forEach(app => appMap.set(app.name, app));
    const appIcons = Array.from(appMap.values());

    const drawHeader = (title, bgColor = 'rgba(0,0,0,0.4)') => {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvasWidth, 60);
        ctx.fillStyle = THEME.primaryText;
        ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText(title, canvasWidth / 2, 40);
        ctx.font = `bold 16px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText('‹ Home', 20, 40);
    };

    if (state.screen === 'lockscreen') {
        const date = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka', weekday: 'long', month: 'long', day: 'numeric' });
        ctx.font = `bold 52px ${FONT_FAMILY}`;
        ctx.fillText(time, canvasWidth / 2, canvasHeight / 2 - 40);
        ctx.font = `24px ${FONT_FAMILY}`;
        ctx.fillText(date, canvasWidth / 2, canvasHeight / 2 + 10);
        ctx.font = `bold 18px ${FONT_FAMILY}`; ctx.globalAlpha = 0.8;
        ctx.fillText('Reply anything to Unlock', canvasWidth / 2, canvasHeight - 80);
        ctx.globalAlpha = 1.0;
    } else if (state.screen === 'home') {
        let iconSize = 64, padding = 28, iconsPerRow = 4;
        let startX = (canvasWidth - (iconsPerRow * iconSize + (iconsPerRow - 1) * padding)) / 2;
        let startY = 80;
        appIcons.forEach((app, i) => {
            const row = Math.floor(i / iconsPerRow), col = i % iconsPerRow;
            const x = startX + col * (iconSize + padding);
            const y = startY + row * (iconSize + padding + 30);
            ctx.fillStyle = '#FFF'; ctx.font = `bold 32px ${FONT_FAMILY}`; ctx.textAlign = 'center';
            fillRoundRect(ctx, x, y, iconSize, iconSize, 15);
            ctx.fillStyle = THEME.darkBg;
            ctx.fillText(app.name.substring(0, 1), x + iconSize / 2, y + iconSize / 2 + 10);
            ctx.fillStyle = '#FFFFFF'; ctx.font = `14px ${FONT_FAMILY}`;
            ctx.fillText(app.name, x + iconSize / 2, y + iconSize + 15);
        });
    } else if (state.screen === 'anchestor_app') {
        drawHeader("Anchestor Bank");
        const userName = await usersDataService.getName(userData.userId) || "CARD HOLDER";
        if (userData.card && userData.card.number) {
            const grad = ctx.createLinearGradient(0, 0, canvasWidth, 0);
            grad.addColorStop(0, '#7289DA'); grad.addColorStop(1, '#5B6EAE');
            ctx.fillStyle = grad;
            fillRoundRect(ctx, 30, 80, canvasWidth - 60, 220, 20);
            ctx.font = `bold 22px ${FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText('Anchestor Debit', 50, 115);
            ctx.font = '24px "Courier New", monospace'; ctx.fillText(userData.card.number, 50, 170);
            ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText(userName.toUpperCase(), 50, 260);
            ctx.fillStyle = '#FFFFFF'; ctx.font = `18px ${FONT_FAMILY}`; ctx.textAlign = 'center';
            ctx.fillText('1. Quick Transfer', canvasWidth / 2, 320);
            ctx.fillText('2. Mini Statement', canvasWidth / 2, 350);
            ctx.fillText('3. QR Pay', canvasWidth / 2, 380);
        } else {
            ctx.font = `18px ${FONT_FAMILY}`; ctx.textAlign = 'center'; ctx.fillText('No card found.', canvasWidth / 2, 200);
        }
        ctx.textAlign = 'center'; ctx.font = `bold 24px ${FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.fillText('Balance:', canvasWidth / 2, 450);
        ctx.font = `bold 48px ${FONT_FAMILY}`; ctx.fillStyle = THEME.successGreen; ctx.fillText(formatKMB(userData.bank), canvasWidth / 2, 500);
    } else if (state.screen === 'messages_list') {
        drawHeader('Messages');
        let yPos = 80;
        const messageThreads = {};
        (userData.messages || []).forEach(msg => {
            const otherPartyId = msg.senderId === userData.userId ? msg.recipientId : msg.senderId;
            if (otherPartyId === "BANK") return;
            if (!messageThreads[otherPartyId]) messageThreads[otherPartyId] = { messages: [], unread: false };
            messageThreads[otherPartyId].messages.push(msg);
            if (!msg.read && msg.senderId !== userData.userId) messageThreads[otherPartyId].unread = true;
        });
        if (Object.keys(messageThreads).length === 0) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("No messages.", canvasWidth / 2, 200);
        } else {
            let index = 1;
            for (const [userId, thread] of Object.entries(messageThreads)) {
                const lastMessage = thread.messages[thread.messages.length - 1];
                const name = userData.contacts[userId] || await usersDataService.getName(userId) || `User ${userId}`;
                ctx.fillStyle = thread.unread ? THEME.lightBg : THEME.darkBg;
                fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 60, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left'; ctx.fillText(`${index}. ${name}`, 35, yPos + 25);
                ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = '#AAAAAA'; wrapText(ctx, (lastMessage.senderId === userData.userId ? "You: " : "") + lastMessage.content, 35, yPos + 45, canvasWidth - 80, 18);
                if (thread.unread) {
                    ctx.beginPath(); ctx.arc(canvasWidth - 35, yPos + 30, 8, 0, 2 * Math.PI); ctx.fillStyle = '#7289DA'; ctx.fill();
                }
                yPos += 75;
                index++;
            }
        }
    } else if (state.screen === 'conversation') {
        drawHeader(`Chat with ${state.contactName}`);
        let yPos = 80;
        const messages = userData.messages.filter(m => (m.senderId === state.contactId && m.recipientId === userData.userId) || (m.senderId === userData.userId && m.recipientId === state.contactId)).slice(-10);
        if (messages.length === 0) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("No messages yet.", canvasWidth / 2, 200);
        } else {
            for (const msg of messages) {
                const isSender = msg.senderId === userData.userId;
                ctx.fillStyle = isSender ? '#7289DA' : THEME.lightBg;
                const textMetrics = ctx.measureText(msg.content);
                const boxHeight = Math.max(50, Math.ceil(textMetrics.width / 180) * 18 + 32);
                fillRoundRect(ctx, isSender ? canvasWidth - 220 : 20, yPos, 200, boxHeight, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `14px ${FONT_FAMILY}`; ctx.textAlign = isSender ? 'right' : 'left';
                wrapText(ctx, msg.content, isSender ? canvasWidth - 30 : 30, yPos + 20, 180, 18);
                yPos += boxHeight + 10;
            }
        }
    } else if (state.screen === 'calculator') {
        drawHeader('Calculator');
        const display = state.display || '0';
        ctx.fillStyle = '#111'; fillRoundRect(ctx, 20, 80, canvasWidth - 40, 120, 10);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.font = `bold 60px ${FONT_FAMILY}`;
        ctx.fillText(display.length > 11 ? parseFloat(display).toExponential(3) : display, canvasWidth - 40, 170);
        const buttons = [ ['C','(',')','/'], ['7','8','9','*'], ['4','5','6','-'], ['1','2','3','+'], ['0','.','='] ];
        const btnHeight = (canvasHeight - 320) / 5;
        const btnYStart = 220;
        buttons.forEach((row, r) => {
            const btnWidth = (canvasWidth-50)/row.length;
            row.forEach((label, c) => {
                let x = 25 + c * (btnWidth + 5);
                const y = btnYStart + r * (btnHeight + 5);
                let currentBtnWidth = btnWidth;
                if (label === '=') currentBtnWidth = btnWidth * 2 + 5;
                if (label === '0') {
                    currentBtnWidth = btnWidth * 2 + 5;
                } else if(c > 0 && buttons[r][c-1] === '0') {
                    x += btnWidth + 5;
                }
                
                ctx.fillStyle = isNaN(parseInt(label)) && label !== '.' ? '#f09a36' : '#333';
                if (label === 'C') ctx.fillStyle = THEME.missedCallRed;
                fillRoundRect(ctx, x, y, currentBtnWidth, btnHeight, 10);
                ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold 32px ${FONT_FAMILY}`;
                ctx.fillText(label, x + currentBtnWidth/2, y + btnHeight/2 + 10);

                if (label === '0') c++;
                if (label === '=') c++;
            });
        });
    } else if (state.screen === 'gallery_home') {
        drawHeader('Gallery');
        ctx.textAlign = 'center'; ctx.font = `24px ${FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF';
        ctx.fillText("1. View Gallery", canvasWidth / 2, 150); ctx.fillText("2. Save Image", canvasWidth / 2, 200);
    } else if (state.screen === 'settings') {
        drawHeader('Settings');
        const settingsOptions = ["1. About Phone", "2. Network Information", "3. Change Wallpaper", "4. Location Sharing"];
        ctx.fillStyle = '#FFF'; ctx.font = `18px ${FONT_FAMILY}`; ctx.textAlign = 'left';
        settingsOptions.forEach((opt, i) => ctx.fillText(opt, 40, 120 + i * 40));
    } else if (state.screen === 'call_log') {
        drawHeader('Call Log');
        let yPos = 80;
        const callLog = (userData.callLog || []).slice(-10).reverse();
        if (callLog.length === 0) { ctx.textAlign='center'; ctx.fillStyle='#ccc'; ctx.font=`18px ${FONT_FAMILY}`; ctx.fillText("No recent calls.", canvasWidth/2, 200); }
        for(const call of callLog) {
            const name = userData.contacts[call.fromId || call.toId] || (call.type === 'missed' ? call.from : call.to);
            const color = call.type === 'missed' ? THEME.missedCallRed : THEME.successGreen;
            ctx.fillStyle = color; ctx.font = `bold 20px ${FONT_FAMILY}`; ctx.textAlign='left'; ctx.fillText(call.type === 'missed' ? '↓' : '↑', 30, yPos+25);
            ctx.fillStyle = '#FFF'; ctx.fillText(name, 60, yPos+25);
            ctx.font=`14px ${FONT_FAMILY}`; ctx.fillStyle='#aaa'; ctx.textAlign='right'; ctx.fillText(new Date(call.date).toLocaleTimeString(), canvasWidth-30, yPos+25);
            yPos += 40;
        }
    } else if (state.screen === 'contacts') {
        drawHeader('Contacts', '#FFF');
        ctx.fillStyle = THEME.googleBlue; ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.textAlign='center'; ctx.fillText('Contacts', canvasWidth/2, 40);
        let yPos = 80;
        const contacts = userData.contacts || {};
        if (Object.keys(contacts).length === 0) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("No contacts.", canvasWidth / 2, 200);
        } else {
            let index = 1;
            for (const [userId, nickname] of Object.entries(contacts)) {
                ctx.fillStyle = THEME.darkBg;
                fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 60, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
                ctx.fillText(`${index}. ${nickname}`, 35, yPos + 25);
                ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = THEME.secondaryText;
                ctx.fillText(`ID: ${userId}`, 35, yPos + 45);
                yPos += 75;
                index++;
            }
        }
    } else if (state.screen === 'app_store') {
        drawHeader('Play Store', THEME.playStoreGreen);
        const availableApps = [
            { name: 'Blackjack', price: 10000 },
            { name: 'Text Adventure', price: 15000 }
        ];
        let yPos = 80;
        availableApps.forEach((app, i) => {
            const isInstalled = (userData.installedApps || []).includes(app.name);
            ctx.fillStyle = THEME.darkBg;
            fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 60, 10);
            ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
            ctx.fillText(`${i+1}. ${app.name}`, 35, yPos + 35);
            ctx.fillStyle = isInstalled ? THEME.secondaryText : THEME.successGreen;
            ctx.font = `bold 14px ${FONT_FAMILY}`; ctx.textAlign = 'right';
            ctx.fillText(isInstalled ? 'Installed' : formatKMB(app.price), canvasWidth - 35, yPos + 35);
            yPos += 75;
        });
    } else if (state.screen === 'chirper') {
        drawHeader('Facebook', THEME.facebookBlue);
        let yPos = 80;
        ctx.fillStyle = THEME.darkBg; fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 50, 10);
        ctx.fillStyle = THEME.secondaryText; ctx.font = `16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
        ctx.fillText("What's on your mind?", 35, yPos + 30);
        yPos += 70;

        const posts = (await db.collection(BANK_COLLECTION).find({ chirperPosts: { $exists: true, $ne: [] } }).sort({ updatedAt: -1 }).limit(5).toArray())
            .flatMap(u => u.chirperPosts.map(p => ({ ...p, authorId: u.userId, id: p.id || new ObjectId().toString() })))
            .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
        
        if (posts.length === 0) { ctx.textAlign='center'; ctx.fillStyle='#ccc'; ctx.fillText("No posts yet. Be the first!", canvasWidth/2, 200);} 
        else {
            const postAuthors = await Promise.all(posts.map(p => usersDataService.getName(p.authorId)));
            const postImages = await Promise.all(posts.map(p => p.imageUrl ? loadImage(p.imageUrl).catch(() => null) : Promise.resolve(null)));

            for (let i = 0; i < posts.length; i++) {
                const post = posts[i];
                const authorName = postAuthors[i] || `User ${post.authorId}`;
                const postImage = postImages[i];
                const hasImage = postImage !== null;
                
                let textHeight = 0;
                ctx.font = `14px ${FONT_FAMILY}`;
                textHeight = wrapText(ctx, post.content, -500, -500, canvasWidth - 80, 18) + 500; // Off-screen measurement
                
                const postHeight = 60 + textHeight + (hasImage ? 160 : 0);
                
                ctx.fillStyle = THEME.darkBg;
                fillRoundRect(ctx, 20, yPos, canvasWidth - 40, postHeight, 10);
                ctx.fillStyle = THEME.primaryText; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
                ctx.fillText(`${i + 1}. ${authorName}`, 35, yPos + 25);
                ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = THEME.secondaryText;
                let textY = wrapText(ctx, post.content, 35, yPos + 50, canvasWidth - 90, 18);
                if (hasImage) {
                    ctx.drawImage(postImage, 35, textY, canvasWidth - 90, 150);
                }
                yPos += postHeight + 10;
            }
        }
    } else if (state.screen === 'chirper_post') {
        drawHeader('Chirper Post');
        let yPos = 80;
        const post = (await db.collection(BANK_COLLECTION).findOne({ userId: state.authorId, 'chirperPosts.id': state.postId }))
            ?.chirperPosts.find(p => p.id === state.postId);
        if (!post) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("Post not found.", canvasWidth / 2, 200);
        } else {
            const authorName = userData.contacts[state.authorId] || await usersDataService.getName(state.authorId) || `User ${state.authorId}`;
            ctx.fillStyle = '#222';
            fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 80, 10);
            ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
            ctx.fillText(`${authorName}`, 35, yPos + 20);
            ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = '#AAAAAA';
            wrapText(ctx, post.content, 35, yPos + 40, canvasWidth - 80, 18);
            yPos += 90;
            (post.replies || []).slice(-3).forEach(async (reply, i) => {
                const replyAuthor = userData.contacts[reply.authorId] || await usersDataService.getName(reply.authorId) || `User ${reply.authorId}`;
                ctx.fillStyle = '#333';
                fillRoundRect(ctx, 40, yPos, canvasWidth - 60, 60, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `14px ${FONT_FAMILY}`;
                ctx.fillText(`${replyAuthor}: ${reply.content}`, 50, yPos + 30);
                yPos += 70;
            });
        }
    } else if (state.screen === 'for_sale') {
        drawHeader('Amazon', THEME.amazonOrange);
        let yPos = 80;
        const listings = (await db.collection(BANK_COLLECTION).find({ inventory: { $exists: true, $ne: [] } }).toArray())
            .flatMap(u => u.inventory.filter(item => item.forSale).map(item => ({ ...item, sellerId: u.userId })))
            .slice(0, 5);
        if (listings.length === 0) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("No items for sale.", canvasWidth / 2, 200);
        } else {
            listings.forEach(async (item, i) => {
                const sellerName = userData.contacts[item.sellerId] || await usersDataService.getName(item.sellerId) || `User ${item.sellerId}`;
                ctx.fillStyle = THEME.darkBg;
                fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 80, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
                ctx.fillText(`${i+1}. ${item.name}`, 35, yPos + 30);
                ctx.fillStyle = THEME.amazonOrange; ctx.font = `bold 18px ${FONT_FAMILY}`; ctx.textAlign = 'right';
                ctx.fillText(formatKMB(item.price), canvasWidth - 35, yPos + 30);
                ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = '#AAAAAA'; ctx.textAlign = 'left';
                ctx.fillText(`Seller: ${sellerName}`, 35, yPos + 55);
                yPos += 90;
            });
        }
    } else if (state.screen === 'goatgle') {
        drawHeader('Google', THEME.googleBlue);
        ctx.fillStyle = '#FFF'; ctx.textAlign = 'center';
        ctx.font = 'bold 70px Arial';
        'Google'.split('').forEach((letter, i) => {
            const colors = [THEME.googleBlue, '#EA4335', '#FBBC05', THEME.googleBlue, '#34A853', '#EA4335'];
            ctx.fillStyle = colors[i];
            ctx.fillText(letter, 100 + i * 35, 250);
        });
        ctx.fillStyle = '#333'; fillRoundRect(ctx, 40, 300, canvasWidth - 80, 50, 25);
        ctx.fillStyle = '#777'; ctx.textAlign = 'left'; ctx.font = `18px ${FONT_FAMILY}`;
        ctx.fillText("Search or type a command...", 55, 333);
    } else if (state.screen === 'goatgle_results') {
        drawHeader('Search Results', THEME.googleBlue);
        ctx.fillStyle = '#FFF'; ctx.textAlign = 'left';
        ctx.font = `bold 16px ${FONT_FAMILY}`;
        wrapText(ctx, `Query: ${state.query}`, 20, 90, canvasWidth - 40, 20);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(20, 120); ctx.lineTo(canvasWidth - 20, 120); ctx.stroke();
        ctx.font = `14px ${FONT_FAMILY}`;
        wrapText(ctx, state.response, 20, 140, canvasWidth - 40, 20);
    } else if (state.screen === 'slots') {
        drawHeader('Slot Machine');
        ctx.fillStyle = '#000'; fillRoundRect(ctx, 20, 90, canvasWidth - 40, 220, 20);
        const reels = state.reels || ['🎰', '🎰', '🎰'];
        const reelWidth = 100;
        const startX = (canvasWidth - reelWidth * 3 - 20) / 2;
        reels.forEach((symbol, i) => {
            ctx.fillStyle = '#222';
            fillRoundRect(ctx, startX + i * (reelWidth + 10), 120, reelWidth, 120, 15);
            ctx.fillStyle = '#FFF'; ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center';
            ctx.fillText(symbol, startX + i * (reelWidth + 10) + reelWidth / 2, 210);
        });
        ctx.fillStyle = '#FFF'; ctx.font = `bold 20px ${FONT_FAMILY}`;
        ctx.fillText(state.slotResult || 'Bet: $100', canvasWidth / 2, 350);
        ctx.fillStyle = THEME.successGreen; fillRoundRect(ctx, 100, 380, canvasWidth - 200, 50, 10);
        ctx.fillStyle = '#FFF'; ctx.fillText('1. Spin!', canvasWidth / 2, 410);
    } else if (state.screen === 'quick_transfer') {
        drawHeader('Quick Transfer');
        ctx.textAlign = 'center'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF';
        ctx.fillText("Enter recipient ID or nickname and amount:", canvasWidth / 2, 150);
        ctx.fillText("Example: Bestie 5000", canvasWidth / 2, 180);
    } else if (state.screen === 'mini_statement') {
        drawHeader('Mini Statement');
        let yPos = 80;
        const transactions = (userData.transactions || []).slice(-5).reverse();
        if (transactions.length === 0) {
            ctx.textAlign = 'center'; ctx.fillStyle = '#ccc'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText("No recent transactions.", canvasWidth / 2, 200);
        } else {
            for (const tx of transactions) {
                ctx.fillStyle = tx.type === 'credit' ? THEME.successGreen : THEME.missedCallRed;
                fillRoundRect(ctx, 20, yPos, canvasWidth - 40, 60, 10);
                ctx.fillStyle = '#FFFFFF'; ctx.font = `bold 16px ${FONT_FAMILY}`; ctx.textAlign = 'left';
                ctx.fillText(`${tx.type === 'credit' ? '+' : '-'} ${formatKMB(tx.amount)}`, 35, yPos + 25);
                ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = '#AAAAAA'; ctx.textAlign = 'right';
                ctx.fillText(new Date(tx.date).toLocaleDateString(), canvasWidth-35, yPos + 25);
                ctx.textAlign = 'left';
                wrapText(ctx, tx.description, 35, yPos + 45, canvasWidth - 80, 18);
                yPos += 75;
            }
        }
    } else if (state.screen === 'qr_pay') {
        drawHeader('QR Pay');
        ctx.fillStyle = '#FFFFFF'; fillRoundRect(ctx, (canvasWidth - 250)/2, 150, 250, 250, 10);
        try {
            const qrCodeImage = await loadImage(`https://api.qrserver.com/v1/create-qr-code/?size=230x230&data=${userData.userId}`);
            ctx.drawImage(qrCodeImage, (canvasWidth-230)/2, 160, 230, 230);
        } catch(e) {
            ctx.fillStyle = '#000'; ctx.font = `24px ${FONT_FAMILY}`; ctx.textAlign = 'center';
            ctx.fillText("QR Unavailable", canvasWidth / 2, 275);
        }
        ctx.fillStyle = '#FFF'; ctx.font = `16px ${FONT_FAMILY}`; ctx.textAlign = 'center';
        ctx.fillText('Share this to receive payments', canvasWidth / 2, 430);
    } else if (state.screen === 'maps') {
        drawHeader('Maps');
        ctx.fillStyle = '#1a502d'; ctx.fillRect(0, 60, canvasWidth, canvasHeight - 60);
        ctx.strokeStyle = '#55a679'; ctx.lineWidth = 2;
        for(let i = 0; i < 10; i++) {
            ctx.beginPath(); ctx.moveTo(i * 50, 60); ctx.lineTo(i * 50, canvasHeight); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, 60 + i * 80); ctx.lineTo(canvasWidth, 60 + i * 80); ctx.stroke();
        }
        const locations = [
            { name: 'Cafe', x: 80, y: 150 }, { name: 'Arcade', x: 250, y: 300 }, { name: 'Beach House', x: 120, y: 500 }
        ];
        locations.forEach((loc, i) => {
            ctx.beginPath(); ctx.arc(loc.x, loc.y, 8, 0, 2 * Math.PI); ctx.fillStyle = THEME.missedCallRed; ctx.fill();
            ctx.fillStyle = '#FFF'; ctx.textAlign = 'center'; ctx.font = `bold 14px ${FONT_FAMILY}`;
            ctx.fillText(`${i + 1}. ${loc.name}`, loc.x, loc.y + 25);
        });
        if (userData.locationOptIn) {
            ctx.beginPath(); ctx.arc(canvasWidth / 2, canvasHeight - 100, 10, 0, 2 * Math.PI);
            ctx.fillStyle = THEME.googleBlue; ctx.fill();
            ctx.strokeStyle = '#FFF'; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = '#FFF'; ctx.fillText('You Are Here', canvasWidth/2, canvasHeight-70);
        }
    }

    const tempImageDir = path.join(__dirname, "..", "cache");
    await fs.ensureDir(tempImageDir);
    const tempImagePath = path.join(tempImageDir, `phone_${userData.userId}_${Date.now()}.png`);
    const out = fs.createWriteStream(tempImagePath);
    canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve));
    return fs.createReadStream(tempImagePath);
}

module.exports = {
    config: {
        name: "phone",
        aliases: ["mobile"],
        version: "3.5",
        author: "Mahi & Gemini & Grok",
        role: 0,
        countDown: 5,
        shortDescription: { en: "Your personal mobile phone." },
        longDescription: { en: "A dynamic mobile phone with AI search, social media, banking, and more." },
        category: "social"
    },

    onReply: async function ({ event, api, message, Reply, usersData }) {
        if (!Reply || event.senderID !== Reply.author) return;

        const { author, type, state } = Reply;
        const db = await getDb();
        let userBankInfo = await getUserBankData(author, db);
        if (!userBankInfo) return message.reply("Error: Could not find your user data.");
        
        const userInput = event.body.trim().toLowerCase();

        if (type === 'call_response') {
            global.GoatBot.onReply.delete(Reply.messageID);
            if (Date.now() - state.callTime > 30000) return message.reply("Call timed out.");

            const callerId = state.callerId;
            const callerData = await getUserBankData(callerId, db);
            const recipientName = await usersData.getName(author);

            if(userInput === 'answer') {
                 callerData.callLog.push({ type: 'answered', to: recipientName, toId: author, date: new Date(), read: true });
                 await updateUserBankData(callerId, callerData, db);
                 userBankInfo.callLog.push({ type: 'answered', from: await usersData.getName(callerId), fromId: callerId, date: new Date(), read: true });
                 await updateUserBankData(author, userBankInfo, db);
                 api.sendMessage(`📞 ${recipientName} answered your call!`, callerId);
                 return message.reply("Call connected!");
            } else if(userInput === 'decline') {
                callerData.callLog.push({ type: 'declined', to: recipientName, toId: author, date: new Date(), read: true });
                await updateUserBankData(callerId, callerData, db);
                userBankInfo.callLog.push({ type: 'declined', from: await usersData.getName(callerId), fromId: callerId, date: new Date(), read: true });
                await updateUserBankData(author, userBankInfo, db);
                api.sendMessage(`📞 ${recipientName} declined your call.`, callerId);
                return message.reply("Call declined.");
            }
            return;
        }

        const renderPhone = async (newState, promptText) => {
            const attachment = await drawPhoneCanvas(newState, userBankInfo, usersData, db);
            let defaultPrompt = "Reply with 'home' to return to the home screen, or 'exit' to close the phone.";
            message.reply({ body: promptText || defaultPrompt, attachment }, (err, info) => {
                fs.unlink(attachment.path, () => {});
                if (err) return;
                newState.step = newState.screen;
                global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: event.senderID, type: 'phone_flow', state: newState });
            });
        };

        if (userInput === 'exit') return message.reply("Phone closed.");
        if (userInput === 'home') return await renderPhone({ screen: 'home' }, "📱 Home Screen\nReply with an app name or number.");
        if (state.step === 'lockscreen') return await renderPhone({ screen: 'home' }, "📱 Home Screen\nReply with an app name or number.");
        
        const inputParts = event.body.trim().split(/\s+/);

        if (state.step === 'home') {
            const defaultIcons = [
                { name: 'Anchestor' }, { name: 'Call' }, { name: 'Messages' }, { name: 'Maps' },
                { name: 'Calculator' }, { name: 'Calendar' }, { name: 'Gallery' }, { name: 'Settings' },
                { name: 'Contacts' }, { name: 'App Store' }, { name: 'Chirper' }, { name: 'For Sale' },
                { name: 'Goatgle' }, { name: 'Slots' }
            ];
            const purchasedAppIcons = (userBankInfo.installedApps || []).map(name => ({ name }));
            const appMap = new Map();
            [...defaultIcons, ...purchasedAppIcons].forEach(app => appMap.set(app.name, app));
            const appIcons = Array.from(appMap.values());
            const choice = parseInt(userInput);
            const appName = isNaN(choice) ? userInput.toLowerCase() : '';
            const appIndex = isNaN(choice) ? appIcons.findIndex(app => app.name.toLowerCase() === appName) : choice - 1;
            if (appIndex > -1 && appIndex < appIcons.length) {
                let screenName = appIcons[appIndex].name.toLowerCase().replace(' ', '_');
                return await renderPhone({ screen: screenName, display: '0' });
            }
            return message.reply("Invalid app selection.");
        }
        if (state.step === 'goatgle') {
            message.reply("🤖 Searching with Google AI...");
            const aiResponse = await getChatResponse(event.body.trim());
            return await renderPhone({ screen: 'goatgle_results', query: event.body.trim(), response: aiResponse });
        }
        if (state.step === 'contacts') {
            if (inputParts[0].toLowerCase() === 'add' && inputParts.length >= 3) {
                const userId = inputParts[1];
                const nickname = inputParts.slice(2).join(' ');
                const userExists = await usersData.getName(userId);
                if (!userExists || !/^\d+$/.test(userId)) return message.reply("Invalid User ID or user not found.");
                userBankInfo.contacts[userId] = nickname;
                await updateUserBankData(userBankInfo.userId, userBankInfo, db);
                return message.reply(`Added ${nickname} (${userId}) to contacts.`);
            }
        }
        if (state.step === 'app_store') {
            const availableApps = [{ name: 'Blackjack', price: 10000 }, { name: 'Text Adventure', price: 15000 }];
            const choice = parseInt(userInput);
            if (choice > 0 && choice <= availableApps.length) {
                const app = availableApps[choice - 1];
                if ((userBankInfo.installedApps || []).includes(app.name)) return message.reply(`${app.name} is already installed.`);
                if (userBankInfo.bank < app.price) return message.reply("Insufficient funds.");
                userBankInfo.bank -= app.price;
                userBankInfo.installedApps.push(app.name);
                await updateUserBankData(userBankInfo.userId, userBankInfo, db);
                return message.reply(`✅ ${app.name} installed successfully!`);
            }
        }
        if (state.step === 'chirper') {
             if (inputParts[0].toLowerCase() === 'post' && inputParts.length > 1) {
                const content = event.body.trim().slice(5);
                userBankInfo.chirperPosts.push({ id: new ObjectId().toString(), content, date: new Date(), replies: [] });
                await updateUserBankData(userBankInfo.userId, userBankInfo, db);
                return message.reply("Posted to Chirper!");
            }
            if(inputParts[0].toLowerCase() === 'image' && inputParts.length > 1){
                const content = event.body.trim().slice(6);
                return renderPhone({screen: 'chirper_image_upload', postContent: content}, "Please reply with an image attachment for your post.");
            }
        }
        if(state.step === 'chirper_image_upload'){
            if (event.attachments.length > 0 && event.attachments[0].type === 'photo') {
                userBankInfo.chirperPosts.push({ id: new ObjectId().toString(), content: state.postContent, imageUrl: event.attachments[0].url, date: new Date(), replies: [] });
                await updateUserBankData(userBankInfo.userId, userBankInfo, db);
                return message.reply("Posted to Chirper with your image!");
            }
        }
        if (state.step === 'slots') {
            if (userInput === '1') {
                if (userBankInfo.bank < 100) return message.reply("Insufficient funds for a spin ($100).");
                userBankInfo.bank -= 100;
                const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎'];
                const result = Array(3).fill(0).map(() => symbols[Math.floor(Math.random() * symbols.length)]);
                let winnings = 0;
                let winMsg = `You lost.`;
                if (result[0] === result[1] && result[1] === result[2]) { winnings = result[0] === '7️⃣' ? 7777 : (result[0] === '💎' ? 5000 : 1000); }
                else if (result.filter(s => s === '🍒').length === 2) { winnings = 200; }
                if (winnings > 0) { userBankInfo.bank += winnings; winMsg = `You won ${formatKMB(winnings)}!`; }
                await updateUserBankData(userBankInfo.userId, userBankInfo, db);
                return await renderPhone({ screen: 'slots', reels: result, slotResult: winMsg });
            }
        }
        if (state.step === 'quick_transfer') {
            const [recipient, amountStr] = event.body.trim().split(' ');
            const amount = parseFloat(amountStr);
            if (!recipient || isNaN(amount) || amount <= 0) return message.reply("Usage: <ID/nickname> <amount>");
            let recipientId = recipient;
            if (userBankInfo.contacts[recipient]) recipientId = userBankInfo.contacts[recipient];
            const recipientData = await getUserBankData(recipientId, db);
            if (!recipientData) return message.reply("Recipient not found.");
            if (userBankInfo.bank < amount) return message.reply("Insufficient funds.");
            userBankInfo.bank -= amount;
            recipientData.bank += amount;
            await updateUserBankData(userBankInfo.userId, userBankInfo, db);
            await updateUserBankData(recipientId, recipientData, db);
            api.sendMessage(`💸 You received ${formatKMB(amount)} from ${await usersData.getName(userBankInfo.userId)}!`, recipientId);
            return message.reply(`Transferred ${formatKMB(amount)} to ${recipientId}.`);
        }
        if (state.step === 'anchestor_app') {
            const choice = parseInt(userInput);
            if (choice === 1) return await renderPhone({ screen: 'quick_transfer' });
            if (choice === 2) return await renderPhone({ screen: 'mini_statement' });
            if (choice === 3) return await renderPhone({ screen: 'qr_pay' });
        }
    },

    onStart: async function ({ args, message, event, api, usersData }) {
        const senderID = String(event.senderID);
        const p = global.utils.getPrefix(event.threadID) || ".";
        const db = await getDb();
        let userBankInfo = await getUserBankData(senderID, db);

        if (!userBankInfo) {
            return message.reply(`You need an Anchestor Bank account to use the phone. Please create one first using '${p}bank create_card'.`);
        }

        const command = args[0]?.toLowerCase();

        if (!command || command === 'open') {
            const attachment = await drawPhoneCanvas({ screen: 'lockscreen' }, userBankInfo, usersData, db);
            return message.reply({ body: "📱 Phone locked. Reply to unlock.", attachment }, (err, info) => {
                fs.unlink(attachment.path, () => {});
                if (err) return;
                global.GoatBot.onReply.set(info.messageID, {
                    commandName: this.config.name,
                    author: event.senderID,
                    type: 'phone_flow',
                    state: { step: 'lockscreen' }
                });
            });
        }
        
        const callOrMessage = async (type) => {
            let recipientId = Object.keys(event.mentions)[0] || args[1];
            if (userBankInfo.contacts[args[1]]) recipientId = userBankInfo.contacts[args[1]];
            if (!recipientId) return message.reply(`Usage: ${p}phone ${type} <@mention/ID/nickname>${type==='message' ? ' <message>' : ''}`);
            const recipientData = await getUserBankData(recipientId, db);
            if (!recipientData) return message.reply("Recipient not found or does not have a bank account.");
            
            const senderName = await usersData.getName(senderID);

            if (type === 'message') {
                const msgContent = args.slice(2).join(" ");
                if (!msgContent) return message.reply(`Usage: ${p}phone message <@mention/ID/nickname> <message>`);
                recipientData.messages.push({ senderId: senderID, recipientId, content: msgContent, date: new Date(), read: false });
                await updateUserBankData(recipientId, recipientData, db);
                userBankInfo.messages.push({ senderId: senderID, recipientId, content: msgContent, date: new Date(), read: true });
                await updateUserBankData(senderID, userBankInfo, db);
                api.sendMessage(`🔔 New message from ${senderName}! Check with '${p}phone'.`, recipientId);
                return message.reply("Message sent!");
            } else if (type === 'call') {
                const recipientName = userBankInfo.contacts[recipientId] || await usersData.getName(recipientId);
                recipientData.callLog.push({ type: 'missed', from: senderName, fromId: senderID, date: new Date(), read: false });
                await updateUserBankData(recipientId, recipientData, db);
                userBankInfo.callLog.push({ type: 'outgoing', to: recipientName, toId: recipientId, date: new Date(), read: true });
                await updateUserBankData(senderID, userBankInfo, db);
                
                message.reply(`Calling ${recipientName}... Waiting for response.`);
                api.sendMessage(`📞 ${senderName} is calling you! Reply with 'answer' or 'decline' within 30 seconds.`, recipientId, (err, info) => {
                    if(err) return;
                     global.GoatBot.onReply.set(info.messageID, {
                        commandName: this.config.name,
                        author: recipientId,
                        type: 'call_response',
                        state: { callerId: senderID, callTime: Date.now() }
                    });
                });
            }
        };

        if (command === 'message') return await callOrMessage('message');
        if (command === 'call') return await callOrMessage('call');

        return message.reply(`Invalid command. Use '${p}phone' to open, '${p}phone message ...' to send a message, or '${p}phone call ...' to call.`);
    }
};
