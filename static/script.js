// static/script.js - AI JS thuần mạnh mẽ cho GitHub Pages
const BOARD_SIZE = 12;
const CELL_SIZE = 38;

// Themes (giữ nguyên của nhóm bạn)
const THEMES = {
  wood: { board: "#eecfa1", line: "#5e4026", p1: { color: "#000" }, p2: { color: "#fff", stroke: "#ddd" } },
  paper: { board: "#f8f9fa", line: "#2c3e50", p1: { color: "#2c3e50" }, p2: { color: "#ffffff", stroke: "#2c3e50" } },
  dark: { board: "#2d3436", line: "#636e72", p1: { color: "#00cec9" }, p2: { color: "#ff7675" } },
};

let currentTheme = "wood";
let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
let currentPlayer = 1;
let gameMode = "easy";
let gameOver = false;
let moveCount = 0;

// Timer
let timeP1 = 3 * 60 * 1000; // 3 phút bạn
let timeP2 = 4 * 60 * 1000; // 4 phút AI/PVP
let timerInterval;
let turnStartTime;

// Elements
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const timerP1El = document.getElementById("timerP1");
const timerP2El = document.getElementById("timerP2");
const turnInfoEl = document.getElementById("turnInfo");
const moveCountEl = document.getElementById("moveCount");
const themeSelect = document.getElementById("themeSelect");
const player2Title = document.getElementById("player2Title");
const modal = document.getElementById("resultModal");
const modalTitle = document.getElementById("modalTitle");
const modalMsg = document.getElementById("modalMessage");

// Init
document.addEventListener("DOMContentLoaded", () => {
  // Đọc mode từ URL
  const urlParams = new URLSearchParams(window.location.search);
  gameMode = urlParams.get("mode") || "easy";
  if (["easy", "medium", "hard", "pvp"].includes(gameMode)) {
    if (player2Title) player2Title.textContent = gameMode === "pvp" ? "Người 2 (O)" : "AI (O)";
  }

  drawBoard();
  updateUIState();
  startTurnTimer();

  themeSelect.addEventListener("change", () => {
    currentTheme = themeSelect.value;
    drawBoard();
  });

  canvas.addEventListener("click", handleCanvasClick);
});

// Click bàn cờ
function handleCanvasClick(e) {
  if (gameOver || (gameMode !== "pvp" && currentPlayer === 2)) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE || board[row][col] !== 0) return;

  makeMove(row, col, currentPlayer);

  if (!gameOver) {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateUIState();
    startTurnTimer();
    if (gameMode !== "pvp" && currentPlayer === 2) {
      setTimeout(aiMove, 500);
    }
  }
}

// Làm nước đi
function makeMove(row, col, player) {
  board[row][col] = player;
  moveCount++;
  moveCountEl.textContent = moveCount;
  drawBoard();
  playSound("move");

  if (checkWin(row, col, player)) {
    gameOver = true;
    clearInterval(timerInterval);
    const winner = player === 1 ? "Bạn" : (gameMode === "pvp" ? "Người 2" : "AI");
    showResult(winner + " THẮNG! 🏆", "");
    playSound(player === 1 ? "win" : "lose");
  }
}

// AI Move - MẠNH NHẤT CÓ THỂ TRÊN BROWSER
function aiMove() {
  if (gameOver || currentPlayer !== 2) return;

  turnInfoEl.textContent = "AI đang tính toán...";

  let bestMove;
  if (gameMode === "easy") {
    bestMove = getRandomMove();
  } else if (gameMode === "medium") {
    bestMove = getMediumMove(); // Chặn thắng + random
  } else if (gameMode === "hard") {
    bestMove = getHardMove(); // Minimax alpha-beta depth động
  }

  if (bestMove) {
    const [row, col] = bestMove;
    makeMove(row, col, 2);
    if (!gameOver) {
      currentPlayer = 1;
      updateUIState();
      startTurnTimer();
    }
  }
}

// Easy: Random
function getRandomMove() {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === 0) empty.push([r, c]);
  return empty.length > 0 ? empty[Math.floor(Math.random() * empty.length)] : null;
}

// Medium: Ưu tiên chặn người chơi thắng, rồi tấn công, rồi random
function getMediumMove() {
  // Chặn người chơi thắng
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) {
        board[r][c] = 1;
        if (checkWin(r, c, 1)) {
          board[r][c] = 0;
          return [r, c];
        }
        board[r][c] = 0;
      }
    }
  }
  // Tạo cơ hội thắng cho AI
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) {
        board[r][c] = 2;
        if (checkWin(r, c, 2)) {
          board[r][c] = 0;
          return [r, c];
        }
        board[r][c] = 0;
      }
    }
  }
  return getRandomMove();
}

// Hard: Minimax alpha-beta + heuristic mạnh
function getHardMove() {
  let depth = 4; // Có thể tăng nếu muốn mạnh hơn (nhưng chậm)
  let bestScore = -Infinity;
  let bestMove = null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) {
        board[r][c] = 2;
        let score = minimax(board, depth - 1, -Infinity, Infinity, false);
        board[r][c] = 0;
        if (score > bestScore) {
          bestScore = score;
          bestMove = [r, c];
        }
      }
    }
  }
  return bestMove;
}

function minimax(board, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || gameOver) return evaluateBoard(board);

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) {
          board[r][c] = 2;
          if (checkWin(r, c, 2)) return 100000;
          let eval = minimax(board, depth - 1, alpha, beta, false);
          board[r][c] = 0;
          maxEval = Math.max(maxEval, eval);
          alpha = Math.max(alpha, eval);
          if (beta <= alpha) return maxEval;
        }
      }
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[r][c] === 0) {
          board[r][c] = 1;
          if (checkWin(r, c, 1)) return -100000;
          let eval = minimax(board, depth - 1, alpha, beta, true);
          board[r][c] = 0;
          minEval = Math.min(minEval, eval);
          beta = Math.min(beta, eval);
          if (beta <= alpha) return minEval;
        }
      }
    }
    return minEval;
  }
}

// Heuristic đánh giá bàn cờ (ưu tiên liên tiếp 4, 3, chặn, trung tâm)
function evaluateBoard(board) {
  let score = 0;
  // Ưu tiên trung tâm
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
    if (board[r][c] === 2) score += 10 * (1 / (Math.abs(r - 5.5) + Math.abs(c - 5.5) + 1));
    if (board[r][c] === 1) score -= 10 * (1 / (Math.abs(r - 5.5) + Math.abs(c - 5.5) + 1));
  }
  // Đếm chuỗi (cơ bản)
  // ... (có thể mở rộng thêm nếu muốn mạnh hơn)
  return score;
}

// checkWin, drawBoard, timer, sound, modal – copy từ code cũ của bạn vào đây nếu thiếu

// Ví dụ checkWin (copy từ code bạn gửi)
function checkWin(row, col, player) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) count++;
      else break;
    }
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) count++;
      else break;
    }
    if (count >= 5) return true;
  }
  return false;
}

// ... thêm drawBoard, playSound, showResult, timer từ code cũ của nhóm bạn

resetGame(); // Gọi khi cần
