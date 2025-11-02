const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const chessDataPath = path.join(__dirname, 'cache', 'chess.json');

const chessController = {
    games: {},
    read: function() {
        if (!fs.existsSync(chessDataPath)) fs.writeJsonSync(chessDataPath, {});
        this.games = fs.readJsonSync(chessDataPath);
    },
    write: function() { fs.writeJsonSync(chessDataPath, this.games, { spaces: 2 }); },
    getGame: function(threadID, gameKey) { return this.games[threadID]?.[gameKey]; },
    setGame: function(threadID, gameKey, gameData) {
        if (!this.games[threadID]) this.games[threadID] = {};
        this.games[threadID][gameKey] = gameData;
        this.write();
    },
    deleteGame: function(threadID, gameKey) {
        if (this.games[threadID]?.[gameKey]) {
            delete this.games[threadID][gameKey];
            this.write();
        }
    },
    findUserGame: function(threadID, userID) {
        if (!this.games[threadID]) return null;
        for (const key in this.games[threadID]) {
            const game = this.games[threadID][key];
            if (game.players.w.id === userID || game.players.b.id === userID) {
                return key;
            }
        }
        return null;
    }
};

const chessLogic = {
    getInitialBoard: () => ([
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'], ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'], ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ]),
    getPieceColor: (piece) => (piece === piece.toUpperCase() ? 'w' : 'b'),
    isKingInCheck: function(board, kingColor) {
        let kingPos;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c]?.toLowerCase() === 'k' && this.getPieceColor(board[r][c]) === kingColor) {
                    kingPos = { r, c };
                    break;
                }
            }
            if (kingPos) break;
        }
        if (!kingPos) return false;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (piece && this.getPieceColor(piece) !== kingColor) {
                    const moves = this.getValidMoves(board, r, c, true);
                    if (moves.some(move => move.r === kingPos.r && move.c === kingPos.c)) {
                        return true;
                    }
                }
            }
        }
        return false;
    },
    getValidMoves: function(board, row, col, isForCheck = false) {
        const piece = board[row][col];
        if (!piece) return [];
        const color = this.getPieceColor(piece);
        const moves = [];

        const addMove = (r, c) => {
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const target = board[r][c];
                if (!target) moves.push({ r, c, capture: false });
                else if (this.getPieceColor(target) !== color) moves.push({ r, c, capture: true });
            }
        };

        const type = piece.toLowerCase();
        switch (type) {
            case 'p':
                const dir = color === 'w' ? -1 : 1;
                const startRow = color === 'w' ? 6 : 1;
                if (row + dir >= 0 && row + dir < 8 && !board[row + dir][col]) addMove(row + dir, col);
                if (row === startRow && !board[row + dir][col] && !board[row + 2 * dir][col]) addMove(row + 2 * dir, col);
                [-1, 1].forEach(side => {
                    if (col + side >= 0 && col + side < 8 && row + dir >= 0 && row + dir < 8) {
                        const target = board[row + dir][col + side];
                        if (target && this.getPieceColor(target) !== color) moves.push({ r: row + dir, c: col + side, capture: true });
                    }
                });
                break;
            case 'r': case 'q':
                [-1, 1, 0, 0].forEach((dr, i) => {
                    const dc = [0, 0, -1, 1][i];
                    for (let d = 1; d < 8; d++) {
                        const r = row + dr * d, c = col + dc * d;
                        if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                        addMove(r, c); if (board[r][c]) break;
                    }
                });
                if (type === 'r') break;
            case 'b':
                [-1, -1, 1, 1].forEach((dr, i) => {
                    const dc = [-1, 1, -1, 1][i];
                     for (let d = 1; d < 8; d++) {
                        const r = row + dr * d, c = col + dc * d;
                        if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                        addMove(r, c); if (board[r][c]) break;
                    }
                });
                break;
            case 'n':
                [-2, -2, -1, -1, 1, 1, 2, 2].forEach((dr, i) => {
                    addMove(row + dr, [ -1, 1, -2, 2, -2, 2, -1, 1][i] + col);
                });
                break;
            case 'k':
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    addMove(row + dr, col + dc);
                }
                break;
        }

        if (isForCheck) return moves;

        return moves.filter(move => {
            const newBoard = board.map(r => [...r]);
            newBoard[move.r][move.c] = piece;
            newBoard[row][col] = null;
            return !this.isKingInCheck(newBoard, color);
        });
    },
    isGameOver: function(board, turn) {
        for(let r=0; r < 8; r++){
            for(let c=0; c < 8; c++){
                const piece = board[r][c];
                if(piece && this.getPieceColor(piece) === turn){
                    if(this.getValidMoves(board, r, c).length > 0) return { over: false };
                }
            }
        }
        return { over: true, isCheckmate: this.isKingInCheck(board, turn) };
    }
};

const pieceUnicode = { 'p': '♟︎', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔' };
const squareSize = 80;
const boardSize = squareSize * 8;

async function drawChessBoard(game) {
    const canvas = createCanvas(boardSize + 250, boardSize);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#1d2b4a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
        ctx.fillRect(c * squareSize, r * squareSize, squareSize, squareSize);
        const num = r * 8 + c + 1;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#8a6d54' : '#d2b48c';
        ctx.font = '12px Arial';
        ctx.fillText(num, c * squareSize + 2, r * squareSize + 12);
    }
    
    if (game.state === 'selecting_destination' && game.selectedSquare) {
        const { r, c } = game.selectedSquare;
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.fillRect(c * squareSize, r * squareSize, squareSize, squareSize);
        game.validMoves.forEach(move => {
            ctx.beginPath();
            ctx.arc(move.c * squareSize + squareSize/2, move.r * squareSize + squareSize/2, squareSize / 4, 0, Math.PI * 2);
            ctx.fillStyle = move.capture ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 255, 0, 0.5)';
            ctx.fill();
        });
    }

    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const piece = game.board[r][c];
        if (piece) ctx.fillText(pieceUnicode[piece], c * squareSize + squareSize / 2, r * squareSize + squareSize / 2);
    }
    
    const panelX = boardSize + 20;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Chess Match', panelX, 40);
    if(game.betAmount > 0) ctx.fillText(`Bet: $${game.betAmount.toLocaleString()}`, panelX, 70);

    const turnPlayerName = game.turn === 'w' ? game.players.w.name : game.players.b.name;
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`Turn: ${turnPlayerName}`, panelX, 110);
    
    ctx.font = '16px Arial';
    ctx.fillText('White:', panelX, 150);
    ctx.fillText(game.players.w.name, panelX + 10, 170);
    ctx.fillText('Black:', panelX, 210);
    ctx.fillText(game.players.b.name, panelX + 10, 230);
    
    if (game.statusMessage) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        wrapText(ctx, game.statusMessage, boardSize/2, boardSize/2, boardSize - 20, 30);
    }

    const outputPath = path.join(__dirname, 'cache', `chess_${game.threadID}.png`);
    await fs.ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
    return outputPath;
}

module.exports = {
    config: {
        name: "chess",
        version: "2.0",
        author: "Mahi--",
        role: 0,
        shortDescription: { en: "Play chess with bets and multiple games." },
        category: "fun",
        guide: { en: "{pn} [@mention] [bet_amount] - Challenge a friend\n{pn} - Play vs Bot\n{pn} end - End your current game" }
    },

    onLoad: function() { chessController.read(); },

    onStart: async function ({ api, event, message, usersData, args }) {
        const threadID = event.threadID;
        const senderID = event.senderID;
        
        if (args[0]?.toLowerCase() === 'end') {
             const gameKey = chessController.findUserGame(threadID, senderID);
             if(gameKey) {
                chessController.deleteGame(threadID, gameKey);
                return message.reply("Your chess game has been ended.");
             }
             return message.reply("You are not currently in a game to end.");
        }

        let betAmount = 0;
        let opponentID;
        const mention = Object.keys(event.mentions)[0];
        
        if (!isNaN(parseInt(args[0])) && mention) {
            betAmount = parseInt(args[0]);
            opponentID = mention;
        } else if (mention) {
            opponentID = mention;
        } else {
            opponentID = api.getCurrentUserID();
        }

        if(betAmount < 0) return message.reply("Bet amount must be a positive number.");
        if (senderID === opponentID) return message.reply("You cannot challenge yourself.");

        const player1Name = await usersData.getName(senderID);
        const player2Name = opponentID === api.getCurrentUserID() ? "Casino Bot" : await usersData.getName(opponentID);
        const gameKey = [senderID, opponentID].sort().join('_');

        if (chessController.getGame(threadID, gameKey)) {
            return message.reply(`A game is already in progress between you and ${player2Name}.`);
        }
        
        if (betAmount > 0) {
            const player1Money = (await usersData.get(senderID)).money || 0;
            const player2Money = (await usersData.get(opponentID)).money || 0;
            if(player1Money < betAmount) return message.reply(`You don't have enough money ($${betAmount.toLocaleString()}) to make this bet.`);
            if(player2Money < betAmount) return message.reply(`${player2Name} doesn't have enough money ($${betAmount.toLocaleString()}) for this bet.`);
        }
        
        const newGame = {
            board: chessLogic.getInitialBoard(), turn: 'w',
            players: { w: { id: senderID, name: player1Name }, b: { id: opponentID, name: player2Name } },
            state: 'selecting_piece', selectedSquare: null, validMoves: [], statusMessage: null, betAmount
        };
        
        chessController.setGame(threadID, gameKey, newGame);
        
        const boardPath = await drawChessBoard(newGame);
        const sentMessage = await message.reply({
            body: `Chess match started!\nWhite: ${player1Name}\nBlack: ${player2Name}\n\nIt's White's turn. Reply with the square number of the piece to move.`,
            attachment: fs.createReadStream(boardPath)
        });

        fs.unlinkSync(boardPath);
        
        global.GoatBot.onReply.set(sentMessage.messageID, {
            commandName: this.config.name, messageID: sentMessage.messageID, threadID, gameKey
        });
    },

    onReply: async function ({ api, event, message, usersData, Reply }) {
        const { threadID, gameKey } = Reply;
        const game = chessController.getGame(threadID, gameKey);

        if (!game) return;
        const currentPlayer = game.turn === 'w' ? game.players.w : game.players.b;
        if (event.senderID !== currentPlayer.id) return;

        const squareNum = parseInt(event.body);
        if (isNaN(squareNum) || squareNum < 1 || squareNum > 64) return message.reply("Please reply with a valid square number (1-64).");
        
        const r = Math.floor((squareNum - 1) / 8);
        const c = (squareNum - 1) % 8;
        
        let replyBody = "";
        let isGameOver = false;

        if (game.state === 'selecting_piece') {
            const piece = game.board[r][c];
            if (!piece || chessLogic.getPieceColor(piece) !== game.turn) return message.reply("Invalid selection. Please select one of your own pieces.");
            
            game.validMoves = chessLogic.getValidMoves(game.board, r, c);
            if (game.validMoves.length === 0) return message.reply("This piece has no valid moves.");
            
            game.state = 'selecting_destination';
            game.selectedSquare = { r, c };
            replyBody = `Piece at square ${squareNum} selected. Reply with the destination square number.`;

        } else if (game.state === 'selecting_destination') {
            const isValidMove = game.validMoves.find(move => move.r === r && move.c === c);
            if (!isValidMove) {
                game.state = 'selecting_piece';
                game.selectedSquare = null;
                game.validMoves = [];
                replyBody = "Invalid move. Please select a piece to move again.";
            } else {
                const from = game.selectedSquare;
                const piece = game.board[from.r][from.c];
                game.board[r][c] = piece;
                game.board[from.r][from.c] = null;
                
                if (piece.toLowerCase() === 'p' && (r === 0 || r === 7)) game.board[r][c] = game.turn === 'w' ? 'Q' : 'q';
                
                game.turn = game.turn === 'w' ? 'b' : 'w';
                game.state = 'selecting_piece';
                game.selectedSquare = null;
                game.validMoves = [];
                const nextPlayer = game.turn === 'w' ? game.players.w : game.players.b;

                const gameState = chessLogic.isGameOver(game.board, game.turn);
                if(gameState.over) {
                    isGameOver = true;
                    if(gameState.isCheckmate) {
                        const winner = game.turn === 'w' ? game.players.b : game.players.w;
                        const loser = game.turn === 'w' ? game.players.w : game.players.b;
                        game.statusMessage = `CHECKMATE! ${winner.name} wins!`;
                        replyBody = game.statusMessage;
                        
                        let prize = 0;
                        if(loser.id === api.getCurrentUserID()) prize = 200000;
                        else if (game.betAmount > 0) prize = game.betAmount * 2;
                        
                        if(prize > 0) {
                            const winnerData = await usersData.get(winner.id);
                            await usersData.set(winner.id, { money: (winnerData.money || 0) + prize });
                            replyBody += `\n${winner.name} won $${prize.toLocaleString()}!`;
                        }

                    } else {
                        game.statusMessage = "STALEMATE! It's a draw!";
                        replyBody = game.statusMessage;
                    }
                    chessController.deleteGame(threadID, gameKey);
                } else {
                    replyBody = `Move successful. It's now ${nextPlayer.name}'s turn.`;
                }
            }
        }
        
        const isBotTurn = !isGameOver && game.players[game.turn].id === api.getCurrentUserID();

        if (isBotTurn) {
            await message.reply("Bot is thinking...");
            const allBotMoves = [];
            for (let br = 0; br < 8; br++) for (let bc = 0; bc < 8; bc++) {
                const piece = game.board[br][bc];
                if (piece && chessLogic.getPieceColor(piece) === game.turn) {
                    const moves = chessLogic.getValidMoves(game.board, br, bc);
                    if(moves.length > 0) allBotMoves.push({ from: {r: br, c: bc}, moves });
                }
            }

            if (allBotMoves.length > 0) {
                const randomPieceMoves = allBotMoves[Math.floor(Math.random() * allBotMoves.length)];
                const randomMove = randomPieceMoves.moves[Math.floor(Math.random() * randomPieceMoves.moves.length)];
                
                const piece = game.board[randomPieceMoves.from.r][randomPieceMoves.from.c];
                game.board[randomMove.r][randomMove.c] = piece;
                game.board[randomPieceMoves.from.r][randomPieceMoves.from.c] = null;
                
                if (piece.toLowerCase() === 'p' && (randomMove.r === 0 || randomMove.r === 7)) game.board[randomMove.r][randomMove.c] = 'q';

                game.turn = 'w';
                const gameState = chessLogic.isGameOver(game.board, game.turn);
                if(gameState.over) {
                    isGameOver = true;
                    if(gameState.isCheckmate){
                        game.statusMessage = `CHECKMATE! Bot wins!`;
                        replyBody = game.statusMessage;
                    } else {
                        game.statusMessage = "STALEMATE! It's a draw!";
                        replyBody = game.statusMessage;
                    }
                     chessController.deleteGame(threadID, gameKey);
                } else {
                    replyBody += `\nBot moved. It's now ${game.players.w.name}'s turn.`;
                }
            } else {
                 isGameOver = true;
                 game.statusMessage = "CHECKMATE! You win!";
                 replyBody = game.statusMessage;
                 const prize = 200000;
                 const winnerData = await usersData.get(game.players.w.id);
                 await usersData.set(game.players.w.id, { money: (winnerData.money || 0) + prize });
                 replyBody += `\nYou won $${prize.toLocaleString()}!`;
                 chessController.deleteGame(threadID, gameKey);
            }
        }
        
        await message.unsend(Reply.messageID);
        const boardPath = await drawChessBoard(game);
        const sentMessage = await message.reply({ body: replyBody, attachment: fs.createReadStream(boardPath) });
        fs.unlinkSync(boardPath);
        
        if (!isGameOver) {
            chessController.setGame(threadID, gameKey, game);
            global.GoatBot.onReply.set(sentMessage.messageID, { commandName: this.config.name, messageID: sentMessage.messageID, threadID, gameKey });
        }
    }
};