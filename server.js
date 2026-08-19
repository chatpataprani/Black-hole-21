/**
 * server.js
 *
 * Black Hole 21 - authoritative Node.js + Express + Socket.IO server.
 * The server owns all game state. Clients only ever send intent
 * ("I want to place 7 on circle 12") - the server validates, applies,
 * and broadcasts the resulting state.
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
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// Admin broadcast + push-token registration API. Every route in here is
// either public-but-narrow (register/unregister a device token) or
// gated behind ADMIN_TOKEN — see server/adminRoutes.js. Mounting this
// doesn't change anything about the existing game routes/sockets below.
app.use("/api", adminRoutes);

const roomManager = new RoomManager({ roomTtlMs: ROOM_TTL_MS });

// socket.id -> roomCode, so we can find a player's room on disconnect
const socketRoomIndex = new Map();

function sendError(socket, message) {
  socket.emit("error_message", { message });
}

function broadcastState(roomCode, extra = {}) {
  const game = roomManager.getRoom(roomCode);
  if (!game) return;
  io.to(roomCode).emit("move_made", {
    game: gameManager.serializeGame(game),
    ...extra,
  });
}

io.on("connection", (socket) => {
  // ---- CREATE ROOM ----
  socket.on("create_room", ({ name } = {}, ack) => {
    try {
      const roomCode = roomManager.generateRoomCode();
      const game = gameManager.createGameState(roomCode, socket.id, name);
      roomManager.createRoom(game);

      socket.join(roomCode);
      socketRoomIndex.set(socket.id, roomCode);

      const payload = { roomCode, game: gameManager.serializeGame(game), you: "player1" };
      if (typeof ack === "function") ack({ ok: true, ...payload });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, message: "Could not create room." });
    }
  });

  // ---- JOIN ROOM ----
  socket.on("join_room", ({ name, roomCode } = {}, ack) => {
    const respond = (result) => {
      if (typeof ack === "function") ack(result);
      else if (!result.ok) sendError(socket, result.message);
    };

    if (!roomCode || typeof roomCode !== "string") {
      return respond({ ok: false, message: "Enter a room code." });
    }

    const game = roomManager.getRoom(roomCode.trim().toUpperCase());
    if (!game) return respond({ ok: false, message: "Room not found." });

    if (game.players.player2 && game.players.player2.connected) {
      return respond({ ok: false, message: "Room is full." });
    }

    if (game.status !== "waiting" && !game.players.player2) {
      return respond({ ok: false, message: "This game has already started." });
    }

    let you;
    if (!game.players.player2) {
      gameManager.addSecondPlayer(game, socket.id, name);
      you = "player2";
    } else {
      // Reconnection path handled separately via reconnect_room; treat
      // a plain join here (player2 slot exists but disconnected) as a
      // reconnection convenience.
      game.players.player2.id = socket.id;
      game.players.player2.connected = true;
      you = "player2";
      clearDisconnectTimer(game, "player2");
    }

    socket.join(game.roomCode);
    socketRoomIndex.set(socket.id, game.roomCode);
    roomManager.touch(game);

    respond({ ok: true, roomCode: game.roomCode, game: gameManager.serializeGame(game), you });

    io.to(game.roomCode).emit("player_joined", { game: gameManager.serializeGame(game) });
    if (game.status === "playing" && game.moveCount === 0) {
      io.to(game.roomCode).emit("game_started", { game: gameManager.serializeGame(game) });
    }
  });

  // ---- RECONNECT ----
  socket.on("reconnect_room", ({ roomCode, playerKey } = {}, ack) => {
    const respond = (result) => {
      if (typeof ack === "function") ack(result);
    };
    const game = roomManager.getRoom(roomCode);
    if (!game) return respond({ ok: false, message: "Room no longer exists." });
    if (!game.players[playerKey]) return respond({ ok: false, message: "Player not recognized." });

    game.players[playerKey].id = socket.id;
    game.players[playerKey].connected = true;
    clearDisconnectTimer(game, playerKey);

    socket.join(roomCode);
    socketRoomIndex.set(socket.id, roomCode);
    roomManager.touch(game);

    respond({ ok: true, game: gameManager.serializeGame(game), you: playerKey });
    io.to(roomCode).emit("player_reconnected", {
      game: gameManager.serializeGame(game),
      player: playerKey,
    });
  });

  // ---- MAKE MOVE ----
  socket.on("make_move", ({ roomCode, position, number } = {}, ack) => {
    const respond = (result) => {
      if (typeof ack === "function") ack(result);
      if (!result.ok) sendError(socket, result.message);
    };

    const game = roomManager.getRoom(roomCode);
    if (!game) return respond({ ok: false, message: "Room not found." });

    const playerKey = gameManager.getPlayerKeyBySocket(game, socket.id);
    if (!playerKey) return respond({ ok: false, message: "You are not part of this game." });

    const validation = rules.isValidMove(game, playerKey, position, number);
    if (!validation.valid) return respond({ ok: false, message: validation.reason });

    gameManager.applyMove(game, playerKey, position, number);
    roomManager.touch(game);

    respond({ ok: true });

    if (game.status === "blackhole") {
      // Let every client run the full cinematic; the server has already
      // computed the authoritative neighbors, order, and final scores.
      io.to(roomCode).emit("black_hole_started", { game: gameManager.serializeGame(game) });
    } else {
      broadcastState(roomCode);
    }
  });

  // ---- CLIENT SIGNALS CINEMATIC FINISHED (so we can mark the game finished) ----
  socket.on("black_hole_finished", ({ roomCode } = {}) => {
    const game = roomManager.getRoom(roomCode);
    if (!game || game.status !== "blackhole") return;
    gameManager.finishGame(game);
    roomManager.touch(game);
    io.to(roomCode).emit("game_finished", { game: gameManager.serializeGame(game) });
  });

  // ---- REMATCH ----
  socket.on("rematch", ({ roomCode } = {}, ack) => {
    const game = roomManager.getRoom(roomCode);
    if (!game) {
      if (typeof ack === "function") ack({ ok: false, message: "Room not found." });
      return;
    }
    if (!game.players.player1?.connected || !game.players.player2?.connected) {
      if (typeof ack === "function") {
        ack({ ok: false, message: "Both players must be connected to rematch." });
      }
      return;
    }
    gameManager.resetForRematch(game);
    roomManager.touch(game);
    if (typeof ack === "function") ack({ ok: true });
    io.to(roomCode).emit("rematch", { game: gameManager.serializeGame(game) });
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    const roomCode = socketRoomIndex.get(socket.id);
    socketRoomIndex.delete(socket.id);
    if (!roomCode) return;

    const game = roomManager.getRoom(roomCode);
    if (!game) return;

    const playerKey = gameManager.getPlayerKeyBySocket(game, socket.id);
    if (!playerKey || !game.players[playerKey]) return;

    game.players[playerKey].connected = false;
    roomManager.touch(game);

    io.to(roomCode).emit("player_disconnected", {
      game: gameManager.serializeGame(game),
      player: playerKey,
    });

    // Give the player a window to reconnect before we give up on the room.
    clearDisconnectTimer(game, playerKey);
    game.disconnectTimers[playerKey] = setTimeout(() => {
      const stillGame = roomManager.getRoom(roomCode);
      if (!stillGame) return;
      const p = stillGame.players[playerKey];
      if (p && !p.connected) {
        // Neither forcibly delete mid-play state nor leak memory forever;
        // the periodic sweep will reap it once both players are gone.
        roomManager.touch(stillGame);
      }
    }, RECONNECT_TIMEOUT_MS);
  });
});

function clearDisconnectTimer(game, playerKey) {
  const timer = game.disconnectTimers && game.disconnectTimers[playerKey];
  if (timer) {
    clearTimeout(timer);
    delete game.disconnectTimers[playerKey];
  }
}

// Periodic cleanup of long-abandoned rooms.
setInterval(() => roomManager.sweepStaleRooms(), 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Black Hole 21 server listening on port ${PORT}`);
});
