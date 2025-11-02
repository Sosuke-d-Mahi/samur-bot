module.exports = {
    config: {
        name: "tag",
        version: "1.7.4",
        author: "Mahi--",
        countDown: 0,
        role: 0,
        hasPermission: 0,
        description: "Tag a user by ID, reply, or name in the group.",
        category: "tag",
        commandCategory: "tag",
        guide: "{pn} <name | @mention | reply> [message]",
        usages: "Provide a name, mention, or reply to tag a user, and optionally add a message."
    },
    onStart: async ({ api, args, event }) => await tagUser({ api, args, event }),
    run: async ({ api, args, event }) => await tagUser({ api, args, event })
};

async function getUserID(api, nameQuery, event) {
    try {
        const threadInfo = await api.getThreadInfo(event.threadID);
        const match = threadInfo.userInfo.find(user => 
            user.name && user.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").includes(nameQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ""))
        );

        return match ? match.id : null;
    } catch (error) {
        console.error("Error in getUserID function:", error);
        return null;
    }
}

async function tagUser({ api, args, event }) {
    try {
        let ID = null;
        let messageText = args.slice(1).join(" ");

        // Check if the message is a reply to another message
        if (event.messageReply) {
            ID = event.messageReply.senderID;
            messageText = args.join(" "); // Use all arguments as message text if replying
        } 
        // Check if the first argument is a direct mention or name
        else if (args.length > 0) {
            // Try to get user by direct ID mention
            if (args[0].startsWith("@") && !isNaN(args[0].substring(1))) {
                ID = args[0].substring(1);
            } else {
                const nameQuery = args[0];
                ID = await getUserID(api, nameQuery, event);
                if (!ID) {
                    return api.sendMessage("No user found with that name. Please try a different name or mention them directly.", event.threadID, event.messageID);
                }
            }
        } else {
            return api.sendMessage("Please provide a name, mention, or reply to tag a user.", event.threadID, event.messageID);
        }

        // Fetch user information for tagging
        const mentionedUser = await api.getUserInfo(ID);
        if (mentionedUser && mentionedUser[ID]) {
            const userName = mentionedUser[ID].name;
            const body = messageText ? `${userName}, ${messageText}` : userName;

            await api.sendMessage({
                body: body,
                mentions: [{
                    tag: userName,
                    id: ID
                }]
            }, event.threadID, event.messageID);
        } else {
            api.sendMessage("Failed to retrieve user information. Please try again.", event.threadID, event.messageID);
        }
    } catch (error) {
        console.error(error);
        api.sendMessage(`An error occurred: ${error.message}`, event.threadID, event.messageID);
    }
}