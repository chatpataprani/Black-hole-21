/**
 * game/gameManager.js
 *
 * Server-authoritative game state management. Wraps the pure rules in
 * gameRules.js with the mutable, per-room game object, and never trusts
 * anything the client claims about board state, turn, score, or winner.
 */

const rules = require("./gameRules");

function createGameState(roomCode, hostSocketId, hostName) {
  const now = Date.now();
  return {
    roomCode,
    status: "waiting", // waiting -> playing -> blackhole -> finished
    players: {
      player1: {
        id: hostSocketId,
        name: rules.sanitizeName(hostName),
        connected: true,
      },
      player2: null,
    },
    board: rules.createEmptyBoard(),
    currentTurn: "player1",
    moveCount: 0,
    blackHolePosition: null,
    blackHoleResult: null, // filled once computed
    scores: { player1: 0, player2: 0 },
    winner: null,
    createdAt: now,
    lastActivity: now,
    disconnectTimers: {}, // playerKey -> Timeout (kept off the serialized state)
  };
}

function addSecondPlayer(game, socketId, name) {
  game.players.player2 = {
    id: socketId,
    name: rules.sanitizeName(name),
    connected: true,
  };
  game.status = "playing";
  game.lastActivity = Date.now();
  return game;
}

function getPlayerKeyBySocket(game, socketId) {
  if (game.players.player1 && game.players.player1.id === socketId) return "player1";
  if (game.players.player2 && game.players.player2.id === socketId) return "player2";
  return null;
}

function otherKey(playerKey) {
  return playerKey === "player1" ? "player2" : "player1";
}

/**
 * Applies a validated move to the game. Assumes isValidMove() already
 * passed - callers (socket handlers) are responsible for validating first.
 */
function applyMove(game, playerKey, position, number) {
  game.board[position] = { number, player: playerKey };
  game.moveCount += 1;
  game.lastActivity = Date.now();

  const blackHolePosition = rules.getBlackHolePosition(game.board);

  if (blackHolePosition !== null) {
    // 20 moves made; the last empty circle is now the Black Hole.
    game.status = "blackhole";
    game.blackHolePosition = blackHolePosition;
    game.blackHoleResult = rules.calculateBlackHoleResult(game.board, blackHolePosition);
    game.scores = game.blackHoleResult.scores;
    game.winner = rules.determineWinner(game.scores);
    game.currentTurn = null;
  } else {
    game.currentTurn = otherKey(playerKey);
  }

  return game;
}

function finishGame(game) {
  game.status = "finished";
  game.lastActivity = Date.now();
  return game;
}

/**
 * Resets an existing room's board/state for a rematch, keeping the same
 * two players and room code. Alternates who starts.
 */
function resetForRematch(game) {
  const previousStarter = game._lastStarter || "player1";
  const nextStarter = otherKey(previousStarter);

  game.board = rules.createEmptyBoard();
  game.currentTurn = nextStarter;
  game.moveCount = 0;
  game.blackHolePosition = null;
  game.blackHoleResult = null;
  game.scores = { player1: 0, player2: 0 };
  game.winner = null;
  game.status = "playing";
  game.lastActivity = Date.now();
  game._lastStarter = nextStarter;

  return game;
}

/**
 * Produces a client-safe snapshot of the game (strips socket ids and
 * internal timer handles).
 */
function serializeGame(game) {
  return {
    roomCode: game.roomCode,
    status: game.status,
    players: {
      player1: game.players.player1
        ? { name: game.players.player1.name, connected: game.players.player1.connected }
        : null,
      player2: game.players.player2
        ? { name: game.players.player2.name, connected: game.players.player2.connected }
        : null,
    },
    board: game.board,
    currentTurn: game.currentTurn,
    moveCount: game.moveCount,
    blackHolePosition: game.blackHolePosition,
    blackHoleResult: game.blackHoleResult,
    scores: game.scores,
    winner: game.winner,
  };
}

module.exports = {
  createGameState,
  addSecondPlayer,
  getPlayerKeyBySocket,
  otherKey,
  applyMove,
  finishGame,
  resetForRematch,
  serializeGame,
};
