/**
 * Black Hole 21 - authoritative Node.js + Express + Socket.IO server.
 */

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const rules = require("./game/gameRules");
const gameManager = require("./game/gameManager");
const { RoomManager } = require("./game/roomManager");
const adminRoutes = require("./server/adminRoutes");

const PORT = process.env.PORT || 3000;
const RECONNECT_TIMEOUT_MS = Number(process.env.RECONNECT_TIMEOUT_MS) || 120000;
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS) || 30 * 60 * 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/api", adminRoutes);

const roomManager = new RoomManager({ roomTtlMs: ROOM_TTL_MS });
const socketRoomIndex = new Map();
const matchmakingQueue = [];
const onlineUsers = new Map();
const friendLinks = new Map();

function sendError(socket, message) { socket.emit("error_message", { message }); }
function broadcastState(roomCode, extra = {}) {
  const game = roomManager.getRoom(roomCode);
  if (!game) return;
  io.to(roomCode).emit("move_made", { game: gameManager.serializeGame(game), ...extra });
}
function userIdFor(socket) { return socket.data.userId || socket.id; }
function cleanQueue() {
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    const item = matchmakingQueue[i];
    if (!item || !io.sockets.sockets.has(item.socketId)) matchmakingQueue.splice(i, 1);
  }
}
function removeFromQueue(socketId) {
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    if (matchmakingQueue[i].socketId === socketId) matchmakingQueue.splice(i, 1);
  }
}
function friendsFor(userId) { return Array.from(friendLinks.get(userId) || []); }
function addFriendLink(a, b) {
  if (!friendLinks.has(a)) friendLinks.set(a, new Set());
  if (!friendLinks.has(b)) friendLinks.set(b, new Set());
  friendLinks.get(a).add(b); friendLinks.get(b).add(a);
}

io.on("connection", (socket) => {
  socket.on("register_user", ({ userId, name } = {}, ack) => {
    const id = String(userId || socket.id).slice(0, 80);
    socket.data.userId = id;
    socket.data.name = String(name || "Player").slice(0, 20);
    onlineUsers.set(id, { socketId: socket.id, name: socket.data.name });
    if (typeof ack === "function") ack({ ok: true, userId: id, friends: friendsFor(id) });
  });

  socket.on("matchmake", ({ name } = {}, ack) => {
    removeFromQueue(socket.id);
    cleanQueue();
    socket.data.name = String(name || socket.data.name || "Player").slice(0, 20);
    const waiting = matchmakingQueue.shift();
    if (!waiting || waiting.socketId === socket.id) {
      matchmakingQueue.push({ socketId: socket.id, name: socket.data.name });
      if (typeof ack === "function") ack({ ok: true, waiting: true });
      return;
    }
    const other = io.sockets.sockets.get(waiting.socketId);
    if (!other) {
      matchmakingQueue.push({ socketId: socket.id, name: socket.data.name });
      if (typeof ack === "function") ack({ ok: true, waiting: true });
      return;
    }
    const roomCode = roomManager.generateRoomCode();
    const game = gameManager.createGameState(roomCode, other.id, waiting.name);
    roomManager.createRoom(game);
    gameManager.addSecondPlayer(game, socket.id, socket.data.name);
    other.join(roomCode); socket.join(roomCode);
    socketRoomIndex.set(other.id, roomCode); socketRoomIndex.set(socket.id, roomCode);
    roomManager.touch(game);
    const payload = { roomCode, game: gameManager.serializeGame(game) };
    if (typeof ack === "function") ack({ ok: true, waiting: false, ...payload, you: "player2" });
    other.emit("match_found", { ...payload, you: "player1" });
    io.to(roomCode).emit("player_joined", { game: gameManager.serializeGame(game) });
    io.to(roomCode).emit("game_started", { game: gameManager.serializeGame(game) });
  });

  socket.on("cancel_matchmake", () => removeFromQueue(socket.id));

  socket.on("friend_add", ({ friendId } = {}, ack) => {
    const from = userIdFor(socket); const to = String(friendId || "").trim();
    if (!to || to === from) return typeof ack === "function" && ack({ ok: false, message: "Invalid friend ID." });
    const target = onlineUsers.get(to);
    if (!target) return typeof ack === "function" && ack({ ok: false, message: "Friend is offline or not found." });
    addFriendLink(from, to);
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) targetSocket.emit("friend_added", { userId: from, name: socket.data.name || "Player" });
    if (typeof ack === "function") ack({ ok: true, friends: friendsFor(from) });
  });

  socket.on("friend_message", ({ friendId, text } = {}, ack) => {
    const from = userIdFor(socket); const to = String(friendId || "").trim();
    const body = String(text || "").trim().slice(0, 500);
    if (!to || !body || !(friendLinks.get(from)?.has(to))) return typeof ack === "function" && ack({ ok: false, message: "Add this player as a friend first." });
    const target = onlineUsers.get(to);
    if (!target) return typeof ack === "function" && ack({ ok: false, message: "Friend is offline." });
    const message = { from, name: socket.data.name || "Player", text: body, at: Date.now() };
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) targetSocket.emit("friend_message", message);
    if (typeof ack === "function") ack({ ok: true, message });
  });

  socket.on("friend_reaction", ({ friendId, reaction } = {}, ack) => {
    const from = userIdFor(socket); const to = String(friendId || "").trim();
    const value = String(reaction || "").trim().slice(0, 32);
    if (!to || !value || !(friendLinks.get(from)?.has(to))) return typeof ack === "function" && ack({ ok: false });
    const target = onlineUsers.get(to);
    if (target) io.sockets.sockets.get(target.socketId)?.emit("friend_reaction", { from, reaction: value });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("create_room", ({ name } = {}, ack) => {
    try {
      const roomCode = roomManager.generateRoomCode();
      const game = gameManager.createGameState(roomCode, socket.id, name);
      roomManager.createRoom(game); socket.join(roomCode); socketRoomIndex.set(socket.id, roomCode);
      const payload = { roomCode, game: gameManager.serializeGame(game), you: "player1" };
      if (typeof ack === "function") ack({ ok: true, ...payload });
    } catch (err) { if (typeof ack === "function") ack({ ok: false, message: "Could not create room." }); }
  });

  socket.on("join_room", ({ name, roomCode } = {}, ack) => {
    const respond = (result) => { if (typeof ack === "function") ack(result); else if (!result.ok) sendError(socket, result.message); };
    if (!roomCode || typeof roomCode !== "string") return respond({ ok: false, message: "Enter a room code." });
    const game = roomManager.getRoom(roomCode.trim().toUpperCase());
    if (!game) return respond({ ok: false, message: "Room not found." });
    if (game.players.player2 && game.players.player2.connected) return respond({ ok: false, message: "Room is full." });
    if (game.status !== "waiting" && !game.players.player2) return respond({ ok: false, message: "This game has already started." });
    let you;
    if (!game.players.player2) { gameManager.addSecondPlayer(game, socket.id, name); you = "player2"; }
    else { game.players.player2.id = socket.id; game.players.player2.connected = true; you = "player2"; clearDisconnectTimer(game, "player2"); }
    socket.join(game.roomCode); socketRoomIndex.set(socket.id, game.roomCode); roomManager.touch(game);
    respond({ ok: true, roomCode: game.roomCode, game: gameManager.serializeGame(game), you });
    io.to(game.roomCode).emit("player_joined", { game: gameManager.serializeGame(game) });
    if (game.status === "playing" && game.moveCount === 0) io.to(game.roomCode).emit("game_started", { game: gameManager.serializeGame(game) });
  });

  socket.on("reconnect_room", ({ roomCode, playerKey } = {}, ack) => {
    const respond = (result) => { if (typeof ack === "function") ack(result); };
    const game = roomManager.getRoom(roomCode);
    if (!game) return respond({ ok: false, message: "Room no longer exists." });
    if (!game.players[playerKey]) return respond({ ok: false, message: "Player not recognized." });
    game.players[playerKey].id = socket.id; game.players[playerKey].connected = true; clearDisconnectTimer(game, playerKey);
    socket.join(roomCode); socketRoomIndex.set(socket.id, roomCode); roomManager.touch(game);
    respond({ ok: true, game: gameManager.serializeGame(game), you: playerKey });
    io.to(roomCode).emit("player_reconnected", { game: gameManager.serializeGame(game), player: playerKey });
  });

  socket.on("make_move", ({ roomCode, position, number } = {}, ack) => {
    const respond = (result) => { if (typeof ack === "function") ack(result); if (!result.ok) sendError(socket, result.message); };
    const game = roomManager.getRoom(roomCode); if (!game) return respond({ ok: false, message: "Room not found." });
    const playerKey = gameManager.getPlayerKeyBySocket(game, socket.id); if (!playerKey) return respond({ ok: false, message: "You are not part of this game." });
    const validation = rules.isValidMove(game, playerKey, position, number); if (!validation.valid) return respond({ ok: false, message: validation.reason });
    gameManager.applyMove(game, playerKey, position, number); roomManager.touch(game); respond({ ok: true });
    if (game.status === "blackhole") io.to(roomCode).emit("black_hole_started", { game: gameManager.serializeGame(game) }); else broadcastState(roomCode);
  });

  socket.on("black_hole_finished", ({ roomCode } = {}) => { const game = roomManager.getRoom(roomCode); if (!game || game.status !== "blackhole") return; gameManager.finishGame(game); roomManager.touch(game); io.to(roomCode).emit("game_finished", { game: gameManager.serializeGame(game) }); });
  socket.on("rematch", ({ roomCode } = {}, ack) => { const game = roomManager.getRoom(roomCode); if (!game) return typeof ack === "function" && ack({ ok: false, message: "Room not found." }); if (!game.players.player1?.connected || !game.players.player2?.connected) return typeof ack === "function" && ack({ ok: false, message: "Both players must be connected to rematch." }); gameManager.resetForRematch(game); roomManager.touch(game); if (typeof ack === "function") ack({ ok: true }); io.to(roomCode).emit("rematch", { game: gameManager.serializeGame(game) }); });

  socket.on("disconnect", () => {
    removeFromQueue(socket.id);
    const uid = socket.data.userId;
    if (uid && onlineUsers.get(uid)?.socketId === socket.id) onlineUsers.delete(uid);
    const roomCode = socketRoomIndex.get(socket.id); socketRoomIndex.delete(socket.id); if (!roomCode) return;
    const game = roomManager.getRoom(roomCode); if (!game) return;
    const playerKey = gameManager.getPlayerKeyBySocket(game, socket.id); if (!playerKey || !game.players[playerKey]) return;
    game.players[playerKey].connected = false; roomManager.touch(game);
    io.to(roomCode).emit("player_disconnected", { game: gameManager.serializeGame(game), player: playerKey });
    clearDisconnectTimer(game, playerKey); game.disconnectTimers[playerKey] = setTimeout(() => { const stillGame = roomManager.getRoom(roomCode); if (!stillGame) return; roomManager.touch(stillGame); }, RECONNECT_TIMEOUT_MS);
  });
});

function clearDisconnectTimer(game, playerKey) { const timer = game.disconnectTimers && game.disconnectTimers[playerKey]; if (timer) { clearTimeout(timer); delete game.disconnectTimers[playerKey]; } }
setInterval(() => roomManager.sweepStaleRooms(), 5 * 60 * 1000);
server.listen(PORT, () => console.log(`Black Hole 21 server listening on port ${PORT}`));
