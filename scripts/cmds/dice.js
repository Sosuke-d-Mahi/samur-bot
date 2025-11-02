const { createCanvas } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const GIFEncoder = require('gifencoder');

function getDiceRoll() {
    return Math.floor(Math.random() * 6) + 1;
}

function calculateDiceWinnings(chosenNumber, result, bet) {
    if (chosenNumber === result) {
        return { amount: bet * 6, message: `!!! JACKPOT !!!` };
    }
    return { amount: 0, message: `YOU LOSE!` };
}

function drawDiceFace(ctx, size, number, showDots = true) {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = size / 20;
    
    ctx.beginPath();
    ctx.roundRect(-size/2, -size/2, size, size, size/10);
    ctx.fill();
    ctx.stroke();
    
    if (!showDots) return;

    ctx.fillStyle = '#1a1a1a';
    const dotRadius = size / 12;
    const positions = {
        1: [[0, 0]], 2: [[-0.25, -0.25], [0.25, 0.25]],
        3: [[-0.25, -0.25], [0, 0], [0.25, 0.25]],
        4: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]],
        5: [[-0.25, -0.25], [0.25, -0.25], [0, 0], [-0.25, 0.25], [0.25, 0.25]],
        6: [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0], [0.25, 0], [-0.25, 0.25], [0.25, 0.25]],
    };

    if (positions[number]) {
        positions[number].forEach(([dx, dy]) => {
            ctx.beginPath();
            ctx.arc(size * dx, size * dy, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

module.exports = {
    config: {
        name: "dice",
        aliases: ["roll"],
        version: "69",
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Roll a dice and bet on the outcome." },
        category: "economy",
        guide: { en: "{pn} <number_1-6> <bet_amount>" }
    },

    onStart: async function ({ api, event, message, usersData, args }) {
        const chosenNumber = parseInt(args[0]);
        const betAmount = parseInt(args[1]);

        if (isNaN(chosenNumber) || chosenNumber < 1 || chosenNumber > 6) {
            return message.reply("Please bet on a number between 1 and 6.");
        }
        if (isNaN(betAmount) || betAmount <= 0) {
            return message.reply("Please enter a valid bet amount.");
        }

        const senderID = event.senderID;
        const userData = await usersData.get(senderID);
        if (!userData || userData.money < betAmount) {
            return message.reply("You don't have enough money for that bet.");
        }

        const processingMessage = await message.reply("🎲 Dropping the dice...");

        try {
            userData.money -= betAmount;
            await usersData.set(senderID, { money: userData.money });

            const isWin = Math.random() < 0.51;
            let result;
            if (isWin) {
                result = chosenNumber;
            } else {
                do { result = getDiceRoll(); } while (result === chosenNumber);
            }
            
            const { amount: winnings, message: winMessage } = calculateDiceWinnings(chosenNumber, result, betAmount);
            if (winnings > 0) {
                userData.money += winnings;
                await usersData.set(senderID, { money: userData.money });
            }
            
            const canvasWidth = 600, canvasHeight = 400;
            const encoder = new GIFEncoder(canvasWidth, canvasHeight);
            const gifPath = path.join(__dirname, 'cache', `dice_${Date.now()}.gif`);
            await fs.ensureDir(path.dirname(gifPath));
            
            const gifStream = fs.createWriteStream(gifPath);
            encoder.createReadStream().pipe(gifStream);
            encoder.start();
            encoder.setRepeat(0);
            encoder.setDelay(50); 
            encoder.setQuality(10);

            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');
            
            const frameCount = 60;
            const dropDuration = 25;
            const bounceDuration = 20;
            const revealFrame = dropDuration + bounceDuration;
            const floorY = 250;
            const diceSize = 100;

            for (let i = 0; i < frameCount; i++) {
                ctx.fillStyle = '#111827';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                const shadowGrad = ctx.createRadialGradient(canvasWidth/2, floorY + 20, 50, canvasWidth/2, floorY+20, 200);
                shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
                shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = shadowGrad;
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                let y, rotation, showDots = false, faceToDraw = result;
                
                if (i < dropDuration) { // Phase 1: Dropping
                    const progress = i / dropDuration;
                    y = -100 + (progress * progress) * (floorY + 100);
                    rotation = progress * 720;
                } else if (i < revealFrame) { // Phase 2: Bouncing
                    const progress = (i - dropDuration) / bounceDuration;
                    y = floorY - Math.abs(Math.sin(progress * Math.PI * 2)) * (50 * (1 - progress));
                    rotation = (dropDuration / dropDuration) * 720 + progress * 90;
                } else { // Phase 3: Reveal
                    y = floorY;
                    rotation = (dropDuration / dropDuration) * 720 + 90;
                    showDots = true;
                }

                ctx.save();
                ctx.translate(canvasWidth / 2, y);
                ctx.rotate(rotation * Math.PI / 180);
                ctx.filter = showDots ? 'none' : 'blur(4px)';
                drawDiceFace(ctx, diceSize, faceToDraw, showDots);
                ctx.restore();
                
                if (i === frameCount - 1) {
                    ctx.textAlign = 'center';
                    ctx.fillStyle = winnings > 0 ? '#34D399' : '#EF4444';
                    ctx.font = 'bold 52px "Arial Black"';
                    ctx.shadowColor = winnings > 0 ? '#34D399' : '#EF4444';
                    ctx.shadowBlur = 25;
                    ctx.fillText(winMessage, canvasWidth / 2, 80);
                    ctx.shadowBlur = 0;
                }
                encoder.addFrame(ctx);
            }

            encoder.finish();
            await new Promise(res => gifStream.on('finish', res));

            await message.reply({
                body: `[ 🎲 DICE ROLL 🎲 ]\nYou bet $${betAmount.toLocaleString()} on ${chosenNumber}.\nThe dice landed on: ${result}\n\n> ${winMessage}${winnings > 0 ? `\nYou won $${winnings.toLocaleString()}!` : ''}\nYour new balance is $${userData.money.toLocaleString()}`,
                attachment: fs.createReadStream(gifPath)
            });
            fs.unlinkSync(gifPath);
            await message.unsend(processingMessage.messageID);

        } catch (error) {
            console.error("Dice roll error:", error);
            await message.unsend(processingMessage.messageID).catch(() => {});
            message.reply("Sorry, the dice are broken. Please try again later.");
        }
    }
};