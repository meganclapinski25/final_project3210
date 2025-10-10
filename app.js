// app.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'static')));



const waiting = [];               
const rooms = new Map();         

const board_size = 10;
const shipsStart = [
  { name: 'carrier', len: 5 },
  { name: 'battleship', len: 4 },
  { name: 'cruiser', len: 3 },
  { name: 'submarine', len: 3 },
  { name: 'destroyer', len: 2 },
];

// Helpers
function emptyBoard() {
  return Array.from({ length: board_size }, () =>
    Array.from({ length: board_size }, () => 0)
  );
}
function inBounds(r, c) {
  return r >= 0 && r < board_size && c >= 0 && c < board_size;
}
function tryPlace(board, len, row, col, dr, dc) {
  const coords = [];
  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (!inBounds(r, c) || board[r][c] !== 0) return null;
    coords.push([r, c]);
  }
  coords.forEach(([r, c]) => (board[r][c] = len)); 
  return coords;
}
function randomPlaceAllShips() {
  const board = emptyBoard();
  const placements = {};
  for (const ship of shipsStart) {
    let placed = null;
    for (let attempt = 0; attempt < 500 && !placed; attempt++) {
      const vertical = Math.random() < 0.5;
      const dr = vertical ? 1 : 0;
      const dc = vertical ? 0 : 1;
      const r = Math.floor(Math.random() * board_size);
      const c = Math.floor(Math.random() * board_size);
      const coords = tryPlace(board, ship.len, r, c, dr, dc);
      if (coords) {
        placements[ship.name] = coords;
        placed = true;
      }
    }
    if (!placed) throw new Error('Failed to place ships');
  }
  return { board, placements };
}

function countRemaining(board, hits) {
  
  let total = 0;
  for (let r = 0; r < board_size; r++) {
    for (let c = 0; c < board_size; c++) {
      if (board[r][c] > 0 && !hits.has(`${r},${c}`)) total++;
    }
  }
  return total;
}


function createRoom(p1, p2) {
  const roomId = `room-${p1.id}-${p2.id}`;
  p1.join(roomId);
  p2.join(roomId);

  const A = randomPlaceAllShips();
  const B = randomPlaceAllShips();

  const names = {
    [p1.id] : p1.data?.name || `Player -${p1.id.slice(0,4)}`,
    [p2.id] : p2.data?.name || `Player -${p2.id.slice(0,4)}`,
  }

  const state = {
    roomId,
    players: [p1.id, p2.id],              
    boards: [A.board, B.board],           
    hits: [new Set(), new Set()],         
    misses: [new Set(), new Set()],
    score: [0,0],
    turn: 0,                             
    over: false,
    names
  };

  rooms.set(roomId, state);

  io.to(roomId).emit('start', {
    roomId,
    youAre: { [p1.id]: 0, [p2.id]: 1 },   
    boardSize: board_size,
    ships: shipsStart.map(s => ({ name: s.name, len: s.len })),
    names :[names[p1.id], names[p2.id]],
    scores : state.score
  });


  io.to(p1.id).emit('your-ships', A.placements);
  io.to(p2.id).emit('your-ships', B.placements);

  io.to(roomId).emit('turn', { playerIndex: state.turn });
}

io.on('connection', (socket) => {
  
  socket.on('hello', (name) => {
    socket.data.name = (name && name.trim()) || `Player-${socket.id.slice(0,4)}`;
  });


  socket.on('find-match', () => {
    if (waiting.includes(socket)) return;
    waiting.push(socket);
    if (waiting.length >= 2) {
      const p1 = waiting.shift();
      const p2 = waiting.shift();
      createRoom(p1, p2);
    } else {
      socket.emit('status', 'Waiting for an opponent…');
    }
  });

  
  socket.on('fire', ({ roomId, row, col }) => {
    const state = rooms.get(roomId);
    if (!state || state.over) return;

    const me = state.players.indexOf(socket.id);
    if (me === -1) return;

    if (state.turn !== me) {
      socket.emit('status', 'Not your turn!');
      return;
    }

    const opp = 1 - me;
    const targetBoard = state.boards[opp];
    const key = `${row},${col}`;

    
    if (state.hits[me].has(key) || state.misses[me].has(key)) {
      socket.emit('status', 'Already fired there.');
      return;
    }

    let result = 'miss';
    if (inBounds(row, col) && targetBoard[row][col] > 0) {
      state.hits[me].add(key);
      result = 'hit';
      state.score[me] +=1;
      io.to(roomId).emit('score', {
        scores: state.score
      })
    } else {
      state.misses[me].add(key);
    }

    
    io.to(roomId).emit('fire-result', {
      shooter: me,
      row, col, result
    });

    
    const remaining = countRemaining(targetBoard, state.hits[me]);
    if (remaining === 0) {
      state.over = true;
      const winner = me;
      const loser = 1- me;
      io.to(roomId).emit('game-over', {
        roomId,
        winnerIndex: winner,
        winnerName: state.names[state.players[winner]],
        loserName:  state.names[state.players[loser]],
        finalScores: state.score
      });
      rooms.delete(roomId);
      return;
    }

    
    state.turn = opp;
    io.to(roomId).emit('turn', { playerIndex: state.turn });
  });

  socket.on('disconnect', () => {
    
    const idx = waiting.indexOf(socket);
    if (idx !== -1) waiting.splice(idx, 1);

    
    for (const [roomId, state] of rooms) {
      const i = state.players.indexOf(socket.id);
      if (i !== -1 && !state.over) {
        state.over = true;
        const winnerIndex = 1-i;
        const winnerId = state.players[winnerIndex];
        const loserId = socket.id;
        io.to(roomId).emit('game-over', { 
          roomId,
          winnerIndex,
          winnerName : state.names[winnerId],
          loserName: state.names[loserId],
          finalScores: state.score,
          reason: 'opponent disconnected' 
        });
        rooms.delete(roomId);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
