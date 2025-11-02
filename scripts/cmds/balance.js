const { MongoClient, ObjectId } = require("mongodb");
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const stockMarket = {
    "AAPL": { name: "Apple Inc.", price: 170.00 }, "MSFT": { name: "Microsoft Corp.", price: 300.00 },
    "GOOGL": { name: "Alphabet Inc.", price: 2800.00 }, "AMZN": { name: "Amazon.com Inc.", price: 3400.00 },
    "TSLA": { name: "Tesla Inc.", price: 750.00 }, "NVDA": { name: "NVIDIA Corp.", price: 200.00 },
    "JPM": { name: "JPMorgan Chase", price: 160.00 }, "V": { name: "Visa Inc.", price: 230.00 },
    "MA": { name: "Mastercard Inc.", price: 380.00 }, "BOTC": { name: "BotCoin", price: 12.00 },
    "GLDF": { name: "Gold Standard Fund", price: 1850.00 }, "OILX": { name: "Global Oil Exchange", price: 75.00 },
};
const TRANSFER_FEE_PERCENT = 0.015;

const mongoUri = "mongodb+srv://Easirmahi:01200120mahi@anchestor.wmvrhcb.mongodb.net";
const DB_NAME = "GoatBotV2_AdvBank";
const BANK_COLLECTION = "advBankData";

let mongoClient;
async function getDb() {
    if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
    }
    return mongoClient.db(DB_NAME);
}

async function getUserBankData(userId, db) {
    const bankCollection = db.collection(BANK_COLLECTION);
    let userData = await bankCollection.findOne({ userId: String(userId) });
    if (!userData) return null;
    userData.transactionHistory = userData.transactionHistory || [];
    userData.netWorthHistory = userData.netWorthHistory || [];
    userData.loansGiven = userData.loansGiven || [];
    userData.loansTaken = userData.loansTaken || [];
    return userData;
}

async function updateNetWorthHistory(userId, db, currentNetWorth) {
    const bankCollection = db.collection(BANK_COLLECTION);
    const userData = await bankCollection.findOne({ userId: String(userId) }, { projection: { netWorthHistory: 1 } });
    const history = userData.netWorthHistory || [];
    const today = new Date().setHours(0, 0, 0, 0);
    const lastEntry = history.length > 0 ? history[history.length - 1] : null;
    const newEntry = { date: new Date(), netWorth: currentNetWorth };

    if (lastEntry && new Date(lastEntry.date).setHours(0, 0, 0, 0) === today) {
        history[history.length - 1] = newEntry;
    } else {
        history.push(newEntry);
    }
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const prunedHistory = history.filter(entry => new Date(entry.date) >= thirtyDaysAgo);
    await bankCollection.updateOne({ userId: String(userId) }, { $set: { netWorthHistory: prunedHistory } });
}

async function addTransaction(userId, db, type, description, amount) {
    const bankCollection = db.collection(BANK_COLLECTION);
    const newTransaction = {
        type: type,
        description: description,
        amount: amount,
        date: new Date()
    };
    await bankCollection.updateOne(
        { userId: String(userId) },
        { $push: { transactionHistory: { $each: [newTransaction], $slice: -50 } } }
    );
}

function formatKMB(amount, includeDollar = true, decimals = 2) {
    if (isNaN(parseFloat(amount))) return includeDollar ? '$0.00' : '0.00';
    amount = parseFloat(amount);
    const sign = amount < 0 ? "-" : ""; amount = Math.abs(amount); let suffix = "";
    if (amount >= 1e12) { amount /= 1e12; suffix = "T"; }
    else if (amount >= 1e9) { amount /= 1e9; suffix = "B"; }
    else if (amount >= 1e6) { amount /= 1e6; suffix = "M"; }
    else if (amount >= 1e3) { amount /= 1e3; suffix = "K"; }
    return `${sign}${includeDollar ? '$' : ''}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
}

function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (num === 0) return 'Zero';
    if (num < 20) return ones[num];
    let words = '';
    if (num >= 100) {
        words += ones[Math.floor(num / 100)] + ' Hundred';
        num %= 100;
        if (num > 0) words += ' ';
    }
    if (num >= 20) {
        words += tens[Math.floor(num / 10)];
        num %= 10;
        if (num > 0) words += ' ';
    }
    if (num > 0) {
        words += ones[num];
    }
    return words.trim();
}

function formatLargeAmount(amount) {
    if (isNaN(parseFloat(amount))) return "Zero";
    amount = parseFloat(amount);
    if (amount === 0) return "Zero";
    const sign = amount < 0 ? "Minus " : "";
    amount = Math.abs(amount);
    const scales = [
        { value: 1e33, name: 'Decillion' }, { value: 1e30, name: 'Nonillion' },
        { value: 1e27, name: 'Octillion' }, { value: 1e24, name: 'Septillion' },
        { value: 1e21, name: 'Sextillion' }, { value: 1e18, name: 'Quintillion' },
        { value: 1e15, name: 'Quadrillion' }, { value: 1e12, name: 'Trillion' },
        { value: 1e9, name: 'Billion' }, { value: 1e6, name: 'Million' },
        { value: 1e3, name: 'Thousand' }
    ];
    for (const scale of scales) {
        if (amount >= scale.value) {
            const numPart = Math.floor(amount / scale.value);
            return `${sign}${numberToWords(numPart)} ${scale.name}`;
        }
    }
    return `${sign}${numberToWords(Math.floor(amount))}`;
}

function drawNetWorthGraph(ctx, history, x, y, width, height) {
    const graphData = history;
    const netWorths = graphData.map(d => d.netWorth);
    const minNetWorth = Math.min(...netWorths);
    const maxNetWorth = Math.max(...netWorths);
    const range = maxNetWorth - minNetWorth;

    const points = graphData.map((d, i) => {
        const pointX = x + (i / (graphData.length - 1)) * width;
        const pointY = y + height - (range === 0 ? height / 2 : ((d.netWorth - minNetWorth) / range) * height);
        return { x: pointX, y: pointY };
    });

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    const lineGradient = ctx.createLinearGradient(x, y, x + width, y);
    lineGradient.addColorStop(0, '#A78BFA');
    lineGradient.addColorStop(1, '#60A5FA');
    ctx.strokeStyle = lineGradient;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const fillGradient = ctx.createLinearGradient(0, y, 0, y + height);
    fillGradient.addColorStop(0, 'rgba(167, 139, 250, 0.2)');
    fillGradient.addColorStop(1, 'rgba(30, 41, 59, 0.0)');
    ctx.fillStyle = fillGradient;
    ctx.lineTo(points[points.length - 1].x, y + height);
    ctx.lineTo(points[0].x, y + height);
    ctx.closePath();
    ctx.fill();
}

async function drawAccountOverview(userData, usersData) {
    const canvasWidth = 800;
    const canvasHeight = 700;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#0F172A');
    gradient.addColorStop(1, '#1E293B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
    for (let i = 0; i < canvasWidth; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasHeight); ctx.stroke(); }
    for (let i = 0; i < canvasHeight; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvasWidth, i); ctx.stroke(); }

    const userCash = await usersData.get(userData.userId, "money") || 0;
    const bankBalance = userData.bank || 0;
    const portfolioValue = (userData.stocks || []).reduce((sum, stock) => {
        const marketPrice = stockMarket[stock.symbol]?.price || 0;
        return sum + (marketPrice * stock.shares);
    }, 0);
    const totalDeposit = bankBalance;
    const currentDebt = (userData.loan?.amount || 0) + (userData.loansTaken?.filter(l => l.status === 'active').reduce((sum, l) => sum + l.amount, 0) || 0);
    const netWorth = userCash + bankBalance + portfolioValue - currentDebt;
    const lastTransaction = userData.transactionHistory?.slice(-1)[0] || { type: 'N/A', amount: 0 };

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('ACCOUNT OVERVIEW', canvasWidth / 2, 60);

    const date = new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    ctx.font = '16px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(date, canvasWidth / 2, 100);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('NET WORTH', canvasWidth / 2, 160);
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = netWorth >= 0 ? '#4ADE80' : '#F87171';
    const netWorthText = formatKMB(netWorth, true, 2);
    const maxLength = 10;
    ctx.fillText(netWorthText.length > maxLength ? netWorthText.substring(0, maxLength) + '...' : netWorthText, canvasWidth / 2, 230);
    ctx.font = 'bold 12px Arial';
    ctx.fillText(netWorthText.length > maxLength ? `Amount: ${formatLargeAmount(netWorth)}` : '', canvasWidth / 2, 255);
    
    let graphHistoryData = userData.netWorthHistory;
    if (!graphHistoryData || graphHistoryData.length < 2) {
        graphHistoryData = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const fluctuation = (Math.random() * 0.4) - 0.2;
            const fakeNetWorth = netWorth * (1 + fluctuation);
            graphHistoryData.push({ date: date, netWorth: fakeNetWorth });
        }
        graphHistoryData[graphHistoryData.length - 1].netWorth = netWorth;
    }
    drawNetWorthGraph(ctx, graphHistoryData, 50, 280, canvasWidth - 100, 90);

    const boxWidth = (canvasWidth - 150) / 2;
    const boxHeight = 120;
    const boxY1 = 390;
    const boxY2 = 530;

    const createInfoBox = (x, y, title, value, subtext, valueColor, borderColor) => {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, boxWidth, boxHeight, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#94A3B8';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(title, x + 20, y + 30);
        ctx.fillStyle = valueColor;
        ctx.font = 'bold 28px Arial';
        const valueText = formatKMB(value);
        const valueMaxLength = 10;
        ctx.fillText(valueText.length > valueMaxLength ? valueText.substring(0, valueMaxLength) + '...' : valueText, x + 20, y + 65);
        ctx.font = 'bold 12px Arial';
        ctx.fillText(valueText.length > valueMaxLength ? `Amount: ${formatLargeAmount(value)}` : '', x + 20, y + 90);
        ctx.fillStyle = '#64748B';
        ctx.font = '14px Arial';
        ctx.fillText(subtext, x + 20, y + 115);
    };

    createInfoBox(50, boxY1, 'TOTAL DEPOSIT (IN BANK)', totalDeposit, `Cash on Hand: ${formatKMB(userCash)}`, '#2DD4BF', '#2DD4BF');
    createInfoBox(50 + boxWidth + 50, boxY1, 'CURRENT DEBT', currentDebt, `${(userData.loansTaken?.filter(l => l.status === 'active').length || 0)} Active P2P Loans`, '#F87171', '#F87171');
    createInfoBox(50, boxY2, 'PORTFOLIO VALUE', portfolioValue, `${(userData.stocks || []).length} Holdings`, '#A78BFA', '#A78BFA');
    createInfoBox(50 + boxWidth + 50, boxY2, 'LAST TRANSACTION', lastTransaction.amount, lastTransaction.type, '#60A5FA', '#60A5FA');
    
    ctx.fillStyle = '#64748B';
    ctx.font = '14px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(userData.card?.number || 'No Card Generated', 25, canvasHeight - 20);
    ctx.textAlign = 'right';
    ctx.fillText(userData.userId, canvasWidth - 25, canvasHeight - 20);

    const tempImageDir = path.join(__dirname, "..", "cache");
    await fs.ensureDir(tempImageDir);
    const tempImagePath = path.join(tempImageDir, `balance_${userData.userId}.png`);
    const out = fs.createWriteStream(tempImagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    await new Promise((resolve) => out.on('finish', resolve));
    return fs.createReadStream(tempImagePath);
}

async function drawHistoryCanvas(userData, usersData) {
    const transactions = userData.transactionHistory.slice(-15).reverse();
    const canvasHeight = 150 + (transactions.length * 40);
    const canvasWidth = 800;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#0F172A');
    gradient.addColorStop(1, '#1E293B');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
    for (let i = 0; i < canvasWidth; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasHeight); ctx.stroke(); }
    for (let i = 0; i < canvasHeight; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvasWidth, i); ctx.stroke(); }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.fillText('TRANSACTION HISTORY', canvasWidth / 2, 60);
    const userName = await usersData.getName(userData.userId);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(userName, canvasWidth / 2, 90);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#CBD5E1';
    ctx.textAlign = 'left';
    ctx.fillText('Date', 50, 130);
    ctx.fillText('Type', 180, 130);
    ctx.fillText('Description', 280, 130);
    ctx.textAlign = 'right';
    ctx.fillText('Amount', 750, 130);

    let yPos = 165;
    if (transactions.length === 0) {
        ctx.font = '16px Arial';
        ctx.fillStyle = '#64748B';
        ctx.textAlign = 'center';
        ctx.fillText('No transactions found.', canvasWidth / 2, 170);
    } else {
        for (const trans of transactions) {
            ctx.fillStyle = transactions.indexOf(trans) % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'transparent';
            ctx.fillRect(30, yPos - 20, canvasWidth - 60, 35);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#94A3B8';
            ctx.textAlign = 'left';
            const date = new Date(trans.date);
            ctx.fillText(date.toLocaleDateString('en-CA'), 50, yPos);
            ctx.fillText(trans.type, 180, yPos);
            ctx.fillText(trans.description.length > 40 ? trans.description.substring(0, 37) + '...' : trans.description, 280, yPos);
            ctx.textAlign = 'right';
            ctx.fillStyle = trans.amount >= 0 ? '#4ADE80' : '#F87171';
            ctx.fillText(formatKMB(trans.amount, true, 2), 750, yPos);
            yPos += 40;
        }
    }

    const tempImageDir = path.join(__dirname, "..", "cache");
    await fs.ensureDir(tempImageDir);
    const tempImagePath = path.join(tempImageDir, `history_${userData.userId}.png`);
    const out = fs.createWriteStream(tempImagePath);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    await new Promise((resolve) => out.on('finish', resolve));
    return fs.createReadStream(tempImagePath);
}

module.exports = {
	config: {
		name: "balance",
		aliases: ["bal", "overview"],
		version: "2.5",
		author: "NTKhang & Mahi--",
		countDown: 10,
		role: 0,
		description: {
			en: "View financial overview or perform bank and loan transactions."
		},
		category: "economy",
		guide: {
			en: "  {pn}: View your own financial overview.\n" +
                "  {pn} history: View your transaction history.\n" +
                "  {pn} <@tag/uid>: View another's overview.\n" +
                "  {pn} deposit <amount>: Deposit cash into your bank.\n" +
                "  {pn} withdraw <amount>: Withdraw cash from your bank.\n" +
                "  {pn} transfer <@tag/uid> <amount>: Transfer money with a fee.\n" +
                "  {pn} donate <@tag/uid> <amount>: Transfer money without a fee.\n" +
                "  {pn} lend <@tag/uid> <amount> <days>: Lend money to a user.\n" +
                "  {pn} pay <@tag/uid> <amount>: Repay a loan to a user.\n" +
                "  {pn} loans: View your loan history and status."
		}
	},

	onStart: async function ({ message, args, usersData, event, api }) {
        const db = await getDb();
        const senderId = event.senderID;
        const subCommand = args[0]?.toLowerCase();
        
        try {
            switch (subCommand) {
                case 'transfer':
                case 'donate': {
                    let recipientId;
                    let amount;
                    if (Object.keys(event.mentions).length > 0) {
                        recipientId = Object.keys(event.mentions)[0];
                        amount = parseFloat(args[args.length - 1]);
                    } else if (event.type === "message_reply") {
                        recipientId = event.messageReply.senderID;
                        amount = parseFloat(args[1]);
                    } else {
                        recipientId = args[1];
                        amount = parseFloat(args[2]);
                    }
                    if (!recipientId || !amount || isNaN(amount) || amount <= 0) return message.reply(`Invalid format. Use: ${this.config.name} ${subCommand} <@mention/uid> <amount>`);
                    if (senderId == recipientId) return message.reply("You cannot transfer money to yourself.");
                    const senderData = await getUserBankData(senderId, db);
                    const recipientData = await getUserBankData(recipientId, db);
                    if (!senderData) return message.reply("You need an Anchestor Bank account to perform this action.");
                    if (!recipientData) return message.reply("The recipient does not have an Anchestor Bank account.");
                    if (senderData.bank < amount) return message.reply(`You have insufficient funds in your bank. Current balance: ${formatKMB(senderData.bank)}`);
                    const isDonate = subCommand === 'donate';
                    const fee = isDonate ? 0 : amount * TRANSFER_FEE_PERCENT;
                    const amountReceived = amount - fee;
                    const bankCollection = db.collection(BANK_COLLECTION);
                    await bankCollection.updateOne({ userId: senderId }, { $inc: { bank: -amount } });
                    await bankCollection.updateOne({ userId: recipientId }, { $inc: { bank: amountReceived } });
                    const recipientName = await usersData.getName(recipientId);
                    const actionText = isDonate ? "donated" : "transferred";
                    const feeText = isDonate ? "" : ` A fee of ${formatKMB(fee)} was applied.`;
                    await addTransaction(senderId, db, 'Transfer Out', `Sent ${formatKMB(amount)} to ${recipientName}`, -amount);
                    await addTransaction(recipientId, db, 'Transfer In', `Received ${formatKMB(amountReceived)} from ${await usersData.getName(senderId)}`, amountReceived);
                    message.reply(`You have successfully ${actionText} ${formatKMB(amount)} to ${recipientName}.${feeText}`);
                    break;
                }
                
                case 'deposit': {
                    const amount = parseFloat(args[1]);
                    if (!amount || isNaN(amount) || amount <= 0) return message.reply("Please specify a valid amount to deposit.");
                    const senderData = await getUserBankData(senderId, db);
                    if (!senderData) return message.reply("You need an Anchestor Bank account to deposit money.");
                    const userCash = await usersData.get(senderId, "money") || 0;
                    if (userCash < amount) return message.reply(`You only have ${formatKMB(userCash)} cash on hand.`);
                    await usersData.set(senderId, { money: userCash - amount });
                    const newBankBalance = (senderData.bank || 0) + amount;
                    await db.collection(BANK_COLLECTION).updateOne({ userId: senderId }, { $set: { bank: newBankBalance } });
                    await addTransaction(senderId, db, 'Deposit', `Deposited ${formatKMB(amount)}`, amount);
                    message.reply(`Successfully deposited ${formatKMB(amount)} into your bank account. Your new bank balance is ${formatKMB(newBankBalance)}.`);
                    break;
                }

                case 'withdraw': {
                    const amount = parseFloat(args[1]);
                    if (!amount || isNaN(amount) || amount <= 0) return message.reply("Please specify a valid amount to withdraw.");
                    const senderData = await getUserBankData(senderId, db);
                    if (!senderData) return message.reply("You need an Anchestor Bank account to withdraw money.");
                    if (senderData.bank < amount) return message.reply(`Insufficient funds. Your bank balance is only ${formatKMB(senderData.bank)}.`);
                    const userCash = await usersData.get(senderId, "money") || 0;
                    await usersData.set(senderId, { money: userCash + amount });
                    const newBankBalance = senderData.bank - amount;
                    await db.collection(BANK_COLLECTION).updateOne({ userId: senderId }, { $set: { bank: newBankBalance } });
                    await addTransaction(senderId, db, 'Withdrawal', `Withdrew ${formatKMB(amount)}`, -amount);
                    message.reply(`Successfully withdrew ${formatKMB(amount)}. It has been added to your cash balance.`);
                    break;
                }

                case 'lend': {
                    let borrowerId;
                    let amount;
                    let days;
                    if (Object.keys(event.mentions).length > 0) {
                        borrowerId = Object.keys(event.mentions)[0];
                        amount = parseFloat(args[args.length - 2]);
                        days = parseInt(args[args.length - 1]);
                    } else if (event.type === "message_reply") {
                        borrowerId = event.messageReply.senderID;
                        amount = parseFloat(args[1]);
                        days = parseInt(args[2]);
                    } else {
                        borrowerId = args[1];
                        amount = parseFloat(args[2]);
                        days = parseInt(args[3]);
                    }
                    if (!borrowerId || !amount || isNaN(amount) || amount <= 0 || !days || isNaN(days) || days <= 0) {
                        return message.reply(`Invalid format. Use: ${this.config.name} lend <@mention/uid> <amount> <days>`);
                    }
                    if (senderId == borrowerId) return message.reply("You cannot lend money to yourself.");
                    const lenderData = await getUserBankData(senderId, db);
                    const borrowerData = await getUserBankData(borrowerId, db);
                    if (!lenderData) return message.reply("You need an Anchestor Bank account to lend money.");
                    if (!borrowerData) return message.reply("The recipient does not have an Anchestor Bank account.");
                    if (lenderData.bank < amount) return message.reply(`You have insufficient funds in your bank. Current balance: ${formatKMB(lenderData.bank)}`);
                    const loanId = new ObjectId();
                    const dueDate = new Date(Date.now() + days * 86400000);
                    const loanGiven = { loanId, borrowerId, amount, dueDate, status: 'active' };
                    const loanTaken = { loanId, lenderId: senderId, amount, dueDate, status: 'active' };
                    const bankCollection = db.collection(BANK_COLLECTION);
                    await bankCollection.updateOne({ userId: senderId }, { $inc: { bank: -amount }, $push: { loansGiven: loanGiven } });
                    await bankCollection.updateOne({ userId: borrowerId }, { $inc: { bank: amount }, $push: { loansTaken: loanTaken } });
                    const lenderName = await usersData.getName(senderId);
                    const borrowerName = await usersData.getName(borrowerId);
                    message.reply(`You have successfully lent ${formatKMB(amount)} to ${borrowerName} for ${days} days. If they don't repay by ${dueDate.toLocaleDateString()}, you will receive ${formatKMB(amount * 2)}.`);
                    api.sendMessage(`You have received a loan of ${formatKMB(amount)} from ${lenderName}. You must repay it by ${dueDate.toLocaleDateString()} using '${this.config.name} pay'. Failure to do so will result in a penalty of ${formatKMB(amount * 2)}.`, borrowerId);
                    break;
                }

                case 'pay': {
                    let lenderId;
                    let amount;
                    if (Object.keys(event.mentions).length > 0) {
                        lenderId = Object.keys(event.mentions)[0];
                        amount = parseFloat(args[1]);
                    } else if (event.type === "message_reply") {
                        lenderId = event.messageReply.senderID;
                        amount = parseFloat(args[1]);
                    } else {
                        lenderId = args[1];
                        amount = parseFloat(args[2]);
                    }
                    if (!lenderId || !amount || isNaN(amount) || amount <= 0) {
                        return message.reply(`Invalid format. Use: ${this.config.name} pay <@mention/uid> <amount>`);
                    }
                    const borrowerData = await getUserBankData(senderId, db);
                    const lenderData = await getUserBankData(lenderId, db);
                    if (!borrowerData || !lenderData) return message.reply("Both parties must have a bank account.");
                    if (borrowerData.bank < amount) return message.reply(`Insufficient funds. Your bank balance is ${formatKMB(borrowerData.bank)}.`);
                    const loanToPay = borrowerData.loansTaken.find(l => l.lenderId === lenderId && l.status === 'active' && l.amount === amount);
                    if (!loanToPay) return message.reply(`No active loan found for this amount with the specified user. Please pay the exact amount of an active loan.`);
                    const bankCollection = db.collection(BANK_COLLECTION);
                    await bankCollection.updateOne({ userId: senderId }, { $inc: { bank: -amount } });
                    await bankCollection.updateOne({ userId: lenderId }, { $inc: { bank: amount } });
                    await bankCollection.updateOne({ userId: senderId, "loansTaken.loanId": loanToPay.loanId }, { $set: { "loansTaken.$.status": "paid" } });
                    await bankCollection.updateOne({ userId: lenderId, "loansGiven.loanId": loanToPay.loanId }, { $set: { "loansGiven.$.status": "paid" } });
                    message.reply(`You have successfully repaid your loan of ${formatKMB(amount)} to ${await usersData.getName(lenderId)}.`);
                    api.sendMessage(`${await usersData.getName(senderId)} has repaid their loan of ${formatKMB(amount)} to you.`, lenderId);
                    break;
                }

                case 'loans': {
                    let lenderData = await getUserBankData(senderId, db);
                    const activeLoansGiven = lenderData.loansGiven.filter(l => l.status === 'active');
                    const bankCollection = db.collection(BANK_COLLECTION);
                    let defaultMessages = [];
                    for (const loan of activeLoansGiven) {
                        if (new Date() > new Date(loan.dueDate)) {
                            const borrowerData = await getUserBankData(loan.borrowerId, db);
                            if (!borrowerData) continue;
                            const penalty = loan.amount * 2;
                            const amountToTake = Math.min(borrowerData.bank, penalty);
                            await bankCollection.updateOne({ userId: senderId }, { $inc: { bank: amountToTake } });
                            await bankCollection.updateOne({ userId: loan.borrowerId }, { $inc: { bank: -amountToTake } });
                            await bankCollection.updateOne({ userId: senderId, "loansGiven.loanId": loan.loanId }, { $set: { "loansGiven.$.status": "defaulted" } });
                            await bankCollection.updateOne({ userId: loan.borrowerId, "loansTaken.loanId": loan.loanId }, { $set: { "loansTaken.$.status": "defaulted" } });
                            const borrowerName = await usersData.getName(loan.borrowerId);
                            defaultMessages.push(`Your loan to ${borrowerName} has defaulted. You collected ${formatKMB(amountToTake)}.`);
                            api.sendMessage(`You failed to repay your loan to ${await usersData.getName(senderId)}. A penalty of ${formatKMB(penalty)} was applied, and ${formatKMB(amountToTake)} was collected from your account.`, loan.borrowerId);
                        }
                    }
                    if (defaultMessages.length > 0) {
                        await message.reply(defaultMessages.join("\n"));
                    }
                    const finalData = await getUserBankData(senderId, db);
                    let reply = "--- Your Loan Report ---\n\n";
                    reply += "Loans You've Given:\n";
                    if (finalData.loansGiven.length === 0) reply += "None.\n";
                    for (const loan of finalData.loansGiven) {
                        const borrowerName = await usersData.getName(loan.borrowerId);
                        reply += `- To: ${borrowerName} | Amount: ${formatKMB(loan.amount)} | Due: ${new Date(loan.dueDate).toLocaleDateString()} | Status: ${loan.status.toUpperCase()}\n`;
                    }
                    reply += "\nLoans You've Taken:\n";
                    if (finalData.loansTaken.length === 0) reply += "None.\n";
                    for (const loan of finalData.loansTaken) {
                        const lenderName = await usersData.getName(loan.lenderId);
                        reply += `- From: ${lenderName} | Amount: ${formatKMB(loan.amount)} | Due: ${new Date(loan.dueDate).toLocaleDateString()} | Status: ${loan.status.toUpperCase()}\n`;
                    }
                    message.reply(reply);
                    break;
                }

                case 'history': {
                    const bankData = await getUserBankData(senderId, db);
                    if (!bankData) return message.reply("You do not have an Anchestor Bank account yet.");
                    const canvasStream = await drawHistoryCanvas(bankData, usersData);
                    message.reply({ attachment: canvasStream }, () => {
                        fs.unlink(canvasStream.path, (err) => {
                            if (err) console.error("Failed to delete history canvas:", err);
                        });
                    });
                    break;
                }

                default: {
                    let targetId = senderId;
                    if (args.length > 0 && !['transfer', 'donate', 'deposit', 'withdraw', 'lend', 'pay', 'loans', 'history'].includes(args[0]?.toLowerCase())) {
                       if (Object.keys(event.mentions).length > 0) {
                           targetId = Object.keys(event.mentions)[0];
                       } else if (event.type === "message_reply") {
                           targetId = event.messageReply.senderID;
                       } else {
                           targetId = args[0] || senderId;
                       }
                    } else if (Object.keys(event.mentions).length > 0) {
                         targetId = Object.keys(event.mentions)[0];
                    }

                    const bankData = await getUserBankData(targetId, db);
                    if (!bankData) {
                        const targetName = await usersData.getName(targetId);
                        return message.reply(`User '${targetName}' does not have an Anchestor Bank account yet.`);
                    }

                    const userCash = await usersData.get(targetId, "money") || 0;
                    const bankBalance = bankData.bank || 0;
                    const portfolioValue = (bankData.stocks || []).reduce((sum, stock) => {
                        const marketPrice = stockMarket[stock.symbol]?.price || 0;
                        return sum + (marketPrice * stock.shares);
                    }, 0);
                    const currentDebt = (bankData.loan?.amount || 0) + (bankData.loansTaken?.filter(l => l.status === 'active').reduce((sum, l) => sum + l.amount, 0) || 0);
                    const netWorth = userCash + bankBalance + portfolioValue - currentDebt;
                    await updateNetWorthHistory(targetId, db, netWorth);
                    const updatedBankData = await getUserBankData(targetId, db);

                    const canvasStream = await drawAccountOverview(updatedBankData, usersData);
                    message.reply({ attachment: canvasStream }, () => {
                        fs.unlink(canvasStream.path, (err) => {
                            if (err) console.error("Failed to delete balance canvas:", err);
                        });
                    });
                    break;
                }
            }
        } catch (error) {
            console.error("Error in balance command:", error);
            message.reply("An error occurred while processing your request. Please try again later.");
        } finally {
            if (mongoClient) {
                await mongoClient.close();
                mongoClient = null;
            }
        }
	}
};