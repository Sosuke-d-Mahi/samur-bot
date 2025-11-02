const axios = require("axios");
const fs = require("fs");
const path = require("path");

const defaultPassword = "6244";

module.exports = {
	config: {
		name: "savetext",
		aliases: ["save"],
		version: "2.1",
		author: "Jsus && tanvir",
		countDown: 5,
		role: 2,
		shortDescription: "SaveText V2",
		longDescription:
			"SaveText V2",
		guide: {
			en:
				"• {pn} <filename>\n" +
				"  - Saves with no lock.\n\n" +
				"• {pn} lock <filename>\n" +
				"  - Saves with a default password access lock.\n\n" +
				"• {pn} lock <filename> <password>\n" +
				"  - Saves with a custom password access lock.\n\n" +
				"• {pn} editlock <filename>\n" +
				"  - Saves with a default password edit lock only.\n\n" +
				"• {pn} editlock <filename> <password>\n" +
				"  - Saves with a custom password for both access and edit lock.\n\n" +
				"• {pn} view <save_url> [password]\n" +
				"  - Retrieves the raw URL for a locked Saves.",
		},
	},

	onStart: async function ({ event, args, message }) {
		if (!global.GoatBot.config.adminBot.includes(event.senderID)) {
			return message.reply("❌ | Access Denied");
		}

		const addr = (await axios.get(`https://raw.githubusercontent.com/Tanvir0999/stuffs/main/raw/addresses.json`)).data.savetext;
		
		const validExts = [
			".js",
			".py",
			".html",
			".css",
			".bash",
			".sh",
			".json",
			".txt",
			".env",
		];

		const randSet = () => {
			const length = 12 + Math.floor(Math.random() * 5);
			return ([...Array(length)]
				.map(() => ((Math.random() * 36) | 0).toString(36))
				.join("")).toUpperCase();
		};

		if (args.length === 0) {
			return message.reply(`Please specify a subcommand or filename.`);
		}

		const command = args[0].toLowerCase();

		try {
			if (command === "view") {
				if (args.length < 2)
					return message.reply("Please provide the URL to view.");

				const urlToView = args[1];
				const password = args[2] || defaultPassword;
				const textId = urlToView.substring(urlToView.lastIndexOf("/") + 1);

				const tokenRes = await axios.post(
					`${addr}/api/verify-access/${textId}`,
					{ password },
				);
				if (!tokenRes.data.success) {
					return message.reply("Incorrect password.");
				}
				const accessToken = tokenRes.data.cookie;

				const rawRes = await axios.post(
					`${addr}/api/raw/${textId}`,
					{},
					{
						headers: { Authorization: `Bearer ${accessToken}` },
					},
				);
				const rawId = rawRes.data.rawId;

				return message.reply(
					`✅ | Access Granted.\n\n🔗 Raw URL: ${addr}/raw/${rawId}`,
				);
			}

			let fileName,
				password,
				content,
				lockSettings = {};
			let provideRawUrl = false;

			switch (command) {
				case "lock":
					fileName = args[1];
					password = args[2];
					lockSettings = {
						accessLock: true,
						editLock: false,
						password: password || defaultPassword,
					};
					provideRawUrl = false;
					break;

				case "editlock":
					fileName = args[1];
					password = args[2];
					if (password) {
						lockSettings = {
							accessLock: true,
							editLock: true,
							password: password,
						};
						provideRawUrl = false;
					} else {
						lockSettings = {
							accessLock: false,
							editLock: true,
							password: defaultPassword,
						};
						provideRawUrl = true;
					}
					break;

				default:
					fileName = args[0];
					lockSettings = { accessLock: false, editLock: false, password: "" };
					provideRawUrl = true;
					break;
			}

			if (!fileName) {
				return message.reply(`Provide a filename`);
			}

			if (!validExts.includes(path.extname(fileName))) {
				return message.reply(`⚠️ | Invalid file extension. The file is being treated as a plain text link.\n\n🔗 URL: ${addr}/${fileName}`);
			}

			const filePath = path.join(process.cwd(), "scripts", "cmds", fileName);
			content = fs.readFileSync(filePath, "utf-8");

			const textId = randSet();

			await axios.post(`${addr}/api/save/${textId}`,
				{ content },
				{
					headers: { "Content-Type": "application/json" },
				},);

			if (lockSettings.accessLock || lockSettings.editLock) {
				await axios.post(`${addr}/api/lock/${textId}`, lockSettings, {
					headers: { "Content-Type": "application/json" },
				});
			}

			let replyMsg;
			const viewUrl = `${addr}/${textId}`;

			if (provideRawUrl) {
				const rawIdRes = await axios.post(`${addr}/api/raw/${textId}`);
				replyMsg = `View URL: ${viewUrl}\n\nRaw URL: ${addr}/raw/${rawIdRes.data.rawId}`;
			} else {
				replyMsg = `View URL: ${viewUrl}`;
			}
			return message.reply(replyMsg);
		} catch (err) {
			if (err.code === "ENOENT") {
				return message.reply(`❌ File Not Found: Could not find "${err.path}"`);
			}
			console.error(err);
			return message.error(err, `An unexpected error occurred`);
		}
	},
};