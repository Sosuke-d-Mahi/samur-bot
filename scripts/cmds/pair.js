const fs = require("fs-extra");
const axios = require("axios");
const { getStreamFromURL } = global.utils;

// Helper functions for managing JSON files
const readJSON = (path) => {
  if (!fs.existsSync(path)) return {};
  return JSON.parse(fs.readFileSync(path, "utf8"));
};

const writeJSON = (path, data) => {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
};

module.exports = {
  config: {
    name: "pair",
    version: "2.0",
    author: "Mahi--",
    countDown: 5,
    shortDescription: {
      en: "A full relationship and pairing suite.",
      vi: ""
    },
    category: "love",
    guide: {
      en: "•pair: Find a random partner.\n" +
          "•pair stats: View group leaderboards.\n" +
          "•pair ship [Name1] and [Name2]: Ship two users.\n" +
          "•pair status: Check your relationship status.\n" +
          "•pair propose @user: Propose to a user.\n" +
          "•pair requests: View your proposals.\n" +
          "•pair accept [@user|number]: Accept a proposal.\n" +
          "•pair break: End your current relationship.\n" +
          "•pair history: View past random pairs."
    }
  },

  onStart: async function({ event, message, threadsData, usersData, args }) {
    const historyPath = __dirname + "/cache/pair_history.json";
    const relationshipsPath = __dirname + "/cache/pair_relationships.json";
    const requestsPath = __dirname + "/cache/pair_requests.json";
    
    const { threadID, senderID } = event;
    const command = args[0]?.toLowerCase();

    const allMembers = (await threadsData.get(threadID)).members;
    const senderName = await usersData.getName(senderID);

    // --- SUB-COMMAND ROUTER ---
    switch (command) {
      case "history":
        // This logic remains the same
        const history = readJSON(historyPath);
        const threadHistory = history[threadID] || [];
        if (threadHistory.length === 0) return message.reply("🗃️ No previous pairs recorded in this group.");
        const list = threadHistory.map((p, i) => `${i + 1}. ${p.name1} ${p.type === 'friend' ? '🤝' : '❤️'} ${p.name2} (${p.percentage}%)`).join("\n");
        return message.reply(`📜 Match History for this Group:\n\n${list}`);

      // --- NEW: STATS/LEADERBOARD ---
      case "stats":
      case "leaderboard": {
        const historyData = readJSON(historyPath)[threadID] || [];
        if (historyData.length === 0) return message.reply("📊 No pairing data available to generate stats.");

        let pairCounts = {}, userCounts = {}, highestScore = { names: "N/A", percentage: 0 };
        
        for (const pair of historyData) {
          userCounts[pair.name1] = (userCounts[pair.name1] || 0) + 1;
          userCounts[pair.name2] = (userCounts[pair.name2] || 0) + 1;
          
          const pairKey = [pair.name1, pair.name2].sort().join(" & ");
          pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;

          if (pair.type === 'love' && pair.percentage > highestScore.percentage) {
            highestScore = { names: `${pair.name1} & ${pair.name2}`, percentage: pair.percentage };
          }
        }

        const topUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
        const topCouple = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0];

        const statsMessage = `📊 Group Pairing Leaderboard 📊\n\n` +
          `💞 Top Couple: ${topCouple ? topCouple[0] : 'N/A'} (${topCouple ? topCouple[1] : 0} times)\n` +
          `💖 Most Paired User: ${topUser ? topUser[0] : 'N/A'} (${topUser ? topUser[1] : 0} pairs)\n` +
          `✨ Highest Love Score: ${highestScore.names} (${highestScore.percentage}%)`;
        
        return message.reply(statsMessage);
      }

      // --- NEW: SHIP COMMAND ---
      case "ship": {
        const shipArgs = args.slice(1).join(" ").split(/ and /i);
        if (shipArgs.length !== 2) return message.reply("❌ Please use the format: {prefix}pair ship [Name 1] and [Name 2]");

        const name1 = shipArgs[0].trim();
        const name2 = shipArgs[1].trim();
        
        const user1 = allMembers.find(m => m.name.toLowerCase() === name1.toLowerCase());
        const user2 = allMembers.find(m => m.name.toLowerCase() === name2.toLowerCase());

        if (!user1 || !user2) return message.reply("❌ Couldn't find one or both users in this group.");
        if (user1.userID === user2.userID) return message.reply("❌ You can't ship a user with themselves.");

        const shipScore = (parseInt(user1.userID) + parseInt(user2.userID)) % 101;
        
        return message.reply(`🚢 ${senderName} is shipping ${name1} and ${name2}!\n\nTheir compatibility score is... ${shipScore}%!`);
      }

      // --- NEW: RELATIONSHIP STATUS SYSTEM ---
      case "status":
      case "propose": {
        const relationships = readJSON(relationshipsPath);
        const threadRelations = relationships[threadID] || {};
        
        if (threadRelations[senderID]) {
          const partnerName = await usersData.getName(threadRelations[senderID]);
          return message.reply(`You are currently in a relationship with ${partnerName}. ❤️`);
        }

        if (command === 'propose') {
          const targetID = Object.keys(event.mentions)[0];
          if (!targetID) return message.reply("❌ You must mention someone to propose to them.");
          if (targetID === senderID) return message.reply("You can't propose to yourself!");
          if (threadRelations[targetID]) return message.reply("That person is already in a relationship.");

          const requests = readJSON(requestsPath);
          if (!requests[threadID]) requests[threadID] = {};
          if (!requests[threadID][targetID]) requests[threadID][targetID] = [];

          if (requests[threadID][targetID].includes(senderID)) {
            return message.reply("You have already sent a proposal to this person.");
          }

          requests[threadID][targetID].push(senderID);
          writeJSON(requestsPath, requests);
          
          const targetName = await usersData.getName(targetID);
          return message.reply(`💌 Proposal sent to ${targetName}!\nThey can accept by using {prefix}pair accept @${senderName}`);
        }
        return message.reply("You are currently single. 💔");
      }
      
      case "requests": {
        const requests = readJSON(requestsPath)[threadID] || {};
        const userRequests = requests[senderID] || [];

        if (userRequests.length === 0) return message.reply("You have no pending proposals.");

        let requestList = "💌 Your incoming proposals:\n\n";
        for (let i = 0; i < userRequests.length; i++) {
          const requesterName = await usersData.getName(userRequests[i]);
          requestList += `${i + 1}. From: ${requesterName}\n`;
        }
        requestList += "\nAccept using {prefix}pair accept [number] or by mentioning the user.";
        return message.reply(requestList);
      }

      case "accept": {
        const relationships = readJSON(relationshipsPath);
        const requests = readJSON(requestsPath);
        const threadRelations = relationships[threadID] || {};
        const threadRequests = requests[threadID] || {};
        const userRequests = threadRequests[senderID] || [];

        if (userRequests.length === 0) return message.reply("You have no proposals to accept.");
        if (threadRelations[senderID]) return message.reply("You are already in a relationship.");

        let proposerID;
        const mentionedID = Object.keys(event.mentions)[0];
        const requestNumber = parseInt(args[1]);

        if (mentionedID) {
          if (userRequests.includes(mentionedID)) proposerID = mentionedID;
        } else if (!isNaN(requestNumber) && requestNumber > 0 && requestNumber <= userRequests.length) {
          proposerID = userRequests[requestNumber - 1];
        } else if (userRequests.length === 1) {
          proposerID = userRequests[0];
        } else {
          return message.reply("Please specify who to accept by mentioning them or using their request number.");
        }

        if (!proposerID) return message.reply("This person has not sent you a proposal.");
        if (threadRelations[proposerID]) return message.reply("That person has entered a relationship with someone else.");
        
        if (!relationships[threadID]) relationships[threadID] = {};
        relationships[threadID][senderID] = proposerID;
        relationships[threadID][proposerID] = senderID;
        
        // Clean up all requests for both users
        delete threadRequests[senderID];
        delete threadRequests[proposerID];
        
        writeJSON(relationshipsPath, relationships);
        writeJSON(requestsPath, requests);
        
        const proposerName = await usersData.getName(proposerID);
        return message.reply(`🎉 Congratulations! ${senderName} and ${proposerName} are now officially a couple!`);
      }

      case "break":
      case "divorce": {
        const relationships = readJSON(relationshipsPath);
        const threadRelations = relationships[threadID] || {};
        const partnerID = threadRelations[senderID];

        if (!partnerID) return message.reply("You are not in a relationship.");
        
        const partnerName = await usersData.getName(partnerID);
        
        delete relationships[threadID][senderID];
        delete relationships[threadID][partnerID];
        writeJSON(relationshipsPath, relationships);
        
        return message.reply(`💔 ${senderName} has broken up with ${partnerName}.`);
      }
    }

    // --- DEFAULT: RANDOM PAIRING LOGIC (UPGRADED) ---
    const getGender = (user) => {
      if (user.gender === 1 || String(user.gender).toLowerCase() === 'female') return 'female';
      if (user.gender === 2 || String(user.gender).toLowerCase() === 'male') return 'male';
      return 'unknown';
    };

    const relationships = readJSON(relationshipsPath);
    const takenUsers = Object.keys(relationships[threadID] || {});
    
    const senderData = allMembers.find(m => m.userID === senderID);
    const senderGender = getGender(senderData);

    if (senderGender === 'unknown') return message.reply("❌ I couldn't detect your gender!");
    if (takenUsers.includes(senderID)) {
      const partnerName = await usersData.getName(relationships[threadID][senderID]);
      return message.reply(`You can't get a random pair, you are already with ${partnerName}! ❤️`);
    }

    let potentialMatches = [];
    let isFriendPair = false;

    // Filter out users who are already in a relationship
    const availableMembers = allMembers.filter(m => !takenUsers.includes(m.userID));

    const targetGender = senderGender === 'male' ? 'female' : 'male';
    potentialMatches = availableMembers.filter(m => m.userID !== senderID && m.inGroup && getGender(m) === targetGender);

    if (potentialMatches.length === 0) {
      isFriendPair = true;
      potentialMatches = availableMembers.filter(m => m.userID !== senderID && m.inGroup && getGender(m) === senderGender);
    }

    if (potentialMatches.length === 0) return message.reply("Sadly, no available singles were found for pairing. 😔");

    const randomMember = potentialMatches[Math.floor(Math.random() * potentialMatches.length)];
    const name2 = await usersData.getName(randomMember.userID);

    const avatarUrl1 = await usersData.getAvatarUrl(senderID);
    const avatarUrl2 = await usersData.getAvatarUrl(randomMember.userID);
    const [avatarStream1, avatarStream2] = await Promise.all([getStreamFromURL(avatarUrl1), getStreamFromURL(avatarUrl2)]);

    const randomNumber1 = Math.floor(Math.random() * 36) + 65;
    const historyEntry = {
        type: isFriendPair ? "friend" : "love",
        name1: senderName,
        name2: name2,
        percentage: randomNumber1,
        timestamp: Date.now()
    };
    
    const messageBody = isFriendPair ?
      `Let's celebrate a new friendship!\n\n✨ ${senderName} and ${name2} ✨\n\nFriendship Score: ${randomNumber1}% 🤝` :
      `Everyone, congratulate the new couple:\n❤ ${senderName} 💕 ${name2} ❤\n\nLove percentage: ${randomNumber1}% 🤭`;

    // Save history
    const history = readJSON(historyPath);
    if (!history[threadID]) history[threadID] = [];
    history[threadID].unshift(historyEntry);
    writeJSON(historyPath, history);

    return message.reply({ body: messageBody, attachment: [avatarStream1, avatarStream2] });
  }
};