const { getPrefix } = global.utils;
const { commands } = global.GoatBot;

module.exports = {
  config: {
    name: "help",
    version: "1.22",
    author: "Mahi--",
    countDown: 0,
    role: 0,
    shortDescription: { en: "View command usage" },
    longDescription: { en: "Search commands by first letter, category, or author." },
    category: "info",
    guide: {
      en: "{pn}help <cmdName or alias>\n{pn}help -s <letter> (search by first letter)\n{pn}help -c <category> (search by category)\n{pn}help -a <author> (search by author)\n{pn}help -k <keyword> (search by keyword)",
    },
  },

  onStart: async function ({ message, args, event, role }) {
    const { threadID } = event;
    const prefix = getPrefix(threadID);
    const baseMsg = `━━━ ☠ 𝗔𝗡𝗖𝗛𝗘𝗦𝗧𝗢𝗥 𝗔𝗜 ☠ ━━━\n\n`;

    if (args.length === 0) {
      let msg = baseMsg;
      const categories = {};

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        const category = value.config.category || "Uncategorized";
        if (!categories[category]) categories[category] = [];
        categories[category].push(name);
      }

      for (const category in categories) {
        msg += `╭──『 ${category.toUpperCase()} 』\n`;
        msg += ` ✧ ${categories[category].sort().join(' ✧ ')} ✧\n`;
        msg += `╰────────────◊\n\n`;
      }

      msg += `📊 Total Commands: ${commands.size}\n`;
      msg += `❓ Use ${prefix}help <cmd> for details on a command!`;

      await message.reply(msg);
      return;
    }

    // Search by first letter
    if (args[0] === "-s" && args[1]) {
      const searchLetter = args[1].toLowerCase();
      let msg = baseMsg;
      const searchResults = [];

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        if (name.startsWith(searchLetter)) searchResults.push(name);
      }

      msg += searchResults.length
        ? `🔍 Found ${searchResults.length} command(s) starting with "${searchLetter.toUpperCase()}":\n✧ ${searchResults.sort().join(" ✧ ")}`
        : `❌ No commands found starting with "${searchLetter.toUpperCase()}".`;

      await message.reply(msg);
      return;
    }

    // Search by category
    if (args[0] === "-c" && args[1]) {
      const searchCategory = args.slice(1).join(" ").toLowerCase();
      let msg = baseMsg;
      const searchResults = [];

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        if ((value.config.category || "Uncategorized").toLowerCase() === searchCategory) {
          searchResults.push(name);
        }
      }

      msg += searchResults.length
        ? `📂 Found ${searchResults.length} command(s) in "${searchCategory.toUpperCase()}":\n✧ ${searchResults.sort().join(" ✧ ")}`
        : `❌ No commands found in category "${searchCategory.toUpperCase()}".`;

      await message.reply(msg);
      return;
    }

    // Search by author
    if (args[0] === "-a" && args[1]) {
      const searchAuthor = args.slice(1).join(" ").toLowerCase();
      let msg = baseMsg;
      const searchResults = [];

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        let author = value.config.author;
        if (Array.isArray(author)) {
          author = author.join(", ");
        } else if (typeof author !== "string") {
          author = "Unknown";
        }
        if (author.toLowerCase().includes(searchAuthor)) searchResults.push(name);
      }

      msg += searchResults.length
        ? `✍ Found ${searchResults.length} command(s) by "${searchAuthor.toUpperCase()}":\n✧ ${searchResults.sort().join(" ✧ ")}`
        : `❌ No commands found by author "${searchAuthor.toUpperCase()}".`;

      await message.reply(msg);
      return;
    }

    // Search by keyword
    if (args[0] === "-k" && args[1]) {
      const searchKeyword = args.slice(1).join(" ").toLowerCase();
      let msg = baseMsg;
      const searchResults = [];

      for (const [name, value] of commands) {
        if (value.config.role > 1 && role < value.config.role) continue;
        if ((value.config.name || "").toLowerCase().includes(searchKeyword)) {
          searchResults.push(name);
        }
      }

      msg += searchResults.length
        ? `🔍 Found ${searchResults.length} command(s) related to "${searchKeyword}":\n✧ ${searchResults.sort().join(" ✧ ")}`
        : `❌ No commands found related to "${searchKeyword}".`;

      await message.reply(msg);
      return;
    }

    // Search by command name or alias
    const query = args[0].toLowerCase();
    let command = commands.get(query);

    if (!command) {
      for (const [name, value] of commands) {
        const aliases = value.config.aliases || [];
        if (aliases.includes(query)) {
          command = value;
          break;
        }
      }
    }

    if (!command) return message.reply(`❌ Command "${query}" not found.`);

    const config = command.config;
    let author = config.author;

    if (Array.isArray(author)) {
      author = author.join(", ");
    } else if (typeof author !== "string") {
      author = "Unknown";
    }

    const usage = (config.guide?.en || "No guide available.").replace(/{pn}/g, prefix).replace(/{cmdName}/g, config.name);
    const aliasesList = config.aliases?.length ? config.aliases.join(", ") : "None";

    const response = `╭── 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 ───⭓
  │ Name: ${config.name}
  │ Aliases: ${aliasesList}
  │ Description: ${config.longDescription?.en || "No description"}
  │ Category: ${config.category || "Uncategorized"}
  │ Author: ${author}
  │ Role: ${config.role}
  │ Version: ${config.version || "1.0"}
  │ Usage: ${usage}
  ╰━━━━━━━❖`;

    await message.reply(response);
  },
};