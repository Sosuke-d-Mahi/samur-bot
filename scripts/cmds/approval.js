module.exports = {
  config: {
    name: "approval",
    aliases: ["approve", "approved"],
    version: "2.1", // Incremented version
    author: "Mahi--",
    countDown: 5,
    role: 0,
    longDescription: "Manage thread approvals directly.",
    category: "𝗦𝗨𝗣𝗣𝗢𝗥𝗧",
    guide: {
      en: "{pn} <add|delete|list> [ThreadID]"
    },
  },

  onStart: async function ({ args, event, message, api, threadsData }) {
    const ownerId = '61568425442088';
    const supportGroupId = "8008566255928114";
    const { senderID, threadID } = event; // Get sender ID and the ID of the chat where the command is used

    // Fetch support group members for permission checks
    let supportGroupMembers;
    try {
        const supportThreadInfo = await api.getThreadInfo(supportGroupId);
        supportGroupMembers = supportThreadInfo.participantIDs;
    } catch (e) {
        console.error(`[APPROVAL] Critical Error: Could not fetch support group members from ID ${supportGroupId}.`, e);
        return message.reply("❌ Command failed. Could not get support group information. Please check the bot's configuration and ensure it's in the support group.");
    }
    
    const command = args[0]?.toLowerCase();
    const targetTid = args[1];
    
    const isOwner = senderID === ownerId;
    const isInSupportGroupChat = threadID === supportGroupId;

    switch (command) {
        case 'add':
            const isSupportMember = supportGroupMembers.includes(senderID);
            
            // PERMISSION CHECK:
            // Allow if:
            // 1. The user is the Owner (can use from anywhere).
            // 2. The user is a Support Member AND is using the command inside the Support Group.
            if (!isOwner && !(isSupportMember && isInSupportGroupChat)) {
                return message.reply("❗This command can only be used by support members inside the official support group chat, or by the bot owner from any chat.");
            }

            if (!targetTid || isNaN(targetTid)) {
                return message.reply("Please provide a valid Thread ID to approve.\nExample: `approval add 1234567890`");
            }

            try {
                const targetThreadData = await threadsData.get(targetTid);
                const now = new Date();
                const oneMonthLater = new Date(now);
                oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
                
                targetThreadData.settings = targetThreadData.settings || {};
                targetThreadData.settings.approval = true;
                targetThreadData.settings.expiry = oneMonthLater.getTime();
                targetThreadData.settings.current = { status: 'approved' };
                delete targetThreadData.settings.warned; 
                
                await threadsData.set(targetTid, targetThreadData);

                const options = { timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric" };
                const expiryDate = oneMonthLater.toLocaleDateString("en-US", options).replace(/(\d+)\/(\d+)\/(\d+)/, "$2-$1-$3");

                await message.reply(`✅ Successfully approved thread:\nTID: ${targetTid}\nExpires on: ${expiryDate}`);
                api.sendMessage(`🎉 Your thread has been approved by a Support Team member!\n\n🗓️ Validity: 30 days\n⏳ Expires on: ${expiryDate}`, targetTid);
            } catch (e) {
                console.error(`[APPROVAL ADD] Error approving thread ${targetTid}:`, e);
                message.reply(`❌ Failed to approve thread ${targetTid}. It's possible the bot is not in that thread.`);
            }
            break;

        case 'delete':
        case 'remove':
            // PERMISSION: Only the Bot Owner can use this.
            if (!isOwner) {
                return message.reply("❗Only the Bot Owner can use the 'delete' command.");
            }
            if (!targetTid || isNaN(targetTid)) {
                return message.reply("Please provide a valid Thread ID to disapprove.\nExample: `approval delete 1234567890`");
            }

            try {
                const targetThreadData = await threadsData.get(targetTid);
                targetThreadData.settings = targetThreadData.settings || {};
                targetThreadData.settings.approval = false;
                targetThreadData.settings.expiry = null;
                targetThreadData.settings.current = null;
                delete targetThreadData.settings.warned;
                
                await threadsData.set(targetTid, targetThreadData);

                await message.reply(`🗑️ Successfully disapproved thread: ${targetTid}`);
                api.sendMessage('❌ Your thread\'s approval has been removed by the Admin.', targetTid);
            } catch (e) {
                 message.reply(`❌ Failed to disapprove thread ${targetTid}.`);
            }
            break;

        case 'list':
            // PERMISSION: Only the Bot Owner can use this.
            if (!isOwner) {
                return message.reply("❗Only the Bot Owner can view the list of approved threads.");
            }
            
            const allThreads = await threadsData.getAll();
            const approvedThreads = allThreads
                .filter(t => t.settings?.approval === true && t.settings?.expiry)
                .map(t => {
                    const exDate = new Date(t.settings.expiry).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });
                    return `• TID: ${t.threadID}\n  Expires: ${exDate}`;
                });
      
            if (approvedThreads.length === 0) {
                return message.reply("📄 No threads are currently approved.");
            }
            return message.reply(`📄 Approved Threads (${approvedThreads.length}):\n\n${approvedThreads.join("\n\n")}`);

        default:
            message.reply(
                "✨ Approval Command Guide ✨\n\n" +
                "▫️`approval add <ThreadID>`\nTo approve a thread. (Must be used in the support group)\n\n" +
                "▫️`approval delete <ThreadID>`\nTo remove approval. (Owner only)\n\n" +
                "▫️`approval list`\nTo see all approved threads. (Owner only)"
            );
            break;
    }
  }
};
