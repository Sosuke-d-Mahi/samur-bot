const { MongoClient, ObjectId } = require("mongodb");
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI("AIzaSyDku3NPwvxZZHxg8dvrUPH2pnj32PovJOk");
const FONT_FAMILY = 'Arial';
const BOLD_FONT_FAMILY = 'Arial Bold';

try {
    const fontPath = path.join(__dirname, '..', 'assets', 'Arial.ttf');
    if (fs.existsSync(fontPath)) registerFont(fontPath, { family: 'Arial' });
    const boldFontPath = path.join(__dirname, '..', 'assets', 'Arial-Bold.ttf');
    if (fs.existsSync(boldFontPath)) registerFont(boldFontPath, { family: 'Arial Bold' });
} catch (e) { console.log("Font loading failed."); }

const mongoUri = "mongodb+srv://Easirmahi:01200120mahi@anchestor.wmvrhcb.mongodb.net";
const DB_NAME = "GoatBotV2_StockMarket";
const USER_COLLECTION = "stockUsers";
const MARKET_COLLECTION = "stockMarket";
const TRANSACTION_FEE = 0.01;
const IPO_FEE = 5000000;
const STAKE_YIELD_PERCENT = 0.0005;

let mongoClient;
async function getDb() { if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) { mongoClient = new MongoClient(mongoUri); await mongoClient.connect(); } return mongoClient.db(DB_NAME); }
async function getUserData(db, userId) { const collection = db.collection(USER_COLLECTION); let data = await collection.findOne({ userId }); if (!data) { data = { userId, portfolio: {}, staked: {}, cash: 10000, history: [], limitOrders: [] }; await collection.insertOne(data); } return data; }
async function updateUserData(db, userId, data) { await db.collection(USER_COLLECTION).updateOne({ userId }, { $set: data }, { upsert: true }); }
async function getMarketData(db) { return await db.collection(MARKET_COLLECTION).find().toArray(); }
async function updateStockData(db, symbol, data) { await db.collection(MARKET_COLLECTION).updateOne({ symbol }, { $set: data }); }
function formatKMB(a,b=!0,c=2){if(isNaN(parseFloat(a)))return b?"$0.00":"0.00";a=parseFloat(a);const d=0>a?"-":"";a=Math.abs(a);let e="";return 1e12<=a?(a/=1e12,e="T"):1e9<=a?(a/=1e9,e="B"):1e6<=a?(a/=1e6,e="M"):1e3<=a&&(a/=1e3,e="K"),`${d}${b?"$":""}${a.toFixed(c)}${e}`}
function toBoldUnicode(t){const o={"a":"𝐚","b":"𝐛","c":"𝐜","d":"𝐝","e":"𝐞","f":"𝐟","g":"𝐠","h":"𝐡","i":"𝐢","j":"𝐣","k":"𝐤","l":"𝐥","m":"𝐦","n":"𝐧","o":"𝐨","p":"𝐩","q":"𝐪","r":"𝐫","s":"𝐬","t":"𝐭","u":"𝐮","v":"𝐯","w":"𝐰","x":"𝐱","y":"𝐲","z":"𝐳","A":"𝐀","B":"𝐁","C":"𝐂","D":"𝐃","E":"𝐄","F":"𝐅","G":"𝐆","H":"𝐇","I":"𝐈","J":"𝐉","K":"𝐊","L":"𝐋","M":"𝐌","N":"𝐍","O":"𝐎","P":"𝐏","Q":"𝐐","R":"𝐑","S":"𝐒","T":"𝐓","U":"𝐔","V":"𝐕","W":"𝐖","X":"𝐗","Y":"𝐘","Z":"𝐙","0":"𝟎","1":"𝟏","2":"𝟐","3":"𝟑","4":"𝟒","5":"𝟓","6":"𝟔","7":"𝟕","8":"𝟖","9":"𝟗"};return String(t).split("").map(t=>o[t]||t).join("")}

async function initializeMarket() {
    const db = await getDb();
    const market = db.collection(MARKET_COLLECTION);
    if (await market.countDocuments() === 0) {
        const initialStocks = [
            { name: "Anchestor Tech", symbol: "ANTECH", price: 150.00, openPrice: 150.00, trend: 0.001, volatility: 0.03, volume: 0, history: Array(100).fill(150.00), marketCap: 1.5e9 },
            { name: "Global Oil Corp", symbol: "GLOBO", price: 75.00, openPrice: 75.00, trend: 0.0005, volatility: 0.05, volume: 0, history: Array(100).fill(75.00), marketCap: 8.0e8 },
            { name: "CyberCoin", symbol: "CYBER", price: 25.00, openPrice: 25.00, trend: 0.005, volatility: 0.15, volume: 0, history: Array(100).fill(25.00), marketCap: 2.5e7 },
            { name: "BioGen Inc.", symbol: "BGEN", price: 320.00, openPrice: 320.00, trend: 0.002, volatility: 0.08, volume: 0, history: Array(100).fill(320.00), marketCap: 4.0e8 }
        ];
        await market.insertMany(initialStocks);
    }
}
initializeMarket();

async function updateMarket() {
    const db = await getDb();
    const stocks = await getMarketData(db);
    for (const stock of stocks) {
        let { price, trend, volatility, volume, history, openPrice } = stock;
        const volumeEffect = Math.min(0.005, (volume / 1000000) * 0.001);
        const noise = (Math.random() - 0.5) * 2;
        const changePercent = trend + volumeEffect + (noise * volatility);
        const newPrice = price * (1 + changePercent);
        stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
        history.push(stock.price);
        if (history.length > 100) history.shift();
        stock.volume = Math.max(0, volume * 0.95);
        await updateStockData(db, stock.symbol, stock);
    }
    await processLimitOrders();
}
setInterval(updateMarket, 20000);

async function processLimitOrders() {
    const db = await getDb();
    const users = await db.collection(USER_COLLECTION).find({ "limitOrders.0": { $exists: true } }).toArray();
    const stocks = await getMarketData(db);
    const market = stocks.reduce((acc, s) => ({ ...acc, [s.symbol]: s }), {});

    for (const user of users) {
        let changed = false;
        for (const order of user.limitOrders) {
            if (order.status !== 'active') continue;
            const stock = market[order.symbol];
            if (!stock) continue;

            let executed = false;
            if (order.type === 'buy' && stock.price <= order.price) {
                const totalCost = order.shares * order.price;
                if (user.cash >= totalCost) {
                    user.cash -= totalCost;
                    user.portfolio[order.symbol] = (user.portfolio[order.symbol] || 0) + order.shares;
                    user.history.push({ type: `LIMIT BUY`, symbol: order.symbol, shares: order.shares, price: order.price, date: new Date() });
                    executed = true;
                }
            } else if (order.type === 'sell' && stock.price >= order.price) {
                if ((user.portfolio[order.symbol] || 0) >= order.shares) {
                    user.portfolio[order.symbol] -= order.shares;
                    user.cash += order.shares * order.price;
                    user.history.push({ type: `LIMIT SELL`, symbol: order.symbol, shares: order.shares, price: order.price, date: new Date() });
                    executed = true;
                }
            }
            if (executed) {
                order.status = 'filled';
                changed = true;
            }
        }
        if (changed) {
            user.limitOrders = user.limitOrders.filter(o => o.status === 'active');
            await updateUserData(db, user.userId, user);
        }
    }
}

async function getAiNews() {
    const db = await getDb();
    const stocks = await getMarketData(db);
    const marketSummary = stocks.map(s => `${s.name} (${s.symbol}) is currently at ${formatKMB(s.price)}.`).join(' ');
    const prompt = `You are a financial news anchor for the 'Anchestor Exchange'. Based on the following live data, create three engaging and fictional news headlines and a short paragraph for each, explaining market movements. Data: ${marketSummary}`;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (e) {
        return "News feed is currently offline due to technical difficulties.";
    }
}

const drawCanvas = async (width, height, drawFunction) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    await drawFunction(ctx);
    const tempDir = path.join(__dirname, '..', 'cache');
    await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `stock_canvas_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath);
    canvas.createPNGStream().pipe(out);
    await new Promise(resolve => out.on('finish', resolve));
    return imagePath;
};

const drawMarketCanvas = (stocks) => drawCanvas(800, 600, (ctx) => {
    const grad = ctx.createLinearGradient(0,0,800,600); grad.addColorStop(0, '#1a202c'); grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad; ctx.fillRect(0,0,800,600);
    ctx.textAlign = 'center'; ctx.font = `bold 40px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText("Anchestor Exchange", 400, 60);
    stocks.sort((a,b) => Math.abs((b.price - b.openPrice)/b.openPrice) - Math.abs((a.price - a.openPrice)/a.openPrice));
    stocks.slice(0, 5).forEach((stock, i) => {
        const y = 120 + i * 80;
        const change = (stock.price - stock.openPrice) / stock.openPrice * 100;
        const color = change >= 0 ? '#48bb78' : '#f56565';
        ctx.fillStyle = 'rgba(45, 55, 72, 0.5)'; fillRoundRect(ctx, 50, y, 700, 70, 10);
        ctx.textAlign = 'left'; ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#fff';
        ctx.fillText(`${stock.symbol} - ${stock.name}`, 70, y + 40);
        ctx.textAlign = 'right'; ctx.font = `bold 28px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = color;
        ctx.fillText(`${change.toFixed(2)}%`, 730, y + 30);
        ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = '#a0aec0';
        ctx.fillText(formatKMB(stock.price), 730, y + 55);
    });
});

const drawChartCanvas = (stock) => drawCanvas(800, 500, (ctx) => {
    ctx.fillStyle = '#1a202c'; ctx.fillRect(0,0,800,500);
    ctx.textAlign = 'center'; ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${stock.name} (${stock.symbol}) Price Chart`, 400, 50);
    const { history } = stock;
    const max = Math.max(...history); const min = Math.min(...history);
    const margin = 50; const chartWidth = 700; const chartHeight = 350;
    ctx.strokeStyle = '#4a5568';
    ctx.beginPath(); ctx.moveTo(margin, margin); ctx.lineTo(margin, margin+chartHeight); ctx.lineTo(margin+chartWidth, margin+chartHeight); ctx.stroke();
    const priceRange = max - min;
    const getX = (i) => margin + (i / (history.length - 1)) * chartWidth;
    const getY = (price) => margin + chartHeight - ((price - min) / priceRange) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(history[0]));
    for (let i = 1; i < history.length; i++) { ctx.lineTo(getX(i), getY(history[i])); }
    const color = stock.price >= stock.openPrice ? '#48bb78' : '#f56565';
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
});

const drawPortfolioCanvas = (userData, marketData, userName) => drawCanvas(800, 600, (ctx) => {
    ctx.fillStyle = '#1a202c'; ctx.fillRect(0,0,800,600);
    ctx.textAlign = 'center'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${userName}'s Portfolio`, 400, 60);
    let y = 120;
    let totalValue = 0;
    const holdings = Object.entries(userData.portfolio).filter(([s, sh]) => sh > 0);
    for (const [symbol, shares] of holdings) {
        const stock = marketData.find(s => s.symbol === symbol);
        if (!stock) continue;
        const value = stock.price * shares;
        totalValue += value;
        ctx.fillStyle = 'rgba(45, 55, 72, 0.5)'; fillRoundRect(ctx, 50, y, 700, 70, 10);
        ctx.textAlign = 'left'; ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#fff';
        ctx.fillText(`${symbol}`, 70, y + 40);
        ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = '#a0aec0';
        ctx.fillText(`${shares} Shares`, 200, y + 40);
        ctx.textAlign = 'right'; ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#fff';
        ctx.fillText(formatKMB(value), 730, y + 40);
        y += 80;
    }
    ctx.textAlign = 'center'; ctx.font = `bold 28px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`Total Portfolio Value: ${formatKMB(totalValue)}`, 400, y + 40);
});

const drawHistoryCanvas = (userData, marketData, userName) => drawCanvas(800, 600, (ctx) => {
    ctx.fillStyle = '#1a202c'; ctx.fillRect(0,0,800,600);
    ctx.textAlign = 'center'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${userName}'s Transaction History`, 400, 60);
    let y = 120;
    const history = userData.history.slice(-8).reverse();
    for (const tx of history) {
        const color = tx.type.includes('BUY') ? '#48bb78' : '#f56565';
        ctx.fillStyle = 'rgba(45, 55, 72, 0.5)'; fillRoundRect(ctx, 50, y, 700, 50, 10);
        ctx.textAlign = 'left'; ctx.font = `bold 20px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = color;
        ctx.fillText(tx.type, 70, y + 28);
        ctx.font = `18px ${FONT_FAMILY}`; ctx.fillStyle = '#a0aec0';
        ctx.fillText(`${tx.shares} ${tx.symbol} @ ${formatKMB(tx.price)}`, 250, y + 28);
        ctx.textAlign = 'right';
        ctx.fillText(new Date(tx.date).toLocaleDateString(), 730, y + 28);
        y += 60;
    }
});

const drawHeatmapCanvas = (stocks) => drawCanvas(800, 600, (ctx) => {
    ctx.fillStyle = '#1a202c'; ctx.fillRect(0,0,800,600);
    ctx.textAlign = 'center'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText("Market Heatmap", 400, 60);
    const totalMarketCap = stocks.reduce((sum, s) => sum + s.marketCap, 0);
    let currentX = 20, currentY = 100, remainingWidth = 760;
    stocks.sort((a,b) => b.marketCap - a.marketCap).forEach((stock, i) => {
        const change = (stock.price - stock.openPrice) / stock.openPrice;
        const red = Math.min(255, Math.max(0, 100 - change * 2000));
        const green = Math.min(255, Math.max(0, 100 + change * 2000));
        ctx.fillStyle = `rgb(${red}, ${green}, 100)`;
        const width = (stock.marketCap / totalMarketCap) * (800*4);
        const boxWidth = Math.min(remainingWidth, width);
        ctx.fillRect(currentX, currentY, boxWidth, 100);
        ctx.fillStyle = '#fff'; ctx.font = `bold 18px ${BOLD_FONT_FAMILY}`;
        ctx.fillText(stock.symbol, currentX + boxWidth/2, currentY + 50);
        currentX += boxWidth;
        if(currentX > 760) { currentX = 20; currentY += 100; }
    });
});

const drawOrderbookCanvas = (stock, limitOrders) => drawCanvas(800, 600, (ctx) => {
    ctx.fillStyle = '#1a202c'; ctx.fillRect(0,0,800,600);
    ctx.textAlign = 'center'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`Order Book for ${stock.symbol}`, 400, 60);
    const buys = limitOrders.filter(o => o.type === 'buy').sort((a,b)=>b.price-a.price);
    const sells = limitOrders.filter(o => o.type === 'sell').sort((a,b)=>a.price-b.price);
    ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#48bb78'; ctx.fillText("Bids (Buy Orders)", 200, 120);
    ctx.fillStyle = '#f56565'; ctx.fillText("Asks (Sell Orders)", 600, 120);
    ctx.font = `18px ${FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
    buys.slice(0,8).forEach((o, i) => { ctx.fillText(`${o.shares} @ ${formatKMB(o.price)}`, 200, 160 + i * 40); });
    sells.slice(0,8).forEach((o, i) => { ctx.fillText(`${o.shares} @ ${formatKMB(o.price)}`, 600, 160 + i * 40); });
});

module.exports = {
    config: { name: "stock", aliases: ["stocks"], version: "1.0", author: "Gemini", role: 0, countDown: 5, shortDescription: { en: "A complete standalone stock market simulation." }, longDescription: { en: "Trade stocks in a dynamic market, create your own company, use advanced order types, and analyze the market with various tools." }, category: "economy" },
    onStart: async function ({ args, message, event, usersData }) {
        const p = global.utils.getPrefix(event.threadID) || "."; const senderID = String(event.senderID);
        const db = await getDb(); let userData = await getUserData(db, senderID);
        const command = args[0]?.toLowerCase();
        if (!command || command === 'help') {
            return message.reply(toBoldUnicode("Anchestor Exchange Commands\n\n")+
            `Use '${p}stock <command> [options]'.\n\n`+
            `Market:\n`+
            `  market - View top market movers.\n`+
            `  chart <symbol> - View a stock's price chart.\n`+
            `  orderbook <symbol> - See buy/sell orders.\n`+
            `  heatmap - View a market heatmap.\n`+
            `  news - Get AI-powered market news.\n\n`+
            `Trading:\n`+
            `  buy <symbol> <shares> - Buy shares.\n`+
            `  sell <symbol> <shares> - Sell shares.\n`+
            `  limit <buy/sell> <symbol> <shares> <price> - Place a limit order.\n`+
            `  short <symbol> <shares> - Short sell a stock.\n`+
            `  cover <symbol> <shares> - Cover a short position.\n`+
            `  stake <symbol> <shares> - Stake shares for dividends.\n`+
            `  unstake <symbol> <shares> - Unstake your shares.\n\n`+
            `Management:\n`+
            `  portfolio [@mention] - View your portfolio.\n`+
            `  history - View your transaction history.\n`+
            `  ipo <name> <symbol> <shares> <price> - Create your own company.`
            );
        }

        const marketData = await getMarketData(db);
        const sendCanvas = async (canvasFunc, ...funcArgs) => {
            const imagePath = await canvasFunc(...funcArgs);
            if (!imagePath) return message.reply("Could not generate image.");
            message.reply({ attachment: fs.createReadStream(imagePath) }, () => fs.unlink(imagePath, e => e && console.error(e)));
        };

        switch(command) {
            case "market": return sendCanvas(drawMarketCanvas, marketData);
            case "chart": {
                const symbol = args[1]?.toUpperCase();
                const stock = marketData.find(s => s.symbol === symbol);
                if (!stock) return message.reply("Invalid stock symbol.");
                return sendCanvas(drawChartCanvas, stock);
            }
            case "orderbook": {
                const symbol = args[1]?.toUpperCase();
                const stock = marketData.find(s => s.symbol === symbol);
                if (!stock) return message.reply("Invalid stock symbol.");
                const allUsers = await db.collection(USER_COLLECTION).find({}).toArray();
                const allOrders = allUsers.flatMap(u => u.limitOrders || []).filter(o => o.symbol === symbol && o.status === 'active');
                return sendCanvas(drawOrderbookCanvas, stock, allOrders);
            }
            case "heatmap": return sendCanvas(drawHeatmapCanvas, marketData);
            case "news": return message.reply(await getAiNews());
            case "buy": case "sell": {
                const symbol = args[1]?.toUpperCase();
                const shares = parseInt(args[2]);
                const stock = marketData.find(s => s.symbol === symbol);
                if (!stock || isNaN(shares) || shares <= 0) return message.reply(`Invalid format. Use: ${p}stock ${command} <symbol> <shares>`);
                const cost = stock.price * shares * (1 + TRANSACTION_FEE);
                if (command === 'buy') {
                    if (userData.cash < cost) return message.reply("Insufficient cash.");
                    userData.cash -= cost;
                    userData.portfolio[symbol] = (userData.portfolio[symbol] || 0) + shares;
                    stock.volume += shares;
                } else {
                    if ((userData.portfolio[symbol] || 0) < shares) return message.reply("You do not own enough shares.");
                    userData.cash += stock.price * shares * (1 - TRANSACTION_FEE);
                    userData.portfolio[symbol] -= shares;
                    stock.volume += shares;
                }
                userData.history.push({ type: command.toUpperCase(), symbol, shares, price: stock.price, date: new Date() });
                await updateUserData(db, senderID, userData);
                await updateStockData(db, symbol, stock);
                return message.reply(`Successfully ${command === 'buy' ? 'bought' : 'sold'} ${shares} shares of ${symbol}.`);
            }
            case "limit": {
                const type = args[1]?.toLowerCase();
                const symbol = args[2]?.toUpperCase();
                const shares = parseInt(args[3]);
                const price = parseFloat(args[4]);
                if (!['buy','sell'].includes(type) || !symbol || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return message.reply(`Invalid format. Use: ${p}stock limit <buy/sell> <symbol> <shares> <price>`);
                userData.limitOrders.push({ type, symbol, shares, price, status: 'active' });
                await updateUserData(db, senderID, userData);
                return message.reply(`Limit ${type} order for ${shares} of ${symbol} at ${formatKMB(price)} has been placed.`);
            }
            case "short": case "cover": {
                const symbol = args[1]?.toUpperCase();
                const shares = parseInt(args[2]);
                const stock = marketData.find(s => s.symbol === symbol);
                if (!stock || isNaN(shares) || shares <= 0) return message.reply(`Invalid format. Use: ${p}stock ${command} <symbol> <shares>`);
                const position = userData.portfolio[`${symbol}_SHORT`] || 0;
                if (command === 'short') {
                    userData.cash += stock.price * shares * (1 - TRANSACTION_FEE);
                    userData.portfolio[`${symbol}_SHORT`] = position + shares;
                } else {
                    if (position < shares) return message.reply("You are not short that many shares.");
                    const cost = stock.price * shares * (1 + TRANSACTION_FEE);
                    if (userData.cash < cost) return message.reply("Insufficient cash to cover.");
                    userData.cash -= cost;
                    userData.portfolio[`${symbol}_SHORT`] -= shares;
                }
                userData.history.push({ type: command.toUpperCase(), symbol, shares, price: stock.price, date: new Date() });
                await updateUserData(db, senderID, userData);
                return message.reply(`Successfully executed ${command} order for ${shares} shares of ${symbol}.`);
            }
            case "stake": case "unstake": {
                const symbol = args[1]?.toUpperCase();
                const shares = parseInt(args[2]);
                if (!symbol || isNaN(shares) || shares <= 0) return message.reply(`Invalid format. Use: ${p}stock ${command} <symbol> <shares>`);
                const portfolioShares = userData.portfolio[symbol] || 0;
                const stakedShares = userData.staked[symbol] || 0;
                if (command === 'stake') {
                    if (portfolioShares < shares) return message.reply("You do not own enough shares to stake.");
                    userData.portfolio[symbol] -= shares;
                    userData.staked[symbol] = stakedShares + shares;
                } else {
                    if (stakedShares < shares) return message.reply("You do not have that many shares staked.");
                    userData.staked[symbol] -= shares;
                    userData.portfolio[symbol] = portfolioShares + shares;
                }
                await updateUserData(db, senderID, userData);
                return message.reply(`Successfully ${command}d ${shares} shares of ${symbol}.`);
            }
            case "portfolio": {
                let targetId = senderID;
                if (Object.keys(event.mentions).length > 0) targetId = Object.keys(event.mentions)[0];
                const targetData = await getUserData(db, targetId);
                const targetName = await usersData.getName(targetId);
                return sendCanvas(drawPortfolioCanvas, targetData, marketData, targetName);
            }
            case "history": {
                const userName = await usersData.getName(senderID);
                return sendCanvas(drawHistoryCanvas, userData, marketData, userName);
            }
            case "ipo": {
                const name = args[1];
                const symbol = args[2]?.toUpperCase();
                const shares = parseInt(args[3]);
                const price = parseFloat(args[4]);
                if (!name || !symbol || symbol.length > 6 || !/^[A-Z]+$/.test(symbol) || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) {
                    return message.reply(`Invalid format. Use: ${p}stock ipo "Company Name" SYMBOL <shares> <price>`);
                }
                if (marketData.find(s => s.symbol === symbol)) return message.reply("A stock with this symbol already exists.");
                if (userData.cash < IPO_FEE) return message.reply(`You need ${formatKMB(IPO_FEE)} to launch an IPO.`);
                userData.cash -= IPO_FEE;
                const newStock = { name, symbol, price, openPrice: price, trend: 0.0001, volatility: 0.05, volume: 0, history: Array(100).fill(price), marketCap: shares * price };
                await db.collection(MARKET_COLLECTION).insertOne(newStock);
                userData.portfolio[symbol] = (userData.portfolio[symbol] || 0) + shares;
                userData.history.push({ type: 'IPO', symbol, shares, price, date: new Date() });
                await updateUserData(db, senderID, userData);
                return message.reply(`Congratulations! Your company, ${name} (${symbol}), is now publicly traded on the Anchestor Exchange!`);
            }
            default: return message.reply("Invalid command. Use `${p}stock help` for a list of commands.");
        }
    }
};