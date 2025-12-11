// static/script.js - FULL HOÀN CHỈNH CHO GITHUB PAGES
const BOARD_SIZE = 12;
const CELL_SIZE = 38;

// === THEMES ===
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
let turnStartTime;
let timerInterval;
let timeP1 = 3 * 60 * 1000; // 3 phút
let timeP2 = 4 * 60 * 1000; // 4 phút

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
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  if (mode && ["easy", "medium", "hard", "pvp"].includes(mode)) {
    gameMode = mode;
  }
  if (player2Title) player2Title.textContent = gameMode === "pvp" ? "Người 2 (O)" : "AI (O)";

  drawBoard();
  updateUIState();
  startTurnTimer();

  themeSelect.value = currentTheme;
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
      setTimeout(aiMove, 600);
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
    showResult(`${winner} THẮNG! 🏆`, "");
    playSound(player === 1 ? "win" : "|lose");
  }
}

// AI Move
function aiMove() {
  if (gameOver || currentPlayer !== 2) return;

  turnInfoEl.textContent = "AI đang tính toán...";

  let bestMove;
  if (gameMode === "easy") {
    bestMove = getRandomMove();
  } else if (gameMode === "medium") {
    bestMove = getMediumMove();
  } else if (gameMode === "hard") {
    bestMove = getHardMove();
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

// Medium: Chặn + tấn công + random
function getMediumMove() {
  // Chặn người chơi
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
  // Tấn công
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

// Hard: Minimax
function getHardMove() {
  let depth = 4;
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

function minimax(board, depth, alpha, beta, maximizing) {
  if (depth === 0 || gameOver) return evaluateBoard(board);

  if (maximizing) {
    let maxEval = -Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === 0) {
      board[r][c] = 2;
      if (checkWin(r, c, 2)) return 100000;
      let eval = minimax(board, depth - 1, alpha, beta, false);
      board[r][c] = 0;
      maxEval = Math.max(maxEval, eval);
      alpha = Math.max(alpha, eval);
      if (beta <= alpha) return maxEval;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === 0) {
      board[r][c] = 1;
      if (checkWin(r, c, 1)) return -100000;
      let eval = minimax(board, depth - 1, alpha, beta, true);
      board[r][c] = 0;
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) return minEval;
    }
    return minEval;
  }
}

function evaluateBoard(board) {
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
    if (board[r][c] === 2) score += 10;
    if (board[r][c] === 1) score -= 10;
  }
  return score;
}

// checkWin
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

// drawBoard (đơn giản)
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const theme = THEMES[currentTheme];
  ctx.fillStyle = theme.board;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2);
    ctx.lineTo(i * CELL_SIZE + CELL_SIZE / 2, canvas.height - CELL_SIZE / 2);
    ctx.moveTo(CELL_SIZE / 2, i * CELL_SIZE + CELL_SIZE / 2);
    ctx.lineTo(canvas.width - CELL_SIZE / 2, i * CELL_SIZE + CELL_SIZE / 2);
    ctx.stroke();
  }
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) {
        const x = c * CELL_SIZE + CELL_SIZE / 2;
        const y = r * CELL_SIZE + CELL_SIZE / 2;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = board[r][c] === 1 ? theme.p1.color : theme.p2.color;
        ctx.fill();
        if (theme.p2.stroke && board[r][c] === 2) {
          ctx.strokeStyle = theme.p2.stroke;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }
}

// Timer
function startTurnTimer() {
  if (timerInterval) clearInterval(timerInterval);
  turnStartTime = Date.now();
  timerInterval = setInterval(() => {
    if (gameOver) return clearInterval(timerInterval);
    const elapsed = Date.now() - turnStartTime;
    if (currentPlayer === 1) timeP1 -= elapsed;
    else timeP2 -= elapsed;
    turnStartTime = Date.now();
    updateTimers();
    if (timeP1 <= 0 || timeP2 <= 0) {
      gameOver = true;
      clearInterval(timerInterval);
      showResult("HẾT GIỜ!", currentPlayer === 1 ? "Bạn thua!" : "AI thua!");
    }
  }, 100);
}

function updateTimers() {
  timerP1El.textContent = formatTime(timeP1);
  timerP2El.textContent = formatTime(timeP2);
}

function formatTime(ms) {
  const m = Math.floor(ms / 60000).toString().padStart(2, "0");
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateUIState() {
  turnInfoEl.textContent = currentPlayer === 1 ? "Lượt của bạn!" : (gameMode === "pvp" ? "Lượt người 2" : "AI đang tính...");
}

// Sound (nếu có file)
function playSound(type) {
  const audio = document.getElementById(`sound-${type}`);
  if (audio) audio.play().catch(() => {});
}

// Modal
function showResult(title, msg) {
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modal.classList.add("show");
}

function closeModalAndReset() {
  modal.classList.remove("show");
  resetGame();
}

// Reset
function resetGame() {
  board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  currentPlayer = 1;
  gameOver = false;
  moveCount = 0;
  timeP1 = 3 * 60 * 1000;
  timeP2 = 4 * 60 * 1000;
  moveCountEl.textContent = "0";
  drawBoard();
  updateUIState();
  updateTimers();
  startTurnTimer();
}

// Gọi reset khi cần
document.querySelector(".btn-reset").addEventListener("click", resetGame);
document.querySelector(".btn-modal").addEventListener("click", closeModalAndReset);

// Bắt đầu game
resetGame();
