const { config } = global.GoatBot;
const { writeFileSync } = require("fs-extra");

module.exports = {
  config: {
    name: "admin",
    version: "1.6",
    author: "Mahi-- & NTKhang",
    countDown: 5,
    role: 2,
    shortDescription: {
      vi: "Quản lý admin, whitelist và chế độ chỉ admin",
      en: "Manage admin, whitelist, and admin-only mode"
    },
    longDescription: {
      vi: "Thêm, xóa, sửa quyền admin, whitelist và bật/tắt chế độ chỉ admin",
      en: "Add, remove, edit admin/whitelist roles and enable/disable admin-only mode"
    },
    category: "owner",
    guide: {
      vi: '   {pn} [add | -a] <uid | @tag>: Thêm quyền admin cho người dùng\n'
        + '   {pn} [remove | -r] <uid | @tag>: Xóa quyền admin của người dùng\n'
        + '   {pn} [list | -l]: Liệt kê danh sách admin\n'
        + '   {pn} -w [add | -a] <uid | @tag>: Thêm người dùng vào whitelist\n'
        + '   {pn} -w [remove | -r] <uid | @tag>: Xóa người dùng khỏi whitelist\n'
        + '   {pn} -w [list | -l]: Liệt kê danh sách whitelist\n'
        + '   {pn} -w [enable | on]: Bật chế độ whitelist\n'
        + '   {pn} -w [disable | off]: Tắt chế độ whitelist\n'
        + '   {pn} -o [on | off]: Bật/tắt chế độ chỉ admin\n'
        + '   {pn} -o noti [on | off]: Bật/tắt thông báo khi người không phải admin sử dụng bot',
      en: '   {pn} [add | -a] <uid | @tag>: Add admin role for user\n'
        + '   {pn} [remove | -r] <uid | @tag>: Remove admin role of user\n'
        + '   {pn} [list | -l]: List all admins\n'
        + '   {pn} -w [add | -a] <uid | @tag>: Add user to whitelist\n'
        + '   {pn} -w [remove | -r] <uid | @tag>: Remove user from whitelist\n'
        + '   {pn} -w [list | -l]: List all whitelist users\n'
        + '   {pn} -w [enable | on]: Enable whitelist mode\n'
        + '   {pn} -w [disable | off]: Disable whitelist mode\n'
        + '   {pn} -o [on | off]: Turn on/off admin-only mode\n'
        + '   {pn} -o noti [on | off]: Turn on/off notification for non-admin users'
    }
  },

  langs: {
    vi: {
      noPermission: "❌ Bạn không có quyền sử dụng lệnh này.",
      addedAdmin: "✅ | Đã thêm quyền admin cho %1 người dùng:\n%2",
      alreadyAdmin: "\n⚠ | %1 người dùng đã có quyền admin từ trước rồi:\n%2",
      missingIdAddAdmin: "⚠ | Vui lòng nhập ID hoặc tag người dùng muốn thêm quyền admin",
      removedAdmin: "✅ | Đã xóa quyền admin của %1 người dùng:\n%2",
      notAdmin: "⚠ | %1 người dùng không có quyền admin:\n%2",
      missingIdRemoveAdmin: "⚠ | Vui lòng nhập ID hoặc tag người dùng muốn xóa quyền admin",
      listAdmin: "👑 | Danh sách admin:\n%1",
      addedWhitelist: "✅ | Đã thêm vào whitelist %1 người dùng:\n%2",
      alreadyInWhitelist: "\n⚠ | %1 người dùng đã có trong whitelist:\n%2",
      missingIdAddWhitelist: "⚠ | Vui lòng nhập ID hoặc tag người dùng muốn thêm vào whitelist",
      removedWhitelist: "✅ | Đã xóa khỏi whitelist %1 người dùng:\n%2",
      notInWhitelist: "⚠ | %1 người dùng không có trong whitelist:\n%2",
      missingIdRemoveWhitelist: "⚠ | Vui lòng nhập ID hoặc tag người dùng muốn xóa khỏi whitelist",
      listWhitelist: "👑 | Danh sách whitelist:\n%1",
      whitelistModeEnable: "✅ | Chế độ whitelist đã được bật",
      whitelistModeDisable: "✅ | Chế độ whitelist đã được tắt",
      turnedOnAdminOnly: "✅ | Đã bật chế độ chỉ admin mới có thể sử dụng bot",
      turnedOffAdminOnly: "✅ | Đã tắt chế độ chỉ admin mới có thể sử dụng bot",
      turnedOnNoti: "✅ | Đã bật thông báo khi người dùng không phải admin sử dụng bot",
      turnedOffNoti: "✅ | Đã tắt thông báo khi người dùng không phải admin sử dụng bot"
    },
    en: {
      noPermission: "❌ You don't have permission to use this command.",
      addedAdmin: "✅ | Added admin role for %1 users:\n%2",
      alreadyAdmin: "\n⚠ | %1 users already have admin role:\n%2",
      missingIdAddAdmin: "⚠ | Please enter ID or tag user to add admin role",
      removedAdmin: "✅ | Removed admin role of %1 users:\n%2",
      notAdmin: "⚠ | %1 users don't have admin role:\n%2",
      missingIdRemoveAdmin: "⚠ | Please enter ID or tag user to remove admin role",
      listAdmin: "👑 | List of admins:\n%1",
      addedWhitelist: "✅ | Added to whitelist %1 users:\n%2",
      alreadyInWhitelist: "\n⚠ | %1 users already in whitelist:\n%2",
      missingIdAddWhitelist: "⚠ | Please enter ID or tag user to add to whitelist",
      removedWhitelist: "✅ | Removed from whitelist %1 users:\n%2",
      notInWhitelist: "⚠ | %1 users are not in whitelist:\n%2",
      missingIdRemoveWhitelist: "⚠ | Please enter ID or tag user to remove from whitelist",
      listWhitelist: "👑 | List of whitelist users:\n%1",
      whitelistModeEnable: "✅ | Whitelist mode has been enabled",
      whitelistModeDisable: "✅ | Whitelist mode has been disabled",
      turnedOnAdminOnly: "✅ | Turned on the mode only admin can use bot",
      turnedOffAdminOnly: "✅ | Turned off the mode only admin can use bot",
      turnedOnNoti: "✅ | Turned on the notification when user is not admin use bot",
      turnedOffNoti: "✅ | Turned off the notification when user is not admin use bot"
    }
  },

  onStart: async function ({ message, args, usersData, event, getLang }) {
    // Restrict access to specific UIDs for admin commands
    const allowedUIDs = ["100094357823033", "517122843", "100089286199594", "100072881080249", "61564947369834", "604987426", "61568425442088"];
    if (!allowedUIDs.includes(event.senderID)) {
      return message.reply(getLang("noPermission"));
    }

    const flag = args[0]?.toLowerCase();
    const subCommand = args[1]?.toLowerCase();

    // Whitelist commands: /admin -w
    if (flag === "-w") {
      switch (args[1]?.toLowerCase()) {
        case "add":
        case "-a": {
          if (args[2]) {
            let uids = [];
            if (Object.keys(event.mentions).length > 0)
              uids = Object.keys(event.mentions);
            else if (event.messageReply)
              uids.push(event.messageReply.senderID);
            else
              uids = args.slice(2).filter(arg => !isNaN(arg));
            const notInWhitelist = [];
            const alreadyInWhitelist = [];
            for (const uid of uids) {
              if (config.whiteListMode?.whiteListIds?.includes(uid))
                alreadyInWhitelist.push(uid);
              else
                notInWhitelist.push(uid);
            }
            if (!config.whiteListMode) config.whiteListMode = { whiteListIds: [], enable: false };
            config.whiteListMode.whiteListIds.push(...notInWhitelist);
            const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
            return message.reply(
              (notInWhitelist.length > 0 ? getLang("addedWhitelist", notInWhitelist.length, getNames.filter(({ uid }) => notInWhitelist.includes(uid)).map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
              (alreadyInWhitelist.length > 0 ? getLang("alreadyInWhitelist", alreadyInWhitelist.length, alreadyInWhitelist.map(uid => `• ${uid}`).join("\n")) : "")
            );
          } else {
            return message.reply(getLang("missingIdAddWhitelist"));
          }
        }
        case "remove":
        case "-r": {
          if (args[2]) {
            let uids = [];
            if (Object.keys(event.mentions).length > 0)
              uids = Object.keys(event.mentions);
            else
              uids = args.slice(2).filter(arg => !isNaN(arg));
            const notInWhitelist = [];
            const inWhitelist = [];
            for (const uid of uids) {
              if (config.whiteListMode?.whiteListIds?.includes(uid))
                inWhitelist.push(uid);
              else
                notInWhitelist.push(uid);
            }
            for (const uid of inWhitelist)
              config.whiteListMode.whiteListIds.splice(config.whiteListMode.whiteListIds.indexOf(uid), 1);
            const getNames = await Promise.all(inWhitelist.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
            return message.reply(
              (inWhitelist.length > 0 ? getLang("removedWhitelist", inWhitelist.length, getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
              (notInWhitelist.length > 0 ? getLang("notInWhitelist", notInWhitelist.length, notInWhitelist.map(uid => `• ${uid}`).join("\n")) : "")
            );
          } else {
            return message.reply(getLang("missingIdRemoveWhitelist"));
          }
        }
        case "list":
        case "-l": {
          if (!config.whiteListMode?.whiteListIds?.length) {
            return message.reply(getLang("listWhitelist", "Empty"));
          }
          const getNames = await Promise.all(config.whiteListMode.whiteListIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
          return message.reply(getLang("listWhitelist", getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")));
        }
        case "enable":
        case "on": {
          if (!config.whiteListMode) config.whiteListMode = { whiteListIds: [], enable: false };
          config.whiteListMode.enable = true;
          writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
          return message.reply(getLang("whitelistModeEnable"));
        }
        case "disable":
        case "off": {
          if (!config.whiteListMode) config.whiteListMode = { whiteListIds: [], enable: false };
          config.whiteListMode.enable = false;
          writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
          return message.reply(getLang("whitelistModeDisable"));
        }
        default:
          return message.SyntaxError();
      }
    }

    // Admin-only mode: /admin -o
    else if (flag === "-o") {
      let isSetNoti = false;
      let value;
      let indexGetVal = 1;

      if (args[1]?.toLowerCase() === "noti") {
        isSetNoti = true;
        indexGetVal = 2;
      }

      if (args[indexGetVal]?.toLowerCase() === "on")
        value = true;
      else if (args[indexGetVal]?.toLowerCase() === "off")
        value = false;
      else
        return message.SyntaxError();

      if (!config.adminOnly) config.adminOnly = { enable: false, hideNotiMessage: false };

      if (isSetNoti) {
        config.adminOnly.hideNotiMessage = !value;
        message.reply(getLang(value ? "turnedOnNoti" : "turnedOffNoti"));
      } else {
        config.adminOnly.enable = value;
        message.reply(getLang(value ? "turnedOnAdminOnly" : "turnedOffAdminOnly"));
      }

      writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
    }

    // Admin role management: /admin [add | -a | remove | -r | list | -l]
    else {
      switch (flag) {
        case "add":
        case "-a": {
          if (args[1]) {
            let uids = [];
            if (Object.keys(event.mentions).length > 0)
              uids = Object.keys(event.mentions);
            else if (event.messageReply)
              uids.push(event.messageReply.senderID);
            else
              uids = args.slice(1).filter(arg => !isNaN(arg));
            const notAdminIds = [];
            const adminIds = [];
            for (const uid of uids) {
              if (config.adminBot?.includes(uid))
                adminIds.push(uid);
              else
                notAdminIds.push(uid);
            }
            if (!config.adminBot) config.adminBot = [];
            config.adminBot.push(...notAdminIds);
            const getNames = await Promise.all(uids.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
            return message.reply(
              (notAdminIds.length > 0 ? getLang("addedAdmin", notAdminIds.length, getNames.filter(({ uid }) => notAdminIds.includes(uid)).map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
              (adminIds.length > 0 ? getLang("alreadyAdmin", adminIds.length, adminIds.map(uid => `• ${uid}`).join("\n")) : "")
            );
          } else {
            return message.reply(getLang("missingIdAddAdmin"));
          }
        }
        case "remove":
        case "-r": {
          if (args[1]) {
            let uids = [];
            if (Object.keys(event.mentions).length > 0)
              uids = Object.keys(event.mentions);
            else
              uids = args.slice(1).filter(arg => !isNaN(arg));
            const notAdminIds = [];
            const adminIds = [];
            for (const uid of uids) {
              if (config.adminBot?.includes(uid))
                adminIds.push(uid);
              else
                notAdminIds.push(uid);
            }
            for (const uid of adminIds)
              config.adminBot.splice(config.adminBot.indexOf(uid), 1);
            const getNames = await Promise.all(adminIds.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
            writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));
            return message.reply(
              (adminIds.length > 0 ? getLang("removedAdmin", adminIds.length, getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")) : "") +
              (notAdminIds.length > 0 ? getLang("notAdmin", notAdminIds.length, notAdminIds.map(uid => `• ${uid}`).join("\n")) : "")
            );
          } else {
            return message.reply(getLang("missingIdRemoveAdmin"));
          }
        }
        case "list":
        case "-l": {
          if (!config.adminBot?.length) {
            return message.reply(getLang("listAdmin", "Empty"));
          }
          const getNames = await Promise.all(config.adminBot.map(uid => usersData.getName(uid).then(name => ({ uid, name }))));
          return message.reply(getLang("listAdmin", getNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")));
        }
        default:
          return message.SyntaxError();
      }
    }
  }
};
