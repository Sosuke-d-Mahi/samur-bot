const { loadImage, createCanvas } = require("canvas");
const fs = require("fs");

module.exports.config = {
  name: "ttt",
  aliases: [],
  version: "1.0.1",
  role: 0,
  author: "Mirai Team | Mesbah Bb'e",
  description: { en: "Play caro with AI" },
  category: "game's",
  countDown: 5,
  guide: "x/o/delete/continue"
};

const startBoard = ({ isX, data }) => {
  data.board = Array.from({ length: 3 }, () => Array(3).fill(0));
  Object.assign(data, { isX, gameOn: true, gameOver: false, available: [] });
  return data;
};

const displayBoard = async (data) => {
  const canvas = createCanvas(1200, 1200);
  const cc = canvas.getContext("2d");
  const background = await loadImage("https://i.postimg.cc/nhDWmj1h/background.png");
  cc.drawImage(background, 0, 0, 1200, 1200);
  const quanO = await loadImage("https://i.postimg.cc/rFP6xLXQ/O.png");
  const quanX = await loadImage("https://i.postimg.cc/HLbFqcJh/X.png");

  data.board.forEach((row, i) => row.forEach((cell, j) => {
    const x = 54 + 366 * j, y = 54 + 366 * i;
    const img = cell == 1 ? (data.isX ? quanO : quanX) : (data.isX ? quanX : quanO);
    if (cell) cc.drawImage(img, x, y, 360, 360);
  }));

  const path = __dirname + "/cache/ttt.png";
  fs.writeFileSync(path, canvas.toBuffer("image/png"));
  return [fs.createReadStream(path)];
};

const checkWin = (data, player) => {
  const b = data.board;
  return (
    [0, 1, 2].some(i => b[i][0] === player && b[i][1] === player && b[i][2] === player) ||
    [0, 1, 2].some(i => b[0][i] === player && b[1][i] === player && b[2][i] === player) ||
    (b[0][0] === player && b[1][1] === player && b[2][2] === player) ||
    (b[0][2] === player && b[1][1] === player && b[2][0] === player)
  );
};

const solveAIMove = ({ depth, turn, data }) => {
  if (checkWin(data, 1)) return 1;
  if (checkWin(data, 2)) return -1;

  const available = getAvailable(data);
  if (available.length === 0) return 0;

  const scores = available.map(point => {
    placeMove({ point, player: turn, data });
    const score = solveAIMove({ depth: depth + 1, turn: 3 - turn, data });
    data.board[point[0]][point[1]] = 0;
    return score;
  });

  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  if (depth === 0) AIMove = available[scores.indexOf(turn === 1 ? maxScore : minScore)];
  return turn === 1 ? maxScore : minScore;
};

const placeMove = ({ point, player, data }) => {
  data.board[point[0]][point[1]] = player;
};

const getAvailable = (data) => {
  return data.board.flatMap((row, i) => row.map((cell, j) => (cell === 0 ? [i, j] : null))).filter(Boolean);
};

const move = (x, y, data) => {
  const available = getAvailable(data);
  if (!available.some(([i, j]) => i === x && j === y)) return "This box is already checked!";
  placeMove({ point: [x, y], player: 2, data });
  solveAIMove({ depth: 0, turn: 1, data });
  placeMove({ point: AIMove, player: 1, data });
};

const checkGameOver = (data) => {
  return getAvailable(data).length === 0 || checkWin(data, 1) || checkWin(data, 2);
};

const AIStart = (data) => {
  const point = [Math.round(Math.random()) * 2, Math.round(Math.random()) * 2];
  placeMove({ point, player: 1, data });
};

module.exports.onReply = async ({ event, api, Reply }) => {
  const { body, threadID, messageID, senderID } = event;
  const { author } = Reply;
  if (author != senderID) return;
  if (!global.game) global.game = {};
  if (!global.game.tictactoe) global.game.tictactoe = new Map();

  const data = global.game.tictactoe.get(threadID);
  if (!data || !data.gameOn) return;

  const number = parseInt(body);
  if (isNaN(number) || number < 1 || number > 9) return api.sendMessage("Invalid cell number!", threadID, messageID);

  const row = Math.floor((number - 1) / 3);
  const col = (number - 1) % 3;
  const msg = move(row, col, data) || (checkGameOver(data) ? (
    checkWin(data, 1) ? "You lose! " + ["chicken 😎", "You should quit😜", "You're still a noobie😎", "a bit immature 😎", "Oh my🤭 what a loss!", "easy game 😎"][Math.floor(Math.random() * 6)] :
    checkWin(data, 2) ? "You win! :<" :
    "It's tied!"
  ) : "Reply number of cells to check");

  if (checkGameOver(data)) global.game.tictactoe.delete(threadID);
  api.sendMessage({ body: msg, attachment: await displayBoard(data) }, threadID, (error, info) => {
    global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: senderID, messageID: info.messageID });
  }, messageID);
  api.unsendMessage(event.messageReply.messageID)
};

module.exports.onStart = async ({ event, api, args }) => {
  const { threadID, messageID, senderID } = event;
  if (!global.game) global.game = {};
  if (!global.game.tictactoe) global.game.tictactoe = new Map();

  const data = global.game.tictactoe.get(threadID) || { gameOn: false, player: "" };
  const prefix = global.utils.getPrefix(threadID) + this.config.name;

  if (!args.length) return api.sendMessage("Please select X or O", threadID, messageID);
  const arg = args[0].toLowerCase();

  if (arg === "delete") {
    global.game.tictactoe.delete(threadID);
    return api.sendMessage("Removed chessboard!", threadID, messageID);
  }
  if (arg === "continue") {
    if (!data.gameOn) return api.sendMessage("No data! use " + prefix + " x/o to play new", threadID, messageID);
    return api.sendMessage({ body: "Reply number of cells to check", attachment: await displayBoard(data) }, threadID, (error, info) => {
      global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: senderID, messageID: info.messageID });
    }, messageID);
    api.unsendMessage(event.messageReply.messageID)
  }
  if (!["x", "o"].includes(arg)) return api.sendMessage("Please select x or o", threadID, messageID);

  if (!data.gameOn) {
    const isX = arg === "x";
    const newData = startBoard({ isX, data, threadID });
    if (isX) AIStart(newData);
    newData.player = senderID;
    global.game.tictactoe.set(threadID, newData);
    return api.sendMessage({
      body: isX ? "I go first!\nReply number of cells to check" : "You go first!\nReply the number of cells to check",
      attachment: await displayBoard(newData)
    }, threadID, (error, info) => {
      global.GoatBot.onReply.set(info.messageID, { commandName: this.config.name, author: senderID, messageID: info.messageID });
    }, messageID);
    api.unsendMessage(event.messageReply.messageID)
  } else {
    return api.sendMessage("This group already exists a TicTacToe Board\nUse:\n" + prefix + " continue -> continue\n" + prefix + " delete -> erase", threadID, messageID);
  }
};
