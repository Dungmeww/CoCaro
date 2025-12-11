async function aiMove() {
  if (gameOver || currentPlayer !== 2) return;

  turnInfoEl.textContent = "AI đang tính toán...";

  // Giả lập "nghĩ" 0.5-1s để đẹp
  await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

  let bestMove = null;

  if (gameMode === "easy") {
    bestMove = getRandomMove();
  } else if (gameMode === "medium") {
    bestMove = getBlockingOrWinningMove() || getRandomMove();
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

// Random cho easy
function getRandomMove() {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

// Chặn thắng hoặc tạo thắng cho medium
function getBlockingOrWinningMove() {
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
  // Tạo thắng cho AI
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
  return null;
}

// Hard: Minimax đơn giản nhưng mạnh (depth 4, có thể tăng nếu máy mạnh)
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

// Minimax với alpha-beta
function minimax(board, depth, alpha, beta, maximizing) {
  if (depth === 0 || gameOver) return evaluateBoard(board);
  if (maximizing) {
    let maxEval = -Infinity;
    for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === 0) {
      board[r][c] = 2;
      if (checkWin(r, c, 2)) return 100000 + depth; // Ưu tiên thắng nhanh
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
      if (checkWin(r, c, 1)) return -100000 - depth;
      let eval = minimax(board, depth - 1, alpha, beta, true);
      board[r][c] = 0;
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) return minEval;
    }
    return minEval;
  }
}

// Heuristic đơn giản nhưng hiệu quả
function evaluateBoard(board) {
  let score = 0;
  // Ưu tiên trung tâm
  for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
    if (board[r][c] === 2) score += 20;
    if (board[r][c] === 1) score -= 20;
  }
  return score;
}
