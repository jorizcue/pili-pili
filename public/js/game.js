'use strict';

// =============================================
// PILI PILI — Game Client
// =============================================

const socket = io();

// State
let myId = null;
let myName = null;
let roomId = null;
let currentState = null;
let betValue = 0;

// Elements
const headerRoom   = document.getElementById('headerRoom');
const headerPlayer = document.getElementById('headerPlayer');
const scoreList    = document.getElementById('scoreList');
const toastEl      = document.getElementById('toast');

// Sections
const sections = {
  lobby:     document.getElementById('lobbySection'),
  passing:   document.getElementById('passingSection'),
  betting:   document.getElementById('bettingSection'),
  playing:   document.getElementById('playingSection'),
  round_end: document.getElementById('roundEndSection'),
  game_end:  document.getElementById('gameEndSection'),
};

// =============================================
// INIT
// =============================================

function init() {
  const params = new URLSearchParams(window.location.search);
  const urlRoom = params.get('room');
  const storedName = sessionStorage.getItem('playerName');
  const storedAction = sessionStorage.getItem('action');
  const storedRoom = sessionStorage.getItem('roomCode') || urlRoom;

  myName = storedName;
  if (!myName) {
    // No name stored, send back to home
    window.location.href = urlRoom ? `/?room=${urlRoom}` : '/';
    return;
  }

  headerPlayer.textContent = myName;

  if (storedAction === 'create') {
    sessionStorage.removeItem('action');
    socket.emit('createRoom', { playerName: myName });
  } else if (storedAction === 'join' && storedRoom) {
    sessionStorage.removeItem('action');
    sessionStorage.removeItem('roomCode');
    roomId = storedRoom.toUpperCase();
    socket.emit('joinRoom', { roomId, playerName: myName });
  } else if (urlRoom && myName) {
    // Direct URL join
    roomId = urlRoom.toUpperCase();
    socket.emit('joinRoom', { roomId, playerName: myName });
  } else {
    window.location.href = '/';
  }
}

// =============================================
// TOAST
// =============================================

let toastTimer = null;
function showToast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

// =============================================
// SOCKET EVENTS
// =============================================

socket.on('roomCreated', ({ roomId: rid, playerId }) => {
  roomId = rid;
  myId = playerId;
  headerRoom.textContent = rid;
  // Update URL without reload
  const url = new URL(window.location.href);
  url.searchParams.set('room', rid);
  window.history.replaceState({}, '', url);
});

socket.on('gameState', (state) => {
  currentState = state;
  myId = state.myId;
  renderState(state);
});

socket.on('error', ({ message }) => {
  showToast(message, 'error');
});

socket.on('disconnect', () => {
  showToast('Conexión perdida. Reconectando...', 'error');
});

socket.on('connect', () => {
  if (roomId && myName) {
    socket.emit('reconnect', { roomId, playerName: myName });
  }
});

// =============================================
// RENDER ROUTER
// =============================================

function renderState(state) {
  // Hide all sections
  for (const s of Object.values(sections)) s.classList.add('hidden');

  const section = sections[state.state];
  if (section) section.classList.remove('hidden');

  renderScoreSidebar(state);

  switch (state.state) {
    case 'lobby':     renderLobby(state);    break;
    case 'passing':   renderPassing(state);  break;
    case 'betting':   renderBetting(state);  break;
    case 'playing':   renderPlaying(state);  break;
    case 'round_end': renderRoundEnd(state); break;
    case 'game_end':  renderGameEnd(state);  break;
  }
}

// =============================================
// SCORE SIDEBAR
// =============================================

function renderScoreSidebar(state) {
  scoreList.innerHTML = '';
  for (const p of state.players) {
    const div = document.createElement('div');
    div.className = 'score-player';

    const pilis = p.pilis;
    const piliStr = pilis === 0 ? '—' : '🌶️'.repeat(pilis);

    const badges = [];
    if (p.id === state.hostId) badges.push('<span class="badge badge-host">Host</span>');
    if (p.isDealer) badges.push('<span class="badge badge-dealer">Dealer</span>');
    if (!p.connected) badges.push('<span class="badge badge-disconnected">⚡</span>');

    div.innerHTML = `
      <div class="score-player-name">
        <span class="status-dot ${p.connected ? 'online' : 'offline'}"></span>
        ${escHtml(p.name)}
        ${badges.join('')}
      </div>
      <div class="score-pilis">
        ${pilis === 0 ? '<span style="color:var(--text-muted);font-size:14px">0 pilis</span>' : piliStr}
        ${pilis > 0 ? `<span class="score-pili-number">(${pilis})</span>` : ''}
      </div>
    `;
    scoreList.appendChild(div);
  }
}

// =============================================
// LOBBY
// =============================================

function renderLobby(state) {
  document.getElementById('lobbyRoomCode').textContent = state.roomId;
  document.getElementById('lobbyCopyCode').textContent = state.roomId;

  const lobbyPlayers = document.getElementById('lobbyPlayers');
  lobbyPlayers.innerHTML = '';
  for (const p of state.players) {
    const item = document.createElement('div');
    item.className = 'lobby-player-item';
    const isHost = p.id === state.hostId;
    item.innerHTML = `
      <div class="player-avatar">${escHtml(p.name[0].toUpperCase())}</div>
      <span>${escHtml(p.name)}</span>
      ${isHost ? '<span class="badge badge-host" style="margin-left:auto">Anfitrión</span>' : ''}
    `;
    lobbyPlayers.appendChild(item);
  }

  const startBtn = document.getElementById('startGameBtn');
  const waitMsg  = document.getElementById('lobbyWait');

  if (state.myId === state.hostId) {
    startBtn.classList.remove('hidden');
    waitMsg.classList.add('hidden');
    startBtn.disabled = state.players.length < 2;
    startBtn.textContent = state.players.length < 2
      ? `Esperando jugadores (${state.players.length}/2)...`
      : `¡Iniciar Partida! (${state.players.length} jugadores)`;
  } else {
    startBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
  }
}

document.getElementById('startGameBtn').addEventListener('click', () => {
  socket.emit('startGame');
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const url = `${window.location.origin}/?room=${roomId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Enlace copiado al portapapeles', 'success');
  }).catch(() => {
    showToast(`Enlace: ${url}`);
  });
});

// =============================================
// PASSING (nuevo modo Pasa la Carta)
// =============================================

function renderPassing(state) {
  const mission = state.mission;
  const passPhase = state.passPhase;

  document.getElementById('passMissionName').textContent = mission.name;
  document.getElementById('passMissionDesc').textContent = mission.desc;
  document.getElementById('passRoundInfo').textContent =
    `Ronda ${state.round} de ${state.totalRounds} · ${mission.cardsPerPlayer} cartas por jugador`;

  const statusEl     = document.getElementById('passingStatus');
  const instructionEl = document.getElementById('passInstruction');
  const waitingEl    = document.getElementById('passingWaiting');
  const progressEl   = document.getElementById('passProgress');
  const handArea     = document.getElementById('passingHand');
  const playersStatus = document.getElementById('passPlayersStatus');

  // Progreso general
  progressEl.textContent = `${passPhase.passedCount} de ${passPhase.totalPlayers} jugadores han elegido`;

  // Estado de cada jugador
  playersStatus.innerHTML = '';
  for (const p of state.players) {
    const chip = document.createElement('div');
    chip.className = 'pass-player-chip' + (p.hasPassed ? ' passed' : '');
    chip.innerHTML = `
      <span>${p.hasPassed ? '✅' : '⏳'}</span>
      <span>${escHtml(p.name)}</span>
    `;
    playersStatus.appendChild(chip);
  }

  if (passPhase.myHasPassed) {
    // Ya elegí — mostrar espera
    statusEl.innerHTML = '<span class="pass-ready">✅ ¡Carta enviada!</span>';
    instructionEl.classList.add('hidden');
    handArea.innerHTML = '';
    waitingEl.classList.remove('hidden');
  } else {
    // Aún no elijo — mostrar mis cartas
    statusEl.innerHTML = '<span class="current-better">¡Elige la carta que quieres pasar!</span>';
    instructionEl.classList.remove('hidden');
    waitingEl.classList.add('hidden');
    handArea.innerHTML = '';

    for (let i = 0; i < state.myCards.length; i++) {
      const idx = i;
      const cardEl = makeCardFace(state.myCards[i], true);
      cardEl.title = 'Clic para pasar esta carta';
      cardEl.addEventListener('click', () => {
        socket.emit('passCard', { cardIndex: idx });
      });
      handArea.appendChild(cardEl);
    }
  }
}

// =============================================
// BETTING
// =============================================

let maxBet = 0;

function renderBetting(state) {
  const mission = state.mission;
  document.getElementById('missionName').textContent = mission.name;
  document.getElementById('missionDesc').textContent = mission.desc;
  document.getElementById('roundInfo').textContent =
    `Ronda ${state.round} de ${state.totalRounds} · ${mission.cardsPerPlayer} carta${mission.cardsPerPlayer > 1 ? 's' : ''} por jugador`;

  // Current better status
  const bettingStatus = document.getElementById('bettingStatus');
  const currentBetter = state.players.find(p => p.isCurrentBetter);

  if (currentBetter) {
    if (currentBetter.id === state.myId) {
      bettingStatus.innerHTML = '<span class="current-better">¡Es tu turno de apostar!</span>';
    } else {
      bettingStatus.innerHTML = `Apostando: <span class="current-better">${escHtml(currentBetter.name)}</span>`;
    }
  } else {
    bettingStatus.textContent = 'Apuestas completadas';
  }

  // Show hand or card backs
  const handArea = document.getElementById('bettingHand');
  handArea.innerHTML = '';

  if (state.isBlindPhase) {
    // Show card backs
    for (let i = 0; i < mission.cardsPerPlayer; i++) {
      handArea.appendChild(makeCardBack());
    }
  } else {
    // Show real cards
    for (const card of state.myCards) {
      handArea.appendChild(makeCardFace(card, false));
    }
  }

  // Manos Abiertas: mostrar cartas de rivales también en la apuesta
  const isTransparent = mission.rule === 'transparent' || mission.rule === 'transparent_lowest';
  const bettingOpponents = document.getElementById('bettingOpponents');
  const bettingOpponentsHands = document.getElementById('bettingOpponentsHands');
  if (isTransparent) {
    bettingOpponents.classList.remove('hidden');
    bettingOpponentsHands.innerHTML = '';
    for (const p of state.players) {
      if (p.id === state.myId) continue;
      const div = document.createElement('div');
      div.className = 'opponent-hand';
      div.innerHTML = `<div class="opponent-hand-name">${escHtml(p.name)}</div>`;
      const cardsRow = document.createElement('div');
      cardsRow.className = 'hand-area';
      for (const card of (p.hand || [])) {
        cardsRow.appendChild(makeCardFace(card, false));
      }
      div.appendChild(cardsRow);
      bettingOpponentsHands.appendChild(div);
    }
  } else {
    bettingOpponents.classList.add('hidden');
  }

  // Bet control (only if it's my turn)
  const betControl = document.getElementById('betControl');
  const isMyTurn = currentBetter && currentBetter.id === state.myId;
  if (isMyTurn) {
    betControl.classList.remove('hidden');
    maxBet = mission.cardsPerPlayer;
    betValue = 0;
    updateBetDisplay();
    document.getElementById('betHint').textContent = `Puedes apostar entre 0 y ${maxBet}`;
  } else {
    betControl.classList.add('hidden');
  }
}

function updateBetDisplay() {
  document.getElementById('betValue').textContent = betValue;
}

document.getElementById('betDown').addEventListener('click', () => {
  if (betValue > 0) { betValue--; updateBetDisplay(); }
});

document.getElementById('betUp').addEventListener('click', () => {
  if (betValue < maxBet) { betValue++; updateBetDisplay(); }
});

document.getElementById('confirmBetBtn').addEventListener('click', () => {
  socket.emit('placeBet', { bet: betValue });
});

// =============================================
// PLAYING
// =============================================

function renderPlaying(state) {
  const mission = state.mission;
  document.getElementById('playMissionName').textContent = mission.name;
  document.getElementById('playMissionDesc').textContent = mission.desc;

  // Trick cards
  const trickCards = document.getElementById('trickCards');
  trickCards.innerHTML = '';
  for (const t of state.currentTrick) {
    const wrap = document.createElement('div');
    wrap.className = 'trick-card-wrap';
    wrap.appendChild(makeCardFace(t.card, false));
    const label = document.createElement('div');
    label.className = 'trick-card-label';
    label.textContent = t.playerName;
    wrap.appendChild(label);
    trickCards.appendChild(wrap);
  }

  // Trick status
  const trickStatus = document.getElementById('trickStatus');
  const currentPlayer = state.players.find(p => p.isCurrentPlayer);
  if (currentPlayer) {
    if (currentPlayer.id === state.myId) {
      trickStatus.innerHTML = '';
    } else {
      trickStatus.textContent = `Jugando: ${currentPlayer.name}`;
    }
  } else {
    trickStatus.textContent = 'Resolviendo truco...';
  }

  // Players bet chips
  const playersBets = document.getElementById('playersBets');
  playersBets.innerHTML = '';

  const headerEl = document.createElement('div');
  headerEl.className = 'players-row-header';
  headerEl.textContent = 'Jugadores';
  playersBets.appendChild(headerEl);

  const chipsRow = document.createElement('div');
  chipsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;';
  for (const p of state.players) {
    const chip = document.createElement('div');
    chip.className = 'player-bet-chip';
    if (p.isCurrentPlayer) chip.classList.add('is-current');
    if (p.id === state.myId) chip.classList.add('is-me');

    const betDisplay = p.bet !== null ? p.bet : '?';
    chip.innerHTML = `
      <span class="chip-name">${escHtml(p.name)}</span>
      <span class="chip-bet">Apuesta: <span>${betDisplay}</span> · Ganados: <span>${p.tricksWon}</span></span>
      <span class="chip-bet">Cartas: ${p.cardCount}</span>
    `;
    chipsRow.appendChild(chip);
  }
  playersBets.appendChild(chipsRow);

  // Manos Abiertas: mostrar cartas de rivales
  const rule = state.mission ? state.mission.rule : '';
  const isTransparent = rule === 'transparent' || rule === 'transparent_lowest';
  const playingOpponents = document.getElementById('playingOpponents');
  const playingOpponentsHands = document.getElementById('playingOpponentsHands');
  if (isTransparent) {
    playingOpponents.classList.remove('hidden');
    playingOpponentsHands.innerHTML = '';
    for (const p of state.players) {
      if (p.id === state.myId) continue;
      const div = document.createElement('div');
      div.className = 'opponent-hand';
      if (p.isCurrentPlayer) div.classList.add('opponent-current');
      div.innerHTML = `<div class="opponent-hand-name">${escHtml(p.name)}${p.isCurrentPlayer ? ' <span class="turn-arrow">▶</span>' : ''}</div>`;
      const cardsRow = document.createElement('div');
      cardsRow.className = 'hand-area';
      if (p.hand && p.hand.length > 0) {
        for (const card of p.hand) {
          cardsRow.appendChild(makeCardFace(card, false));
        }
      } else {
        cardsRow.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Sin cartas</span>';
      }
      div.appendChild(cardsRow);
      playingOpponentsHands.appendChild(div);
    }
  } else {
    playingOpponents.classList.add('hidden');
  }

  // My hand
  const isMyTurn = currentPlayer && currentPlayer.id === state.myId;
  const handArea = document.getElementById('playingHand');
  handArea.innerHTML = '';
  const playHint = document.getElementById('playHint');

  if (state.isFullBlind) {
    // Modo A Oscuras: mostrar dorsos de carta en lugar de caras
    // El número de cartas viene del cardCount del jugador en el sidebar
    const me = state.players.find(p => p.id === state.myId);
    const myCardCount = me ? me.cardCount : 0;

    for (let i = 0; i < myCardCount; i++) {
      const idx = i;
      const backEl = makeCardBack();
      if (isMyTurn) {
        backEl.classList.add('playable-back');
        backEl.title = 'Clic para jugar esta carta (no sabes cuál es)';
        backEl.addEventListener('click', () => playCard(idx));
      }
      handArea.appendChild(backEl);
    }

    if (isMyTurn) {
      playHint.innerHTML = '<span class="it-is-your-turn">¡Es tu turno! Elige un dorso — ¡no sabes qué carta es!</span>';
    } else if (currentPlayer) {
      playHint.textContent = `Esperando a ${currentPlayer.name}... (tampoco sabe qué juega)`;
    } else {
      playHint.textContent = '';
    }
  } else {
    // Modo normal: mostrar caras de carta
    for (let i = 0; i < state.myCards.length; i++) {
      const card = state.myCards[i];
      const cardEl = makeCardFace(card, isMyTurn);
      if (isMyTurn) {
        cardEl.dataset.index = i;
        cardEl.addEventListener('click', () => playCard(i));
      }
      handArea.appendChild(cardEl);
    }

    if (isMyTurn) {
      playHint.innerHTML = '<span class="it-is-your-turn">¡Es tu turno! Selecciona una carta</span>';
    } else if (currentPlayer) {
      playHint.textContent = `Esperando a ${currentPlayer.name}...`;
    } else {
      playHint.textContent = '';
    }
  }
}

function playCard(index) {
  socket.emit('playCard', { cardIndex: index });
}

// =============================================
// ROUND END
// =============================================

function renderRoundEnd(state) {
  const tbody = document.getElementById('resultsBody');
  tbody.innerHTML = '';

  // Sort by pilis gained desc for visual impact, but show all
  for (const r of state.roundResults) {
    const tr = document.createElement('tr');
    const isPerfect = r.pilisGained === 0;
    const piliClass = isPerfect ? 'pilis-zero' : 'pilis-gained';
    const betClass  = isPerfect ? 'perfect-bet' : 'bad-bet';

    const totalPlayer = state.players.find(p => p.id === r.id);
    const totalPilis = totalPlayer ? totalPlayer.pilis : r.totalPilis;

    tr.innerHTML = `
      <td style="font-weight:700">${escHtml(r.name)}</td>
      <td class="${betClass}">${r.bet}</td>
      <td>${r.tricksWon}</td>
      <td class="${piliClass}">${isPerfect ? '✓ 0' : '+' + r.pilisGained + ' 🌶️'}</td>
      <td>${'🌶️'.repeat(totalPilis) || '0'} ${totalPilis > 0 ? `<small>(${totalPilis})</small>` : ''}</td>
    `;
    tbody.appendChild(tr);
  }

  const nextBtn  = document.getElementById('nextRoundBtn');
  const waitMsg  = document.getElementById('roundWait');

  if (state.myId === state.hostId) {
    nextBtn.classList.remove('hidden');
    waitMsg.classList.add('hidden');
    nextBtn.textContent = state.round >= state.totalRounds ? 'Ver resultados finales' : 'Siguiente Ronda →';
  } else {
    nextBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
  }
}

document.getElementById('nextRoundBtn').addEventListener('click', () => {
  socket.emit('nextRound');
});

// =============================================
// GAME END
// =============================================

function renderGameEnd(state) {
  document.getElementById('winnerName').textContent = `¡Ganador: ${state.winner}! 🎉`;

  const finalScores = document.getElementById('finalScores');
  finalScores.innerHTML = '';

  const sorted = [...state.players].sort((a, b) => a.pilis - b.pilis);
  for (const p of sorted) {
    const row = document.createElement('div');
    row.className = 'final-score-row' + (p.name === state.winner ? ' winner-row' : '');
    const piliStr = p.pilis === 0 ? '🏆 0' : '🌶️'.repeat(p.pilis) + ` (${p.pilis})`;
    row.innerHTML = `
      <span class="final-score-name">${p.name === state.winner ? '🏆 ' : ''}${escHtml(p.name)}</span>
      <span class="final-score-pilis">${piliStr}</span>
    `;
    finalScores.appendChild(row);
  }
}

// =============================================
// CARD RENDERERS
// =============================================

function makeCardFace(card, playable) {
  const el = document.createElement('div');
  el.className = 'card card-face';
  if (card.isWild) el.classList.add('wild');
  if (playable) el.classList.add('playable');

  if (card.isWild) {
    el.innerHTML = `
      <div class="card-wild-icon">🃏</div>
      <div class="card-wild-label">Comodín</div>
    `;
  } else {
    el.innerHTML = `<div class="card-value">${card.value}</div>`;
  }
  return el;
}

function makeCardBack() {
  const el = document.createElement('div');
  el.className = 'card card-back';
  el.innerHTML = `<div class="card-back-pattern">🌶️</div>`;
  return el;
}

// =============================================
// UTILS
// =============================================

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =============================================
// START
// =============================================

init();
