const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const GIFEncoder = require('gifencoder');

// --- Game Configuration ---
const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '🔔', '💎', '7️⃣'];
const payouts = {
    '7️⃣7️⃣7️⃣': 50,
    '💎💎💎': 25,
    '⭐⭐⭐': 15,
    '🔔🔔🔔': 10,
    '🍉🍉🍉': 8,
    '🍊🍊🍊': 5,
    '🍋🍋🍋': 4,
    '🍒🍒🍒': 3,
};
const reelStrips = [
    ['🍒', '🍋', '🍊', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋', '🍊', '🍉'],
    ['🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋', '🍊', '🍉', '⭐', '🔔', '💎'],
    ['🍋', '🍊', '🍉', '⭐', '🔔', '💎', '7️⃣', '🍒', '🍋', '🍊', '🍉', '⭐']
];

// --- Utility: Split emojis correctly ---
function splitEmojis(str) {
    // Returns an array of emoji symbols (each could be multi-codepoint)
    const regex = /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|[0-9#*]\uFE0F?\u20E3)/gu;
    return Array.from(str.matchAll(regex), m => m[0]);
}

// --- Core Logic ---
function getResult() {
    // 80% chance to win something
    if (Math.random() < 0.8) {
        const winningCombinations = Object.keys(payouts);
        const randomWin = winningCombinations[Math.floor(Math.random() * winningCombinations.length)];
        const split = splitEmojis(randomWin);
        if (split.length === 3) return split;
    }

    // Fallback: random non-winning result
    return [
        reelStrips[0][Math.floor(Math.random() * reelStrips[0].length)],
        reelStrips[1][Math.floor(Math.random() * reelStrips[1].length)],
        reelStrips[2][Math.floor(Math.random() * reelStrips[2].length)]
    ];
}

function calculateWinnings(result, bet) {
    if (!Array.isArray(result) || result.length < 3) {
        return { amount: 0, message: 'Invalid spin result. Try again.' };
    }
    const key = result.join('');
    if (payouts[key]) {
        return { amount: bet * payouts[key], message: `JACKPOT! Three ${result[0]}s!` };
    }
    if (result[0] === result[1] && result[0] === '🍒') {
        return { amount: bet * 2, message: 'Nice! Double Cherries!' };
    }
    return { amount: 0, message: 'Better luck next time!' };
}

// --- Command Export ---
module.exports = {
    config: {
        name: "slot",
        aliases: ["slots"],
        version: "1.2",
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Play the slot machine" },
        longDescription: { en: "Play a slot machine game with animated canvas GIF output." },
        category: "economy",
        guide: { en: "{pn} <bet_amount>" }
    },

    onStart: async function ({ api, event, message, usersData, args }) {
        const betAmount = parseInt(args[0]);
        if (isNaN(betAmount) || betAmount <= 0) {
            return message.reply("Please enter a valid bet amount.");
        }

        const senderID = event.senderID;
        const userData = await usersData.get(senderID);
        if (!userData || userData.money < betAmount) {
            return message.reply("You don't have enough money to place that bet.");
        }

        const processingMessage = await message.reply("🎰 Placing your bet and spinning the reels...");

        try {
            userData.money -= betAmount;
            await usersData.set(senderID, { money: userData.money });

            const result = getResult();
            const { amount: winnings, message: winMessage } = calculateWinnings(result, betAmount);

            if (winnings > 0) {
                userData.money += winnings;
                await usersData.set(senderID, { money: userData.money });
            }

            const gifPath = path.join(__dirname, 'cache', `slot_${Date.now()}.gif`);
            await fs.ensureDir(path.dirname(gifPath));

            const canvasWidth = 600;
            const canvasHeight = 400;
            const encoder = new GIFEncoder(canvasWidth, canvasHeight);
            const gifStream = fs.createWriteStream(gifPath);
            encoder.createReadStream().pipe(gifStream);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(100);
            encoder.setQuality(10);

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            ctx.font = '70px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const reelWidth = 100;
            const reelHeight = 100;
            const reelPositionsX = [150, 300, 450];
            const reelWindowY = 190;
            const frameCount = 30;
            const spinDuration = 20;

            for (let i = 0; i < frameCount; i++) {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = '#33334d';
                ctx.fillRect(100, 130, 400, 120);
                ctx.strokeStyle = '#ffcc00';
                ctx.lineWidth = 5;
                ctx.strokeRect(100, 130, 400, 120);

                const hue = (i * 12) % 360;
                const glowColor = `hsl(${hue}, 100%, 70%)`;
                ctx.fillStyle = glowColor;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 15;
                ctx.font = 'bold 48px Arial';
                ctx.fillText("CASINO SLOT", canvasWidth / 2, 60);
                ctx.shadowBlur = 0;

                for (let r = 0; r < 3; r++) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(reelPositionsX[r] - reelWidth / 2, reelWindowY - reelHeight / 2, reelWidth, reelHeight);
                    ctx.clip();

                    const stopFrame = spinDuration + r * 3;
                    if (i < stopFrame) {
                        const yOffset = (Date.now() + r * 100) % 100;
                        for (let s = -1; s < 2; s++) {
                            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
                            ctx.font = '70px sans-serif';
                            ctx.fillText(randomSymbol, reelPositionsX[r], reelWindowY + yOffset + s * 100 - 50);
                        }
                    } else {
                        ctx.font = '70px sans-serif';
                        ctx.fillText(result[r], reelPositionsX[r], reelWindowY);
                    }
                    ctx.restore();
                }

                if (i === frameCount - 1) {
                    ctx.fillStyle = winnings > 0 ? '#34D399' : '#EF4444';
                    ctx.font = 'bold 30px Arial';
                    ctx.fillText(winMessage, canvasWidth / 2, 320);
                    if (winnings > 0) {
                        ctx.fillStyle = '#FFD700';
                        ctx.fillText(`You won $${winnings.toLocaleString()}!`, canvasWidth / 2, 360);
                    }
                }

                encoder.addFrame(ctx);
            }

            encoder.finish();
            await new Promise(res => gifStream.on('finish', res));

            await message.reply({
                body: `[ 🎰 SLOT RESULT 🎰 ]\nBet: $${betAmount.toLocaleString()}\nResult: ${result.join(' ')}\n> ${winMessage}${winnings > 0 ? `\n> Payout: $${winnings.toLocaleString()}` : ''}\nYour new balance: $${userData.money.toLocaleString()}`,
                attachment: fs.createReadStream(gifPath)
            });

            fs.unlinkSync(gifPath);
            message.unsend(processingMessage.messageID);

        } catch (error) {
            console.error("Slot machine error:", error);
            message.reply("Sorry, the slot machine is out of order. Please try again later.");
            message.unsend(processingMessage.messageID);
        }
    }
};
