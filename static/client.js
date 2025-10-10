// public/client.js
const socket = io();

let myIndex = null;       // 0 or 1
let roomId = null;
let boardSize = 10;

// Local boards for rendering
const myShips = new Set();      // "r,c"
const myHitsTaken = new Set();  // where opponent hit me
const myMissesSeen = new Set(); // not needed, but symmetry
const myShotsHit = new Set();   // "r,c" I hit opponent
const myShotsMiss = new Set();

const $ = (sel) => document.querySelector(sel);
const $status = $('#status');
const $info = $('#info');
const myBoardEl = $('#myBoard');
const theirBoardEl = $('#theirBoard');

function setStatus(msg) { $status.textContent = msg; }
function setInfo(msg) { $info.textContent = msg; }

function makeBoard(el) {
  el.innerHTML = '';
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      el.appendChild(div);
    }
  }
}
function renderMyBoard() {
  [...myBoardEl.children].forEach(cell => {
    const key = `${cell.dataset.r},${cell.dataset.c}`;
    cell.className = 'cell';
    if (myShips.has(key)) cell.classList.add('ship');
    if (myHitsTaken.has(key)) cell.classList.add('hit');
  });
}
function renderTheirBoard() {
  [...theirBoardEl.children].forEach(cell => {
    const key = `${cell.dataset.r},${cell.dataset.c}`;
    cell.className = 'cell';
    if (myShotsHit.has(key))  cell.classList.add('hit');
    if (myShotsMiss.has(key)) cell.classList.add('miss');
  });
}

$('#join').onclick = () => {
  const name = ($('#name').value || '').trim();
  socket.emit('hello', name);
  socket.emit('find-match');
  setStatus('Finding a match…');
};

theirBoardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || roomId == null) return;
  const row = Number(cell.dataset.r);
  const col = Number(cell.dataset.c);
  socket.emit('fire', { roomId, row, col });
});

// --- Socket events ---
socket.on('status', setStatus);

socket.on('start', (payload) => {
  roomId = payload.roomId;
  boardSize = payload.boardSize;
  makeBoard(myBoardEl);
  makeBoard(theirBoardEl);
  // Figure out my index
  myIndex = payload.youAre[socket.id];
  setInfo(`You are Player ${myIndex}. Game started!`);
  setStatus('Board ready. Waiting for turn…');
});

socket.on('your-ships', (placements) => {
  myShips.clear();
  for (const coords of Object.values(placements)) {
    coords.forEach(([r,c]) => myShips.add(`${r},${c}`));
  }
  renderMyBoard();
});

socket.on('turn', ({ playerIndex }) => {
  if (playerIndex === myIndex) {
    setStatus('Your turn: click a cell on the opponent board.');
  } else {
    setStatus(`Opponent's turn…`);
  }
});

socket.on('fire-result', ({ shooter, row, col, result }) => {
  const key = `${row},${col}`;
  if (shooter === myIndex) {
    if (result === 'hit') myShotsHit.add(key);
    else myShotsMiss.add(key);
    renderTheirBoard();
  } else {
    if (result === 'hit') myHitsTaken.add(key);
    renderMyBoard();
  }
});

socket.on('score', ({scores}) => {
  console.log(`Scores: ${scores[0]} - ${scores[1]}`);
  const scoreTemp = document.getElementById('score');
  if (scoreTemp) scoreTemp.textContent = `Score ${scores[0]} - ${scores[1]}`;
});


socket.on('game-over', ({ winnerIndex, winnerName, loserName, finalScores }) => {
  const youWon = (winnerIndex === myIndex);
  alert(
    youWon
      ? `🎉 You win! Final score ${finalScores[0]} - ${finalScores[1]}`
      : `💀 You lose. Winner: ${winnerName}. Final score ${finalScores[0]} - ${finalScores[1]}`
  );
});
