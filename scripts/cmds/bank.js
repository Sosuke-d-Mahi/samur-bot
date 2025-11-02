const { MongoClient, ObjectId } = require("mongodb");
const { createCanvas, registerFont, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const AI_MANAGER_PROMPT = `
Your identity is the Anchestor Bank AI Manager. Your entire knowledge is strictly limited to the features and live market data of the Anchestor Bank system. You are formal, professional, and helpful. You never use markdown.

Core Knowledge Base (Your entire world):
- Bank Name: Anchestor Bank
- Account functions: Balance, deposit, withdraw, transfer, interest, statements, net worth, credit score, detailed reports.
- ATM Interface: A visual, PIN-protected menu for transactions like bill pay, cash advance, and PIN changes. Requires a debit card.
- Phone System: A smartphone interface with apps like messaging, calls, and gallery.
- Stock Market & IPOs: You have live data on fictional shares. You can analyze trends, offer suggestions, and provide info on Initial Public Offerings (IPOs). Now supports Short Selling and Options Trading. You also provide a daily market digest.
- Businesses & Marketplace: Users can buy businesses for passive income.
- Corporations: Players can form corporations, pool money, undertake exclusive corporate ventures, and attempt high-stakes bank heists.
- Real Estate: A dynamic market where property values fluctuate, and properties generate rental income.
- Insurance, Government Bonds, Cheques, Investments, Loans, Daily Rewards, Tiers with Perks, Market Events (including corporate buyouts).
- Credit Cards: A realistic system with billing cycles, statements, interest, limit requests, and a rewards points program.
- Jobs: Users can apply for jobs and work to earn an active income.
- Achievements: A visual showcase of a player's financial milestones.

CRITICAL RULES:
1.  You ONLY answer questions directly related to the Core Knowledge Base and the provided market data.
2.  You provide financial analysis and suggestions based on the data.
3.  If a user asks about anything outside of this world (e.g., real-world events, your identity as an AI), you MUST politely decline. Your required response for refusal is: "I'm sorry sir/ma'am, my expertise is limited to Anchestor Bank services. How may I assist you with your account today?"
4.  You MUST NOT identify as an AI or a large language model. You are the Anchestor Bank AI Manager.
`;

const COMMAND_HELPER_PROMPT = `
You are a command correction AI. Your task is to analyze a user's failed command and determine their most likely intent based on a list of valid commands.
Your response MUST be a single, raw JSON object with no markdown, backticks, or explanatory text.
If confident, respond with: {"intent": "valid_command_key", "suggestion": "Helpful suggestion for the user."}
If not confident, respond with: {"intent": "unknown", "suggestion": "null"}

Valid Commands & Intents:
- "how much money do i have", "check my money" -> intent: "balance", suggestion: "It seems you're asking about your balance. The command is '/bank balance'."
- "i want to create an account", "/bank create" -> intent: "create_card", suggestion: "To open an account and get a debit card, please use the command '/bank create_card'."
- "get a job" -> intent: "jobs_list", suggestion: "Looking for a job? You can see all available positions with '/bank jobs list'."
- "i want to buy apple stock" -> intent: "stock_trade", suggestion: "To trade stocks, please use the format: '/bank stock buy <SYMBOL> <shares>'. For example, '/bank stock buy AAPL 10'."

Analyze this user's failed command: `;

const genAI = new GoogleGenerativeAI("AIzaSyDku3NPwvxZZHxg8dvrUPH2pnj32PovJOk");

const achievementsList = {
    FIRST_DEPOSIT: { name: "First Saver", description: "Make your first deposit.", reward: 500, icon: 'piggy' },
    FIRST_STOCK: { name: "Budding Investor", description: "Buy your first stock.", reward: 1000, icon: 'chart' },
    FIRST_BIZ: { name: "Entrepreneur", description: "Buy your first business.", reward: 50000, icon: 'briefcase' },
    NET_WORTH_1M: { name: "Millionaire", description: "Reach a net worth of $1M.", reward: 100000, icon: 'moneyBag' },
    CREDIT_PRO: { name: "Credit Guru", description: "Achieve a score of 800+.", reward: 25000, icon: 'star' },
    CORP_FOUNDER: { name: "Incorporated", description: "Found your first corporation.", reward: 1000000, icon: 'building' }
};

const JOBS_LIST = {
    'janitor': { name: 'Janitor', salary: 1500, cooldownHours: 3, requirements: { creditScore: 0, netWorth: 0 } },
    'barista': { name: 'Cafe Barista', salary: 3500, cooldownHours: 3, requirements: { creditScore: 450, netWorth: 10000 } },
    'teller': { name: 'Bank Teller', salary: 8000, cooldownHours: 4, requirements: { creditScore: 550, netWorth: 100000 } },
    'broker': { name: 'Stock Broker', salary: 25000, cooldownHours: 6, requirements: { creditScore: 650, netWorth: 1000000 } },
    'ceo': { name: 'CEO', salary: 100000, cooldownHours: 8, requirements: { creditScore: 750, netWorth: 25000000 } }
};

const TIPS = [
    "You can view the server's wealthiest users with '/bank leaderboard'!",
    "Your bank card's design upgrades automatically as your Net Worth increases!",
    "High-risk, high-reward stock options can be traded using '/bank option buy'.",
    "Join or create a corporation with '/bank corp' to access exclusive features like heists!",
    "Need a steady income? Apply for a job with '/bank jobs apply <name>' and use '/bank work'.",
    "Check the daily market summary with '/bank digest' for an AI-powered analysis."
];

const CREDIT_REDEEM_OPTIONS = {
    'cash500': { points: 5000, type: 'cash', value: 500, description: 'Redeem 5,000 pts for $500' },
    'cash2500': { points: 20000, type: 'cash', value: 2500, description: 'Redeem 20,000 pts for $2,500' },
    'cash15000': { points: 100000, type: 'cash', value: 15000, description: 'Redeem 100,000 pts for $15,000' }
};

try {
    const fontPath = path.join(__dirname, '..', 'assets', 'Arial.ttf');
    if (fs.existsSync(fontPath)) registerFont(fontPath, { family: 'Arial' });
    const boldFontPath = path.join(__dirname, '..', 'assets', 'Arial-Bold.ttf');
    if (fs.existsSync(boldFontPath)) registerFont(boldFontPath, { family: 'Arial Bold' });
} catch (e) { console.log("Custom font not found or failed to load. Using system default 'Arial'."); }

const mongoUri = "mongodb+srv://Easirmahi:01200120mahi@anchestor.wmvrhcb.mongodb.net";
const DB_NAME = "GoatBotV2_AdvBank";
const BANK_COLLECTION = "advBankData";
const CORP_COLLECTION = "advBankCorps";
const AUDIT_COLLECTION = "advBankAuditLogs";
const LOTTERY_COLLECTION = "advBankLottery";
const STOCK_TRANSACTION_FEE_PERCENT = 0.0015;
const EARLY_WITHDRAWAL_PENALTY_PERCENT = 0.01;
const LOTTERY_TICKET_PRICE = 100;
const CREDIT_CARD_INTEREST_RATE = 0.05;
const CASH_ADVANCE_FEE_PERCENT = 0.05;
const CORP_CREATION_FEE = 10000000;
const INCOME_TAX_RATE = 0.05;
const RESEARCH_FEE = 10000;
const TAX_FILING_PERIOD_DAYS = 30;
const atmSessions = new Map();

let stockMarket = {
    "AAPL": { name: "Apple Inc.", price: 170.00, openPrice: 170.00, history: Array(50).fill(170.00).map((p, i) => p + (Math.random() - 0.5) * i), trend: 0.001, volatility: 0.03 },
    "MSFT": { name: "Microsoft Corp.", price: 300.00, openPrice: 300.00, history: Array(50).fill(300.00).map((p, i) => p + (Math.random() - 0.5) * i), trend: 0.0008, volatility: 0.025 },
    "GOOGL": { name: "Alphabet Inc.", price: 2800.00, openPrice: 2800.00, history: Array(50).fill(2800.00).map((p, i) => p + (Math.random() - 0.5) * i), trend: 0.0012, volatility: 0.035 },
    "TSLA": { name: "Tesla Inc.", price: 750.00, openPrice: 750.00, history: Array(50).fill(750.00).map((p, i) => p + (Math.random() - 0.5) * i * 2), trend: 0.002, volatility: 0.08 },
    "BOTC": { name: "BotCoin", price: 12.00, openPrice: 12.00, history: Array(50).fill(12.00).map((p, i) => p + (Math.random() - 0.5) * i * 0.5), trend: 0.005, volatility: 0.15 },
    "OILX": { name: "Global Oil Exchange", price: 75.00, openPrice: 75.00, history: Array(50).fill(75.00).map((p, i) => p + (Math.random() - 0.5) * i * 0.8), trend: 0.0009, volatility: 0.05 },
};
let cryptoMarket = {
    "BTCF": { name: "BotCoin", price: 42000.00, openPrice: 42000.00, history: Array(50).fill(42000.00).map((p, i) => p + (Math.random() - 0.5) * i * 10), trend: 0.002, volatility: 0.08 },
    "ETHF": { name: "Etherium", price: 2800.00, openPrice: 2800.00, history: Array(50).fill(2800.00).map((p, i) => p + (Math.random() - 0.5) * i * 5), trend: 0.0015, volatility: 0.06 },
    "DOGEF": { name: "DogeCoin", price: 0.15, openPrice: 0.15, history: Array(50).fill(0.15).map((p, i) => p + (Math.random() - 0.5) * i * 0.01), trend: 0.003, volatility: 0.20 },
};
const MINING_RIGS = {
    'level1': { name: 'Basic Rig', cost: 50000, rewardPerCycle: 0.0001, cooldownHours: 4, crypto: 'BTCF' },
    'level2': { name: 'Advanced Rig', cost: 250000, rewardPerCycle: 0.0006, cooldownHours: 3, crypto: 'BTCF' },
    'level3': { name: 'Quantum Miner', cost: 1000000, rewardPerCycle: 0.002, cooldownHours: 2, crypto: 'BTCF' }
};
const propertyAssets = [ { id: "SUB_APT", name: "Suburban Apartment", price: 75000, dailyRent: 250 }, { id: "CITY_CONDO", name: "City Center Condo", price: 250000, dailyRent: 800 }, { id: "BEACH_HOUSE", name: "Beachfront House", price: 800000, dailyRent: 2000 }];
let propertyMarket = JSON.parse(JSON.stringify(propertyAssets));
const availableBusinesses = [ { id: "CAFE", name: "Anchestor Cafe", cost: 150000, baseIncome: 200 }, { id: "ARCADE", name: "Retro Arcade", cost: 500000, baseIncome: 750 }, { id: "TECH_STARTUP", name: "AI Tech Startup", cost: 2500000, baseIncome: 4000 } ];
const investmentOptions = [ { id: "BOND_LOW", name: "Govt. Savings Bond", type: "bond", interestRate: 0.025, riskLevel: "Low", durationDays: 30, minAmount: 500 }, { id: "TECH_FUND", name: "Tech Growth Fund", type: "fund", avgReturn: 0.08, riskLevel: "High", durationDays: 90, minAmount: 5000 }];
let auctionableItems = [
    { id: "MONA_LISA", name: "Mona Lisa (Fake)", baseValue: 500000, volatility: 0.1 },
    { id: "RARE_STAMP", name: "Rare Anchestor Stamp", baseValue: 120000, volatility: 0.05 },
    { id: "GOLD_WATCH", name: "Solid Gold Watch", baseValue: 250000, volatility: 0.02 }
];

let marketEvent = null;
let currentIpo = null;
let currentAuction = null;

function triggerEvent() { if (marketEvent && Date.now() > marketEvent.endTime) marketEvent = null; if (currentIpo && Date.now() > currentIpo.endTime) { stockMarket[currentIpo.symbol] = { name: currentIpo.name, price: currentIpo.price, openPrice: currentIpo.price, history: Array(50).fill(currentIpo.price), trend: (Math.random() - 0.4) * 0.001, volatility: 0.05 }; currentIpo = null; } if (!marketEvent && !currentIpo && Math.random() < 0.05) { const eventTypes = ['market', 'ipo', 'buyout']; const chosenEventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]; if (chosenEventType === 'market') { const events = [ { name: "Bull Market", effect: 0.001, duration: 3600000 * 2, type: 'market' }, { name: "Recession Scare", effect: -0.002, duration: 3600000 * 3, type: 'market' } ]; marketEvent = events[Math.floor(Math.random() * events.length)]; marketEvent.endTime = Date.now() + marketEvent.duration; } else if (chosenEventType === 'ipo') { const newSymbol = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + 'X'; if (!stockMarket[newSymbol]) { currentIpo = { symbol: newSymbol, name: "New Tech Ventures", price: parseFloat((Math.random() * 100 + 20).toFixed(2)), duration: 3600000 * 4, type: 'ipo' }; currentIpo.endTime = Date.now() + currentIpo.duration; } } else if (chosenEventType === 'buyout') { const businessToBuyout = availableBusinesses[Math.floor(Math.random() * availableBusinesses.length)]; marketEvent = { name: `Corporate Buyout of ${businessToBuyout.name}`, type: 'buyout', businessId: businessToBuyout.id, premium: 1.5, duration: 3600000 * 1 }; marketEvent.endTime = Date.now() + marketEvent.duration; } } }
setInterval(triggerEvent, 3600000);

function updateStockPrices() { for (const symbol in stockMarket) { const stock = stockMarket[symbol]; stock.dailyChange = ((stock.price - stock.openPrice) / stock.openPrice) * 100; let marketEffect = (marketEvent && marketEvent.type === 'market') ? (marketEvent.sector ? (marketEvent.sector.includes(symbol) ? marketEvent.effect : 0) : marketEvent.effect) : 0; let noise = (Math.random() - 0.5) * 2; let changePercent = (stock.trend || 0) + marketEffect + (noise * stock.volatility); let newPrice = stock.price * (1 + changePercent); stock.price = parseFloat(Math.max(0.01, newPrice).toFixed(2)); stock.history.push(stock.price); if (stock.history.length > 50) stock.history.shift(); } }
setInterval(updateStockPrices, 15000);

function updatePropertyPrices() { propertyMarket.forEach(prop => { const change = (Math.random() - 0.49) * 0.05; prop.price = Math.max(1000, parseFloat((prop.price * (1 + change)).toFixed(2))); }); }
setInterval(updatePropertyPrices, 3600000 * 3);

function updateCryptoPrices() {
    for (const symbol in cryptoMarket) {
        const crypto = cryptoMarket[symbol];
        crypto.dailyChange = ((crypto.price - crypto.openPrice) / crypto.openPrice) * 100;
        let noise = (Math.random() - 0.5) * 2;
        let changePercent = (crypto.trend || 0) + (noise * crypto.volatility);
        let newPrice = crypto.price * (1 + changePercent);
        crypto.price = parseFloat(Math.max(0.01, newPrice).toFixed(2));
        crypto.history.push(crypto.price);
        if (crypto.history.length > 50) crypto.history.shift();
    }
}
setInterval(updateCryptoPrices, 10000);

async function manageAuctionCycle() {
    if (currentAuction && Date.now() > currentAuction.endTime) {
        const db = await getDb();
        if (currentAuction.highestBidderId) {
            let winnerData = await getUserBankData(currentAuction.highestBidderId, db);
            if (winnerData) {
                winnerData.collectibles = winnerData.collectibles || [];
                winnerData.collectibles.push({ name: currentAuction.itemName, value: currentAuction.currentBid, acquired: new Date() });
                await updateUserBankData(currentAuction.highestBidderId, winnerData, db);
            }
        }
        currentAuction = null;
    }

    if (!currentAuction) {
        const item = auctionableItems[Math.floor(Math.random() * auctionableItems.length)];
        currentAuction = {
            itemId: item.id,
            itemName: item.name,
            currentBid: item.baseValue,
            highestBidderId: null,
            highestBidderName: "No bids yet",
            endTime: Date.now() + 3600000 * 6
        };
    }
}
setInterval(manageAuctionCycle, 60000);

function formatNumber(num, usePrefix = true, decimals = 2) { if (isNaN(parseFloat(num))) return usePrefix ? "$0.00" : "0.00"; const sign = num < 0 ? "-" : ""; num = Math.abs(num); if (num < 1000) return `${sign}${usePrefix ? "$" : ""}${num.toFixed(decimals)}`; const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"]; let i = 0; while (num >= 1000 && i < suffixes.length - 1) { num /= 1000; i++; } return `${sign}${usePrefix ? "$" : ""}${num.toFixed(decimals)}${suffixes[i]}`; }
function toBoldUnicode(t){const o={"a":"𝐚","b":"𝐛","c":"𝐜","d":"𝐝","e":"𝐞","f":"𝐟","g":"𝐠","h":"𝐡","i":"𝐢","j":"𝐣","k":"𝐤","l":"𝐥","m":"𝐦","n":"𝐧","o":"𝐨","p":"𝐩","q":"𝐪","r":"𝐫","s":"𝐬","t":"𝐭","u":"𝐮","v":"𝐯","w":"𝐰","x":"𝐱","y":"𝐲","z":"𝐳","A":"𝐀","B":"𝐁","C":"𝐂","D":"𝐃","E":"𝐄","F":"𝐅","G":"𝐆","H":"𝐇","I":"𝐈","J":"𝐉","K":"𝐊","L":"𝐋","M":"𝐌","N":"𝐍","O":"𝐎","P":"𝐏","Q":"𝐐","R":"𝐑","S":"𝐒","T":"𝐓","U":"𝐔","V":"𝐕","W":"𝐖","X":"𝐗","Y":"𝐘","Z":"𝐙","0":"𝟎","1":"𝟏","2":"𝟐","3":"𝟑","4":"𝟒","5":"𝟓","6":"𝟔","7":"𝟕","8":"𝟖","9":"𝟗"};return String(t).split("").map(t=>o[t]||t).join("")}
let mongoClient;
async function getDb(){if(!mongoClient||!mongoClient.topology||!mongoClient.topology.isConnected())mongoClient=new MongoClient(mongoUri),await mongoClient.connect();return mongoClient.db(DB_NAME)}
async function getUserBankData(d,b){const a=b.collection(BANK_COLLECTION);let c=await a.findOne({userId:String(d)});if(!c){return null}c.card=c.card||{number:null,pin:null};c.daily=c.daily||{lastClaimed:null,streak:0};c.loan=c.loan||{amount:0,history:{repaid:0}};c.creditScore=c.creditScore||500;c.creditCard=c.creditCard||{issued:!1,limit:0,balance:0,locked:!1,nickname:null,rewards:{points:0},transactionHistory:[],statement:{balance:0,dueDate:null,paid:!0}};c.bills=c.bills||[];c.options=c.options||[];c.job=c.job||{title:'unemployed',lastWorked:null};c.corporation=c.corporation||{id:null,name:null,rank:null};c.achievements=c.achievements||[];c.taxPaid=c.taxPaid||0;c.messages=c.messages||[];c.callLog=c.callLog||[];c.gallery=c.gallery||[];c.wallpaperUrl=c.wallpaperUrl||null;c.crypto=c.crypto||[];c.mining=c.mining||{rigLevel:0,lastMined:null};c.collectibles=c.collectibles||[];c.tax=c.tax||{lastFiled:c.createdAt||new Date,reportableIncome:0};c.security=c.security||{twoFactorEnabled:!1,alerts:[]};return c}
async function createNewUser(userId, db) { const now = new Date(); const newUser = { userId: String(userId), bank: 0, loan: { amount: 0, history: { repaid: 0 }, dueDate: null }, card: { number: null, pin: null }, daily: { lastClaimed: null, streak: 0 }, lastLoanWarning: null, creditScore: 500, stocks: [], investments: [], properties: [], businesses: [], cheques: { issued: [], received: [] }, transactionHistory: [], insurance: [], achievements: [], taxPaid: 0, creditCard: { issued: false, limit: 0, balance: 0, locked: false, nickname: null, rewards: { points: 0 }, transactionHistory: [], statement: { balance: 0, dueDate: null, paid: true } }, bills: [], options: [], job: { title: 'unemployed', lastWorked: null }, corporation: { id: null, name: null, rank: null }, messages: [], callLog: [], gallery: [], wallpaperUrl: null, crypto: [], mining: { rigLevel: 0, lastMined: null }, collectibles: [], tax: { lastFiled: now, reportableIncome: 0 }, security: { twoFactorEnabled: false, alerts: [] }, createdAt: now, updatedAt: now }; await db.collection(BANK_COLLECTION).insertOne(newUser); return newUser; }
async function updateUserBankData(c,b,a){b.updatedAt=new Date;delete b._id;await a.collection(BANK_COLLECTION).updateOne({userId:String(c)},{$set:b},{upsert:!0})}
async function addTransaction(e,d,c,b,a){const f={type:d,description:c,amount:b,date:new Date};await a.collection(BANK_COLLECTION).updateOne({userId:String(e)},{$push:{transactionHistory:{$each:[f],$slice:-50}}})}
async function logAudit(db, type, event, details = {}) { await db.collection(AUDIT_COLLECTION).insertOne({ type, userId: String(event.senderID), timestamp: new Date(), ...details }); }
async function calculateCreditScore(c,b){let a=300;const d=(c.bank||0)+b,e=(new Date()-new Date(c.createdAt).getTime())/864e5;return a+=Math.min(150,5*Math.floor(e/30)),a+=Math.min(150,Math.floor(d/1e4)),a+=25*(c.loan.history.repaid||0),c.loan.amount>0&&(a-=50),c.creditCard.issued&&c.creditCard.balance>0&&(a-=Math.min(50,Math.floor(c.creditCard.balance/c.creditCard.limit*100))),a+=Math.min(100,(c.transactionHistory||[]).length),Math.max(300,Math.min(850,a))}
function getTierByNetWorth(netWorth) { if (netWorth >= 1e9) return "Obsidian"; if (netWorth >= 1e8) return "Platinum"; if (netWorth >= 1e7) return "Gold"; if (netWorth >= 1e6) return "Silver"; return "Bronze"; }
function getTierPerks(liquidAssets) { if (liquidAssets >= 1e9) return { tier: "⚫ Obsidian", feeModifier: .25, interestBonus: .005 }; if (liquidAssets >= 1e8) return { tier: "💎 Platinum", feeModifier: .5, interestBonus: .002 }; if (liquidAssets >= 1e7) return { tier: "🥇 Gold", feeModifier: .7, interestBonus: .001 }; if (liquidAssets >= 1e6) return { tier: "🥈 Silver", feeModifier: .85, interestBonus: 0 }; return { tier: "🥉 Bronze", feeModifier: 1, interestBonus: 0 }; }
function wrapText(e,d,c,b,a,f){const g=(d||"").toString().split("\n");for(const h of g){let i=h.split(" "),j="";for(let k=0;k<i.length;k++){let l=j+i[k]+" ";e.measureText(l).width>a&&k>0?(e.fillText(j.trim(),c,b),j=i[k]+" ",b+=f):j=l}e.fillText(j.trim(),c,b),b+=f}}
function levenshteinDistance(a, b) { const m = []; for (let i = 0; i <= b.length; i++) { m[i] = [i]; if (i === 0) continue; for (let j = 0; j <= a.length; j++) { m[0][j] = j; if (j === 0) continue; m[i][j] = b.charAt(i - 1) === a.charAt(j - 1) ? m[i - 1][j - 1] : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1); } } return m[b.length][a.length]; }
function findBestMatch(input, commandList) { let bestMatch = null; let minDistance = Infinity; for (const cmd of commandList) { const distance = levenshteinDistance(input, cmd); if (distance < minDistance) { minDistance = distance; bestMatch = cmd; } } return minDistance <= 2 ? bestMatch : null; }
async function getAiResponse(prompt, imageUrl) { try { const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); const generationConfig = { temperature: 0.7, topP: 1, topK: 1, maxOutputTokens: 2048 }; const modelPrompt = [AI_MANAGER_PROMPT, prompt]; if (imageUrl) { const response = await axios.get(imageUrl, { responseType: "arraybuffer" }); const buffer = Buffer.from(response.data, "binary"); const imagePart = { inlineData: { data: buffer.toString("base64"), mimeType: "image/png", }, }; modelPrompt.push(imagePart); } const result = await model.generateContent(modelPrompt, generationConfig); const response = await result.response; return response.text(); } catch (error) { console.error("AI API Error:", error); return "My apologies, the AI service is currently unavailable."; } }
async function getCommandIntent(userInput) { try { const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); const prompt = COMMAND_HELPER_PROMPT + userInput; const result = await model.generateContent(prompt); const response = await result.response; let text = response.text().trim(); if (text.startsWith("```json")) { text = text.replace(/^```json\n/, '').replace(/\n```$/, ''); } return JSON.parse(text); } catch (e) { return { intent: 'unknown', suggestion: 'null' }; } }
async function tradeStockOption(senderID, db, usersData, symbol, type, strikePrice, shares, expiryDays) { let userBankInfo = await getUserBankData(senderID, db); let userCash = await usersData.get(senderID, "money") || 0; const stock = stockMarket[symbol]; if (!stock) return { success: false, message: 'Invalid stock symbol.' }; const premium = stock.price * shares * 0.05; if (premium > userCash) return { success: false, message: `You need ${formatNumber(premium)} to buy this option.` }; const optionId = new ObjectId(); const expiryDate = new Date(Date.now() + expiryDays * 86400000); userBankInfo.options = userBankInfo.options || []; userBankInfo.options.push({ optionId, symbol, type, strikePrice, shares, premium, expiryDate, status: 'active' }); await usersData.set(senderID, { money: userCash - premium }); if(!userBankInfo.report) userBankInfo.report = {}; userBankInfo.report.spent = (userBankInfo.report.spent || 0) + premium; await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "OPTION_BUY", { senderID }, { symbol, type, shares, premium }); return { success: true, message: `Bought ${type} option for ${shares} shares of ${symbol} at strike ${formatNumber(strikePrice)}. Expires in ${expiryDays} days.` }; }
async function exerciseOption(senderID, db, usersData, optionIdShort) { let userBankInfo = await getUserBankData(senderID, db); let userCash = await usersData.get(senderID, "money") || 0; const option = userBankInfo.options?.find(o => o.optionId.toString().endsWith(optionIdShort) && o.status === 'active'); if (!option) return { success: false, message: 'Option not found or already exercised.' }; const stock = stockMarket[option.symbol]; if (new Date() > new Date(option.expiryDate)) { option.status = 'expired'; await updateUserBankData(senderID, userBankInfo, db); return { success: false, message: `Option for ${option.symbol} has expired.` }; } let payout = 0; if (option.type === 'call' && stock.price > option.strikePrice) { payout = (stock.price - option.strikePrice) * option.shares; } else if (option.type === 'put' && stock.price < option.strikePrice) { payout = (option.strikePrice - stock.price) * option.shares; } if (payout <= 0) { option.status = 'expired'; await updateUserBankData(senderID, userBankInfo, db); return { success: false, message: 'Option is out of the money. No payout.' }; } userCash += payout; option.status = 'exercised'; await usersData.set(senderID, { money: userCash }); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "OPTION_EXERCISE", { senderID }, { optionId: option.optionId, payout }); return { success: true, message: `Exercised ${option.type} option for ${option.symbol}. Payout: ${formatNumber(payout)}.` }; }
async function processCycle(user, db) { const now = new Date(); if (user.creditCard?.issued && user.creditCard.statement?.dueDate && now > new Date(user.creditCard.statement.dueDate) && !user.creditCard.statement.paid) { const interest = user.creditCard.statement.balance * CREDIT_CARD_INTEREST_RATE; user.creditCard.balance += interest; user.creditCard.statement.paid = true; } if (user.creditCard?.issued && (!user.creditCard.statement?.dueDate || now > new Date(user.creditCard.statement.dueDate))) { const minimumPayment = user.creditCard.balance * 0.05; const dueDate = new Date(now.getTime() + 14 * 86400000); user.creditCard.statement = { balance: user.creditCard.balance, minimumPayment, dueDate, paid: false }; user.messages = user.messages || []; user.messages.push({ fromId: "SYSTEM", fromName: "Anchestor Bank", content: `Your credit card statement is ready. Balance: ${formatNumber(user.creditCard.balance)}. Minimum payment: ${formatNumber(minimumPayment)}. Due: ${dueDate.toLocaleDateString()}`, date: new Date(), read: false }); } if (!user.bills || user.bills.length === 0 || now > new Date(user.bills[0].dueDate)) { user.bills = [{ type: "Utilities", amount: Math.floor(Math.random() * (5000 - 500 + 1) + 500), dueDate: new Date(now.getTime() + 14 * 86400000) }]; } return user; }

const FONT_FAMILY = 'Arial';
const BOLD_FONT_FAMILY = 'Arial Bold';
function fillRoundRect(ctx, x, y, width, height, radius) { if (typeof radius === 'number') radius = { tl: radius, tr: radius, br: radius, bl: radius }; else { const dR = { tl: 0, tr: 0, br: 0, bl: 0 }; for (let s in dR) radius[s] = radius[s] || dR[s]; } ctx.beginPath(); ctx.moveTo(x + radius.tl, y); ctx.lineTo(x + width - radius.tr, y); ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr); ctx.lineTo(x + width, y + height - radius.br); ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height); ctx.lineTo(x + radius.bl, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl); ctx.lineTo(x, y + radius.tl); ctx.quadraticCurveTo(x, y, x + radius.tl, y); ctx.closePath(); ctx.fill(); }

async function drawModernAtmCanvas(session) {
    const baseHeight = 800; let dynamicHeight = baseHeight;
    if (session.step === 'bill_pay_list' && session.bills.length > 3) { dynamicHeight += (session.bills.length - 3) * 100; }
    if (session.step === 'mini_statement' && session.transactions.length > 5) { dynamicHeight += (session.transactions.length - 5) * 50; }
    
    const width = 1000;
    const canvas = createCanvas(width, dynamicHeight); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, width, dynamicHeight); grad.addColorStop(0, '#2c3e50'); grad.addColorStop(1, '#34495e');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, dynamicHeight);
    const screenX = 150, screenY = 80, screenWidth = 700, screenHeight = dynamicHeight - 160;
    ctx.fillStyle = '#1e2b38'; fillRoundRect(ctx, screenX - 10, screenY - 10, screenWidth + 20, screenHeight + 20, 20);
    ctx.fillStyle = '#0f172a'; fillRoundRect(ctx, screenX, screenY, screenWidth, screenHeight, 15);
    ctx.textAlign = 'center'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText("Anchestor Bank ATM", width / 2, screenY + 50);
    ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(screenX + 50, screenY + 80); ctx.lineTo(screenX + screenWidth - 50, screenY + 80); ctx.stroke();

    const drawButton = (x, y, text, icon, color = '#2563eb', textColor = '#ffffff') => {
        const btnW = 280, btnH = 70;
        ctx.fillStyle = color; fillRoundRect(ctx, x, y, btnW, btnH, 12);
        ctx.fillStyle = textColor; ctx.font = `bold 22px ${BOLD_FONT_FAMILY}`; ctx.textAlign = 'left'; ctx.fillText(text, x + 65, y + 42);
        if (icon) { ctx.font = `28px ${BOLD_FONT_FAMILY}`; ctx.fillText(icon, x + 28, y + 45); }
        ctx.textAlign = 'center';
    };

    if (session.step === 'main_menu') {
        const options = [{ text: "Withdraw", icon: '💸' }, { text: "Deposit", icon: '📥' }, { text: "Balance", icon: '📊' }, { text: "Bill Pay", icon: '🧾' }, { text: "Quick Cash", icon: '⚡' }, { text: "Mini Statement", icon: '📄' }, { text: "Cash Advance", icon: '💳' }, { text: "PIN Change", icon: '🔒' }];
        options.forEach((opt, i) => { const x = (i % 2 === 0) ? screenX + 60 : screenX + screenWidth - 340; const y = screenY + 110 + Math.floor(i / 2) * 90; drawButton(x, y, opt.text, opt.icon); });
    } else if (session.step === 'awaiting_pin') {
        ctx.font = `32px ${FONT_FAMILY}`; ctx.fillStyle = '#cbd5e1'; ctx.fillText("Please Enter Your PIN", width / 2, screenY + 150);
        const pinDisplay = session.pinInput ? '*'.repeat(session.pinInput.length) : "";
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; fillRoundRect(ctx, width/2 - 150, screenY + 200, 300, 70, 10);
        ctx.font = `bold 48px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#fff'; ctx.fillText(pinDisplay, width / 2, screenY + 245);
        const keySize = 70; const keyGap = 15; const startX = width/2 - (keySize * 1.5 + keyGap / 2); const startY = screenY + 290;
        const keys = session.keypadLayout || ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'];
        keys.forEach((key, i) => {
            const col = i % 3; const row = Math.floor(i / 3);
            const x = startX + col * (keySize + keyGap); const y = startY + row * (keySize + keyGap);
            ctx.fillStyle = '#2563eb'; fillRoundRect(ctx, x, y, keySize, keySize, 15);
            ctx.fillStyle = '#fff'; ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillText(key, x + keySize/2, y + 45);
        });
    } else if (session.step.includes('prompt')) {
        ctx.font = `32px ${FONT_FAMILY}`; ctx.fillStyle = '#cbd5e1'; wrapText(ctx, session.message, width / 2, screenY + 250, screenWidth - 100, 45);
        ctx.fillStyle = '#475569'; fillRoundRect(ctx, width/2 - 200, screenY + 350, 400, 60, 10);
        ctx.font = `28px ${FONT_FAMILY}`; ctx.fillStyle = '#94a3b8'; ctx.fillText("Enter response below...", width/2, screenY + 388);
    } else if (session.step === 'quick_cash') {
        ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText("Quick Cash Withdrawal", width/2, screenY + 130);
        const amounts = [1000, 5000, 10000, 20000];
        amounts.forEach((amt, i) => {
            const x = (i % 2 === 0) ? screenX + 60 : screenX + screenWidth - 340; const y = screenY + 200 + Math.floor(i / 2) * 110; drawButton(x, y, formatNumber(amt), '💵');
        });
    } else if (session.step === 'mini_statement') {
        ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText("Mini Statement", width/2, screenY + 130);
        let y = screenY + 180;
        session.transactions.forEach(t => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#94a3b8'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText(new Date(t.date).toLocaleDateString(), screenX + 40, y);
            ctx.fillStyle = '#e2e8f0'; ctx.font = `20px ${FONT_FAMILY}`; ctx.fillText(t.description, screenX + 180, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = t.amount >= 0 ? '#4ade80' : '#f87171';
            ctx.fillText(formatNumber(t.amount), screenX + screenWidth - 40, y);
            y += 40;
        });
    } else if (session.step === 'receipt') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; fillRoundRect(ctx, width/2 - 200, screenY + 120, 400, 480, 15);
        ctx.fillStyle = '#1e2b38'; ctx.font = `bold 28px ${BOLD_FONT_FAMILY}`; ctx.fillText("TRANSACTION RECEIPT", width / 2, screenY + 160);
        ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText(new Date().toLocaleString(), width/2, screenY + 190);
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(width/2 - 180, screenY + 210); ctx.lineTo(width/2 + 180, screenY + 210); ctx.stroke();
        ctx.textAlign = 'left'; ctx.font = `22px ${FONT_FAMILY}`; ctx.fillText(`Status:`, width/2 - 170, screenY + 250);
        ctx.textAlign = 'right'; ctx.fillStyle = session.isError ? '#ef4444' : '#22c55e'; ctx.font = `bold 22px ${BOLD_FONT_FAMILY}`; ctx.fillText(session.isError ? "FAILED" : "SUCCESS", width/2 + 170, screenY + 250);
        ctx.textAlign = 'center'; ctx.fillStyle = '#1e2b38'; ctx.font = `24px ${FONT_FAMILY}`; wrapText(ctx, session.message, width / 2, screenY + 320, 360, 35);
        ctx.font = `16px ${FONT_FAMILY}`; ctx.fillStyle = '#64748b'; ctx.fillText("Thank you for banking with Anchestor.", width/2, screenY + 570);
    } else if (session.step === 'bill_pay_list') {
         ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText("Outstanding Bills", width/2, screenY + 130);
        if(!session.bills || session.bills.length === 0){ ctx.font = `28px ${FONT_FAMILY}`; ctx.fillStyle = '#94a3b8'; ctx.fillText("You have no outstanding bills.", width/2, screenY + 250); }
        else { session.bills.forEach((bill, i) => { const billText = `${i+1}. ${bill.type}: ${formatNumber(bill.amount)}`; drawButton(screenX + 210, screenY + 200 + i * 100, billText, '🧾', '#be123c'); }); }
    } else if (session.step === 'balance_view') {
        ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText("Account Balance", width/2, screenY + 130);
        ctx.fillStyle = '#4ade80'; fillRoundRect(ctx, screenX + 100, screenY + 200, screenWidth - 200, 120, 15);
        ctx.fillStyle = '#15803d'; ctx.font = `28px ${FONT_FAMILY}`; ctx.fillText("Bank Balance", width/2, screenY + 240);
        ctx.font = `bold 48px ${BOLD_FONT_FAMILY}`; ctx.fillText(formatNumber(session.bankBalance), width/2, screenY + 290);
        ctx.fillStyle = '#60a5fa'; fillRoundRect(ctx, screenX + 100, screenY + 350, screenWidth - 200, 120, 15);
        ctx.fillStyle = '#1d4ed8'; ctx.font = `28px ${FONT_FAMILY}`; ctx.fillText("Cash on Hand", width/2, screenY + 390);
        ctx.font = `bold 48px ${BOLD_FONT_FAMILY}`; ctx.fillText(formatNumber(session.cash), width/2, screenY + 440);
        ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = '#94a3b8'; ctx.fillText("Select any option to return to the main menu.", width/2, screenY + 550);
    }

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir); const imagePath = path.join(tempDir, `atm_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out); await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawStockMarketCanvas(b){const c=6,d=Object.keys(stockMarket),a=Math.ceil(d.length/c);b=Math.max(1,Math.min(b,a));const e=(b-1)*c,f=d.slice(e,e+c),g=550,h=90,i=60,j=40,k=i+f.length*h+j,l=createCanvas(g,k),m=l.getContext("2d");m.fillStyle="#1A202C",m.fillRect(0,0,g,k),m.fillStyle="#2D3748",m.fillRect(0,0,g,i),m.fillStyle="#E2E8F0",m.font=`bold 24px ${FONT_FAMILY}`,m.textAlign="center",m.textBaseline="middle",m.fillText("Anchestor Stock Exchange",g/2,i/2);let n=i+5;for(const o of f){const p=stockMarket[o];m.fillStyle="#2D3748",m.fillRect(10,n,g-20,h-5),m.fillStyle="#E2E8F0",m.font=`bold 18px ${FONT_FAMILY}`,m.textAlign="left",m.fillText(`${o} • ${p.name}`,25,n+30),m.font=`16px ${FONT_FAMILY}`,m.fillText(`Price: ${formatNumber(p.price)}`,25,n+60);const q=(p.dailyChange||0).toFixed(2);m.fillStyle=0<=(p.dailyChange||0)?"#48BB78":"#F56565",m.textAlign="right",m.font=`bold 20px ${FONT_FAMILY}`,m.fillText(`${0<=(p.dailyChange||0)?"▲":"▼"} ${q}%`,g-25,n+45),n+=h}m.fillStyle="#2D3748",m.fillRect(0,k-j,g,j),m.fillStyle="#99AAB5",m.font=`16px ${FONT_FAMILY}`,m.textAlign="center",m.fillText(`Page ${b} of ${a}`,g/2,k-j/2);const o=path.join(__dirname,"..","cache");await fs.ensureDir(o);const p=path.join(o,`stock_market_${Date.now()}.png`),q=fs.createWriteStream(p);l.createPNGStream().pipe(q); return await new Promise(a=>q.on("finish",() => a(p)))}
async function drawCryptoMarketCanvas(b){const c=6,d=Object.keys(cryptoMarket),a=Math.ceil(d.length/c);b=Math.max(1,Math.min(b,a));const e=(b-1)*c,f=d.slice(e,e+c),g=550,h=90,i=60,j=40,k=i+f.length*h+j,l=createCanvas(g,k),m=l.getContext("2d");m.fillStyle="#2d3748",m.fillRect(0,0,g,k),m.fillStyle="#4c51bf",m.fillRect(0,0,g,i),m.fillStyle="#E2E8F0",m.font=`bold 24px ${FONT_FAMILY}`,m.textAlign="center",m.textBaseline="middle",m.fillText("Anchestor Crypto Exchange",g/2,i/2);let n=i+5;for(const o of f){const p=cryptoMarket[o];m.fillStyle="#4a5568",m.fillRect(10,n,g-20,h-5),m.fillStyle="#E2E8F0",m.font=`bold 18px ${FONT_FAMILY}`,m.textAlign="left",m.fillText(`${o} • ${p.name}`,25,n+30),m.font=`16px ${FONT_FAMILY}`,m.fillText(`Price: ${formatNumber(p.price)}`,25,n+60);const q=(p.dailyChange||0).toFixed(2);m.fillStyle=0<=(p.dailyChange||0)?"#48BB78":"#F56565",m.textAlign="right",m.font=`bold 20px ${FONT_FAMILY}`,m.fillText(`${0<=(p.dailyChange||0)?"▲":"▼"} ${q}%`,g-25,n+45),n+=h}m.fillStyle="#4c51bf",m.fillRect(0,k-j,g,j),m.fillStyle="#a3bffa",m.font=`16px ${FONT_FAMILY}`,m.textAlign="center",m.fillText(`Page ${b} of ${a}`,g/2,k-j/2);const o=path.join(__dirname,"..","cache");await fs.ensureDir(o);const p=path.join(o,`crypto_market_${Date.now()}.png`),q=fs.createWriteStream(p);l.createPNGStream().pipe(q); return await new Promise(a=>q.on("finish",() => a(p)))}
async function drawStockPortfolioCanvas(c, a, d) { const e = c.stocks || []; if (e.length === 0) return null; const f = 700, g = 120, h = 80, b = h + e.length * g + 20, i = createCanvas(f, b), j = i.getContext("2d"); j.fillStyle = "#1A202C"; j.fillRect(0, 0, f, b); j.fillStyle = "#2D3748"; fillRoundRect(j, 0, 0, f, h, { tl: 15, tr: 15, bl: 0, br: 0 }); j.fillStyle = "#E2E8F0"; j.font = `bold 28px ${BOLD_FONT_FAMILY}`; j.textAlign = "center"; j.textBaseline = "middle"; const k = await a.getName(d) || "User"; j.fillText(`${k}'s Stock Portfolio`, f / 2, h / 2); let l = h + 10; for (const m of e) { const n = stockMarket[m.symbol]; if (!n) continue; const isShort = m.type === 'short'; let o, p, q, r; if (isShort) { o = n.price * m.shares; p = m.avgPrice * m.shares; q = p - o; r = p !== 0 ? 100 * q / p : 0; } else { o = n.price * m.shares; p = m.avgPrice * m.shares; q = o - p; r = p !== 0 ? 100 * q / p : 0; } j.fillStyle = isShort ? "rgba(44, 36, 77, 0.5)" : "rgba(45, 55, 72, 0.5)"; fillRoundRect(j, 10, l, f - 20, g - 10, 10); j.fillStyle = "#E2E8F0"; j.font = `bold 22px ${BOLD_FONT_FAMILY}`; j.textAlign = "left"; j.fillText(`${m.symbol} • ${n.name}`, 25, l + 35); if (isShort) { j.fillStyle = "#d69fef"; j.font = `bold 16px ${BOLD_FONT_FAMILY}`; j.fillText("[SHORT]", 25 + j.measureText(`${m.symbol} • ${n.name}`).width + 10, l + 35); } j.fillStyle = "#E2E8F0"; j.font = `16px ${FONT_FAMILY}`; j.fillText(`${m.shares} shares @ avg ${formatNumber(m.avgPrice)}`, 25, l + 65); j.fillText(`Value: ${formatNumber(o)}`, 25, l + 95); j.textAlign = "right"; j.fillStyle = q >= 0 ? "#48BB78" : "#F56565"; j.font = `bold 24px ${BOLD_FONT_FAMILY}`; j.fillText(`${q >= 0 ? "▲" : "▼"} ${r.toFixed(2)}%`, f - 180, l + 55); j.font = `18px ${FONT_FAMILY}`; j.fillText(`P/L: ${formatNumber(q)}`, f - 180, l + 85); const chartX = f - 160, chartY = l + 20, chartW = 140, chartH = g - 50; const history = n.history; const min = Math.min(...history), max = Math.max(...history); j.strokeStyle = q >= 0 ? "rgba(72, 187, 120, 0.8)" : "rgba(245, 101, 101, 0.8)"; j.lineWidth = 2; j.beginPath(); history.forEach((price, idx) => { const x = chartX + (idx / (history.length - 1)) * chartW; const y = chartY + chartH - ((price - min) / (max - min)) * chartH; if (idx === 0) j.moveTo(x, y); else j.lineTo(x, y); }); j.stroke(); l += g; } const s = path.join(__dirname, "..", "cache"); await fs.ensureDir(s); const t = path.join(s, `stock_portfolio_${d}_${Date.now()}.png`), u = fs.createWriteStream(t); i.createPNGStream().pipe(u); return await new Promise(a => u.on("finish", () => a(t))); }
async function drawFinancialReportCanvas(d,c,a){const b=600,e=750,f=createCanvas(b,e),g=f.getContext("2d");const h=g.createLinearGradient(0,0,b,e);h.addColorStop(0,"#1e293b");h.addColorStop(1,"#0f172a");g.fillStyle=h;g.fillRect(0,0,b,e);const i=await c.getName(a)||"User";g.font=`bold 32px ${BOLD_FONT_FAMILY}`;g.fillStyle="#e2e8f0";g.textAlign="center";g.fillText(`${i}'s Financial Report`,b/2,50);const j=d.bank||0,k=await c.get(a,"money")||0,l=(d.stocks||[]).reduce((a,b)=>a+(stockMarket[b.symbol]?.price||0)*b.shares,0),m=(d.businesses||[]).reduce((a,b)=>{const c=availableBusinesses.find(a=>a.id===b.businessId);return a+(c?.cost||0)},0),n=(d.properties||[]).reduce((a,b)=>a+(propertyMarket.find(c=>c.id===b.assetId)?.price||0),0),o=j+k+l+m+n;const p={Bank:j,Cash:k,Stocks:l,Businesses:m,Properties:n},q=Object.values(p).reduce((a,b)=>a+b,0);let r=1.5*Math.PI;const s=["#3b82f6","#22c55e","#facc15","#ef4444","#a855f7"];let t=0;const u=b/2,v=220;for(const[w,x]of Object.entries(p)){if(x>0){const y=x/q*2*Math.PI;g.fillStyle=s[t++%s.length];g.beginPath();g.moveTo(u,v);g.arc(u,v,120,r,r+y);g.closePath();g.fill();r+=y}}g.fillStyle="#0f172a";g.beginPath();g.arc(u,v,80,0,2*Math.PI);g.fill();g.textAlign="left";g.font=`16px ${FONT_FAMILY}`;g.fillStyle="#94a3b8";let x_pos=400;Object.entries(p).forEach(([a_key,c_val],d_idx)=>{g.fillStyle=s[d_idx%s.length];g.fillRect(50,x_pos-10,20,10);g.fillStyle="#e2e8f0";g.fillText(`${a_key}: ${formatNumber(c_val)} (${(c_val/q*100||0).toFixed(1)}%)`,80,x_pos);x_pos+=30});const drawWidget=(x,y,w,h,label,value,color)=>{g.fillStyle="rgba(45, 55, 72, 0.5)";fillRoundRect(g,x,y,w,h,15);g.font=`20px ${FONT_FAMILY}`;g.fillStyle="#94a3b8";g.textAlign="center";g.fillText(label,x+w/2,y+35);g.font=`bold 36px ${BOLD_FONT_FAMILY}`;g.fillStyle=color;g.fillText(value,x+w/2,y+80);};drawWidget(50,580,240,120,"Credit Score",formatNumber(d.creditScore,false,0),"#facc15");drawWidget(310,580,240,120,"Net Worth",formatNumber(o),"#22c55e");const z=path.join(__dirname,"..","cache");await fs.ensureDir(z);const A=path.join(z,`report_${a}_${Date.now()}.png`),B=fs.createWriteStream(A);f.createPNGStream().pipe(B);return await new Promise(a=>B.on("finish",()=>a(A)))}
async function drawBankCardCanvas(userData, cardHolderName, netWorth) {
    const width = 856; const height = 540; const canvas = createCanvas(width, height); const ctx = canvas.getContext("2d");
    const tierName = getTierByNetWorth(netWorth);
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, width, height, 30); ctx.clip();
    switch (tierName) {
        case "Bronze": { const grad = ctx.createLinearGradient(0, 0, width, height); grad.addColorStop(0, "#a97142"); grad.addColorStop(1, "#664229"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height); break; }
        case "Silver": { const grad = ctx.createLinearGradient(0, 0, width, height); grad.addColorStop(0, "#c0c0c0"); grad.addColorStop(0.5, "#e9e9e9"); grad.addColorStop(1, "#a0a0a0"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height); ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; for(let i = 0; i < height; i += 4) { ctx.fillRect(0, i, width, 2); } break; }
        case "Gold": { const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width); grad.addColorStop(0, "#fffde4"); grad.addColorStop(1, "#c89b3c"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height); break; }
        case "Platinum": { ctx.fillStyle = "#e5e4e2"; ctx.fillRect(0, 0, width, height); const grad = ctx.createLinearGradient(0, 0, width, height); grad.addColorStop(0, "rgba(255, 255, 255, 0.8)"); grad.addColorStop(1, "rgba(200, 200, 200, 0)"); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height); break; }
        case "Obsidian": { ctx.fillStyle = "#111111"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; for (let i = -width; i < width; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + height, height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, height); ctx.lineTo(i + height, 0); ctx.stroke(); } break; }
    }
    ctx.restore(); ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; ctx.fillRect(0, 0, width, height); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 5;
    ctx.font = `bold 40px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText("Anchestor Bank", 60, 80);
    ctx.font = `bold 24px ${FONT_FAMILY}`; ctx.fillText("DEBIT / CREDIT", 65, 120);
    ctx.textAlign = 'right'; ctx.fillText(tierName.toUpperCase(), width - 60, 80);
    ctx.fillStyle = "#bfa87a"; fillRoundRect(ctx, 70, 180, 80, 65, 8);
    ctx.fillStyle = "#d4c09a"; ctx.fillRect(80, 185, 60, 55); ctx.strokeStyle = "#826e4a"; ctx.lineWidth = 2; ctx.strokeRect(95, 195, 30, 35);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(180, 212, 30, Math.PI * 1.3, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(180, 212, 22, Math.PI * 1.3, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(180, 212, 14, Math.PI * 1.3, Math.PI * 1.7); ctx.stroke();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.font = `bold 60px ${FONT_FAMILY}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.textAlign = 'center';
    ctx.fillText(userData.card.number, width / 2, 330);
    ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    const memberSince = new Date(userData.createdAt).toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' });
    ctx.textAlign = 'left'; ctx.fillText(`MEMBER\nSINCE ${memberSince}`, 410, 380);
    ctx.textAlign = 'center'; ctx.fillText("VALID\nTHRU", 530, 380);
    ctx.font = `bold 30px ${FONT_FAMILY}`; ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fillText("08/29", 620, 392);
    ctx.font = `bold 32px ${FONT_FAMILY}`; ctx.textAlign = 'left'; ctx.fillText(cardHolderName.toUpperCase(), 70, 480);
    ctx.globalCompositeOperation = 'blend'; ctx.fillStyle = '#EB001B'; ctx.beginPath(); ctx.arc(width - 160, height - 85, 40, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#F79E1B'; ctx.beginPath(); ctx.arc(width - 100, height - 85, 40, 0, Math.PI*2); ctx.fill();
    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir); const imagePath = path.join(tempDir, `bankcard_${userData.userId}_${Date.now()}.png`); const out = fs.createWriteStream(imagePath); const stream = canvas.createPNGStream(); stream.pipe(out); await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawLeaderboardCanvas(leaderboardData) {
    const width = 600; const height = 750; const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, width, height); grad.addColorStop(0, '#1a202c'); grad.addColorStop(1, '#2d3748');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height); ctx.font = `bold 40px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'center'; ctx.fillText("Anchestor Bank Rich List", width / 2, 60);
    for (const [index, user] of leaderboardData.entries()) {
        const y = 120 + index * 60;
        ctx.fillStyle = 'rgba(45, 55, 72, 0.5)'; fillRoundRect(ctx, 20, y, width - 40, 55, 10);
        let rankColor = '#A0AEC0'; if (index === 0) rankColor = '#F6E05E'; if (index === 1) rankColor = '#C0C0C0'; if (index === 2) rankColor = '#CD7F32';
        ctx.font = `bold 28px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = rankColor; ctx.textAlign = 'left'; ctx.fillText(`${index + 1}.`, 35, y + 35);
        try { const avatar = await loadImage(user.avatar); ctx.save(); ctx.beginPath(); ctx.arc(95, y + 27.5, 20, 0, Math.PI * 2, true); ctx.closePath(); ctx.clip(); ctx.drawImage(avatar, 75, y + 7.5, 40, 40); ctx.restore(); } catch (e) { ctx.fillStyle = '#4A5568'; ctx.beginPath(); ctx.arc(95, y + 27.5, 20, 0, Math.PI*2); ctx.fill(); }
        ctx.font = `24px ${FONT_FAMILY}`; ctx.fillStyle = '#E2E8F0'; ctx.fillText(user.name, 130, y + 35);
        ctx.textAlign = 'right'; ctx.fillText(formatNumber(user.netWorth), width - 35, y + 35);
    }
    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir); const imagePath = path.join(tempDir, `leaderboard_${Date.now()}.png`); const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out); await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawAchievementsCanvas(userAchievements) {
    const width = 800; const height = 600;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,height); grad.addColorStop(0, '#1a202c'); grad.addColorStop(1, '#2d3748');
    ctx.fillStyle = grad; ctx.fillRect(0,0,width,height);
    ctx.font = `bold 40px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'center'; ctx.fillText("Achievements Showcase", width/2, 60);
    const drawIcon = (iconType, x, y, size) => {
        ctx.save(); ctx.translate(x, y); ctx.lineWidth = size * 0.08;
        if(iconType === 'piggy'){ ctx.fillStyle = '#ffc0cb'; ctx.strokeStyle = '#e5a9b7'; ctx.beginPath(); ctx.arc(size/2, size/2, size/2.2, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff9eb2'; ctx.beginPath(); ctx.ellipse(size/2, size/2, size/3, size/4, 0, 0, Math.PI*2); ctx.fill();
        } else if (iconType === 'chart') { ctx.strokeStyle = '#48BB78'; ctx.beginPath(); ctx.moveTo(size*0.1,size*0.8); ctx.lineTo(size*0.3, size*0.4); ctx.lineTo(size*0.5, size*0.6); ctx.lineTo(size*0.7, size*0.2); ctx.lineTo(size*0.9, size*0.5); ctx.stroke();
        } else if (iconType === 'briefcase') { ctx.fillStyle = '#8B4513'; ctx.strokeStyle = '#5a2d0c'; fillRoundRect(ctx, size*0.1, size*0.3, size*0.8, size*0.6, 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(size*0.3, size*0.3); ctx.lineTo(size*0.3, size*0.1); ctx.lineTo(size*0.7, size*0.1); ctx.lineTo(size*0.7, size*0.3); ctx.stroke();
        } else if (iconType === 'moneyBag') { ctx.fillStyle = '#48BB78'; ctx.strokeStyle = '#2F855A'; ctx.beginPath(); ctx.arc(size/2, size/1.5, size/3, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.font = `bold ${size/2}px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#fff'; ctx.fillText('$', size/2, size/1.5 + size/12);
        } else if (iconType === 'star') { ctx.fillStyle = '#F6E05E'; ctx.strokeStyle = '#D69E2E'; ctx.beginPath(); let rot = Math.PI/2 * 3; let x_ = size/2; let y_ = size/2; let step = Math.PI / 5; for(let i=0; i<5; i++){ ctx.moveTo(x_,y_); ctx.lineTo(x_ + Math.cos(rot)*size/2, y_ + Math.sin(rot)*size/2); rot+=step; ctx.lineTo(x_ + Math.cos(rot)*size/4, y_ + Math.sin(rot)*size/4); rot+=step; } ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (iconType === 'building') { ctx.fillStyle = '#A0AEC0'; ctx.strokeStyle = '#4A5568'; ctx.fillRect(size*0.2, size*0.4, size*0.6, size*0.5); ctx.strokeRect(size*0.2, size*0.4, size*0.6, size*0.5); ctx.beginPath(); ctx.moveTo(size*0.1, size*0.4); ctx.lineTo(size*0.5, size*0.1); ctx.lineTo(size*0.9, size*0.4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore();
    }
    const achievements = Object.entries(achievementsList);
    const cols = 3; const boxW = 200, boxH = 200; const marginX = (width - cols*boxW)/(cols+1), marginY = 80;
    for(let i=0; i<achievements.length; i++){
        const [id, ach] = achievements[i]; const row = Math.floor(i/cols); const col = i % cols;
        const x = marginX + col * (boxW + marginX); const y = 120 + row * (boxH + marginY);
        const unlocked = userAchievements.includes(id); ctx.globalAlpha = unlocked ? 1.0 : 0.4;
        fillRoundRect(ctx, x, y, boxW, boxH, 15); drawIcon(ach.icon, x+50, y+20, 100);
        ctx.font = `bold 20px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = unlocked ? '#fff' : '#A0AEC0'; ctx.textAlign = 'center';
        ctx.fillText(unlocked ? ach.name : 'LOCKED', x + boxW/2, y + 150);
        ctx.font = `14px ${FONT_FAMILY}`; ctx.fillStyle = unlocked ? '#A0AEC0' : '#718096';
        wrapText(ctx, unlocked ? ach.description : '???', x + boxW/2, y + 175, boxW - 20, 16);
    }
    ctx.globalAlpha = 1.0; const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `achievements_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawDigestCanvas(gainers, losers, analysis) {
    const width = 800; const height = 500;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#1e3a8a'); grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = `bold 40px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText("Anchestor Daily Digest", width / 2, 60);
    ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = '#94a3b8'; ctx.fillText(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), width/2, 100);
    const drawList = (title, stocks, x, color) => {
        ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(title, x, 160);
        stocks.forEach((stock, i) => { const y = 200 + i * 40; ctx.font = `bold 20px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'left'; ctx.fillText(`${stock.symbol}`, x - 150, y); ctx.font = `20px ${FONT_FAMILY}`; ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(`${stock.dailyChange.toFixed(2)}%`, x + 150, y); });
    };
    drawList("Top Gainers", gainers, 250, '#48BB78'); drawList("Top Losers", losers, 550, '#F56565');
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; fillRoundRect(ctx, 50, 340, width - 100, 120, 10);
    ctx.font = `bold 22px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.fillText("AI Market Analysis:", 70, 370);
    ctx.font = `18px ${FONT_FAMILY}`; wrapText(ctx, analysis, 70, 405, width - 140, 24);
    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir); const imagePath = path.join(tempDir, `digest_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawPhoneHomeScreenCanvas(userBankData, userName) {
    const width = 450; const height = 800;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, width, height);
    const now = new Date();
    ctx.font = `bold 64px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), width / 2, 120);
    ctx.font = `24px ${FONT_FAMILY}`; ctx.fillStyle = '#94a3b8';
    ctx.fillText(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), width / 2, 160);

    const drawAppIcon = (x, y, label, icon, notificationCount) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; fillRoundRect(ctx, x, y, 80, 80, 20);
        ctx.font = `40px ${BOLD_FONT_FAMILY}`; ctx.fillText(icon, x + 40, y + 50);
        ctx.font = `16px ${FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.fillText(label, x + 40, y + 105);
        if (notificationCount) {
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(x + 75, y + 10, 12, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = `bold 14px ${BOLD_FONT_FAMILY}`; ctx.fillText(notificationCount, x + 75, y + 15);
        }
    };
    const unreadMessages = userBankData.messages.filter(m => !m.read).length;
    drawAppIcon(50, 250, 'Messages', '💬', unreadMessages > 0 ? unreadMessages : false);
    drawAppIcon(185, 250, 'Bank', '🏦', false);
    drawAppIcon(320, 250, 'Stocks', '📈', false);
    drawAppIcon(50, 400, 'Gallery', '🖼️', false);
    
    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `phone_${userBankData.userId}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawCreditCardViewCanvas(userData) {
    const width = 600; const height = 400; const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height); grad.addColorStop(0, '#1e3a8a'); grad.addColorStop(1, '#172554'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.fillText(userData.creditCard.nickname || "Anchestor Credit Card", width/2, 50);

    const drawWidget = (x, y, w, h, label, value, color) => {
        ctx.fillStyle = "rgba(0,0,0,0.2)"; fillRoundRect(ctx, x, y, w, h, 15);
        ctx.font = `22px ${FONT_FAMILY}`; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center"; ctx.fillText(label, x + w / 2, y + 40);
        ctx.font = `bold 38px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = color; ctx.fillText(value, x + w / 2, y + 90);
    };

    const cc = userData.creditCard;
    drawWidget(30, 100, 260, 120, "Credit Limit", formatNumber(cc.limit), '#34d399');
    drawWidget(310, 100, 260, 120, "Available", formatNumber(cc.limit - cc.balance), '#60a5fa');
    drawWidget(30, 240, 260, 120, "Current Balance", formatNumber(cc.balance), '#f87171');
    drawWidget(310, 240, 260, 120, "Reward Points", (cc.rewards.points || 0).toLocaleString(), '#facc15');

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `cc_view_${userData.userId}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawCreditCardHistoryCanvas(userData) {
    const history = userData.creditCard.transactionHistory || [];
    const baseHeight = 200; const itemHeight = 40; const height = baseHeight + history.length * itemHeight;
    const width = 700; const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height); grad.addColorStop(0, '#4a044e'); grad.addColorStop(1, '#1e1b4b'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.fillText("Credit Card History", width/2, 50);
    
    let y = 120;
    history.slice(-15).reverse().forEach(t => {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#d8b4fe'; ctx.font = `18px ${FONT_FAMILY}`; ctx.fillText(new Date(t.date).toLocaleString(), 40, y);
        ctx.fillStyle = '#e2e8f0'; ctx.font = `20px ${FONT_FAMILY}`; ctx.fillText(t.type, 280, y);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f87171';
        ctx.fillText(formatNumber(t.amount), width - 40, y);
        y += itemHeight;
    });

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `cc_history_${userData.userId}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawNetWorthCanvas(netWorthData, userName) {
    const width = 700; const height = 500; const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height); grad.addColorStop(0, '#064e3b'); grad.addColorStop(1, '#134e4a'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);
    ctx.font = `bold 32px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center'; ctx.fillText(`${userName}'s Net Worth`, width/2, 50);
    ctx.font = `bold 48px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#6ee7b7'; ctx.fillText(formatNumber(netWorthData.total), width/2, 100);

    const barWidth = 80; const barGap = 40; const chartX = 50; const chartY = 450;
    const maxValue = Math.max(...Object.values(netWorthData.breakdown));
    let currentX = chartX;
    const colors = { Bank: '#3b82f6', Cash: '#22c55e', Stocks: '#facc15', Businesses: '#ef4444', Properties: '#a855f7' };
    for (const [key, value] of Object.entries(netWorthData.breakdown)) {
        if (value > 0) {
            const barHeight = (value / maxValue) * 250;
            ctx.fillStyle = colors[key] || '#94a3b8';
            ctx.fillRect(currentX, chartY - barHeight, barWidth, barHeight);
            ctx.fillStyle = '#fff'; ctx.font = `16px ${FONT_FAMILY}`;
            ctx.fillText(key, currentX + barWidth/2, chartY + 20);
            ctx.fillText(formatNumber(value, true, 1), currentX + barWidth/2, chartY - barHeight - 10);
            currentX += barWidth + barGap;
        }
    }

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `networth_${Date.now()}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawTaxStatusCanvas(userData, userName) {
    const width = 600, height = 500;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#4a5568'); grad.addColorStop(1, '#1a202c');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

    ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'center';
    ctx.fillText("Tax Filing Status", width / 2, 60);
    ctx.font = `20px ${FONT_FAMILY}`; ctx.fillText(`For: ${userName}`, width / 2, 95);

    const taxData = userData.tax || { lastFiled: userData.createdAt, reportableIncome: 0 };
    const lastFiledDate = new Date(taxData.lastFiled);
    const filingDueDate = new Date(lastFiledDate.getTime() + TAX_FILING_PERIOD_DAYS * 86400000);
    const daysLeft = Math.max(0, Math.ceil((filingDueDate - Date.now()) / 86400000));
    
    const estimatedTax = taxData.reportableIncome * INCOME_TAX_RATE;
    const taxDue = estimatedTax - (userData.taxPaid || 0);

    const drawInfoLine = (label, value, y) => {
        ctx.textAlign = 'left';
        ctx.font = `22px ${FONT_FAMILY}`; ctx.fillStyle = '#a0aec0';
        ctx.fillText(label, 50, y);
        ctx.textAlign = 'right';
        ctx.font = `bold 22px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#e2e8f0';
        ctx.fillText(value, width - 50, y);
    };

    drawInfoLine("Filing Period Ends:", filingDueDate.toLocaleDateString(), 180);
    drawInfoLine("Days Left to File:", `${daysLeft} days`, 220);
    drawInfoLine("Reportable Income:", formatNumber(taxData.reportableIncome), 280);
    drawInfoLine("Tax Withheld:", formatNumber(userData.taxPaid || 0), 320);
    drawInfoLine("Estimated Tax:", formatNumber(estimatedTax), 360);
    
    ctx.strokeStyle = '#718096'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, 400); ctx.lineTo(width - 50, 400); ctx.stroke();
    
    ctx.textAlign = 'center';
    ctx.font = `24px ${FONT_FAMILY}`;
    ctx.fillStyle = taxDue > 0 ? '#f56565' : '#48bb78';
    ctx.fillText(taxDue > 0 ? `Balance Due: ${formatNumber(taxDue)}` : `Refund Due: ${formatNumber(Math.abs(taxDue))}`, width/2, 440);

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `tax_status_${userData.userId}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}
async function drawSecurityDashboardCanvas(userData) {
    const width = 600, height = 450;
    const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#065f46'); grad.addColorStop(1, '#064e3b');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

    ctx.font = `bold 36px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = '#d1fae5'; ctx.textAlign = 'center';
    ctx.fillText("Security Center", width / 2, 60);

    const drawStatusWidget = (y, label, status, color) => {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        fillRoundRect(ctx, 50, y, width - 100, 80, 15);
        ctx.font = `24px ${FONT_FAMILY}`; ctx.fillStyle = '#a7f3d0';
        ctx.textAlign = 'left'; ctx.fillText(label, 70, y + 45);
        ctx.font = `bold 24px ${BOLD_FONT_FAMILY}`; ctx.fillStyle = color;
        ctx.textAlign = 'right'; ctx.fillText(status, width - 70, y + 45);
    };

    const securityData = userData.security || { twoFactorEnabled: false, alerts: [] };
    const pinStatus = (userData.card && userData.card.pin) ? "SET" : "NOT SET";
    const twoFactorStatus = securityData.twoFactorEnabled ? "ENABLED" : "DISABLED";
    const alertStatus = securityData.alerts.length > 0 ? `${securityData.alerts.length} Active` : "NONE";

    drawStatusWidget(120, "Card PIN Status", pinStatus, pinStatus === "SET" ? "#6ee7b7" : "#fca5a5");
    drawStatusWidget(220, "Two-Factor Auth (2FA)", twoFactorStatus, securityData.twoFactorEnabled ? "#6ee7b7" : "#a7f3d0");
    drawStatusWidget(320, "Transaction Alerts", alertStatus, "#a7f3d0");

    const tempDir = path.join(__dirname, '..', 'cache'); await fs.ensureDir(tempDir);
    const imagePath = path.join(tempDir, `security_dashboard_${userData.userId}.png`);
    const out = fs.createWriteStream(imagePath); canvas.createPNGStream().pipe(out);
    await new Promise((resolve) => out.on('finish', resolve)); return imagePath;
}

module.exports = {
    config: { name: "bank", aliases: ["ab", "anchestor"], version: "14.0", author: "Mahi--", role: 0, countDown: 3, shortDescription: { en: "The complete Anchestor Bank financial system." }, longDescription: { en: "The ultimate banking experience with a huge array of financial tools and games." }, category: "economy" },
    onReply: async function ({ event, api, message, Reply, usersData }) { const { author, type } = Reply; if (event.senderID !== author) return; const handler = { 'ai_talk': this.handleAiTalkReply, 'atm_flow': this.handleAtmReply, 'card_creation': this.handleCardCreationReply }[type]; if (handler) await handler.call(this, { event, api, message, Reply, usersData }); },
    handleCardCreationReply: async function ({ event, message, Reply }) { const pin = event.body.trim(); if (!/^\d{4}$/.test(pin)) { message.reply("Invalid format. Please reply with exactly 4 numbers for your PIN.", (err, info) => { if(err) return; global.GoatBot.onReply.set(info.messageID, Reply); }); return; } const db = await getDb(); let userBankInfo = await getUserBankData(event.senderID, db); if (!userBankInfo) { userBankInfo = await createNewUser(event.senderID, db); } const cardNumber = '4269 ' + Array.from({ length: 3 }, () => Math.floor(1000 + Math.random() * 9000)).join(' '); userBankInfo.card = { number: cardNumber, pin: pin }; await updateUserBankData(event.senderID, userBankInfo, db); const p = global.utils.getPrefix(event.threadID) || "."; message.reply(`✅ Your Anchestor Bank debit card is active!\n\n💳 Card Number: ${cardNumber}\n🔒 PIN: ••••\n\nYou can now use the ATM with: ${p}bank atm`); },
    handleAtmReply: async function ({ event, message, Reply, usersData }) {
        const senderID = event.senderID; const userInput = event.body.trim(); const session = atmSessions.get(senderID);
        if (!session) return; if (userInput.toLowerCase() === 'exit') { atmSessions.delete(senderID); return message.reply("Session terminated. Thank you for using Anchestor Bank."); }
        const db = await getDb(); let userBankInfo = await getUserBankData(senderID, db); let userCash = await usersData.get(senderID, "money") || 0;
        
        const sendReply = async (newSessionState, replyMessage) => {
            atmSessions.set(senderID, newSessionState);
            try {
                const imagePath = await drawModernAtmCanvas(newSessionState);
                message.reply({ body: replyMessage, attachment: fs.createReadStream(imagePath) }, (err, info) => {
                    if (err) console.error("ATM Reply Error:", err);
                    fs.unlink(imagePath, (unlinkErr) => { if (unlinkErr) console.error("Failed to delete ATM canvas:", unlinkErr); });
                    if (newSessionState.step !== 'receipt') { global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: senderID, type: 'atm_flow' }); } else { setTimeout(() => atmSessions.delete(senderID), 5000); }
                });
            } catch (e) { console.error("Critical error in ATM sendReply:", e); atmSessions.delete(senderID); message.reply("An error occurred with the ATM interface. Please try again."); }
        };

        switch (session.step) {
            case 'awaiting_pin': { if (userInput !== userBankInfo.card.pin) { sendReply({ step: 'receipt', isError: true, message: 'Incorrect PIN. Session terminated.' }, 'Security failure.'); return; } userBankInfo = await processCycle(userBankInfo); await updateUserBankData(senderID, userBankInfo, db); sendReply({ step: 'main_menu' }, "PIN Accepted. Please select an option (1-8) or type 'exit'."); break; }
            case 'main_menu': case 'balance_view': {
                const choice = parseInt(userInput, 10);
                if (isNaN(choice) || choice < 1 || choice > 8) { if(session.step !== 'balance_view') { sendReply({ ...session }, "Invalid selection. Please choose 1-8."); } else { sendReply({ step: 'main_menu' }, "Returning to main menu..."); } return; }
                switch (choice) {
                    case 1: sendReply({ step: 'prompt_withdraw', message: 'Enter amount to withdraw:' }, 'How much would you like to withdraw?'); break;
                    case 2: sendReply({ step: 'prompt_deposit', message: 'Enter amount to deposit:' }, 'How much are you depositing?'); break;
                    case 3: sendReply({ step: 'balance_view', bankBalance: userBankInfo.bank, cash: userCash }, 'Displaying your current balances.'); break;
                    case 4: sendReply({ step: 'bill_pay_list', bills: userBankInfo.bills }, 'Select a bill to pay by number, or type 0 to exit.'); break;
                    case 5: sendReply({ step: 'quick_cash' }, 'Select a Quick Cash amount (1-4).'); break;
                    case 6: sendReply({ step: 'mini_statement', transactions: userBankInfo.transactionHistory.slice(-5).reverse() }, 'Displaying last 5 transactions.'); break;
                    case 7: sendReply({ step: 'prompt_cash_advance', message: 'Enter cash advance amount:\n(5% fee applies)' }, 'How much would you like to advance from your credit card?'); break;
                    case 8: sendReply({ step: 'prompt_pin_verify', message: 'For security, please verify your current PIN.' }, 'Enter your current PIN to continue.'); break;
                }
                break;
            }
            case 'quick_cash': {
                const amounts = [1000, 5000, 10000, 20000]; const choice = parseInt(userInput, 10);
                if(isNaN(choice) || choice < 1 || choice > 4) return sendReply({...session}, "Invalid selection. Please choose 1-4.");
                const amount = amounts[choice - 1];
                if (userBankInfo.bank < amount) { sendReply({ step: 'receipt', isError: true, message: 'Insufficient funds for this selection.' }, 'Transaction failed.'); return; }
                userBankInfo.bank -= amount; await usersData.set(senderID, { money: userCash + amount }); await addTransaction(senderID, "Withdraw", `ATM Quick Cash`, -amount, db);
                await updateUserBankData(senderID, userBankInfo, db);
                sendReply({ step: 'receipt', isError: false, message: `Successfully withdrew ${formatNumber(amount)}.` }, 'Transaction complete.');
                break;
            }
            case 'prompt_withdraw': case 'prompt_deposit': case 'prompt_cash_advance': {
                const amount = parseFloat(userInput);
                if (isNaN(amount) || amount <= 0) { sendReply({ step: 'receipt', isError: true, message: 'Invalid amount entered.' }, "Transaction failed."); return; }
                if (session.step === 'prompt_withdraw') { if (userBankInfo.bank < amount) { sendReply({ step: 'receipt', isError: true, message: 'Insufficient funds in bank.' }, 'Transaction failed.'); return; } userBankInfo.bank -= amount; await usersData.set(senderID, { money: userCash + amount }); await addTransaction(senderID, "Withdraw", `ATM Withdrawal`, -amount, db); }
                else if (session.step === 'prompt_deposit') { if (userCash < amount) { sendReply({ step: 'receipt', isError: true, message: 'Insufficient cash on hand.' }, 'Transaction failed.'); return; } userBankInfo.bank += amount; await usersData.set(senderID, { money: userCash - amount }); await addTransaction(senderID, "Deposit", `ATM Deposit`, amount, db); }
                else { if (!userBankInfo.creditCard.issued) { sendReply({ step: 'receipt', isError: true, message: 'No credit card found.' }, 'Transaction failed.'); return; } const fee = amount * CASH_ADVANCE_FEE_PERCENT; const totalDeducted = amount + fee; if (totalDeducted > (userBankInfo.creditCard.limit - userBankInfo.creditCard.balance)) { sendReply({ step: 'receipt', isError: true, message: 'This transaction exceeds your credit limit.' }, 'Transaction failed.'); return; } userBankInfo.creditCard.balance += totalDeducted; await usersData.set(senderID, { money: userCash + amount }); userBankInfo.creditCard.transactionHistory.push({ type: 'Cash Advance', amount: totalDeducted, date: new Date() }); }
                await updateUserBankData(senderID, userBankInfo, db);
                sendReply({ step: 'receipt', isError: false, message: `Transaction of ${formatNumber(amount)} was successful.` }, 'Transaction complete.');
                break;
            }
            case 'bill_pay_list': {
                const choice = parseInt(userInput, 10); if (choice === 0) { sendReply({ step: 'main_menu' }, "Returning to main menu."); return; }
                if (choice > 0 && choice <= userBankInfo.bills.length) { const bill = userBankInfo.bills[choice - 1]; if (userBankInfo.bank < bill.amount) { sendReply({ step: 'receipt', isError: true, message: 'Insufficient funds to pay this bill.' }, 'Transaction failed.'); return; } userBankInfo.bank -= bill.amount; userBankInfo.bills.splice(choice - 1, 1); await updateUserBankData(senderID, userBankInfo, db); sendReply({ step: 'receipt', isError: false, message: `Successfully paid ${bill.type} bill of ${formatNumber(bill.amount)}.` }, 'Thank you.'); return; }
                sendReply({ ...session }, "Invalid selection."); break;
            }
            case 'prompt_pin_verify': { if (userInput !== userBankInfo.card.pin) { sendReply({ step: 'receipt', isError: true, message: 'Incorrect PIN. Session terminated.' }, 'Security failure.'); return; } sendReply({ step: 'prompt_pin_new', message: 'Enter your new 4-digit PIN:' }, 'Verification successful. Please enter a new PIN.'); break; }
            case 'prompt_pin_new': { if (!/^\d{4}$/.test(userInput)) { sendReply({ ...session, message: 'Invalid format. Please enter a 4-digit PIN:' }, 'Invalid format. Please try again.'); return; } userBankInfo.card.pin = userInput; await updateUserBankData(senderID, userBankInfo, db); sendReply({ step: 'receipt', isError: false, message: 'Your PIN has been changed successfully.' }, 'Thank you.'); break; }
        }
    },
    handleAiTalkReply: async function ({ event, message, Reply }) { const conversation = `${Reply.conversation}\nUser: ${event.body}\nManager:`; let imageUrl = null; if (event.messageReply && event.messageReply.attachments.some(att => att.type === "photo")) { imageUrl = event.messageReply.attachments.find(att => att.type === "photo").url; } const aiResponse = await getAiResponse(conversation, imageUrl); const newConversationState = `${Reply.conversation}\nUser: ${event.body}\nManager: ${aiResponse}`; message.reply(aiResponse, (err, info) => { if (err) return; global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: event.senderID, type: 'ai_talk', conversation: newConversationState }); }); },
    onStart: async function ({ args, message, event, api, usersData }) {
        const p = global.utils.getPrefix(event.threadID) || "."; const senderID = String(event.senderID);
        const db = await getDb(); let userBankInfo = await getUserBankData(senderID, db);
        if (!userBankInfo) { userBankInfo = await createNewUser(senderID, db); }
        let userCash = await usersData.get(senderID, "money") || 0;
        const awardAchievement = async (achievementId) => { if (!userBankInfo.achievements.includes(achievementId)) { const achievement = achievementsList[achievementId]; userBankInfo.achievements.push(achievementId); userBankInfo.bank += achievement.reward; await updateUserBankData(senderID, userBankInfo, db); message.reply(`🏆 ${toBoldUnicode("Achievement Unlocked!")} 🏆\n\n${toBoldUnicode(achievement.name)}\n${achievement.description}\n\nReward: ${formatNumber(achievement.reward)} has been added to your bank!`); } };
        const command = args[0]?.toLowerCase();
        if (userBankInfo.loan.amount > 0 && userBankInfo.loan.dueDate && new Date() > new Date(userBankInfo.loan.dueDate)) { const now = new Date(); const twoHours = 2 * 60 * 60 * 1000; if (!userBankInfo.lastLoanWarning || (new Date() - new Date(userBankInfo.lastLoanWarning).getTime()) > twoHours) { message.reply(`🚨 Loan Payment Overdue!\nYour loan of ${formatNumber(userBankInfo.loan.amount)} is past its due date. Late payments may negatively affect your credit score. Use '${p}bank payloan' to make a payment.`); userBankInfo.lastLoanWarning = now; await updateUserBankData(senderID, userBankInfo, db); } }
        
        const sendCanvasReply = async (canvasFunction, messageBody = '', ...canvasArgs) => {
            try {
                const imagePath = await canvasFunction(...canvasArgs);
                if (!imagePath) return message.reply("Sorry, there was an error generating the image, or there is no data to display.");
                message.reply({ body: messageBody, attachment: fs.createReadStream(imagePath) }, (err, info) => {
                    if (err) console.error("Canvas Reply Error:", err);
                    fs.unlink(imagePath, (unlinkErr) => { if (unlinkErr) console.error("Failed to delete canvas file:", unlinkErr); });
                });
            } catch (e) { console.error("A critical error occurred in a canvas function:", e); message.reply("An error occurred while creating the visual content. Please try again."); }
        };
        
        const helpDetails = {
            creditcard: `💳 ${toBoldUnicode("Credit Card Guide")} 💳\n\n` +
                        `Use your credit card to make purchases and earn rewards!\n\n` +
                        `» ${p}bank creditcard apply - Get a new credit card.\n` +
                        `» ${p}bank creditcard view - (Canvas) See your limit, balance, and points.\n` +
                        `» ${p}bank creditcard use <amount> <description> - Make a purchase.\n` +
                        `» ${p}bank creditcard pay <amount> <pin> - Pay off your balance from your bank.\n` +
                        `» ${p}bank creditcard statement - View your recent transactions and due dates.\n` +
                        `» ${p}bank creditcard history - (Canvas) See a detailed transaction list.\n` +
                        `» ${p}bank creditcard redeem - See and redeem your reward points.\n` +
                        `» ${p}bank creditcard lock/unlock - Secure your card.\n` +
                        `» ${p}bank creditcard nickname <name> - Set a custom name for your card.`,
            stock: `💹 ${toBoldUnicode("Stock Market Guide")} 💹\n\n` +
                   `Trade on the Anchestor Stock Exchange.\n\n` +
                   `» ${p}bank stock market [page] - View the market.\n` +
                   `» ${p}bank stock portfolio - (Canvas) View your holdings.\n` +
                   `» ${p}bank stock buy <SYMBOL> <shares> <pin> - Buy shares.\n` +
                   `» ${p}bank stock sell <SYMBOL> <shares> <pin> - Sell shares.\n` +
                   `» ${p}bank stock short <SYMBOL> <shares> <pin> - Bet against a stock.\n` +
                   `» ${p}bank stock cover <SYMBOL> <shares> <pin> - Close a short position.`
        };

        if (!command || command === 'help' || command === 'guide') {
            const helpCategory = args[1]?.toLowerCase();
            const categories = {
                'account': "👤 𝗔𝗖𝗖𝗢𝗨𝗡𝗧\n`" + `${p}bank daily` + "` - Claim daily reward\n`" + `${p}bank balance` + "` - Check balance\n`" + `${p}bank report` + "` - View financial report\n`" + `${p}bank networth` + "` - (Canvas) See net worth breakdown\n`" + `${p}bank tier` + "` - Check financial tier & perks\n`" + `${p}bank credit_score` + "` - Check credit score\n`" + `${p}bank digest` + "` - Get daily stock market summary",
                'career': "💼 𝗖𝗔𝗥𝗘𝗘𝗥\n`" + `${p}bank jobs list` + "` - See available jobs\n`" + `${p}bank jobs apply <name>` + "` - Apply for a job\n`" + `${p}bank work` + "` - Work your job for a salary\n`" + `${p}bank resign` + "` - Resign from your job",
                'atm': "💳 𝗖𝗔𝗥𝗗 & 𝗔𝗧𝗠\n`" + `${p}bank create_card` + "` - Create your bank card\n`" + `${p}bank card` + "` - View your premium tiered card\n`" + `${p}bank atm` + "` - Access the interactive ATM\n`" + `${p}bank paybill` + "` - Pay outstanding bills directly",
                'assets': "🏘️ 𝗔𝗦𝗦𝗘𝗧𝗦\n`" + `${p}bank business` + "` list/buy/portfolio/collect\n`" + `${p}bank property` + "` market/buy/sell/collect/portfolio\n`" + `${p}bank insurance` + "` list/buy/status\n`" + `${p}bank leaderboard` + "` - View the wealthiest users",
                'market': "💹 𝗠𝗔𝗥𝗞𝗘𝗧\n`" + `${p}bank stock` + "` market/buy/sell/short/cover/portfolio\n`" + `${p}bank crypto` + "` market/buy/sell/mine/portfolio/setup\n`" + `${p}bank option` + "` buy/exercise - Trade stock options\n`" + `${p}bank invest` + "` list/buy/claim/sell/portfolio\n`" + `${p}bank ipo` + "` status/buy - Participate in IPOs\n`" + `${p}bank auction` + "` status/bid",
                'social': "👥 𝗦𝗢𝗖𝗜𝗔𝗟\n`" + `${p}bank corp` + "` create/invite/join/deposit/members/heist\n`" + `${p}bank phone` + "` - Access your smartphone\n`" + `${p}bank message` + "` <@mention> <msg> - Send a text\n`" + `${p}bank manager <message>` + "` - Chat with the AI Manager",
                'features': "🌟 𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦\n" + `  ${p}bank creditcard` + " ... (see help creditcard)\n`" + `${p}bank lottery` + "` status/buy/draw\n`" + `${p}bank tax` + "` status/file\n`" + `${p}bank achievements` + "` - View achievements\n`" + `${p}bank event_status` + "` - Check market events",
                'utilities': "⚙️ 𝗨𝗧𝗜𝗟𝗜𝗧𝗜𝗘𝗦\n`" + `${p}bank calculate <expression>` + "` - In-game calculator\n`" + `${p}bank research` + "` stock/crypto/property <ID>\n`" + `${p}bank security` + "` - Manage account security\n`" + `${p}bank top <category>` + "` - View leaderboards for various stats\n`" + `${p}bank serverstats` + "` - See server-wide economic data"
            };
            if (helpCategory && categories[helpCategory]) return message.reply(toBoldUnicode(categories[helpCategory]));
            if (helpCategory && helpDetails[helpCategory]) return message.reply(helpDetails[helpCategory]);

            const mainGuide = toBoldUnicode("🏦 Anchestor Bank Main Menu 🏦\n\n") + `Use '${p}bank help <category>' for more info.\n` + `Example: ${p}bank help account\n\n` + "𝗖𝗔𝗧𝗘𝗚𝗢𝗥𝗜𝗘𝗦:\n" + Object.keys(categories).map(c => `» ${c}`).join("\n");
            return message.reply(mainGuide);
        }

        const commandString = args.join(" ").toLowerCase();
        let pinSensitiveCommands = ["withdraw", "transfer", "payloan", "cheque write", "invest buy", "invest sell", "stock sell", "stock buy", "stock short", "stock cover", "property sell", "market sell", "business buy", "creditcard pay"];
        let isSensitive = pinSensitiveCommands.some(cmd => commandString.startsWith(cmd));
        if (isSensitive && userBankInfo.card && userBankInfo.card.pin) { const providedPin = args[args.length - 1]; if (!/^\d{4}$/.test(providedPin) || providedPin !== userBankInfo.card.pin) { return message.reply(toBoldUnicode(`🔒 This action requires your 4-digit PIN. Please append it to the command.`)); } args.pop(); }

        const subcommand = args[1]?.toLowerCase();
        if (helpDetails[command] && !subcommand) {
            return message.reply(helpDetails[command]);
        }

        switch (command) {
            case "achievements": { return sendCanvasReply(drawAchievementsCanvas, '', userBankInfo.achievements); }
            case "atm": {
                if (!userBankInfo.card || !userBankInfo.card.pin) return message.reply(`You need an Anchestor Bank card. Create one with: ${p}bank create_card`);
                if (atmSessions.has(senderID)) return message.reply("You already have an active ATM session.");
                const session = { step: 'awaiting_pin', pinInput: '', keypadLayout: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].sort(() => Math.random() - 0.5) }; atmSessions.set(senderID, session);
                try { const imagePath = await drawModernAtmCanvas(session); message.reply({ body: "Welcome to the Anchestor Bank ATM. Please reply with your 4-digit PIN to begin.", attachment: fs.createReadStream(imagePath) }, (err, info) => { if (err) return; fs.unlink(imagePath, e => e && console.error(e)); global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: senderID, type: 'atm_flow' }); }); } catch(e) { console.error(e); message.reply("ATM is currently offline."); atmSessions.delete(senderID); }
                return;
            }
            case "auction": {
                await manageAuctionCycle();
                const subCmd = args[1]?.toLowerCase();
                if (subCmd === 'status') {
                    if (!currentAuction) return message.reply("There is no active auction right now. One will begin shortly.");
                    const timeLeft = Math.max(0, currentAuction.endTime - Date.now());
                    const minutes = Math.floor(timeLeft / 60000);
                    const seconds = Math.floor((timeLeft % 60000) / 1000);
                    let statusMsg = `**🔥 Live Auction! 🔥**\n\n` +
                                    `**Item:** ${currentAuction.itemName}\n` +
                                    `**Current Bid:** ${formatNumber(currentAuction.currentBid)}\n` +
                                    `**Highest Bidder:** ${currentAuction.highestBidderName}\n` +
                                    `**Time Left:** ${minutes}m ${seconds}s\n\n` +
                                    `Use '${p}bank auction bid <amount>' to place a bid.`;
                    return message.reply(statusMsg);
                }
                if (subCmd === 'bid') {
                    if (!currentAuction) return message.reply("The auction has not started yet.");
                    if (Date.now() > currentAuction.endTime) return message.reply("This auction has ended.");
                    const bidAmount = parseFloat(args[2]);
                    if (isNaN(bidAmount)) return message.reply("Invalid bid amount.");
                    if (bidAmount <= currentAuction.currentBid) return message.reply(`Your bid must be higher than the current bid of ${formatNumber(currentAuction.currentBid)}.`);
                    if (bidAmount > userBankInfo.bank) return message.reply("You do not have enough money in your bank for this bid.");
                    if (currentAuction.highestBidderId) {
                        const previousBidderData = await getUserBankData(currentAuction.highestBidderId, db);
                        if (previousBidderData) {
                            previousBidderData.bank += currentAuction.currentBid;
                            await updateUserBankData(currentAuction.highestBidderId, previousBidderData, db);
                        }
                    }
                    userBankInfo.bank -= bidAmount;
                    await updateUserBankData(senderID, userBankInfo, db);
                    currentAuction.currentBid = bidAmount;
                    currentAuction.highestBidderId = senderID;
                    currentAuction.highestBidderName = await usersData.getName(senderID);
                    return message.reply(`You are now the highest bidder for the ${currentAuction.itemName} with a bid of ${formatNumber(bidAmount)}!`);
                }
                return message.reply("Invalid auction command. Use 'status' or 'bid'.");
            }
            case "balance": { let targetId = senderID; if (Object.keys(event.mentions).length > 0) targetId = Object.keys(event.mentions)[0]; else if (event.type === "message_reply") targetId = event.messageReply.senderID; const targetBankData = await getUserBankData(targetId, db); if(!targetBankData) return message.reply("This user does not have a bank account."); const targetCash = await usersData.get(targetId, "money") || 0; const targetName = await usersData.getName(targetId); const balanceTitle = targetId === senderID ? "Your Financial Overview" : `${targetName}'s Financial Overview`; return message.reply(toBoldUnicode(`📊 ${balanceTitle} 📊\n\n💵 Cash: ${formatNumber(targetCash)}\n🏦 Bank: ${formatNumber(targetBankData.bank)}`)); }
            case "business": { const subCmd = args[1]?.toLowerCase(); if (!subCmd || subCmd === 'help') return message.reply(`Please specify a business action: list, buy, portfolio, collect.`); if (subCmd === 'list') { let listMsg = toBoldUnicode("🏢 Businesses For Sale 🏢\n\n"); availableBusinesses.forEach(b => listMsg += `${toBoldUnicode(b.id)}: ${b.name}\nCost: ${formatNumber(b.cost)}\nIncome: ~${formatNumber(b.baseIncome)}/hr\n---\n`); return message.reply(listMsg + `Use ${p}bank business buy <ID>`); } if (subCmd === 'buy') { const businessId = args[2]?.toUpperCase(); const businessToBuy = availableBusinesses.find(b => b.id === businessId); if (!businessToBuy) return message.reply(`Invalid business ID.`); if (userBankInfo.businesses.some(b => b.businessId === businessId)) return message.reply("You already own this type of business."); if (businessToBuy.cost > userCash) return message.reply(`Insufficient cash. You need ${formatNumber(businessToBuy.cost)}.`); await usersData.set(senderID, { money: userCash - businessToBuy.cost }); userBankInfo.businesses.push({ businessId: businessToBuy.id, lastCollected: new Date() }); await awardAchievement('FIRST_BIZ'); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "BUSINESS_BUY", event, {business: businessId, cost: businessToBuy.cost}); return message.reply(`Congratulations! You are now the owner of ${businessToBuy.name}.`); } if (subCmd === 'portfolio') { if (userBankInfo.businesses.length === 0) return message.reply("You do not own any businesses."); let portMsg = toBoldUnicode("📈 Your Business Portfolio 📈\n\n"); userBankInfo.businesses.forEach(owned => { const details = availableBusinesses.find(b => b.id === owned.businessId); portMsg += `${toBoldUnicode(details.name)}\nIncome: ~${formatNumber(details.baseIncome)}/hr\n---\n`; }); return message.reply(portMsg + `Use ${p}bank business collect to get your profits.`); } if (subCmd === 'collect') { if (userBankInfo.businesses.length === 0) return message.reply("You do not own any businesses to collect profits from."); let totalProfit = 0; const now = new Date(); userBankInfo.businesses.forEach(owned => { const details = availableBusinesses.find(b => b.id === owned.businessId); const hoursSinceCollected = (now.getTime() - new Date(owned.lastCollected).getTime()) / 36e5; const profit = Math.floor(hoursSinceCollected * details.baseIncome); totalProfit += profit; owned.lastCollected = now; }); if (totalProfit <= 0) return message.reply("It's too soon to collect profits. Wait a while longer."); const taxAmount = totalProfit * INCOME_TAX_RATE; const netProfit = totalProfit - taxAmount; userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + totalProfit; userBankInfo.bank += netProfit; userBankInfo.taxPaid += taxAmount; await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "BUSINESS_COLLECT", event, {amount: netProfit, tax: taxAmount}); return message.reply(`You collected a total of ${formatNumber(totalProfit)} from your businesses. After a ${formatNumber(taxAmount)} tax, ${formatNumber(netProfit)} has been deposited into your bank.`); } return message.reply(`Invalid business command.`); }
            case "card": { 
                if (!userBankInfo.card || !userBankInfo.card.number) return message.reply(`You don't have a card yet. Create one with: ${p}bank create_card`);
                const stockValue = (userBankInfo.stocks || []).reduce((s, st) => s + (stockMarket[st.symbol]?.price * st.shares || 0), 0); const propertyValue = (userBankInfo.properties || []).reduce((s, p) => (propertyMarket.find(prop => prop.id === p.assetId)?.price || 0) + s, 0);
                const netWorth = userBankInfo.bank + userCash + stockValue + propertyValue; const cardHolderName = await usersData.getName(senderID); const currentTierName = getTierByNetWorth(netWorth);
                return sendCanvasReply(drawBankCardCanvas, `Here is your Anchestor ${currentTierName} card.`, userBankInfo, cardHolderName, netWorth);
            }
            case "cheque": { const chequeAction = args[1]?.toLowerCase(); const idArg = args[2]; const amtArg = args[3]; if (chequeAction === "write") { let recipientId = Object.keys(event.mentions)[0] || idArg; const chequeAmountStr = amtArg; const memo = args.slice(4).join(" ") || "N/A"; const chequeAmount = parseFloat(chequeAmountStr); if (!recipientId || isNaN(chequeAmount) || chequeAmount <= 0) return message.reply(`Invalid format.`); if (chequeAmount > userBankInfo.bank) return message.reply(`Insufficient bank balance.`); userBankInfo.bank -= chequeAmount; const chequeId = new ObjectId(); userBankInfo.cheques.issued.push({ chequeId, senderId: senderID, recipientId: String(recipientId), amount: chequeAmount, memo, dateIssued: new Date(), status: 'pending' }); await updateUserBankData(senderID, userBankInfo, db); const recipientName = await usersData.getName(String(recipientId)) || `User ${recipientId}`; await logAudit(db, "CHEQUE_WRITE", event, { to: String(recipientId), amount: chequeAmount }); return message.reply(`✅ Cheque ..${chequeId.toString().slice(-6)} written to ${recipientName}.`); } else if (chequeAction === "cash") { const chequeIdShort = idArg; if (!chequeIdShort) return message.reply("Provide cheque ID suffix."); const bankDatas = await db.collection(BANK_COLLECTION).find({ "cheques.issued.chequeId": {$exists: true} }).toArray(); let foundCheque = null; let issuerBankData = null; for (const data of bankDatas) { const chq = data.cheques.issued.find(c => c.chequeId.toString().endsWith(chequeIdShort) && c.status === 'pending'); if (chq) { if (String(chq.recipientId) !== senderID) return message.reply("Cheque not for you."); foundCheque = chq; issuerBankData = data; break; } } if (!foundCheque) return message.reply(`Cheque ..${chequeIdShort} not found/valid.`); userBankInfo.bank += foundCheque.amount; foundCheque.status = 'cashed'; foundCheque.dateCashed = new Date(); await updateUserBankData(senderID, userBankInfo, db); const issuedChqInSender = issuerBankData.cheques.issued.find(c => c.chequeId.equals(foundCheque.chequeId)); if(issuedChqInSender) issuedChqInSender.status = 'cashed'; await updateUserBankData(String(foundCheque.senderId), issuerBankData, db); await logAudit(db, "CHEQUE_CASH", event, { from: String(foundCheque.senderId), amount: foundCheque.amount, chequeId: foundCheque.chequeId }); return message.reply(`✅ Cashed cheque for ${formatNumber(foundCheque.amount)}.`); } else if (chequeAction === "list") { const listType = idArg?.toLowerCase() || "sent"; let chequesToList = []; let listTitle = ""; if (listType === "sent") { listTitle = "📜 Issued Cheques 📜"; chequesToList = userBankInfo.cheques.issued; } else if (listType === "received") { listTitle = "📬 Receivable Cheques 📬"; const allIssued = (await db.collection(BANK_COLLECTION).find({ "cheques.issued.recipientId": senderID, "cheques.issued.status": "pending" }).toArray()).flatMap(d => d.cheques.issued.filter(c => c.recipientId === senderID && c.status === 'pending')); chequesToList = allIssued; } else { return message.reply("Invalid list type: sent, received."); } if (chequesToList.length === 0) return message.reply(`📭 No cheques for '${listType}'.`); let listMsg = toBoldUnicode(`${listTitle}\n\n`); for(const c of chequesToList.slice(-10).reverse()){ const oPID = listType === "sent" ? c.recipientId : c.senderId; const oPN = await usersData.getName(String(oPID)) || `User ${oPID}`; listMsg += `ID: ..${c.chequeId.toString().slice(-6)} | ${listType === "sent" ? "To" : "From"}: ${toBoldUnicode(oPN)}\n Amt: ${formatNumber(c.amount)} | Sts: ${toBoldUnicode(c.status)}\n---\n`; } return message.reply(listMsg); } return message.reply("Invalid cheque command."); }
            case "corp": {
                const subCmd = args[1]?.toLowerCase(); const corpCollection = db.collection(CORP_COLLECTION);
                if(subCmd === 'create'){ const corpName = args.slice(2).join(" "); if(!corpName) return message.reply("Please provide a name for your corporation."); if(userBankInfo.corporation.id) return message.reply("You are already in a corporation."); if(userBankInfo.bank < CORP_CREATION_FEE) return message.reply(`You need ${formatNumber(CORP_CREATION_FEE)} to found a corporation.`); userBankInfo.bank -= CORP_CREATION_FEE; const newCorp = { name: corpName, ceoId: senderID, members: [senderID], treasury: 0, level: 1, createdAt: new Date(), heist: { active: false } }; const result = await corpCollection.insertOne(newCorp); userBankInfo.corporation = { id: result.insertedId.toString(), name: corpName, rank: 'CEO' }; await updateUserBankData(senderID, userBankInfo, db); await awardAchievement('CORP_FOUNDER'); return message.reply(`You have successfully founded **${corpName}**!`); }
                if(!userBankInfo.corporation.id) return message.reply("You are not part of a corporation.");
                let corpData = await corpCollection.findOne({ _id: new ObjectId(userBankInfo.corporation.id) });
                if(!corpData) return message.reply("Your corporation data could not be found. This may be an error.");
                if(subCmd === 'invite'){ if(userBankInfo.corporation.rank !== 'CEO') return message.reply("Only the CEO can invite new members."); const targetId = Object.keys(event.mentions)[0]; if(!targetId) return message.reply("Please mention a user to invite."); const targetData = await getUserBankData(targetId, db); if(targetData.corporation.id) return message.reply("This user is already in a corporation."); await corpCollection.updateOne({ _id: corpData._id }, { $addToSet: { invites: targetId } }); api.sendMessage(`You have been invited to join **${corpData.name}**. Use '${p}bank corp join ${corpData.name}' to accept.`, event.threadID, () => {}, targetId); return message.reply(`An invitation has been sent to the user.`); }
                if(subCmd === 'join'){ const corpName = args.slice(2).join(" "); const corpToJoin = await corpCollection.findOne({ name: corpName, invites: senderID }); if(!corpToJoin) return message.reply("You have not been invited to this corporation or it does not exist."); userBankInfo.corporation = { id: corpToJoin._id.toString(), name: corpToJoin.name, rank: 'Member' }; await corpCollection.updateOne({ _id: corpToJoin._id }, { $pull: { invites: senderID }, $push: { members: senderID } }); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`You have successfully joined **${corpToJoin.name}**!`); }
                if(subCmd === 'deposit'){ const amount = parseFloat(args[2]); if(isNaN(amount) || amount <= 0) return message.reply("Invalid amount."); if(userBankInfo.bank < amount) return message.reply("Insufficient funds."); userBankInfo.bank -= amount; await corpCollection.updateOne({ _id: corpData._id }, { $inc: { treasury: amount } }); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully deposited ${formatNumber(amount)} into the corporate treasury.`); }
                if(subCmd === 'members'){ let memberList = `**${corpData.name} - Member List**\n\n`; for(const memberId of corpData.members){ const memberName = await usersData.getName(memberId); const memberData = await getUserBankData(memberId, db); memberList += `- ${memberName} [${memberData.corporation.rank}]\n`; } return message.reply(memberList); }
                if(subCmd === 'heist'){ if(userBankInfo.corporation.rank !== 'CEO') return message.reply("Only the CEO can initiate a heist."); if(corpData.heist && corpData.heist.active) return message.reply("A heist is already in progress!"); const setupCost = 50000000; if(corpData.treasury < setupCost) return message.reply(`The corporation needs ${formatNumber(setupCost)} in its treasury to start a heist.`); const newHeist = { active: true, stage: 1, successPoints: 0, startTime: new Date() }; await corpCollection.updateOne({ _id: corpData._id }, { $set: { heist: newHeist }, $inc: { treasury: -setupCost }}); return message.reply(`**Bank Heist Initiated!**\n\nYour corporation has paid ${formatNumber(setupCost)} to begin the heist on the Anchestor Reserve. You have 1 hour to complete all stages.\n\n**Stage 1: RECON**\nAll members must now use \`${p}bank corp heist recon\` to gather intel. Good luck.`); }
                if(subCmd === 'recon' || subCmd === 'breach' || subCmd === 'escape'){ if(!corpData.heist || !corpData.heist.active) return message.reply("There is no active heist for your corporation."); const success = Math.random() < 0.6; if(success){ await corpCollection.updateOne({ _id: corpData._id }, { $inc: { 'heist.successPoints': 1 } }); return message.reply("Your action was a success! You've contributed to the heist."); } else { return message.reply("Your action failed and drew attention. Try again!"); } }
                 return message.reply("Invalid corporation command.");
            }
            case "create_card": case "create": { if (userBankInfo.card && userBankInfo.card.number) return message.reply(`You already have an Anchestor Bank card.`); message.reply("Please reply with a 4-digit PIN for your new ATM card.", (err, info) => { if (err) return; global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: event.senderID, type: 'card_creation' }); }); return; }
            case "credit_score": case "credit": { const score = await calculateCreditScore(userBankInfo, userCash); userBankInfo.creditScore = score; await updateUserBankData(senderID, userBankInfo, db); if (score >= 800) await awardAchievement('CREDIT_PRO'); let rating; if (score < 580) rating = "Poor"; else if (score < 670) rating = "Fair"; else if (score < 740) rating = "Good"; else if (score < 800) rating = "Very Good"; else rating = "Excellent"; return message.reply(`Your Anchestor Bank credit score is: ${toBoldUnicode(score)} (${toBoldUnicode(rating)})`); }
            case "creditcard": {
                userBankInfo = await processCycle(userBankInfo); await updateUserBankData(senderID, userBankInfo, db);
                const subCmd = args[1]?.toLowerCase(); if (!subCmd || subCmd === 'help') return message.reply(helpDetails.creditcard);
                const cc = userBankInfo.creditCard;
                if (subCmd === 'apply') { if (cc.issued) return message.reply("You already have a credit card."); if(userBankInfo.creditScore < 650 || userBankInfo.bank < 50000) return message.reply(`You do not meet the minimum requirements (650 credit score, ${formatNumber(50000)} in bank).`); cc.issued = true; cc.balance = 0; cc.limit = Math.max(5000, userBankInfo.creditScore * 10); cc.rewards = { points: 0 }; cc.transactionHistory = []; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Congratulations! Your Anchestor Credit Card application was approved with a limit of ${formatNumber(cc.limit)}!\nUse '${p}bank card' to see it.`); }
                if (!cc.issued) return message.reply(`You do not have a credit card. Use '${p}bank creditcard apply'.`);
                if (subCmd === 'view') { return sendCanvasReply(drawCreditCardViewCanvas, '', userBankInfo); }
                if (subCmd === 'history') { return sendCanvasReply(drawCreditCardHistoryCanvas, '', userBankInfo); }
                if (subCmd === 'lock') { cc.locked = true; await updateUserBankData(senderID, userBankInfo, db); return message.reply("🔒 Your credit card has been locked."); }
                if (subCmd === 'unlock') { cc.locked = false; await updateUserBankData(senderID, userBankInfo, db); return message.reply("🔓 Your credit card has been unlocked."); }
                if (subCmd === 'nickname') { const name = args.slice(2).join(" "); if (!name) return message.reply("Please provide a nickname."); cc.nickname = name; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Your card's nickname has been set to: ${name}`); }
                if (subCmd === 'statement') { let statement = toBoldUnicode("Credit Card Statement\n\n"); statement += `Statement Balance: ${toBoldUnicode(formatNumber(cc.statement.balance))}\n`; statement += `Due Date: ${toBoldUnicode(new Date(cc.statement.dueDate).toLocaleDateString())}\n\n`; statement += toBoldUnicode("Recent Transactions:\n"); if (!cc.transactionHistory || cc.transactionHistory.length === 0) { statement += "No transactions in this period."; } else { cc.transactionHistory.slice(-5).forEach(t => { statement += `[${new Date(t.date).toLocaleDateString()}] ${t.type}: ${formatNumber(t.amount)}\n`; }); } return message.reply(statement); }
                if (subCmd === 'request_limit') { if (userBankInfo.creditScore < 700) return message.reply("Your credit score is too low for a limit increase. Please improve it and try again."); const increaseAmount = cc.limit * 0.25; cc.limit += increaseAmount; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Congratulations! Your credit limit has been increased by ${formatNumber(increaseAmount)}. Your new limit is ${formatNumber(cc.limit)}.`); }
                if (subCmd === 'use') { if (cc.locked) return message.reply("Your credit card is locked. Use `creditcard unlock` to use it."); const amount = parseFloat(args[2]); const description = args.slice(3).join(" ") || "Purchase"; if (isNaN(amount) || amount <= 0) return message.reply("Invalid amount."); if (amount > (cc.limit - cc.balance)) return message.reply(`Transaction declined. This would exceed your credit limit. Available: ${formatNumber(cc.limit - cc.balance)}.`); cc.balance += amount; const earnedPoints = Math.floor(amount / 10); cc.rewards.points = (cc.rewards.points || 0) + earnedPoints; cc.transactionHistory.push({ type: description, amount: amount, date: new Date() }); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully charged ${formatNumber(amount)} to your credit card. Your new balance is ${formatNumber(cc.balance)}. You earned ${earnedPoints} reward points.`); }
                if (subCmd === 'redeem') { let reply = toBoldUnicode("🎁 Credit Card Rewards 🎁\n\n"); reply += `Your points: ${(cc.rewards.points || 0).toLocaleString()}\n\n`; Object.entries(CREDIT_REDEEM_OPTIONS).forEach(([id, opt]) => { reply += `${opt.description} » '${p}bank creditcard redeem ${id}'\n`; }); const redeemId = args[2]?.toLowerCase(); if (!redeemId) return message.reply(reply); const option = CREDIT_REDEEM_OPTIONS[redeemId]; if (!option) return message.reply("Invalid reward option."); if ((cc.rewards.points || 0) < option.points) return message.reply(`You need ${option.points.toLocaleString()} points for that.`); cc.rewards.points -= option.points; if (option.type === 'cash') { userBankInfo.bank += option.value; } await updateUserBankData(senderID, userBankInfo, db); return message.reply(`✅ Successfully redeemed ${option.points.toLocaleString()} points for ${formatNumber(option.value)}!`); }
                if (subCmd === 'pay') { const amount = parseFloat(args[2]); if (isNaN(amount) || amount <= 0) return message.reply("Invalid amount."); if (amount > userBankInfo.bank) return message.reply(`Insufficient funds in your bank account.`); const payment = Math.min(amount, cc.balance); cc.balance -= payment; if(cc.statement.balance > 0) cc.statement.balance = Math.max(0, cc.statement.balance - payment); if(cc.statement.balance <= 0) cc.statement.paid = true; userBankInfo.bank -= payment; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Thank you for your payment of ${formatNumber(payment)}. Your remaining balance is ${formatNumber(cc.balance)}.`); }
                return message.reply(helpDetails.creditcard);
            }
            case "crypto": {
                const subCmd = args[1]?.toLowerCase();
                const symbol = args[2]?.toUpperCase();
                const amount = parseFloat(args[3]);
                if (subCmd === 'market') {
                    const page = parseInt(args[2]) || 1;
                    return sendCanvasReply(drawCryptoMarketCanvas, `Use '${p}bank crypto market [page_number]' to navigate.`, page);
                }
                if (subCmd === 'buy') {
                    if (!symbol || !cryptoMarket[symbol]) return message.reply("Invalid crypto symbol.");
                    if (isNaN(amount) || amount <= 0) return message.reply("Invalid amount.");
                    const cost = cryptoMarket[symbol].price * amount;
                    if (cost > userCash) return message.reply(`Insufficient cash. You need ${formatNumber(cost)}.`);
                    await usersData.set(senderID, { money: userCash - cost });
                    let holding = userBankInfo.crypto.find(c => c.symbol === symbol);
                    if (holding) {
                        holding.amount += amount;
                    } else {
                        userBankInfo.crypto.push({ symbol, amount });
                    }
                    await updateUserBankData(senderID, userBankInfo, db);
                    return message.reply(`Successfully bought ${amount} ${symbol} for ${formatNumber(cost)}.`);
                }
                if (subCmd === 'sell') {
                    if (!symbol || !cryptoMarket[symbol]) return message.reply("Invalid crypto symbol.");
                    if (isNaN(amount) || amount <= 0) return message.reply("Invalid amount.");
                    let holding = userBankInfo.crypto.find(c => c.symbol === symbol);
                    if (!holding || holding.amount < amount) return message.reply(`You do not have enough ${symbol} to sell. You have ${holding ? holding.amount : 0}.`);
                    const proceeds = cryptoMarket[symbol].price * amount;
                    await usersData.set(senderID, { money: userCash + proceeds });
                    holding.amount -= amount;
                    if (holding.amount <= 0) {
                        userBankInfo.crypto = userBankInfo.crypto.filter(c => c.symbol !== symbol);
                    }
                    await updateUserBankData(senderID, userBankInfo, db);
                    return message.reply(`Successfully sold ${amount} ${symbol} for ${formatNumber(proceeds)}.`);
                }
                if (subCmd === 'mine') {
                    const rig = MINING_RIGS[`level${userBankInfo.mining.rigLevel}`];
                    if (!rig) return message.reply("You don't have a mining rig. Use 'crypto setup' to buy one.");
                    if (userBankInfo.mining.lastMined) {
                        const cooldown = rig.cooldownHours * 3600000;
                        const timeSince = Date.now() - new Date(userBankInfo.mining.lastMined).getTime();
                        if (timeSince < cooldown) {
                            const remaining = cooldown - timeSince;
                            const hours = Math.floor(remaining / 3600000);
                            const minutes = Math.floor((remaining % 3600000) / 60000);
                            return message.reply(`Your mining rig is cooling down. You can mine again in ${hours}h and ${minutes}m.`);
                        }
                    }
                    const reward = rig.rewardPerCycle * (0.8 + Math.random() * 0.4);
                    let holding = userBankInfo.crypto.find(c => c.symbol === rig.crypto);
                    if (holding) {
                        holding.amount += reward;
                    } else {
                        userBankInfo.crypto.push({ symbol: rig.crypto, amount: reward });
                    }
                    userBankInfo.mining.lastMined = new Date();
                    await updateUserBankData(senderID, userBankInfo, db);
                    return message.reply(`Your ${rig.name} successfully mined ${reward.toFixed(6)} ${rig.crypto}!`);
                }
                if (subCmd === 'portfolio') {
                    if (!userBankInfo.crypto || userBankInfo.crypto.length === 0) {
                        return message.reply("You do not own any cryptocurrency.");
                    }
                    let portMsg = toBoldUnicode("💎 Your Crypto Portfolio 💎\n\n");
                    let totalValue = 0;
                    for (const holding of userBankInfo.crypto) {
                        const marketData = cryptoMarket[holding.symbol];
                        if (marketData) {
                            const value = holding.amount * marketData.price;
                            totalValue += value;
                            portMsg += `${toBoldUnicode(holding.symbol)}: ${holding.amount.toFixed(6)}\n` +
                                       `Value: ${formatNumber(value)}\n---\n`;
                        }
                    }
                    portMsg += `\n${toBoldUnicode("Total Crypto Value:")} ${formatNumber(totalValue)}`;
                    return message.reply(portMsg);
                }
                if (subCmd === 'setup') {
                    let setupMsg = "**Mining Rig Shop**\n\n";
                    for (const [levelId, rig] of Object.entries(MINING_RIGS)) {
                        const level = levelId.replace('level', '');
                        setupMsg += `**Level ${level}: ${rig.name}**\nCost: ${formatNumber(rig.cost)}\nMines: ${rig.crypto}\nCooldown: ${rig.cooldownHours}h\n\n`;
                    }
                    setupMsg += `Use '${p}bank crypto setup buy <level>' to purchase or upgrade a rig.`;
                    const buyLevel = args[3];
                    if (args[2]?.toLowerCase() === 'buy' && buyLevel) {
                        const rigToBuy = MINING_RIGS[`level${buyLevel}`];
                        if (!rigToBuy) return message.reply("Invalid rig level.");
                        if (parseInt(buyLevel) <= userBankInfo.mining.rigLevel) return message.reply("You already have this rig or a better one.");
                        if (rigToBuy.cost > userCash) return message.reply(`You need ${formatNumber(rigToBuy.cost)} to buy the ${rigToBuy.name}.`);
                        await usersData.set(senderID, { money: userCash - rigToBuy.cost });
                        userBankInfo.mining.rigLevel = parseInt(buyLevel);
                        await updateUserBankData(senderID, userBankInfo, db);
                        return message.reply(`Congratulations! You've purchased the ${rigToBuy.name}. Use '${p}bank crypto mine' to start mining!`);
                    }
                    return message.reply(setupMsg);
                }
                return message.reply("Invalid crypto command. Use `market`, `buy`, `sell`, `mine`, `portfolio` or `setup`.");
            }
            case "daily": { const now = new Date(); const lastClaim = userBankInfo.daily.lastClaimed ? new Date(userBankInfo.daily.lastClaimed) : null; let canClaim = false; if (!lastClaim) { canClaim = true; } else { const nextClaimTime = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate() + 1); if (now >= nextClaimTime) { canClaim = true; } } if (!canClaim) { const nextClaimTime = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate() + 1); const timeRemaining = nextClaimTime - now; const hours = Math.floor(timeRemaining / 3600000); const minutes = Math.floor((timeRemaining % 3600000) / 60000); return message.reply(`You've already claimed your daily reward. Please wait ${hours}h ${minutes}m.`); } const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1); if (lastClaim && lastClaim.toDateString() === yesterday.toDateString()) { userBankInfo.daily.streak = (userBankInfo.daily.streak || 0) + 1; } else { userBankInfo.daily.streak = 1; } const baseReward = 2500; const streakBonus = Math.min(userBankInfo.daily.streak * 500, 5000); const totalReward = baseReward + streakBonus; userBankInfo.bank += totalReward; userBankInfo.daily.lastClaimed = now; await updateUserBankData(senderID, userBankInfo, db); let replyMsg = `✅ You claimed your daily reward of ${formatNumber(totalReward)}!`; if (userBankInfo.daily.streak > 1) { replyMsg += `\n🔥 You're on a ${userBankInfo.daily.streak}-day streak! Keep it up for bigger bonuses!`; } return message.reply(replyMsg); }
            case "deposit": { const amount = parseFloat(args[1]); if (isNaN(amount) || amount <= 0) return message.reply(`Invalid amount.`); if (amount > userCash) return message.reply(`Insufficient cash.`); userCash -= amount; userBankInfo.bank += amount; await usersData.set(senderID, { money: userCash }); await awardAchievement('FIRST_DEPOSIT'); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "DEPOSIT", event, { amount }); return message.reply(`✅ Deposited ${formatNumber(amount)}.`); }
            case "digest": { const stockChanges = Object.entries(stockMarket).map(([symbol, data]) => ({ symbol, name: data.name, dailyChange: data.dailyChange || 0 })); stockChanges.sort((a,b) => b.dailyChange - a.dailyChange); const gainers = stockChanges.slice(0, 3); const losers = stockChanges.slice(-3).reverse(); const analysisPrompt = "Provide a brief, one-paragraph market analysis for today based on the current top performing stocks."; const analysisText = await getAiResponse(analysisPrompt); return sendCanvasReply(drawDigestCanvas, '', gainers, losers, analysisText); }
            case "event_status": { if (currentIpo) { const timeLeft = Math.round((currentIpo.endTime - Date.now()) / 60000); return message.reply(`📢 Initial Public Offering (IPO) Active!\nCompany: ${toBoldUnicode(currentIpo.name)} (${toBoldUnicode(currentIpo.symbol)})\nPrice: ${formatNumber(currentIpo.price)} per share\nTime Left to Buy: ~${timeLeft} minutes.\nUse '${p}bank ipo buy <shares>' to participate!`); } if (marketEvent) { const timeLeft = Math.round((marketEvent.endTime - Date.now()) / 60000); let eventMsg = `🚨 Active Event: ${toBoldUnicode(marketEvent.name)}\n`; if (marketEvent.type === 'buyout') eventMsg += `A corporation is offering to buy all ${marketEvent.businessId} businesses for a ${marketEvent.premium*100}% premium! Use '${p}bank accept_buyout' to sell.`; else eventMsg += `This event is causing unusual market movements.`; eventMsg += `\nTime remaining: ~${timeLeft} minutes.`; return message.reply(eventMsg); } else { return message.reply("The market is currently stable. There are no active global events."); } }
            case "accept_buyout": { if (!marketEvent || marketEvent.type !== 'buyout') return message.reply("There is no active buyout event."); const businessToSell = userBankInfo.businesses.find(b => b.businessId === marketEvent.businessId); if (!businessToSell) return message.reply(`You do not own a ${marketEvent.businessId} to sell.`); const businessDetails = availableBusinesses.find(b => b.id === businessToSell.businessId); const salePrice = businessDetails.cost * marketEvent.premium; userBankInfo.businesses = userBankInfo.businesses.filter(b => b.businessId !== marketEvent.businessId); userBankInfo.bank += salePrice; await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "BUYOUT_ACCEPT", event, {business: businessToSell.businessId, price: salePrice}); return message.reply(`Congratulations! You accepted the buyout offer for your ${businessDetails.name} and received ${formatNumber(salePrice)}.`); }
            case "insurance": { const subCmd = args[1]?.toLowerCase(); if (!subCmd) return message.reply(`Please specify an insurance action.\nExample: ${p}bank insurance list`); if (subCmd === 'list') return message.reply(`Property Insurance:\nProtect your real estate from disaster!\n- Cost: 5% of property value\n- Duration: 30 days\n\nUse '${p}bank insurance buy <property_id>'`); if (subCmd === 'buy') { const propId = args[2]?.toUpperCase(); const prop = userBankInfo.properties.find(p => p.assetId === propId); if (!prop) return message.reply(`You do not own a property with this ID.`); if (userBankInfo.insurance.some(i => i.assetId === propId)) return message.reply("This property is already insured."); const baseProp = propertyMarket.find(p => p.id === prop.assetId); const premium = baseProp.price * 0.05; if (premium > userCash) return message.reply(`You need ${formatNumber(premium)} to insure this property.`); await usersData.set(senderID, { money: userCash - premium }); const expiryDate = new Date(Date.now() + 30 * 86400000); userBankInfo.insurance.push({ assetId: prop.assetId, name: prop.name, expiryDate }); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "INSURANCE_BUY", event, {asset: propId, premium}); return message.reply(`Successfully insured your ${prop.name} for 30 days.`); } return message.reply(`Invalid insurance command.`); }
            case "invest": { const investAction = args[1]?.toLowerCase(); const idArg = args[2]; const amtArg = args[3]; if (investAction === "list") { let listMsg = toBoldUnicode("📈 Investments 📈\n\n"); investmentOptions.forEach(opt => listMsg += `${toBoldUnicode(opt.id)} - ${toBoldUnicode(opt.name)}\n Type: ${opt.type}, Risk: ${opt.riskLevel}\n ${opt.type==='fund'?'Avg.Ret':'Int'}: ${((opt.avgReturn||opt.interestRate)*100).toFixed(1)}% (~${opt.durationDays}d)\n Min: ${formatNumber(opt.minAmount)}\n---\n`); return message.reply(listMsg + `Use ${p}bank invest buy <ID> <amount>`); } else if (investAction === "buy") { const optionId = idArg?.toUpperCase(); const investAmount = parseFloat(amtArg); const option = investmentOptions.find(o => o.id === optionId); if (!option || isNaN(investAmount)) return message.reply(`Invalid format.`); if (investAmount < option.minAmount) return message.reply(`Min for ${option.name} is ${formatNumber(option.minAmount)}.`); if (investAmount > userCash) return message.reply(`Insufficient cash.`); await usersData.set(senderID, { money: userCash - investAmount }); const invId = new ObjectId(); const pDate = new Date(); const mDate = new Date(pDate.getTime() + option.durationDays * 86400000); userBankInfo.investments.push({ investmentId: invId, optionId: option.id, name: option.name, principal: investAmount, purchaseDate: pDate, maturityDate: mDate, status: 'active', interestEarned: 0, interestRate: option.interestRate, avgReturn: option.avgReturn }); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "INVEST_BUY", event, { optionId, amount: investAmount }); return message.reply(`✅ Invested ${formatNumber(investAmount)} in ${option.name} (..${invId.toString().slice(-6)}).`); } else if (investAction === "portfolio") { if (userBankInfo.investments.length === 0) return message.reply("📊 No investments."); let portMsg = toBoldUnicode("📊 Investment Portfolio 📊\n\n"); let totalP = 0; userBankInfo.investments.forEach(inv => { totalP += inv.principal; const tL = inv.status==='active' ? Math.max(0,(new Date(inv.maturityDate).getTime()-new Date().getTime())/864e5) : 0; portMsg += `${toBoldUnicode(inv.name)} (ID: ..${inv.investmentId.toString().slice(-6)})\n Principal: ${formatNumber(inv.principal)} | Sts: ${toBoldUnicode(inv.status)}\n`; if(inv.status==='active') portMsg += ` Matures: ~${tL.toFixed(0)}d left\n`; else if(inv.status==='matured'||inv.status==='sold') portMsg += ` Returned: ${formatNumber(inv.principal+inv.interestEarned)}\n`; portMsg += `---\n`; }); return message.reply(portMsg + toBoldUnicode(`Total Principal: ${formatNumber(totalP)}`)); } else if (investAction === "sell" || investAction === "claim") { const invIdShort = idArg; const claimAll = invIdShort === 'all' && investAction === "claim"; if (!invIdShort && !claimAll) return message.reply("Provide Investment ID suffix or 'all'."); let toProcess = []; if (claimAll) { toProcess = userBankInfo.investments.filter(inv => inv.status === 'active' && new Date() >= new Date(inv.maturityDate)); if (toProcess.length === 0) return message.reply("No investments matured."); } else { const inv = userBankInfo.investments.find(i => i.investmentId.toString().endsWith(invIdShort)); if (!inv) return message.reply("Investment ID not found."); toProcess.push(inv); } let totalClaimed = 0; let repMsgs = []; for (const inv of toProcess) { if (investAction === "sell" && inv.status === 'active' && new Date() < new Date(inv.maturityDate)) { const penalty = inv.principal * EARLY_WITHDRAWAL_PENALTY_PERCENT; const amtRet = inv.principal - penalty; userCash += amtRet; inv.status = 'sold_early'; inv.interestEarned = -penalty; totalClaimed += amtRet; await logAudit(db, "INVEST_SELL", event, { invId: inv.investmentId, penalty }); repMsgs.push(`Sold ${inv.name} early for ${formatNumber(amtRet)} (Penalty: ${formatNumber(penalty)}).`); continue; } if (inv.status === 'active' && new Date() >= new Date(inv.maturityDate)) { const opt = investmentOptions.find(o => o.id === inv.optionId); let interest = 0; if (opt) { if (opt.type === 'bond') interest = inv.principal * (opt.interestRate||0); else if (opt.type === 'fund') interest = inv.principal * (opt.avgReturn||0) * (0.8 + Math.random()*0.4); } inv.interestEarned = parseFloat(interest.toFixed(2)); if (inv.interestEarned > 0) { userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + inv.interestEarned; } inv.status = 'matured'; const amtRet = inv.principal + inv.interestEarned; userCash += amtRet; totalClaimed += amtRet; await logAudit(db, "INVEST_CLAIM", event, { invId: inv.investmentId, amount: amtRet }); repMsgs.push(`Claimed ${inv.name}. Total: ${formatNumber(amtRet)} (Int: ${formatNumber(inv.interestEarned)}).`); } else if (inv.status !== 'active') repMsgs.push(`${inv.name} (..${inv.investmentId.toString().slice(-6)}) already ${inv.status}.`); else if (investAction === "claim") repMsgs.push(`${inv.name} (..${inv.investmentId.toString().slice(-6)}) not matured.`); } if (totalClaimed > 0) { await usersData.set(senderID, { money: userCash }); await updateUserBankData(senderID, userBankInfo, db); } return message.reply(toBoldUnicode(repMsgs.join("\n") + (totalClaimed > 0 ? `\nTotal to cash: ${formatNumber(totalClaimed)}` : ""))); } return message.reply("Invalid invest command."); }
            case "ipo": { const subCmd = args[1]?.toLowerCase(); if (!currentIpo) return message.reply("There is no active IPO at the moment."); if (subCmd === 'status') { const timeLeft = Math.round((currentIpo.endTime - Date.now()) / 60000); return message.reply(`📢 IPO Active: ${toBoldUnicode(currentIpo.name)} (${toBoldUnicode(currentIpo.symbol)})\nPrice: ${formatNumber(currentIpo.price)} per share\nTime Left: ~${timeLeft} minutes.\nUse '${p}bank ipo buy <shares>'`); } if (subCmd === 'buy') { const shares = parseInt(args[2]); if (isNaN(shares) || shares <= 0) return message.reply(`Invalid number of shares.`); const totalCost = currentIpo.price * shares; if (totalCost > userCash) return message.reply(`Insufficient cash. You need ${formatNumber(totalCost)}.`); await usersData.set(senderID, { money: userCash - totalCost }); let holding = userBankInfo.stocks.find(s => s.symbol === currentIpo.symbol); if (holding) { const tOV = holding.avgPrice * holding.shares; holding.shares += shares; holding.avgPrice = (tOV + totalCost) / holding.shares; } else userBankInfo.stocks.push({ symbol: currentIpo.symbol, shares, avgPrice: currentIpo.price, type: 'long' }); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "IPO_BUY", event, {symbol: currentIpo.symbol, shares, price: currentIpo.price}); return message.reply(`Successfully purchased ${shares} IPO shares of ${currentIpo.symbol}!`); } return message.reply(`Invalid IPO command. Use 'status' or 'buy'.`); }
            case "jobs": {
                const subCmd = args[1]?.toLowerCase();
                if (subCmd === 'list') { let replyMsg = toBoldUnicode("Available Jobs at Anchestor Corp\n\n"); for(const [id, job] of Object.entries(JOBS_LIST)) { replyMsg += `${toBoldUnicode(job.name)} (${p}bank jobs apply ${id})\n`; replyMsg += `Salary: ${formatNumber(job.salary)} | Cooldown: ${job.cooldownHours}h\n`; replyMsg += `Reqs: ${formatNumber(job.requirements.netWorth, true, 0)} Net Worth, ${job.requirements.creditScore} Credit Score\n---\n`; } return message.reply(replyMsg); }
                if (subCmd === 'apply') { const jobId = args[2]?.toLowerCase(); const job = JOBS_LIST[jobId]; if (!job) return message.reply("That job does not exist."); if (userBankInfo.job.title !== 'unemployed') return message.reply(`You already have a job as a ${userBankInfo.job.title}. You must resign first.`); const stockValue = (userBankInfo.stocks || []).reduce((s, st) => s + (stockMarket[st.symbol]?.price * st.shares || 0), 0); const propertyValue = (userBankInfo.properties || []).reduce((s, p) => (propertyMarket.find(prop => prop.id === p.assetId)?.price || 0) + s, 0); const netWorth = userBankInfo.bank + userCash + stockValue + propertyValue; if (netWorth < job.requirements.netWorth || userBankInfo.creditScore < job.requirements.creditScore) return message.reply("You do not meet the requirements for this job."); userBankInfo.job.title = job.name; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Congratulations! You have been hired as a ${job.name}. Use '${p}bank work' to earn your salary.`); }
                return message.reply(`Invalid job command. Use 'list' or 'apply'. You can also use '${p}bank work' and '${p}bank resign'.`);
            }
            case "leaderboard": {
                const topUsersData = await db.collection(BANK_COLLECTION).find().sort({ bank: -1 }).limit(10).toArray(); let leaderboard = [];
                for (const user of topUsersData) {
                    try {
                        const cash = await usersData.get(user.userId, "money") || 0;
                        const stockValue = (user.stocks || []).reduce((s, st) => s + (stockMarket[st.symbol]?.price * st.shares || 0), 0);
                        const propertyValue = (user.properties || []).reduce((s, p) => (propertyMarket.find(prop => prop.id === p.assetId)?.price || 0) + s, 0);
                        const netWorth = (user.bank || 0) + cash + stockValue + propertyValue;
                        const [name, avatar] = await Promise.all([usersData.getName(user.userId), usersData.getAvatarUrl(user.userId)]);
                        leaderboard.push({ name: name || "Unknown User", netWorth, avatar });
                    } catch (e) { continue; }
                }
                leaderboard.sort((a, b) => b.netWorth - a.netWorth);
                return sendCanvasReply(drawLeaderboardCanvas, '', leaderboard);
            }
            case "loan": { const loanAmount = parseFloat(args[1]); if (isNaN(loanAmount) || loanAmount <= 0) return message.reply(`Invalid amount.`); if (userBankInfo.loan.amount > 0) return message.reply(`You already have an outstanding loan.`); const creditScore = await calculateCreditScore(userBankInfo, userCash); const maxLoan = Math.floor(((userBankInfo.bank + userCash) * 0.25) + (creditScore * 100)); if (loanAmount > maxLoan) return message.reply(`Your maximum loan is ${formatNumber(maxLoan)}.`); userBankInfo.loan.amount = loanAmount; userBankInfo.loan.dueDate = new Date(Date.now() + 14 * 86400000); userBankInfo.bank += loanAmount; await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "LOAN_TAKE", event, {amount: loanAmount}); return message.reply(`Loan approved! ${formatNumber(loanAmount)} has been credited. Due in 14 days.`); }
            case "lottery": { const lotteryDb = db.collection(LOTTERY_COLLECTION); let lotteryData = await lotteryDb.findOne({ _id: "current_lottery" }); const now = Date.now(); if (!lotteryData) { lotteryData = { _id: "current_lottery", pot: 100000, tickets: [], drawTime: now + 24 * 3600000 }; await lotteryDb.insertOne(lotteryData); } const subCmd = args[1]?.toLowerCase(); if (subCmd === 'status') { const timeLeft = lotteryData.drawTime - now; const hours = Math.floor(timeLeft / 3600000); const minutes = Math.floor((timeLeft % 3600000) / 60000); const totalTickets = lotteryData.tickets.reduce((sum, t) => sum + t.count, 0); return message.reply(toBoldUnicode(`🎟️ Daily Lottery Status 🎟️\n\nCurrent Jackpot: ${formatNumber(lotteryData.pot)}\nTotal Tickets Sold: ${totalTickets}\nTime Until Draw: ${hours}h ${minutes}m\n\nBuy tickets with '${p}bank lottery buy <amount>'. A ticket costs ${formatNumber(LOTTERY_TICKET_PRICE)}.`)); } if (subCmd === 'buy') { const count = parseInt(args[2]); if (isNaN(count) || count <= 0) return message.reply("Please specify a valid number of tickets to buy."); const cost = count * LOTTERY_TICKET_PRICE; if (cost > userCash) return message.reply(`You need ${formatNumber(cost)} cash to buy ${count} tickets.`); await usersData.set(senderID, { money: userCash - cost }); let playerTickets = lotteryData.tickets.find(t => t.userId === senderID); if (playerTickets) { playerTickets.count += count; } else { lotteryData.tickets.push({ userId: senderID, count }); } lotteryData.pot += cost; await lotteryDb.updateOne({ _id: "current_lottery" }, { $set: { tickets: lotteryData.tickets, pot: lotteryData.pot } }); return message.reply(`You have successfully purchased ${count} lottery tickets for ${formatNumber(cost)}! Good luck!`); } if (subCmd === 'draw') { if (now < lotteryData.drawTime) return message.reply("It's not time to draw the lottery yet."); if (lotteryData.tickets.length === 0) { await lotteryDb.updateOne({ _id: "current_lottery" }, { $set: { pot: 100000, tickets: [], drawTime: now + 24 * 3600000 } }); return message.reply("No tickets were sold for this lottery. The pot rolls over and the lottery is reset."); } const ticketPool = lotteryData.tickets.flatMap(p => Array(p.count).fill(p.userId)); const winnerId = ticketPool[Math.floor(Math.random() * ticketPool.length)]; const winnerName = await usersData.getName(winnerId); const prize = lotteryData.pot; api.sendMessage(`🎉 Congratulations to ${winnerName} for winning the daily lottery jackpot of ${formatNumber(prize)}! 🎉`, event.threadID); let winnerData = await getUserBankData(winnerId, db); winnerData.bank += prize; await updateUserBankData(winnerId, winnerData, db); await lotteryDb.updateOne({ _id: "current_lottery" }, { $set: { pot: 100000, tickets: [], drawTime: now + 24 * 3600000 } }); return; } return message.reply(`Invalid lottery command. Use 'status', 'buy', or 'draw'.`); }
            case "manager": case "talk": {
                const userMessage = args.slice(1).join(" ");
                if (!userMessage && !(event.type === "message_reply" && event.messageReply.attachments.length > 0)) return message.reply(`Please provide a message to the AI Manager.\nExample: ${p}bank manager Tell me about my account.`);
                let imageUrl = null;
                if (event.type === "message_reply" && event.messageReply.attachments.some(att => att.type === "photo")) { imageUrl = event.messageReply.attachments.find(att => att.type === "photo").url; }
                const prompt = `${userMessage}\n\nLive Market Data: ` + Object.entries(stockMarket).map(([symbol, data]) => `${symbol}: ${formatNumber(data.price)}`).join(', ');
                const aiResponse = await getAiResponse(prompt, imageUrl);
                const conversationState = `User: ${userMessage}\nManager: ${aiResponse}`;
                return message.reply(aiResponse, (err, info) => { if (err) return; global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: event.senderID, type: 'ai_talk', conversation: conversationState }); });
            }
            case "message": { const targetId = Object.keys(event.mentions)[0]; if (!targetId) return message.reply(`You must @mention a user to send them a message.`); const msgContent = args.slice(2).join(" "); if (!msgContent) return message.reply("You cannot send an empty message."); const recipientData = await getUserBankData(targetId, db); if (!recipientData) return message.reply("This user does not have an Anchestor Bank account and cannot receive messages."); const senderName = await usersData.getName(senderID); const newMessage = { fromId: senderID, fromName: senderName, content: msgContent, date: new Date(), read: false }; await db.collection(BANK_COLLECTION).updateOne({ userId: targetId }, { $push: { messages: newMessage }}); return message.reply("Message sent!"); }
            case "networth": { const userName = await usersData.getName(senderID); const breakdown = { Bank: userBankInfo.bank, Cash: userCash, Stocks: (userBankInfo.stocks || []).reduce((s, st) => s + (stockMarket[st.symbol]?.price * st.shares || 0), 0), Businesses: (userBankInfo.businesses || []).reduce((s, b) => s + (availableBusinesses.find(biz => biz.id === b.businessId)?.cost || 0), 0), Properties: (userBankInfo.properties || []).reduce((s, p) => s + (propertyMarket.find(prop => prop.id === p.assetId)?.price || 0), 0) }; const total = Object.values(breakdown).reduce((s, v) => s + v, 0); return sendCanvasReply(drawNetWorthCanvas, '', { total, breakdown }, userName); }
            case "option": { const subCmd = args[1]?.toLowerCase(); if (subCmd === 'buy') { const symbol = args[2]?.toUpperCase(); const type = args[3]?.toLowerCase(); const strikePrice = parseFloat(args[4]); const shares = parseInt(args[5]); const expiryDays = parseInt(args[6]) || 7; if (!symbol || !['call', 'put'].includes(type) || isNaN(strikePrice) || isNaN(shares) || shares <= 0) return message.reply(`Invalid format. Use: ${p}bank option buy <SYMBOL> <call/put> <strike_price> <shares> [expiry_days]`); const result = await tradeStockOption(senderID, db, usersData, symbol, type, strikePrice, shares, expiryDays); return message.reply(result.message); } if (subCmd === 'exercise') { const optionId = args[2]; if (!optionId) return message.reply('Provide option ID suffix.'); const result = await exerciseOption(senderID, db, usersData, optionId); return message.reply(result.message); } return message.reply(`Invalid option command. Use: buy, exercise.`); }
            case "paybill": { const billIndex = parseInt(args[1]) - 1; if (isNaN(billIndex) || !userBankInfo.bills[billIndex]) return message.reply("Invalid bill number."); const bill = userBankInfo.bills[billIndex]; if (userBankInfo.bank < bill.amount) return message.reply("Insufficient funds to pay this bill."); userBankInfo.bank -= bill.amount; userBankInfo.bills.splice(billIndex, 1); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully paid ${bill.type} bill of ${formatNumber(bill.amount)}.`); }
            case "payloan": { const paymentAmount = parseFloat(args[1]); if (isNaN(paymentAmount) || paymentAmount <= 0) return message.reply(`Invalid amount.`); if (userBankInfo.loan.amount <= 0) return message.reply("You have no outstanding loan."); if (paymentAmount > userCash) return message.reply(`Insufficient cash.`); const paidAmount = Math.min(paymentAmount, userBankInfo.loan.amount); await usersData.set(senderID, { money: userCash - paidAmount }); userBankInfo.loan.amount -= paidAmount; if (userBankInfo.loan.amount <= 0) { userBankInfo.loan.history.repaid = (userBankInfo.loan.history.repaid || 0) + 1; userBankInfo.loan.amount = 0; userBankInfo.loan.dueDate = null; } await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "LOAN_PAY", event, {amount: paidAmount}); if (userBankInfo.loan.amount <= 0) return message.reply("Congratulations! You have fully paid off your loan. This will improve your credit score."); return message.reply(`You paid ${formatNumber(paidAmount)}. Remaining loan: ${formatNumber(userBankInfo.loan.amount)}.`); }
            case "phone": { const userName = await usersData.getName(senderID); return sendCanvasReply(drawPhoneHomeScreenCanvas, '', userBankInfo, userName); }
            case "property": {
                 const subCmd = args[1]?.toLowerCase();
                 if(subCmd === 'market'){ let marketMsg = toBoldUnicode("Anchestor Real Estate Market\n\n"); propertyMarket.forEach(p => { const original = propertyAssets.find(op => op.id === p.id); const change = ((p.price - original.price) / original.price) * 100; marketMsg += `${toBoldUnicode(p.name)} (${p.id})\nValue: ${formatNumber(p.price)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}% since IPO)\nRent: ${formatNumber(p.dailyRent, true, 0)}/day\n\n`; }); return message.reply(marketMsg); }
                 if(subCmd === 'buy'){ const propId = args[2]?.toUpperCase(); const prop = propertyMarket.find(p => p.id === propId); if(!prop) return message.reply("Invalid property ID."); if(userBankInfo.bank < prop.price) return message.reply(`Insufficient funds. You need ${formatNumber(prop.price)}.`); userBankInfo.bank -= prop.price; userBankInfo.properties.push({ assetId: prop.id, name: prop.name, purchasePrice: prop.price, lastRentCollected: new Date() }); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Congratulations! You have purchased a ${prop.name} for ${formatNumber(prop.price)}.`); }
                 if(subCmd === 'sell'){ const propId = args[2]?.toUpperCase(); const ownedProp = userBankInfo.properties.find(p => p.assetId === propId); if(!ownedProp) return message.reply("You do not own this property."); const marketProp = propertyMarket.find(p => p.id === propId); const profit = marketProp.price - ownedProp.purchasePrice; let taxAmount = 0; let replyMsg = ""; if(profit > 0) { taxAmount = profit * INCOME_TAX_RATE; userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + profit; replyMsg = ` After a capital gains tax of ${formatNumber(taxAmount)},`; } const finalSalePrice = marketProp.price - taxAmount; userBankInfo.bank += finalSalePrice; userBankInfo.taxPaid += taxAmount; userBankInfo.properties = userBankInfo.properties.filter(p => p.assetId !== propId); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`You have sold your ${ownedProp.name} for ${formatNumber(marketProp.price)}.${replyMsg} you receive ${formatNumber(finalSalePrice)}.`); }
                 if(subCmd === 'collect') { if (userBankInfo.properties.length === 0) return message.reply("You don't own any properties to collect rent from."); let totalRent = 0; const now = new Date(); userBankInfo.properties.forEach(prop => { const details = propertyAssets.find(p => p.id === prop.assetId); if (details) { const daysSinceCollected = (now.getTime() - new Date(prop.lastRentCollected).getTime()) / 86400000; if (daysSinceCollected >= 1) { const rentToCollect = Math.floor(daysSinceCollected) * details.dailyRent; totalRent += rentToCollect; prop.lastRentCollected = now; } } }); if (totalRent <= 0) return message.reply("It's too soon to collect rent. Rent is collected daily."); if (totalRent > 0) { userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + totalRent; userBankInfo.bank += totalRent; } await updateUserBankData(senderID, userBankInfo, db); return message.reply(`You collected ${formatNumber(totalRent)} in rent from your properties.`); }
                return message.reply("Invalid property command. Use `market`, `buy`, `sell`, or `collect`.");
            }
            case "report": { return sendCanvasReply(drawFinancialReportCanvas, '', userBankInfo, usersData, senderID); }
            case "research": {
                if (userBankInfo.bank < RESEARCH_FEE) return message.reply(`You need ${formatNumber(RESEARCH_FEE)} in your bank to request research.`);
                const type = args[1]?.toLowerCase();
                const symbol = args[2]?.toUpperCase();
                if (!type || !symbol) return message.reply(`Invalid format. Use '${p}bank research <stock|crypto|property> <ID/SYMBOL>'.`);
                let dataPrompt = "";
                let assetName = "";
                if (type === 'stock') {
                    const stock = stockMarket[symbol];
                    if (!stock) return message.reply("Invalid stock symbol.");
                    assetName = stock.name;
                    dataPrompt = `Analyze the stock ${symbol} (${assetName}). Current Price: ${stock.price}. Recent price history (oldest to newest): ${stock.history.join(', ')}. Based ONLY on this data, what is the short-term outlook? Mention trends and volatility.`;
                } else if (type === 'crypto') {
                    const crypto = cryptoMarket[symbol];
                    if (!crypto) return message.reply("Invalid crypto symbol.");
                    assetName = crypto.name;
                    dataPrompt = `Analyze the cryptocurrency ${symbol} (${assetName}). Current Price: ${crypto.price}. Recent price history (oldest to newest): ${crypto.history.join(', ')}. Based ONLY on this data, what is the short-term outlook? Mention trends and its high volatility.`;
                } else if (type === 'property') {
                    const prop = propertyMarket.find(p => p.id === symbol);
                    if (!prop) return message.reply("Invalid property ID.");
                    assetName = prop.name;
                    dataPrompt = `Analyze the real estate asset ${symbol} (${assetName}). Current Value: ${prop.price}. Daily Rental Income: ${prop.dailyRent}. Based ONLY on this data, is this a good long-term investment for stable income?`;
                } else {
                    return message.reply("Invalid research type. Use 'stock', 'crypto', or 'property'.");
                }
                message.reply("🔎 Your research request is being processed by the AI Manager... (This may take a moment)");
                userBankInfo.bank -= RESEARCH_FEE;
                await updateUserBankData(senderID, userBankInfo, db);
                const aiResponse = await getAiResponse(dataPrompt);
                return message.reply(`**Anchestor AI Research Report**\n**Asset:** ${assetName} (${symbol})\n\n${aiResponse}\n\n*A fee of ${formatNumber(RESEARCH_FEE)} has been deducted from your account. This is not financial advice.*`);
            }
            case "resign": { if (userBankInfo.job.title === 'unemployed') return message.reply("You do not have a job to resign from."); const oldJob = userBankInfo.job.title; userBankInfo.job = { title: 'unemployed', lastWorked: null }; await updateUserBankData(senderID, userBankInfo, db); return message.reply(`You have resigned from your position as a ${oldJob}.`); }
            case "security": {
                const subCmd = args[1]?.toLowerCase();
                if (subCmd === 'pin') {
                    return message.reply(`To change your PIN, please use the ATM interface: '${p}bank atm'`);
                }
                if (subCmd === '2fa') {
                    const toggle = args[2]?.toLowerCase();
                    if (toggle === 'on') {
                        userBankInfo.security.twoFactorEnabled = true;
                        await updateUserBankData(senderID, userBankInfo, db);
                        return message.reply("✅ Two-Factor Authentication has been enabled (simulated).");
                    } else if (toggle === 'off') {
                        userBankInfo.security.twoFactorEnabled = false;
                        await updateUserBankData(senderID, userBankInfo, db);
                        return message.reply("❌ Two-Factor Authentication has been disabled.");
                    }
                    return message.reply("Use 'on' or 'off' to manage 2FA.");
                }
                return sendCanvasReply(drawSecurityDashboardCanvas, '', userBankInfo);
            }
            case "stock": {
                const stockAction = args[1]?.toLowerCase(); if (!stockAction || stockAction === 'help') return message.reply(helpDetails.stock);
                if (stockAction === 'market') { const page = parseInt(args[2]) || 1; return sendCanvasReply(drawStockMarketCanvas, `Use '${p}bank stock market [page_number]' to navigate.`, page); }
                const stockSymbol = args[2]?.toUpperCase();
                if (stockAction === 'portfolio') { return sendCanvasReply(drawStockPortfolioCanvas, '', userBankInfo, usersData, senderID); }
                if (!stockSymbol || !stockMarket[stockSymbol]) return message.reply(`Invalid stock symbol.\nExample: ${p}bank stock price AAPL`);
                if (stockAction === 'price') return message.reply(`${stockMarket[stockSymbol].name} (${stockSymbol}): ${formatNumber(stockMarket[stockSymbol].price)}`);
                const stockShares = parseInt(args[3]); if (isNaN(stockShares) || stockShares <= 0) return message.reply(`Invalid number of shares.\nExample: ${p}bank stock buy AAPL 10`);
                if (stockAction === 'buy') { const stock = stockMarket[stockSymbol]; const stockPerks = getTierPerks((userBankInfo.bank + userCash)); const totalCost = (stock.price * stockShares) * (1 + (STOCK_TRANSACTION_FEE_PERCENT * stockPerks.feeModifier)); if (totalCost > userCash) return message.reply(`Insufficient cash. You need ${formatNumber(totalCost)}.`); await usersData.set(senderID, { money: userCash - totalCost }); let holding = userBankInfo.stocks.find(s => s.symbol === stockSymbol && s.type !== 'short'); if (holding) { holding.avgPrice = ((holding.avgPrice * holding.shares) + (stock.price * stockShares)) / (holding.shares + stockShares); holding.shares += stockShares; } else { userBankInfo.stocks.push({ symbol: stockSymbol, shares: stockShares, avgPrice: stock.price, type: 'long' }); } await awardAchievement('FIRST_STOCK'); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully bought ${stockShares} shares of ${stockSymbol}.`); }
                if (stockAction === 'sell') { let holding = userBankInfo.stocks.find(s => s.symbol === stockSymbol && s.type !== 'short'); if (!holding || holding.shares < stockShares) return message.reply(`You don't have enough shares. You own ${holding ? holding.shares : 0} of ${stockSymbol}.`); const stockPerks = getTierPerks((userBankInfo.bank + userCash)); let proceeds = (stockMarket[stockSymbol].price * stockShares); const profit = (stockMarket[stockSymbol].price - holding.avgPrice) * stockShares; let taxAmount = 0; let replyMsg = ""; if (profit > 0) { taxAmount = profit * INCOME_TAX_RATE; userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + profit; proceeds -= taxAmount; userBankInfo.taxPaid += taxAmount; replyMsg = ` After a capital gains tax of ${formatNumber(taxAmount)}, you receive`; } else { replyMsg = ` You receive`; } const finalProceeds = proceeds * (1 - (STOCK_TRANSACTION_FEE_PERCENT * stockPerks.feeModifier)); await usersData.set(senderID, { money: userCash + finalProceeds }); holding.shares -= stockShares; if (holding.shares === 0) userBankInfo.stocks = userBankInfo.stocks.filter(s => s.symbol !== stockSymbol || s.type === 'short'); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully sold ${stockShares} shares of ${stockSymbol}.${replyMsg} ${formatNumber(finalProceeds)}.`); }
                if (stockAction === 'short') { const stock = stockMarket[stockSymbol]; const totalValue = stock.price * stockShares; const collateral = (userBankInfo.bank + userCash) * 0.5; if (totalValue > collateral) return message.reply(`Insufficient collateral to short this position. You need at least ${formatNumber(totalValue)} in net worth available.`); const proceeds = totalValue * (1 - STOCK_TRANSACTION_FEE_PERCENT); await usersData.set(senderID, { money: userCash + proceeds }); let holding = userBankInfo.stocks.find(s => s.symbol === stockSymbol && s.type === 'short'); if (holding) { holding.avgPrice = ((holding.avgPrice * holding.shares) + (stock.price * stockShares)) / (holding.shares + stockShares); holding.shares += stockShares; } else { userBankInfo.stocks.push({ symbol: stockSymbol, shares: stockShares, avgPrice: stock.price, type: 'short' }); } await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully opened a short position for ${stockShares} shares of ${stockSymbol}.`); }
                if (stockAction === 'cover') { let holding = userBankInfo.stocks.find(s => s.symbol === stockSymbol && s.type === 'short'); if (!holding || holding.shares < stockShares) return message.reply(`You don't have enough shorted shares to cover. You are short ${holding ? holding.shares : 0} of ${stockSymbol}.`); const cost = stockMarket[stockSymbol].price * stockShares * (1 + STOCK_TRANSACTION_FEE_PERCENT); if (cost > userCash) return message.reply(`Insufficient cash to cover this position. You need ${formatNumber(cost)}.`); await usersData.set(senderID, { money: userCash - cost }); holding.shares -= stockShares; if (holding.shares === 0) userBankInfo.stocks = userBankInfo.stocks.filter(s => s.symbol !== stockSymbol || s.type !== 'short'); await updateUserBankData(senderID, userBankInfo, db); return message.reply(`Successfully covered ${stockShares} shares of ${stockSymbol}.`); }
                return message.reply(`Invalid stock command.`);
            }
            case "tax": {
                const subCmd = args[1]?.toLowerCase();
                const userName = await usersData.getName(senderID);
                if (subCmd === 'status') {
                    return sendCanvasReply(drawTaxStatusCanvas, '', userBankInfo, userName);
                }
                if (subCmd === 'file') {
                    const taxData = userBankInfo.tax || { lastFiled: userBankInfo.createdAt, reportableIncome: 0 };
                    const estimatedTax = taxData.reportableIncome * INCOME_TAX_RATE;
                    const taxDue = estimatedTax - (userBankInfo.taxPaid || 0);
                    if (taxDue > 0 && taxDue > userBankInfo.bank) {
                        return message.reply(`You cannot file your taxes. You owe an estimated ${formatNumber(taxDue)}, but you only have ${formatNumber(userBankInfo.bank)} in your bank.`);
                    }
                    if (taxDue > 0) {
                        userBankInfo.bank -= taxDue;
                        message.reply(`You have filed your taxes. A final payment of ${formatNumber(taxDue)} has been deducted from your bank account.`);
                    } else {
                        const refund = Math.abs(taxDue);
                        userBankInfo.bank += refund;
                        message.reply(`You have filed your taxes. A refund of ${formatNumber(refund)} has been deposited into your bank account.`);
                    }
                    userBankInfo.tax = { lastFiled: new Date(), reportableIncome: 0 };
                    userBankInfo.taxPaid = 0;
                    await updateUserBankData(senderID, userBankInfo, db);
                    return;
                }
                return message.reply(`Invalid tax command. Use 'status' or 'file'.`);
            }
            case "tier": { const stockValue = (userBankInfo.stocks || []).reduce((s, st) => s + (stockMarket[st.symbol]?.price * st.shares || 0), 0); const propertyValue = (userBankInfo.properties || []).reduce((s, p) => (propertyMarket.find(prop => prop.id === p.assetId)?.price || 0) + s, 0); const netWorth = userBankInfo.bank + userCash + stockValue + propertyValue; if (netWorth >= 1000000) await awardAchievement('NET_WORTH_1M'); const tierPerk = getTierPerks(userBankInfo.bank + userCash); return message.reply(`${tierPerk.tier}\n💰 ${toBoldUnicode("Net Worth:")} ${toBoldUnicode(formatNumber(netWorth))}`); }
            case "transfer": { let recipientId = Object.keys(event.mentions)[0] || args[1]; const transferAmount = parseFloat(args[2]); if (!recipientId || isNaN(transferAmount) || transferAmount <= 0) return message.reply(`Invalid format.`); if (String(recipientId) === senderID) return message.reply("Cannot transfer to yourself."); if (transferAmount > userBankInfo.bank) return message.reply(`Insufficient bank balance.`); let recipientBankData = await getUserBankData(String(recipientId), db); if(!recipientBankData) return message.reply("Recipient does not have a bank account."); userBankInfo.bank -= transferAmount; recipientBankData.bank += transferAmount; await updateUserBankData(senderID, userBankInfo, db); await updateUserBankData(String(recipientId), recipientBankData, db); const recipientName = await usersData.getName(String(recipientId)) || `User ${recipientId}`; await logAudit(db, "TRANSFER", event, { to: String(recipientId), amount: transferAmount }); return message.reply(`✅ Transferred ${formatNumber(transferAmount)} to ${recipientName}.`); }
            case "withdraw": { const amount = parseFloat(args[1]); if (isNaN(amount) || amount <= 0) return message.reply(`Invalid amount.`); if (amount > userBankInfo.bank) return message.reply(`Insufficient bank funds.`); userBankInfo.bank -= amount; userCash += amount; await usersData.set(senderID, { money: userCash }); await updateUserBankData(senderID, userBankInfo, db); await logAudit(db, "WITHDRAW", event, { amount }); return message.reply(`✅ Withdrew ${formatNumber(amount)}.`); }
            case "work": {
                const userJob = userBankInfo.job; if (userJob.title === 'unemployed') return message.reply("You don't have a job. Use '/bank jobs list' to find one.");
                const jobInfo = Object.values(JOBS_LIST).find(j => j.name === userJob.title);
                if (userJob.lastWorked) { const cooldown = jobInfo.cooldownHours * 3600000; const timeSince = new Date() - new Date(userJob.lastWorked); if (timeSince < cooldown) { const remaining = cooldown - timeSince; const hours = Math.floor(remaining / 3600000); const minutes = Math.floor((remaining % 3600000) / 60000); return message.reply(`You are tired. You can work again in ${hours}h and ${minutes}m.`); } }
                const grossPay = jobInfo.salary; const taxAmount = grossPay * INCOME_TAX_RATE; const netPay = grossPay - taxAmount;
                userBankInfo.tax.reportableIncome = (userBankInfo.tax.reportableIncome || 0) + grossPay;
                userBankInfo.bank += netPay; userBankInfo.taxPaid += taxAmount; userBankInfo.job.lastWorked = new Date();
                await updateUserBankData(senderID, userBankInfo, db); await addTransaction(senderID, "Salary", `Paycheck: ${jobInfo.name}`, netPay, db);
                return message.reply(`You worked as a ${jobInfo.name} and earned ${formatNumber(grossPay)}. After a ${formatNumber(taxAmount)} tax, ${formatNumber(netPay)} was deposited to your bank.`);
            }
            case "setwallpaper": { const url = args[1]; if (!url) return message.reply("Please provide an image URL."); userBankInfo.wallpaperUrl = url; await updateUserBankData(senderID, userBankInfo, db); return message.reply("Your phone wallpaper has been updated."); }
            case "calculate": { const expression = args.slice(1).join(" "); const result = safeEval(expression); if (result === null) return message.reply("Invalid calculation."); return message.reply(`Result: ${formatNumber(result)}`); }
            case "top": { return message.reply("This feature is under development."); }
            case "serverstats": { const allUsers = await db.collection(BANK_COLLECTION).find().toArray(); const totalBank = allUsers.reduce((sum, u) => sum + (u.bank || 0), 0); const totalCorps = await db.collection(CORP_COLLECTION).countDocuments(); return message.reply(`${toBoldUnicode("Anchestor Server Stats")}\n\n- Total Accounts: ${allUsers.length}\n- Total Bank Value: ${formatNumber(totalBank)}\n- Active Corporations: ${totalCorps}`); }
            default:
                const allCommands = ['help', 'create_card', 'atm', 'card', 'balance', 'deposit', 'withdraw', 'transfer', 'loan', 'payloan', 'business', 'stock', 'option', 'tier', 'report', 'credit_score', 'event_status', 'insurance', 'ipo', 'cheque', 'invest', 'daily', 'lottery', 'achievements', 'creditcard', 'leaderboard', 'jobs', 'work', 'resign', 'property', 'corp', 'digest', 'phone', 'message', 'manager', 'talk', 'news', 'suggest', 'networth', 'paybill', 'setwallpaper', 'calculate', 'top', 'serverstats', 'crypto', 'auction', 'tax', 'security', 'research'];
                const bestMatch = findBestMatch(command, allCommands);
                if (bestMatch) { return message.reply(`Did you mean '${p}bank ${bestMatch}'?`); }
                const intentResult = await getCommandIntent(event.body);
                if(intentResult.intent !== 'unknown' && intentResult.suggestion) { return message.reply(intentResult.suggestion); }
                const randomTip = TIPS[Math.floor(Math.random() * TIPS.length)];
                message.reply(`Unknown command. Use '${p}bank help' for a list of commands.\n\n💡 **Tip:** ${randomTip}`);
        }
    }
};
