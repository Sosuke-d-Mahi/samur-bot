const fs = require("fs-extra");

module.exports = {
	config: {
		name: "restart",
		version: "1.1",
		author: "NTKhang",
		countDown: 5,
		role: 2,
		description: {
			en: "Restart bot"
		},
		category: "Owner",
		guide: {
			en: "   {pn}: Restart bot"
		}
	},

	langs: {
		en: {
			restartting: "🔄 | Restarting bot..."
		}
	},

	onLoad: function ({ api }) {
		const tmpDir = `${__dirname}/tmp`;
		const pathFile = `${tmpDir}/restart.txt`;

		if (fs.existsSync(pathFile)) {
			const [tid, time] = fs.readFileSync(pathFile, "utf-8").split(" ");
			api.sendMessage(`✅ | Bot restarted\n⏰ | Time: ${(Date.now() - time) / 1000}s`, tid);
			fs.unlinkSync(pathFile);

			if (!fs.existsSync(tmpDir)) {
				fs.mkdirSync(tmpDir);
			}
		}
	},

	onStart: async function ({ message, event, getLang }) {
		const tmpDir = `${__dirname}/tmp`;
		const pathFile = `${tmpDir}/restart.txt`;

		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir);
		}

		fs.writeFileSync(pathFile, `${event.threadID} ${Date.now()}`);

		await message.reply(getLang("restartting"));
		process.exit(2);
	}
};