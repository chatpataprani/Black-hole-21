/**
 * game/gameRules.js
 *
 * All Black Hole 21 game rules live here, isolated from networking code.
 * The frontend NEVER calculates winners, scores, or Black Hole neighbors
 * itself - it only renders what the server (using this module) decides.
 *
 * Board layout (position IDs, not shown to players):
 *
 *                     0
 *                   1   2
 *                 3   4   5
 *               6   7   8   9
 *            10  11  12  13  14
 *         15  16  17  18  19  20
 */

const TOTAL_CIRCLES = 21;
const TOTAL_ROWS = 6;

// rows[r] (r = 1..6) => array of position IDs in that row, left to right.
const ROWS = (() => {
  const rows = [null]; // 1-indexed, rows[0] unused
  let cursor = 0;
  for (let r = 1; r <= TOTAL_ROWS; r++) {
    const row = [];
    for (let i = 0; i < r; i++) {
      row.push(cursor++);
    }
    rows.push(row);
  }
  return rows;
})();

// Reverse lookup: position -> { row, index }
const POSITION_INFO = (() => {
  const info = new Array(TOTAL_CIRCLES);
  for (let r = 1; r <= TOTAL_ROWS; r++) {
    ROWS[r].forEach((pos, i) => {
      info[pos] = { row: r, index: i };
    });
  }
  return info;
})();

/**
 * Returns the exact neighboring positions of a circle in the triangular
 * pyramid, using explicit adjacency rules (never visual/pixel distance).
 *
 * A circle can have up to 6 neighbors:
 *   - left / right in the same row
 *   - two "parents" in the row above
 *   - two "children" in the row below
 */
function getBlackHoleNeighbors(position) {
  if (!POSITION_INFO[position]) return [];
  const { row, index } = POSITION_INFO[position];
  const neighbors = [];

  // Same row
  if (index - 1 >= 0) neighbors.push(ROWS[row][index - 1]);
  if (index + 1 < ROWS[row].length) neighbors.push(ROWS[row][index + 1]);

  // Row above
  if (row > 1) {
    const above = ROWS[row - 1];
    if (index - 1 >= 0 && index - 1 < above.length) neighbors.push(above[index - 1]);
    if (index < above.length) neighbors.push(above[index]);
  }

  // Row below
  if (row < TOTAL_ROWS) {
    const below = ROWS[row + 1];
    if (index < below.length) neighbors.push(below[index]);
    if (index + 1 < below.length) neighbors.push(below[index + 1]);
  }

  return neighbors;
}

function createEmptyBoard() {
  return new Array(TOTAL_CIRCLES).fill(null);
}

function isValidPosition(position) {
  return Number.isInteger(position) && position >= 0 && position < TOTAL_CIRCLES;
}

function isValidNumber(num) {
  return Number.isInteger(num) && num >= 1 && num <= 10;
}

/**
 * Validates a move against full server-authoritative game state.
 * Returns { valid: true } or { valid: false, reason: "..." }
 */
function isValidMove(game, playerKey, position, number) {
  if (!game) return { valid: false, reason: "Game not found." };
  if (game.status !== "playing") return { valid: false, reason: "Game is not active." };
  if (game.currentTurn !== playerKey) return { valid: false, reason: "It is not your turn." };
  if (!isValidPosition(position)) return { valid: false, reason: "Invalid circle." };
  if (game.board[position] !== null) return { valid: false, reason: "Circle already occupied." };
  if (!isValidNumber(number)) return { valid: false, reason: "Number must be between 1 and 10." };
  return { valid: true };
}

/**
 * Finds the single remaining empty circle. Returns null if the board
 * isn't in a state where exactly one circle is empty.
 */
function getBlackHolePosition(board) {
  const empty = board.reduce((acc, cell, idx) => {
    if (cell === null) acc.push(idx);
    return acc;
  }, []);
  return empty.length === 1 ? empty[0] : null;
}

/**
 * Given the board and the black hole position, computes the ordered
 * absorption sequence and running/final scores per player.
 *
 * Returns:
 * {
 *   blackHolePosition,
 *   neighbors: [ { position, number, player } ],
 *   scores: { player1: total, player2: total },
 * }
 */
function calculateBlackHoleResult(board, blackHolePosition) {
  const neighborPositions = getBlackHoleNeighbors(blackHolePosition);
  const neighbors = neighborPositions
    .filter((pos) => board[pos] !== null)
    .map((pos) => ({
      position: pos,
      number: board[pos].number,
      player: board[pos].player,
    }));

  const scores = calculateScores(neighbors);

  return { blackHolePosition, neighbors, scores };
}

function calculateScores(neighbors) {
  const scores = { player1: 0, player2: 0 };
  for (const n of neighbors) {
    if (scores[n.player] !== undefined) {
      scores[n.player] += n.number;
    }
  }
  return scores;
}

/**
 * Lower score wins. Equal scores => draw.
 * Returns "player1" | "player2" | "draw"
 */
function determineWinner(scores) {
  if (scores.player1 === scores.player2) return "draw";
  return scores.player1 < scores.player2 ? "player1" : "player2";
}

function sanitizeName(rawName) {
  if (typeof rawName !== "string") return "Player";
  const trimmed = rawName.trim().slice(0, 20);
  const cleaned = trimmed.replace(/[<>"'`]/g, "");
  return cleaned.length > 0 ? cleaned : "Player";
}

module.exports = {
  TOTAL_CIRCLES,
  TOTAL_ROWS,
  ROWS,
  getBlackHoleNeighbors,
  createEmptyBoard,
  isValidPosition,
  isValidNumber,
  isValidMove,
  getBlackHolePosition,
  calculateBlackHoleResult,
  calculateScores,
  determineWinner,
  sanitizeName,
};
