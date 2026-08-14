/**
 * game/roomManager.js
 *
 * Owns the in-memory map of active rooms and generates non-sequential,
 * human-friendly room codes. Games themselves are shaped by gameManager.js.
 */

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 confusion
const ROOM_CODE_LENGTH = 5;

class RoomManager {
  constructor({ roomTtlMs = 30 * 60 * 1000 } = {}) {
    /** @type {Map<string, object>} roomCode -> game state */
    this.rooms = new Map();
    this.roomTtlMs = roomTtlMs;
  }

  generateRoomCode() {
    let code;
    do {
      code = "";
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(game) {
    this.rooms.set(game.roomCode, game);
    return game;
  }

  getRoom(roomCode) {
    if (!roomCode) return null;
    return this.rooms.get(roomCode.toUpperCase()) || null;
  }

  deleteRoom(roomCode) {
    this.rooms.delete(roomCode);
  }

  touch(game) {
    game.lastActivity = Date.now();
  }

  /** Periodic sweep: remove rooms that have been idle past the TTL. */
  sweepStaleRooms() {
    const now = Date.now();
    for (const [code, game] of this.rooms.entries()) {
      const idle = now - (game.lastActivity || game.createdAt || 0);
      const bothGone =
        !game.players.player1?.connected && !game.players.player2?.connected;
      if (idle > this.roomTtlMs && (game.status === "finished" || bothGone)) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = { RoomManager, ROOM_CODE_LENGTH };
