print("[DEBUG] app_fixed.py loaded – no file is being overwritten.")
from flask import Flask, render_template, request, jsonify
from copy import deepcopy
import time, math, random, collections


app = Flask(__name__)
BOARD_SIZE = 12
TIME_LIMIT = 0.6           
DEPTH_HARD = 5
TOP_MOVES = 22  
MEDIUM_BLOCK_RATE = 0.8    
TRANS_TABLE_MAX = 200000   

transposition_table = {}

def is_in(board, y, x):
    return 0 <= y < len(board) and 0 <= x < len(board)

def board_key(board):
    return tuple(tuple(row) for row in board)

# WIN CHECK
def check_win(board, player):
    n = len(board)
    dirs = [(0,1),(1,0),(1,1),(1,-1)]
    for y in range(n):
        for x in range(n):
            if board[y][x] != player: continue
            for dy,dx in dirs:
                cnt = 0
                ny, nx = y, x
                while 0 <= ny < n and 0 <= nx < n and board[ny][nx] == player:
                    cnt += 1
                    ny += dy; nx += dx
                if cnt >= 5:
                    return True
    return False

def is_open_four(board, player):
    n = len(board)
    dirs = [(0,1),(1,0),(1,1),(1,-1)]
    for y in range(n):
        for x in range(n):
            for dy,dx in dirs:
                seg = []
                for k in range(6):
                    ny = y + k*dy
                    nx = x + k*dx
                    if not is_in(board, ny, nx):
                        seg = None; break
                    seg.append(board[ny][nx])
                if seg and seg == [0, player, player, player, player, 0]:
                    return True
    return False

# STATIC HEURISTIC
def score_of_list(lis, player):
    opp = 1 if player == 2 else 2
    if opp in lis and player in lis:
        return -1

    filled = lis.count(player)
    blanks = lis.count(0)
    if filled == 0:
        return 0

    if filled == 4:
        if len(lis) == 6:
            if lis[0] == 0 and lis[-1] == 0:
                return 9999
        return 2000

    # open-three: .XXX.
    if filled == 3:
        if len(lis) >= 5 and lis[0] == 0 and lis[-1] == 0:
            return 500
        return 50

    if filled == 2:
        return 10
    if filled == 1:
        return 1

    return filled


def row_to_list(board, y, x, dy, dx, yf, xf):
    row = []
    while True:
        if is_in(board, y, x):
            row.append(board[y][x])
        if y == yf and x == xf:
            break
        y += dy; x += dx
    return row

def score_of_row(board, cordi, dy, dx, cordf, player):
    colscores = []
    y,x = cordi; yf,xf = cordf
    row = row_to_list(board, y, x, dy, dx, yf, xf)
    if len(row) < 5:
        return []
    for start in range(max(0, len(row)-6+1)):
        if start+6 <= len(row):
            window = row[start:start+6]
            s = score_of_list(window, player)
            colscores.append(s)
    for start in range(len(row) - 4):
        window = row[start:start+5]
        s = score_of_list(window, player)
        colscores.append(s)
    return colscores

def score_ready(scorecol):
    sumcol = {0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, -1: {}}
    for key in scorecol:
        for score in scorecol[key]:
            if key in sumcol[score]:
                sumcol[score][key] += 1
            else:
                sumcol[score][key] = 1
    return sumcol

def sum_sumcol_values(sumcol):
    for key in list(sumcol.keys()):
        if key == 5:
            sumcol[5] = int(1 in sumcol[5].values())
        else:
            sumcol[key] = sum(sumcol[key].values())

def score_of_col(board, player):
    f = len(board)
    scores = {(0,1): [], (-1,1): [], (1,0): [], (1,1): []}
    for start in range(f):
        scores[(0,1)].extend(score_of_row(board, (start,0), 0, 1, (start, f-1), player))
        scores[(1,0)].extend(score_of_row(board, (0,start), 1, 0, (f-1, start), player))
        scores[(1,1)].extend(score_of_row(board, (start,0), 1, 1, (f-1, f-1-start), player))
        scores[(-1,1)].extend(score_of_row(board, (start,0), -1, 1, (0,start), player))
        if start + 1 < f:
            scores[(1,1)].extend(score_of_row(board, (0, start+1), 1, 1, (f-2-start, f-1), player))
            scores[(-1,1)].extend(score_of_row(board, (f-1, start+1), -1, 1, (start+1, f-1), player))
    return score_ready(scores)

def get_static_heuristic_score(board):
    ai_scores = score_of_col(board, 2); sum_sumcol_values(ai_scores)
    human_scores = score_of_col(board, 1); sum_sumcol_values(human_scores)

    # Immediate wins/losses
    if ai_scores[5] > 0:
        return 1_000_000
    if human_scores[5] > 0:
        return -1_000_000

    ai_total = (ai_scores[1] * 10 +
                ai_scores[2] * 150 +
                ai_scores[3] * 4000 +
                ai_scores[4] * 200000)
    human_total = (human_scores[1] * 10 +
                   human_scores[2] * 150 +
                   human_scores[3] * 4000 +
                   human_scores[4] * 200000)

    return ai_total - human_total * 1.1

# HEURISTIC MOVE (fallback)
def score_line_simple(line, player):
    opp = 1 if player==2 else 2
    s = 0
    cnt_player = line.count(player)
    cnt_empty = line.count(0)
    if cnt_player==0: return 0
    s += cnt_player**2
    if cnt_empty==len(line)-cnt_player:
        s += cnt_player*2
    return s

def heuristic_move(board, player):
    n = len(board)
    best = None; best_score = -1
    for i in range(n):
        for j in range(n):
            if board[i][j]!=0: continue
            sc = 0
            for dx,dy in [(1,0),(0,1),(1,1),(1,-1)]:
                line = []
                for k in range(-4,5):
                    x = i + k*dx; y = j + k*dy
                    if 0<=x<n and 0<=y<n:
                        line.append(board[x][y])
                sc += score_line_simple(line, player)
                sc += score_line_simple(line, 1 if player==2 else 2) * 0.9
            if sc>best_score:
                best_score = sc; best = (i,j)
    return best

# FORCED MOVE
def find_forced_move(board, player):
    n = len(board)
    for y in range(n):
        for x in range(n):
            if board[y][x] != 0: continue
            board[y][x] = player
            if check_win(board, player):
                board[y][x] = 0
                return (y,x)
            board[y][x] = 0
    opp = 1 if player==2 else 2
    for y in range(n):
        for x in range(n):
            if board[y][x] != 0: continue
            board[y][x] = opp
            if check_win(board, opp):
                board[y][x] = 0
                return (y,x)
            board[y][x] = 0
    for y in range(n):
        for x in range(n):
            if board[y][x] != 0: continue
            board[y][x] = opp
            if is_open_four(board, opp):
                board[y][x] = 0
                return (y,x)
            board[y][x] = 0
    return None

#  GENERATE MOVES
def generate_moves_fast(board, limit=TOP_MOVES, radius=2):
    n = len(board)
    candidates = set()
    for y in range(n):
        for x in range(n):
            if board[y][x] != 0: continue
            found = False
            for dy in range(-radius, radius+1):
                for dx in range(-radius, radius+1):
                    if dy==0 and dx==0: continue
                    ny, nx = y+dy, x+dx
                    if is_in(board, ny, nx) and board[ny][nx] != 0:
                        candidates.add((y,x)); found = True; break
                if found: break
    if not candidates:
        return [(n//2, n//2)]
    scored = []
    for (y,x) in candidates:
        s = 0
        for dy,dx in [(1,0),(0,1),(1,1),(1,-1)]:
            for k in range(-4,5):
                ny, nx = y + k*dy, x + k*dx
                if is_in(board, ny, nx):
                    if board[ny][nx] == 2: s += 4
                    elif board[ny][nx] == 1: s += 3
        scored.append((s, (y,x)))
    scored.sort(reverse=True)
    return [m for _,m in scored[:limit]]

# TRANS TABLE UTIL
def trans_get(key, depth):
    entry = transposition_table.get(key)
    if entry is None: return None
    move, score, depth_stored = entry
    if depth_stored >= depth:
        return (move, score)
    return None

def trans_set(key, move, score, depth):
    if len(transposition_table) > TRANS_TABLE_MAX:
        keys = list(transposition_table.keys())
        for k in keys[:len(keys)//2]:
            transposition_table.pop(k, None)
    transposition_table[key] = (move, score, depth)

# MINIMAX
def minimax(board, depth, maximizing, alpha, beta, start_time):
    # time cutoff
    if time.time() - start_time > TIME_LIMIT:
        return None, None

    key = board_key(board)
    cached = trans_get(key, depth)
    if cached is not None:
        return cached

    if check_win(board, 2):
        return None, 1_000_000
    if check_win(board, 1):
        return None, -1_000_000
    if depth == 0:
        return None, get_static_heuristic_score(board)

    moves = generate_moves_fast(board, limit=TOP_MOVES)
    for (y,x) in moves:
        board[y][x] = 2 if maximizing else 1
        if check_win(board, 2 if maximizing else 1):
            board[y][x] = 0
            score = 1_000_000 if maximizing else -1_000_000
            trans_set(key, (y,x), score, depth)
            return (y,x), score
        board[y][x] = 0

    best_move = None
    if maximizing:
        best_score = -math.inf
        scored = []
        for (y,x) in moves:
            board[y][x] = 2
            sc = get_static_heuristic_score(board)
            board[y][x] = 0
            scored.append((sc,(y,x)))
        scored.sort(reverse=True)
        ordered = [m for _,m in scored]
        for (y,x) in ordered:
            board[y][x] = 2
            mv, score = minimax(board, depth-1, False, alpha, beta, start_time)
            board[y][x] = 0
            if score is None:
                score = get_static_heuristic_score(board)
            if score > best_score:
                best_score = score; best_move = (y,x)
            alpha = max(alpha, score)
            if beta <= alpha:
                break
        trans_set(key, best_move, best_score, depth)
        return best_move, best_score
    else:
        best_score = math.inf
        scored = []
        for (y,x) in moves:
            board[y][x] = 1
            sc = get_static_heuristic_score(board)
            board[y][x] = 0
            scored.append((sc,(y,x)))
        scored.sort()
        ordered = [m for _,m in scored]
        for (y,x) in ordered:
            board[y][x] = 1
            mv, score = minimax(board, depth-1, True, alpha, beta, start_time)
            board[y][x] = 0
            if score is None:
                score = get_static_heuristic_score(board)
            if score < best_score:
                best_score = score; best_move = (y,x)
            beta = min(beta, score)
            if beta <= alpha:
                break
        trans_set(key, best_move, best_score, depth)
        return best_move, best_score

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/game")
def game():
    return render_template("game.html", board_size=BOARD_SIZE)

@app.route("/ai_move", methods=["POST"])
def ai_move():
    payload = request.get_json()
    board = payload.get("board")
    mode = payload.get("mode","easy")

    b = deepcopy(board)

    start_time = time.time()
    best_move = None

    try:
        # EASY
        if mode == "easy":
            mv, sc = minimax(b, 1, True, -math.inf, math.inf, start_time)
            best_move = mv
            if best_move is None:
                best_move = heuristic_move(b, 2)

        # MEDIUM
        elif mode == "medium":
            forced = find_forced_move(b, 2)
            if forced and random.random() < MEDIUM_BLOCK_RATE:
                return jsonify({"move": forced})
            mv, sc = minimax(b, 2, True, -math.inf, math.inf, start_time)
            best_move = mv
            if best_move is None:
                best_move = heuristic_move(b, 2)

        # HARD
        else:
            forced = find_forced_move(b, 2)
            if forced:
                return jsonify({"move": forced})
            for depth in range(1, DEPTH_HARD+1):
                if time.time() - start_time > TIME_LIMIT:
                    break
                mv, sc = minimax(b, depth, True, -math.inf, math.inf, start_time)
                if mv is not None:
                    best_move = mv
                if sc is not None and abs(sc) >= 1_000_000:
                    break
            if best_move is None:
                best_move = heuristic_move(b, 2)

    except Exception as e:
        best_move = heuristic_move(b, 2)

    if best_move is None:
        return jsonify({"move": None})
    return jsonify({"move": best_move})

# ----------------- RUN SERVER -----------------
if __name__ == "__main__":
    print("FILE APP.PY MOI - run this with: python app.py")
    app.run(debug=True, use_reloader=False)
