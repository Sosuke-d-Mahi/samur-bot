const fs = require('fs-extra');
const path = require('path');
const moment = require('moment-timezone');

const lotteryFilePath = path.join(__dirname, 'cache', 'lottery.json');
const ANNOUNCEMENT_THREAD_ID = "8008566255928114";
let isDrawing = false; // A lock to prevent multiple simultaneous draws

// Helper function to manage lottery data
const lotteryDataController = {
    read: function() {
        try {
            if (!fs.existsSync(lotteryFilePath)) {
                const initialData = {
                    currentLottery: {
                        ticketPrice: null,
                        endTime: null,
                        players: {},
                        allTickets: []
                    },
                    lastWinner: null
                };
                fs.writeJsonSync(lotteryFilePath, initialData, { spaces: 2 });
                return initialData;
            }
            return fs.readJsonSync(lotteryFilePath);
        } catch (e) {
            console.error("Failed to read lottery data:", e);
            return null;
        }
    },
    write: function(data) {
        try {
            fs.writeJsonSync(lotteryFilePath, data, { spaces: 2 });
        } catch (e) {
            console.error("Failed to write lottery data:", e);
        }
    }
};

// Function to start a new lottery round
function startNewLottery(lotteryData) {
    lotteryData.currentLottery = {
        ticketPrice: null,
        endTime: moment().tz('Asia/Dhaka').add(48, 'hours').valueOf(),
        players: {},
        allTickets: []
    };
    lotteryDataController.write(lotteryData);
}

// Main function to draw winners
async function drawLottery(api, usersData) {
    if (isDrawing) return;
    isDrawing = true;

    try {
        const lotteryData = lotteryDataController.read();
        const { ticketPrice, allTickets } = lotteryData.currentLottery;

        if (allTickets.length < 3) {
            await api.sendMessage("Lottery draw cancelled due to insufficient participants (less than 3). A new lottery has started.", ANNOUNCEMENT_THREAD_ID);
            startNewLottery(lotteryData);
            isDrawing = false;
            return;
        }

        let announcement = "🎉 L̷O̷T̷T̷E̷R̷Y̷ ̷R̷E̷S̷U̷L̷T̷S̷ 🎉\n\nThe moment has arrived! The winners are:\n\n";
        const winners = [];
        const uniqueParticipants = [...new Set(allTickets.map(t => t.owner))];
        
        // Shuffle all tickets to ensure fairness
        const shuffledTickets = allTickets.sort(() => 0.5 - Math.random());
        const winningTickets = [];
        const winnerIDs = new Set();
        
        for (const ticket of shuffledTickets) {
            if (!winnerIDs.has(ticket.owner)) {
                winningTickets.push(ticket);
                winnerIDs.add(ticket.owner);
            }
            if(winningTickets.length === 3) break;
        }
        
        if(winningTickets.length < 3) {
             await api.sendMessage("Lottery draw cancelled as there are not enough unique participants for 3 winner slots. A new lottery has started.", ANNOUNCEMENT_THREAD_ID);
             startNewLottery(lotteryData);
             isDrawing = false;
             return;
        }

        const prizeMultipliers = [1000, 100, 50];
        const prizeEmojis = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < winningTickets.length; i++) {
            const winnerTicket = winningTickets[i];
            const winnerID = winnerTicket.owner;
            const winnings = ticketPrice * prizeMultipliers[i];
            
            const winnerName = await usersData.getName(winnerID);
            const winnerData = await usersData.get(winnerID);
            winnerData.money += winnings;
            await usersData.set(winnerID, { money: winnerData.money });

            announcement += `${prizeEmojis[i]} **1st Place:** ${winnerName}\n   - Ticket ID: #${winnerTicket.id}\n   - Won: $${winnings.toLocaleString()}\n\n`;
            winners.push({ name: winnerName, prize: winnings });
        }
        
        announcement += "Congratulations to our winners! 🥳 Better luck next time to everyone else.\nA new lottery round has begun!";

        await api.sendMessage(announcement, ANNOUNCEMENT_THREAD_ID);
        startNewLottery(lotteryData);

    } catch (e) {
        console.error("Error during lottery draw:", e);
        api.sendMessage("A critical error occurred during the lottery draw. Please contact the bot admin.", ANNOUNCEMENT_THREAD_ID);
    } finally {
        isDrawing = false;
    }
}

module.exports = {
    config: {
        name: "lottery",
        version: "1.0",
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Participate in the server lottery" },
        longDescription: { en: "Buy lottery tickets for a chance to win big prizes. The draw happens automatically." },
        category: "economy",
        guide: {
            en: "{pn} buy <price> [amount=1] - Buy tickets\n" +
                "{pn} status - Check current lottery status\n" +
                "{pn} mytickets - View your tickets\n" +
                "{pn} give <@mention> <ticket_id> - Give a ticket to a user"
        }
    },

    onLoad: async function({ api, usersData }) {
        lotteryDataController.read(); // Initialize file if it doesn't exist
        setInterval(() => {
            const lotteryData = lotteryDataController.read();
            if (lotteryData.currentLottery.endTime && Date.now() >= lotteryData.currentLottery.endTime) {
                console.log("Lottery time is up. Drawing winners...");
                drawLottery(api, usersData);
            }
        }, 60 * 1000); // Check every minute
    },

    onStart: async function ({ api, event, message, usersData, args }) {
        const subcommand = args[0]?.toLowerCase();
        const lotteryData = lotteryDataController.read();

        switch (subcommand) {
            case 'buy':
                const price = parseInt(args[1]);
                const count = args[2] ? parseInt(args[2]) : 1;

                if (isNaN(price) || price <= 0) {
                    return message.reply("Please specify a valid ticket price.");
                }
                if (isNaN(count) || count <= 0) {
                    return message.reply("Please specify a valid number of tickets to buy.");
                }

                // Set the ticket price for the round if it's the first ticket
                if (lotteryData.currentLottery.ticketPrice === null) {
                    lotteryData.currentLottery.ticketPrice = price;
                } else if (lotteryData.currentLottery.ticketPrice !== price) {
                    return message.reply(`You must buy tickets at the current round's price: $${lotteryData.currentLottery.ticketPrice.toLocaleString()}`);
                }
                
                const totalCost = lotteryData.currentLottery.ticketPrice * count;
                const userData = await usersData.get(event.senderID);
                if (userData.money < totalCost) {
                    return message.reply(`You don't have enough money. You need $${totalCost.toLocaleString()} to buy ${count} ticket(s).`);
                }

                userData.money -= totalCost;
                await usersData.set(event.senderID, { money: userData.money });

                if (!lotteryData.currentLottery.players[event.senderID]) {
                    lotteryData.currentLottery.players[event.senderID] = [];
                }

                const newTickets = [];
                for (let i = 0; i < count; i++) {
                    const ticketId = Math.random().toString(36).substring(2, 8).toUpperCase();
                    lotteryData.currentLottery.allTickets.push({ id: ticketId, owner: event.senderID });
                    lotteryData.currentLottery.players[event.senderID].push(ticketId);
                    newTickets.push(ticketId);
                }
                
                lotteryDataController.write(lotteryData);
                
                const uniquePlayers = Object.keys(lotteryData.currentLottery.players).length;
                await message.reply(`Successfully bought ${count} ticket(s) for $${totalCost.toLocaleString()}!\nYour ticket IDs: #${newTickets.join(', #')}\n\nThere are now ${uniquePlayers}/10 unique players.`);

                if (uniquePlayers >= 10) {
                    await message.reply("The threshold of 10 players has been reached! Drawing the lottery now...");
                    drawLottery(api, usersData);
                }
                break;

            case 'status':
                const { ticketPrice, endTime, players, allTickets } = lotteryData.currentLottery;
                if (ticketPrice === null) {
                    return message.reply("The lottery hasn't started yet! Be the first to buy a ticket with `/lottery buy <price>`.");
                }
                const timeRemaining = moment(endTime).fromNow();
                message.reply(
                    `-- Lottery Status --\n` +
                    `Ticket Price: $${ticketPrice.toLocaleString()}\n` +
                    `Total Tickets Sold: ${allTickets.length}\n` +
                    `Unique Players: ${Object.keys(players).length}/10\n` +
                    `Draws ${timeRemaining}.`
                );
                break;

            case 'mytickets':
                const userTickets = lotteryData.currentLottery.players[event.senderID];
                if (!userTickets || userTickets.length === 0) {
                    return message.reply("You don't have any lottery tickets for the current round.");
                }
                message.reply(`Your tickets: #${userTickets.join(', #')}`);
                break;
                
            case 'give':
                const mentionedUID = Object.keys(event.mentions)[0];
                const ticketToGive = args[2]?.toUpperCase();

                if (!mentionedUID || !ticketToGive) {
                    return message.reply("Usage: /lottery give <@mention> <ticket_id>");
                }
                
                const senderTickets = lotteryData.currentLottery.players[event.senderID];
                if (!senderTickets || !senderTickets.includes(ticketToGive)) {
                    return message.reply(`You don't own the ticket with ID #${ticketToGive}.`);
                }

                // Remove from sender
                lotteryData.currentLottery.players[event.senderID] = senderTickets.filter(id => id !== ticketToGive);
                // Add to receiver
                if (!lotteryData.currentLottery.players[mentionedUID]) {
                    lotteryData.currentLottery.players[mentionedUID] = [];
                }
                lotteryData.currentLottery.players[mentionedUID].push(ticketToGive);
                // Update master ticket list
                const ticketIndex = lotteryData.currentLottery.allTickets.findIndex(t => t.id === ticketToGive);
                lotteryData.currentLottery.allTickets[ticketIndex].owner = mentionedUID;
                
                lotteryDataController.write(lotteryData);
                const receiverName = await usersData.getName(mentionedUID);
                message.reply(`You have successfully transferred ticket #${ticketToGive} to ${receiverName}.`);
                break;

            default:
                message.reply("Invalid subcommand. Use `/help lottery` to see available commands.");
                break;
        }
    }
};