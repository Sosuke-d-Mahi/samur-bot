const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const moment = require('moment-timezone');

try {
    const fontDir = path.join('scripts', 'cmds', 'assets', 'font');
    if (fs.existsSync(path.join(fontDir, 'HindSiliguri-Bold.ttf'))) {
        registerFont(path.join(fontDir, 'HindSiliguri-Bold.ttf'), { family: 'Hind Siliguri', weight: 'bold' });
    }
    if (fs.existsSync(path.join(fontDir, 'HindSiliguri-Regular.ttf'))) {
        registerFont(path.join(fontDir, 'HindSiliguri-Regular.ttf'), { family: 'Hind Siliguri', weight: 'normal' });
    }
    if (fs.existsSync(path.join(fontDir, 'Arial-Bold.ttf'))) {
        registerFont(path.join(fontDir, 'Arial-Bold.ttf'), { family: 'Arial', weight: 'bold' });
    }
    if (fs.existsSync(path.join(fontDir, 'Arial.ttf'))) {
        registerFont(path.join(fontDir, 'Arial.ttf'), { family: 'Arial', weight: 'normal' });
    }
} catch (e) {
    console.error(`Welcome Font Registration Failed: ${e.message}`);
}

async function downloadImage(url, outputPath) {
    try {
        if (!url) throw new Error("URL is null or undefined");
        if (fs.existsSync(outputPath)) return outputPath; // Use cached image
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        await fs.ensureDir(path.dirname(outputPath));
        fs.writeFileSync(outputPath, res.data);
        return outputPath;
    } catch (e) {
        console.error(`Failed to download image from ${url}`, e.message);
        return null;
    }
}

async function createWelcomeCanvas(newUserInfo, addedByInfo, groupInfo, localImagePaths) {
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    // Background
    try {
        const bg = await loadImage(localImagePaths.background);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } catch {
        ctx.fillStyle = '#101828';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Top and bottom bars
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, 70);
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    // Group avatar
    const groupAvatar = await loadImage(localImagePaths.groupAvatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(45, 35, 25, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(groupAvatar, 20, 10, 50, 50);
    ctx.restore();

    // Group info
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "Hind Siliguri", Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(groupInfo.name, 85, 28);
    ctx.font = 'normal 16px Arial';
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText(`${groupInfo.memberCount} members • ${groupInfo.adminCount} admins`, 85, 50);

    // Added by avatar
    const addedByAvatar = await loadImage(localImagePaths.addedByAvatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width - 45, 35, 25, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(addedByAvatar, canvas.width - 70, 10, 50, 50);
    ctx.restore();

    ctx.strokeStyle = '#FDB813';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#FDB813';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(canvas.width - 45, 35, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'right';
    ctx.font = 'normal 16px Arial';
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText("Invited by:", canvas.width - 85, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Hind Siliguri", Arial';
    ctx.fillText(addedByInfo.name, canvas.width - 85, 50);

    // Welcome text
    const welcomeGrad = ctx.createLinearGradient(0, 0, 0, 150);
    welcomeGrad.addColorStop(0, '#FFFFFF');
    welcomeGrad.addColorStop(1, '#00FFFF');
    ctx.textAlign = 'center';
    ctx.font = 'bold 100px Arial';
    ctx.fillStyle = welcomeGrad;
    ctx.shadowColor = '#00FFFF';
    ctx.shadowBlur = 20;
    ctx.fillText("WELCOME", canvas.width / 2, 220);
    ctx.shadowBlur = 0;

    // New user avatar
    const newUserAvatar = await loadImage(localImagePaths.newUserAvatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 360, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(newUserAvatar, canvas.width / 2 - 80, 280, 160, 160);
    ctx.restore();

    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 6;
    ctx.shadowColor = '#34D399';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 360, 83, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 48px "Hind Siliguri", Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(newUserInfo.name, canvas.width / 2, 490);

    ctx.font = 'normal 28px Arial';
    ctx.fillStyle = '#B0B3B8';
    ctx.fillText(`You are the ${groupInfo.position} member!`, canvas.width / 2, 535);

    ctx.fillStyle = '#18191A';
    ctx.beginPath();
    ctx.roundRect(canvas.width / 2 - 300, canvas.height - 65, 600, 50, 25);
    ctx.fill();

    ctx.fillStyle = '#E4E6EB';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`${groupInfo.memberCount} Members • ${groupInfo.male} Male • ${groupInfo.female} Female • Bot Joined: ${groupInfo.botJoinedDate}`, canvas.width / 2, canvas.height - 40);

    const outputPath = path.join('scripts', 'cmds', 'cache', `welcome_final_${newUserInfo.id}.png`);
    await fs.ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
    return outputPath;
}

module.exports = {
    config: {
        name: "welcome",
        version: "15.0",
        author: "Mahi--",
        category: "events",
    },

    onStart: async ({ threadsData, message, event, api, usersData }) => {
        if (event.logMessageType !== "log:subscribe") return;
        const threadID = event.threadID;
        const nickNameBot = global.GoatBot?.config?.nickNameBot;

        // If bot is added
        if (event.logMessageData.addedParticipants.some(p => p.userFbId === api.getCurrentUserID())) {
            if (nickNameBot) await api.changeNickname(nickNameBot, threadID, api.getCurrentUserID());
        }

        try {
            const threadData = await threadsData.get(threadID);
            if (threadData.settings.sendWelcomeMessage === false) return;

            if (!threadData.botJoinedTimestamp) {
                threadData.botJoinedTimestamp = Date.now();
                await threadsData.set(threadID, threadData);
            }

            const threadInfo = await api.getThreadInfo(threadID);
            const addedByInfo = { id: event.author, name: await usersData.getName(event.author) };

            for (const user of event.logMessageData.addedParticipants) {
                if (user.userFbId === api.getCurrentUserID()) continue;

                const newUserInfo = { id: user.userFbId, name: user.fullName };
                const cacheFolder = path.join('scripts', 'cmds', 'cache');
                await fs.ensureDir(cacheFolder);

                const uniqueSuffix = `${Date.now()}_${newUserInfo.id}`;
                const backgroundPath = path.join(cacheFolder, `w_bg_${uniqueSuffix}.png`);
                const newUserAvatarPath = path.join(cacheFolder, `w_av1_${uniqueSuffix}.png`);
                const addedByAvatarPath = path.join(cacheFolder, `w_av2_${uniqueSuffix}.png`);
                const groupAvatarPath = path.join(cacheFolder, `w_av3_${uniqueSuffix}.png`);

                const tempFiles = [backgroundPath, newUserAvatarPath, addedByAvatarPath, groupAvatarPath];
                let finalCanvasPath;

                try {
                    const backgroundUrl = "https://i.ibb.co/Z1GsdJFW/fiery-volcanic-eruption-h6bl83vgczkvnssh.png";
                    const newUserAvatarUrl = await usersData.getAvatarUrl(newUserInfo.id);
                    const addedByUrl = await usersData.getAvatarUrl(addedByInfo.id);
                    const groupUrl = threadInfo.imageSrc || `https://graph.facebook.com/${threadID}/picture?width=512&height=512`;

                    await Promise.all([
                        downloadImage(backgroundUrl, backgroundPath),
                        downloadImage(newUserAvatarUrl, newUserAvatarPath),
                        downloadImage(addedByUrl, addedByAvatarPath),
                        downloadImage(groupUrl, groupAvatarPath)
                    ]);

                    let male = 0, female = 0;
                    for (const u in threadInfo.userInfo) {
                        if (threadInfo.userInfo[u].gender === "MALE") male++;
                        else if (threadInfo.userInfo[u].gender === "FEMALE") female++;
                    }

                    const groupInfo = {
                        id: threadID,
                        name: threadInfo.threadName,
                        position: threadInfo.participantIDs.length,
                        memberCount: threadInfo.participantIDs.length,
                        adminCount: threadInfo.adminIDs.length,
                        botJoinedDate: moment(threadData.botJoinedTimestamp).format("MMM DD, YYYY"),
                        male, female
                    };

                    const localImagePaths = {
                        background: backgroundPath,
                        newUserAvatar: newUserAvatarPath,
                        addedByAvatar: addedByAvatarPath,
                        groupAvatar: groupAvatarPath
                    };

                    finalCanvasPath = await createWelcomeCanvas(newUserInfo, addedByInfo, groupInfo, localImagePaths);

                    await message.send({
                        body: `Welcome to the group, ${newUserInfo.name}!`,
                        mentions: [{ tag: newUserInfo.name, id: newUserInfo.id }],
                        attachment: fs.createReadStream(finalCanvasPath)
                    });

                } catch (e) {
                    console.error("Welcome Canvas Generation Failed:", e);
                    await message.send(`Welcome, ${newUserInfo.name}! (Error creating image)`);
                } finally {
                    tempFiles.push(finalCanvasPath);
                    tempFiles.forEach(f => f && fs.existsSync(f) && fs.unlinkSync(f));
                }
            }
        } catch (e) {
            console.error("Welcome Event Error:", e);
        }
    }
};
