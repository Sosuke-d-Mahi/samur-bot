const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");

// Configuration
const CONFIG = {
  timezone: "Asia/Dhaka",
  autoApprove: {
    verifiedUsers: true,
    minMutualFriends: 3,
    minAccountAgeDays: 30
  },
  requestTimeout: 15000
};

// GraphQL API Endpoints
const FB_API = {
  listRequests: {
    doc_id: "4499164963466303",
    name: "FriendingCometFriendRequestsRootQueryRelayPreloader"
  },
  acceptRequest: {
    doc_id: "3147613905362928",
    name: "FriendingCometFriendRequestConfirmMutation"
  },
  deleteRequest: {
    doc_id: "4108254489275063",
    name: "FriendingCometFriendRequestDeleteMutation"
  }
};

// Utility Functions
async function fetchFriendRequests(api) {
  try {
    const form = {
      av: api.getCurrentUserID(),
      fb_api_req_friendly_name: FB_API.listRequests.name,
      fb_api_caller_class: "RelayModern",
      doc_id: FB_API.listRequests.doc_id,
      variables: JSON.stringify({ input: { scale: 3 } })
    };

    const response = await api.httpPost("https://www.facebook.com/api/graphql/", form);
    if (!response) throw new Error("Empty API response");

    const data = JSON.parse(response);
    if (!data?.data?.viewer?.friending_possibilities?.edges) {
      throw new Error("Invalid API response structure");
    }

    return data.data.viewer.friending_possibilities.edges
      .filter(i => i.node?.friendship_status === "INCOMING_REQUEST")
      .map(i => ({
        name: i.node?.name || "Unknown User",
        userID: i.node?.id,
        timestamp: i.time ? moment.unix(i.time).tz(CONFIG.timezone) : null,
        isVerified: i.node?.is_verified || false,
        profilePic: i.node?.profile_picture?.uri
      }));
  } catch (error) {
    console.error("Fetch Error:", error);
    throw new Error("Failed to retrieve friend requests");
  }
}

async function getUserDetails(userID, api, usersData, threadsData) {
  try {
    const [userData, allThreads] = await Promise.all([
      usersData.get(userID),
      threadsData.getAll()
    ]);

    const accountInfo = {
      name: userData?.name || `User ${userID}`,
      money: userData?.money || 0,
      isVerified: userData?.isVerified || false,
      createdAt: userData?.createdAt ? new Date(userData.createdAt) : null
    };

    const socialInfo = {
      mutualFriends: 0,
      commonGroups: (allThreads || [])
        .filter(t => t.members?.some(m => m.userID === userID && m.inGroup))
        .map(t => ({ id: t.threadID, name: t.threadName || `Group ${t.threadID}` }))
    };

    // Try to get mutual friends if API supports it
    try {
      const friends = await api.getFriendsList();
      socialInfo.mutualFriends = friends.filter(f => f.userID === userID).length;
    } catch {}

    return { ...accountInfo, ...socialInfo };
  } catch (error) {
    console.error("User Details Error:", error);
    return {
      name: `User ${userID}`,
      money: 0,
      isVerified: false,
      createdAt: null,
      mutualFriends: 0,
      commonGroups: []
    };
  }
}

// Command Implementation
module.exports = {
  config: {
    name: "accept",
    aliases: ["acp"],
    version: "2.1",
    author: "Mahi",
    countDown: 10,
    role: 0,
    shortDescription: "Manage friend requests",
    longDescription: "View, accept, or delete incoming friend requests with detailed user information",
    category: "utility",
    guide: {
      en: "{pn} [number] - View details\n{pn} add [number|all] - Accept request\n{pn} del [number|all] - Delete request"
    }
  },

  onStart: async function ({ event, api, usersData, threadsData }) {
    try {
      const requests = await fetchFriendRequests(api);
      if (!requests.length) {
        return api.sendMessage("🎉 No pending friend requests found!", event.threadID);
      }

      // Auto-approve verified users if enabled
      if (CONFIG.autoApprove.verifiedUsers) {
        const verified = requests.filter(r => r.isVerified);
        for (const user of verified) {
          try {
            await api.httpPost("https://www.facebook.com/api/graphql/", {
              av: api.getCurrentUserID(),
              fb_api_req_friendly_name: FB_API.acceptRequest.name,
              fb_api_caller_class: "RelayModern",
              doc_id: FB_API.acceptRequest.doc_id,
              variables: JSON.stringify({
                input: {
                  friend_requester_id: user.userID,
                  source: "friends_tab",
                  actor_id: api.getCurrentUserID(),
                  client_mutation_id: Math.random().toString(36).substr(2, 7)
                },
                scale: 3
              })
            });
          } catch {}
        }
      }

      // Build request list message
      let message = "📩 Pending Friend Requests:\n\n";
      requests.forEach((req, i) => {
        message += `${i + 1}. ${req.name}${req.isVerified ? " ✅" : ""}\n`;
        message += `   🕒 ${req.timestamp ? req.timestamp.format("DD/MM/YYYY HH:mm") : "Unknown"}\n\n`;
      });

      message += "Reply with:\n";
      message += "• Number to view details\n";
      message += "• 'add [number|all]' to accept\n";
      message += "• 'del [number|all]' to delete";

      const sentMsg = await api.sendMessage(message, event.threadID, (err, info) => {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name,
          author: event.senderID,
          messageID: info.messageID,
          requests
        });

        setTimeout(() => {
          global.GoatBot.onReply.delete(info.messageID);
          api.unsendMessage(info.messageID);
        }, CONFIG.requestTimeout);
      });

    } catch (error) {
      console.error("Command Error:", error);
      api.sendMessage("⚠️ Failed to process friend requests. Please try again later.", event.threadID);
    }
  },

  onReply: async function ({ event, Reply, api, usersData, threadsData }) {
    if (event.senderID !== Reply.author) return;

    const { requests, messageID } = Reply;
    const args = event.body.split(" ");
    const action = args[0].toLowerCase();

    try {
      // Handle number input (view details)
      if (/^\d+$/.test(action)) {
        const index = parseInt(action) - 1;
        if (index < 0 || index >= requests.length) {
          return api.sendMessage("❌ Invalid selection number", event.threadID);
        }

        const user = requests[index];
        const details = await getUserDetails(user.userID, api, usersData, threadsData);

        const accountAge = details.createdAt 
          ? `${Math.floor((new Date() - details.createdAt) / (1000 * 60 * 60 * 24))} days` 
          : "Unknown";

        let infoMessage = `👤 USER PROFILE\n`;
        infoMessage += `├─ Name: ${details.name}\n`;
        infoMessage += `├─ ID: ${user.userID}\n`;
        infoMessage += `├─ Verified: ${details.isVerified ? "✅" : "❌"}\n`;
        infoMessage += `├─ Account Age: ${accountAge}\n`;
        infoMessage += `├─ Balance: $${details.money.toLocaleString()}\n`;
        infoMessage += `└─ Mutual Friends: ${details.mutualFriends}\n\n`;
        
        infoMessage += `👥 COMMON GROUPS (${details.commonGroups.length})\n`;
        details.commonGroups.slice(0, 5).forEach(group => {
          infoMessage += `├─ ${group.name}\n`;
        });

        return api.sendMessage(infoMessage, event.threadID);
      }

      // Handle actions (add/del)
      if (["add", "del"].includes(action)) {
        if (args.length < 2) {
          return api.sendMessage("❌ Please specify request numbers or 'all'", event.threadID);
        }

        const targets = args[1].toLowerCase() === "all"
          ? requests.map((_, i) => i)
          : args.slice(1).map(n => parseInt(n) - 1).filter(n => !isNaN(n) && n >= 0 && n < requests.length);

        if (!targets.length) {
          return api.sendMessage("❌ No valid requests selected", event.threadID);
        }

        const endpoint = action === "add" ? FB_API.acceptRequest : FB_API.deleteRequest;
        const results = { success: [], failed: [] };

        for (const index of targets) {
          try {
            await api.httpPost("https://www.facebook.com/api/graphql/", {
              av: api.getCurrentUserID(),
              fb_api_req_friendly_name: endpoint.name,
              fb_api_caller_class: "RelayModern",
              doc_id: endpoint.doc_id,
              variables: JSON.stringify({
                input: {
                  friend_requester_id: requests[index].userID,
                  source: "friends_tab",
                  actor_id: api.getCurrentUserID(),
                  client_mutation_id: Math.random().toString(36).substr(2, 7)
                },
                scale: 3
              })
            });
            results.success.push(requests[index].name);
          } catch {
            results.failed.push(requests[index].name);
          }
        }

        let response = "";
        if (results.success.length) {
          response += `✅ Successfully ${action === "add" ? "accepted" : "deleted"} ${results.success.length} request(s)\n`;
        }
        if (results.failed.length) {
          response += `\n❌ Failed to process ${results.failed.length} request(s)`;
        }

        api.unsendMessage(messageID);
        return api.sendMessage(response || "❌ No actions were performed", event.threadID);
      }

      api.sendMessage("❌ Invalid command. Use number to view, or 'add/del [number|all]'", event.threadID);
    } catch (error) {
      console.error("Reply Error:", error);
      api.sendMessage("⚠️ An error occurred while processing your request", event.threadID);
    }
  }
};