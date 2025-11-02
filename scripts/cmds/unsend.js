module.exports = {
	config: {
		name: "unsend",
		version: "1.3",
      aliases: ["u", "uns"],
		author: "Mahi--",
		countDown: 5,
		role: 0,
		description: {
			en: "Unsend a message by replying to it."
		},
		category: "utility",
		guide: {
			en: "{pn} (while replying to a message)"
		}
	},

	langs: {
		en: {
			syntaxError: "Please reply to a message you want to unsend.",
			noPermission: "❌ You do not have permission to unsend this message.",
			unsendError: "❌ An error occurred. The message may have already been unsent."
		}
	},

	onStart: async function ({ message, event, api, getLang, role }) {
		const { senderID, messageReply } = event;

		// Check if the user is replying to a message
		if (!messageReply) {
			return message.reply(getLang("syntaxError"));
		}

		const targetMessageID = messageReply.messageID;
		const targetSenderID = messageReply.senderID;
		const isAdmin = role > 0;

		// Check for permission:
		// 1. You can unsend your own message.
		// 2. You can unsend the bot's message.
		// 3. Admins can unsend anyone's message.
		if (targetSenderID === senderID || targetSenderID === api.getCurrentUserID() || isAdmin) {
			return api.unsendMessage(targetMessageID, (err) => {
				if (err) {
					// If there's an error (e.g., message already deleted), send a reply
					return message.reply(getLang("unsendError"));
				}
			});
		} else {
			// If the user has no permission
			return message.reply(getLang("noPermission"));
		}
	}
};