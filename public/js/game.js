'use strict';

// =============================================
// PILI PILI — Game Client
// =============================================

const _token = sessionStorage.getItem('pochaset_token') || localStorage.getItem('pochaset_token') || '';
const socket = io({ auth: { token: _token } });

// =============================================
// SOUND ENGINE (Web Audio API — sin archivos)
// =============================================

const SFX = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, type, tStart, dur, vol = 0.18) {
    if (muted) return;
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, tStart);
      gain.gain.setValueAtTime(vol, tStart);
      gain.gain.exponentialRampToValueAtTime(0.001, tStart + dur);
      osc.start(tStart);
      osc.stop(tStart + dur + 0.01);
    } catch (_) {}
  }

  function now() {
    try { return getCtx().currentTime; } catch(_) { return 0; }
  }

  return {
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() { return muted; },

    deal() { // Repartir cartas
      const t = now();
      [0, 0.06, 0.12].forEach((d, i) => tone(600 - i * 80, 'sine', t + d, 0.12, 0.12));
    },

    card() { // Jugar una carta
      const t = now();
      tone(380, 'square', t, 0.04, 0.08);
      tone(620, 'sine', t + 0.03, 0.1, 0.1);
    },

    bet() { // Confirmar apuesta
      const t = now();
      tone(523, 'sine', t, 0.12, 0.15);
      tone(659, 'sine', t + 0.1, 0.1, 0.12);
    },

    pass() { // Pasar carta
      const t = now();
      tone(440, 'sine', t, 0.06, 0.14);
      tone(554, 'sine', t + 0.06, 0.06, 0.14);
      tone(659, 'sine', t + 0.12, 0.1, 0.14);
    },

    trick() { // Ganar un truco
      const t = now();
      [330, 392, 494].forEach((f, i) => tone(f, 'sine', t + i * 0.07, 0.13, 0.16));
    },

    forbidden() { // Apuesta prohibida
      const t = now();
      tone(220, 'sawtooth', t, 0.08, 0.12);
      tone(196, 'sawtooth', t + 0.07, 0.1, 0.12);
    },

    roundEnd() { // Fin de ronda
      const t = now();
      [392, 349, 330, 294].forEach((f, i) => tone(f, 'sine', t + i * 0.13, 0.18, 0.18));
    },

    gameWin() { // Ganaste la partida
      const t = now();
      [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, 'triangle', t + i * 0.11, 0.2, 0.2));
    },

    gameLose() { // Perdiste la partida
      const t = now();
      [294, 262, 233, 196].forEach((f, i) => tone(f, 'sawtooth', t + i * 0.15, 0.22, 0.16));
    },
  };
})();

// State
let myId = null;
let myName = null;
let roomId = null;
let currentState = null;
let prevGameState = null; // para detectar cambios y disparar sonidos
let betValue = 0;
let currentForbiddenBet = null;

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
    const roomName = sessionStorage.getItem('roomName') || '';
    const isPublic = sessionStorage.getItem('roomIsPublic') !== 'false';
    sessionStorage.removeItem('roomName');
    sessionStorage.removeItem('roomIsPublic');
    socket.emit('createRoom', { playerName: myName, roomName, isPublic });
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
  handleSounds(prevGameState, state);
  prevGameState = currentState;
  currentState = state;
  myId = state.myId;
  renderState(state);
});

function handleSounds(prev, curr) {
  if (!prev) { SFX.deal(); return; }

  // Cambio de estado
  if (prev.state !== curr.state) {
    switch (curr.state) {
      case 'betting':   SFX.deal();     break;
      case 'passing':   SFX.pass();     break;
      case 'round_end': SFX.roundEnd(); break;
      case 'game_end':
        // ¿Gané o perdí?
        const me = curr.players.find(p => p.id === curr.myId);
        if (me && curr.winner === me.name) SFX.gameWin();
        else SFX.gameLose();
        break;
    }
  }

  // Carta jugada (trick creció)
  if (curr.state === 'playing' && prev.state === 'playing' &&
      curr.currentTrick.length > prev.currentTrick.length) {
    SFX.card();
  }

  // Truco resuelto (trick estaba lleno y ahora está vacío)
  if (curr.state === 'playing' && prev.state === 'playing' &&
      prev.currentTrick.length === prev.players.length &&
      curr.currentTrick.length === 0) {
    SFX.trick();
  }
}

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

socket.on('joinPending', ({ roomId: rid, roomName }) => {
  roomId = rid;
  for (const s of Object.values(sections)) s.classList.add('hidden');
  document.getElementById('pendingSection').classList.remove('hidden');
  document.getElementById('pendingRoomInfo').textContent =
    `Sala: ${roomName || rid} — Esperando que el anfitrión apruebe tu solicitud.`;
});

socket.on('joinRejected', ({ message }) => {
  sessionStorage.setItem('joinError', message || 'El anfitrión rechazó tu solicitud');
  window.location.href = '/';
});

// =============================================
// RENDER ROUTER
// =============================================

function renderState(state) {
  // Hide all sections (including pending)
  document.getElementById('pendingSection').classList.add('hidden');
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
        ${p.level ? `<span class="level-emoji" title="${escHtml(p.level.name)}">${p.level.emoji}</span>` : ''}
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
    const isHost   = p.id === state.hostId;
    const isBot    = p.isBot;
    const isMe     = p.id === state.myId;
    const amHost   = state.myId === state.hostId;

    const avatarStyle = isBot ? 'background:rgba(255,107,53,.18);color:#ff6b35;font-size:1.1rem' : '';
    const avatarContent = isBot ? '🤖' : escHtml(p.name[0].toUpperCase());

    let rightBadge = '';
    if (isHost)  rightBadge = '<span class="badge badge-host" style="margin-left:auto">Anfitrión</span>';
    if (isBot && amHost)
      rightBadge = `<button class="btn btn-sm" style="margin-left:auto;padding:2px 9px;font-size:0.75rem;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3)"
                     onclick="window._removeBot('${p.id}')">✕ Quitar</button>`;

    const levelTag = p.level ? ` <span style="font-size:.7rem;color:var(--text-muted);margin-left:4px">${p.level.emoji} ${p.level.name}</span>` : '';
    const botTag   = isBot ? ' <span style="font-size:.7rem;color:#ff6b35;margin-left:4px">BOT</span>' : '';

    item.innerHTML = `
      <div class="player-avatar" style="${avatarStyle}">${avatarContent}</div>
      <span>${escHtml(p.name)}${botTag}${levelTag}</span>
      ${rightBadge}
    `;
    lobbyPlayers.appendChild(item);
  }

  // Panel "Añadir bot" (solo host)
  let botPanel = document.getElementById('addBotPanel');
  if (state.myId === state.hostId) {
    if (!botPanel) {
      botPanel = document.createElement('div');
      botPanel.id = 'addBotPanel';
      botPanel.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:12px;flex-wrap:wrap;justify-content:center';
      botPanel.innerHTML = `
        <span style="font-size:0.85rem;color:var(--text-muted)">Añadir bot:</span>
        <select id="botDifficulty" style="padding:4px 8px;border-radius:6px;background:var(--bg-panel);color:var(--text-primary);border:1px solid var(--border);font-size:0.83rem">
          <option value="easy">😴 Fácil</option>
          <option value="normal" selected>🤖 Normal</option>
          <option value="hard">😈 Difícil</option>
        </select>
        <button class="btn btn-sm btn-secondary" id="addBotBtn" style="display:flex;align-items:center;gap:4px">🤖 Añadir</button>
      `;
      lobbyPlayers.after(botPanel);
      document.getElementById('addBotBtn').addEventListener('click', () => {
        const diff = document.getElementById('botDifficulty').value;
        socket.emit('addBot', { difficulty: diff });
      });
    }
    // Ocultar si sala llena
    botPanel.style.display = state.players.length >= 8 ? 'none' : 'flex';
  } else if (botPanel) {
    botPanel.style.display = 'none';
  }

  // Room name display
  const lobbyRoomNameEl = document.getElementById('lobbyRoomName');
  if (lobbyRoomNameEl) lobbyRoomNameEl.textContent = state.roomName ? `— ${state.roomName}` : '';

  // Public/private badge
  const roomTypeBadge = document.getElementById('roomTypeBadge');
  if (roomTypeBadge) {
    roomTypeBadge.textContent = state.isPublic ? '🌐 Pública' : '🔒 Privada';
    roomTypeBadge.className = 'badge ' + (state.isPublic ? 'badge-public' : 'badge-private');
  }

  // Pending requests (host only, private rooms)
  const pendingRequests = document.getElementById('pendingRequests');
  const pendingList = document.getElementById('pendingList');
  if (state.pendingRequests && state.pendingRequests.length > 0 && state.myId === state.hostId) {
    pendingRequests.classList.remove('hidden');
    pendingList.innerHTML = '';
    for (const req of state.pendingRequests) {
      const item = document.createElement('div');
      item.className = 'pending-item';
      item.innerHTML = `
        <div class="player-avatar">${escHtml(req.name[0].toUpperCase())}</div>
        <span class="pending-name">${escHtml(req.name)} quiere unirse</span>
        <button class="btn btn-sm btn-approve" data-sid="${escHtml(req.socketId)}">✓ Aprobar</button>
        <button class="btn btn-sm btn-reject" data-sid="${escHtml(req.socketId)}">✗ Rechazar</button>
      `;
      pendingList.appendChild(item);
    }
    pendingList.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', () => socket.emit('approveJoin', { pendingSocketId: btn.dataset.sid }));
    });
    pendingList.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', () => socket.emit('rejectJoin', { pendingSocketId: btn.dataset.sid }));
    });
  } else {
    pendingRequests.classList.add('hidden');
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

  // Config panel (host only)
  const configPanel = document.getElementById('configPanel');
  if (state.myId === state.hostId) {
    configPanel.classList.remove('hidden');
    // Fill mode checkboxes if not already done
    const cfgModes = document.getElementById('cfgModes');
    if (cfgModes.children.length === 0 && state.modeFamilies) {
      const enabledFamilies = state.config ? state.config.enabledFamilies : null;
      for (const fam of state.modeFamilies) {
        const label = document.createElement('label');
        label.className = 'config-mode-option';
        const checked = !enabledFamilies || enabledFamilies.includes(fam.key);
        label.innerHTML = `<input type="checkbox" name="mode" value="${fam.key}" ${checked ? 'checked' : ''}> ${escHtml(fam.label)}`;
        cfgModes.appendChild(label);
      }
      // Deck size
      const deckInput = document.getElementById('cfgDeckSize');
      if (state.config) deckInput.value = state.config.deckSize;

      // Listeners
      const sendConfig = () => {
        const deckSize = parseInt(document.getElementById('cfgDeckSize').value, 10) || 55;
        const boxes = cfgModes.querySelectorAll('input[type=checkbox]');
        const enabledFamilies = [...boxes].filter(b => b.checked).map(b => b.value);
        socket.emit('setConfig', { deckSize, enabledFamilies });
      };
      document.getElementById('cfgDeckSize').addEventListener('change', sendConfig);
      cfgModes.addEventListener('change', sendConfig);
      document.getElementById('cfgSelectAll').addEventListener('click', () => {
        cfgModes.querySelectorAll('input').forEach(b => b.checked = true);
        sendConfig();
      });
      document.getElementById('cfgSelectNone').addEventListener('click', () => {
        cfgModes.querySelectorAll('input').forEach(b => b.checked = false);
        sendConfig();
      });
    }
  } else {
    configPanel.classList.add('hidden');
  }
}

document.getElementById('startGameBtn').addEventListener('click', () => {
  socket.emit('startGame');
});

// Expuesto globalmente para los botones inline de "Quitar bot"
window._removeBot = (botId) => socket.emit('removeBot', { botId });

document.getElementById('muteBtn').addEventListener('click', () => {
  const muted = SFX.toggleMute();
  document.getElementById('muteBtn').textContent = muted ? '🔇' : '🔊';
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const url = `${window.location.origin}/game?room=${roomId}`;
  if (navigator.share) {
    navigator.share({
      title: 'PochaSet 🌶️',
      text: `¡Únete a mi partida de PochaSet! Código: ${roomId}`,
      url,
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Enlace copiado al portapapeles', 'success');
    }).catch(() => {
      showToast(`Enlace: ${url}`);
    });
  }
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

  // Instrucción dinámica con conteo
  instructionEl.querySelector('p').innerHTML =
    `👈 Elige <strong>${passPhase.passCount}</strong> carta(s) para pasar al jugador de tu <strong>izquierda</strong>
     <br><small style="color:var(--text-muted)">${passPhase.myPassedCount}/${passPhase.passCount} elegidas</small>`;

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
    statusEl.innerHTML = '<span class="pass-ready">✅ ¡Carta(s) enviada(s)!</span>';
    instructionEl.classList.add('hidden');
    handArea.innerHTML = '';
    waitingEl.classList.remove('hidden');
  } else {
    // Aún no elijo — mostrar mis cartas
    statusEl.innerHTML = '<span class="current-better">¡Elige la(s) carta(s) que quieres pasar!</span>';
    instructionEl.classList.remove('hidden');
    waitingEl.classList.add('hidden');
    handArea.innerHTML = '';

    for (let i = 0; i < state.myCards.length; i++) {
      const idx = i;
      const cardEl = makeCardFace(state.myCards[i], true);
      cardEl.title = 'Clic para pasar esta carta';
      cardEl.addEventListener('click', () => {
        SFX.pass();
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

  // El Indio: show a card back for own hand in betting phase
  if (state.isIndian) {
    handArea.innerHTML = '';
    handArea.appendChild(makeCardBack());
  }

  // Manos Abiertas o El Indio: mostrar cartas de rivales también en la apuesta
  const isTransparent = mission.rule === 'transparent' || mission.rule === 'transparent_lowest';
  const bettingOpponents = document.getElementById('bettingOpponents');
  const bettingOpponentsHands = document.getElementById('bettingOpponentsHands');

  if (isTransparent || state.isIndian) {
    bettingOpponents.classList.remove('hidden');
    bettingOpponentsHands.innerHTML = '';
    for (const p of state.players) {
      if (p.id === state.myId) continue;
      const div = document.createElement('div');
      div.className = 'opponent-hand';
      const visibleCards = p.hand || [];

      if (isTransparent) {
        const hiddenCount = p.cardCount - visibleCards.length;
        div.innerHTML = `<div class="opponent-hand-name">${escHtml(p.name)} <small style="color:var(--text-muted)">(${visibleCards.length} visibles, ${hiddenCount} ocultas)</small></div>`;
        const cardsRow = document.createElement('div');
        cardsRow.className = 'hand-area';
        for (const card of visibleCards) {
          cardsRow.appendChild(makeCardFace(card, false));
        }
        for (let i = 0; i < hiddenCount; i++) {
          cardsRow.appendChild(makeCardBack());
        }
        div.appendChild(cardsRow);
      } else {
        // El Indio: show full hand
        div.innerHTML = `<div class="opponent-hand-name">${escHtml(p.name)}</div>`;
        const cardsRow = document.createElement('div');
        cardsRow.className = 'hand-area';
        for (const card of visibleCards) {
          cardsRow.appendChild(makeCardFace(card, false));
        }
        div.appendChild(cardsRow);
      }

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
    currentForbiddenBet = state.forbiddenBet ?? null;

    // Start betValue away from forbidden if needed
    betValue = 0;
    if (betValue === currentForbiddenBet) betValue = betValue < maxBet ? betValue + 1 : maxBet - 1 >= 0 ? maxBet - 1 : 0;

    document.getElementById('betHint').textContent = `Puedes apostar entre 0 y ${maxBet}`;
    updateBetDisplay();
  } else {
    currentForbiddenBet = null;
    betControl.classList.add('hidden');
  }
}

function updateBetDisplay() {
  document.getElementById('betValue').textContent = betValue;

  const isForbidden = currentForbiddenBet !== null && betValue === currentForbiddenBet;
  const confirmBtn = document.getElementById('confirmBetBtn');
  const forbiddenMsg = document.getElementById('forbiddenBetMsg');

  confirmBtn.disabled = isForbidden;

  if (currentForbiddenBet !== null) {
    forbiddenMsg.classList.remove('hidden');
    forbiddenMsg.textContent = `❌ No puedes apostar ${currentForbiddenBet} — eres el último en apostar y la suma total no puede ser igual al número de cartas`;
    if (isForbidden) {
      forbiddenMsg.classList.add('forbidden-active');
      SFX.forbidden();
    } else {
      forbiddenMsg.classList.remove('forbidden-active');
    }
  } else {
    forbiddenMsg.classList.add('hidden');
    forbiddenMsg.classList.remove('forbidden-active');
  }
}

document.getElementById('betDown').addEventListener('click', () => {
  if (betValue > 0) {
    betValue--;
    // Saltar el valor prohibido
    if (betValue === currentForbiddenBet && betValue > 0) betValue--;
    updateBetDisplay();
  }
});

document.getElementById('betUp').addEventListener('click', () => {
  if (betValue < maxBet) {
    betValue++;
    // Saltar el valor prohibido
    if (betValue === currentForbiddenBet && betValue < maxBet) betValue++;
    updateBetDisplay();
  }
});

document.getElementById('confirmBetBtn').addEventListener('click', () => {
  if (betValue === currentForbiddenBet) return; // doble seguridad
  SFX.bet();
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
      <span class="chip-name">${p.level ? p.level.emoji + ' ' : ''}${escHtml(p.name)}</span>
      <span class="chip-bet">Apuesta: <span>${betDisplay}</span> · Ganados: <span>${p.tricksWon}</span></span>
      <span class="chip-bet">Cartas: ${p.cardCount}</span>
    `;
    chipsRow.appendChild(chip);
  }
  playersBets.appendChild(chipsRow);

  // Hide opponents section by default
  document.getElementById('playingOpponents').classList.add('hidden');

  // Show opponents if server sent their hands (e.g. El Indio mode)
  const anyOpponentHasHand = state.players.some(p => p.id !== state.myId && p.hand && p.hand.length > 0);
  const playingOpponents = document.getElementById('playingOpponents');
  const playingOpponentsHands = document.getElementById('playingOpponentsHands');
  if (anyOpponentHasHand) {
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
      for (const card of (p.hand || [])) {
        cardsRow.appendChild(makeCardFace(card, false));
      }
      div.appendChild(cardsRow);
      playingOpponentsHands.appendChild(div);
    }
  }

  // My hand
  const isMyTurn = currentPlayer && currentPlayer.id === state.myId;
  const handArea = document.getElementById('playingHand');
  handArea.innerHTML = '';
  const playHint = document.getElementById('playHint');

  // El Indio: can't see own card, show a back
  if (state.isIndian) {
    const backEl = makeCardBack();
    handArea.appendChild(backEl);
    if (isMyTurn) {
      playHint.innerHTML = '<span class="it-is-your-turn">¡Es tu turno! Juega tu carta (¡no sabes cuál es!)</span>';
      backEl.classList.add('playable-back');
      backEl.addEventListener('click', () => playCard(0));
    } else if (currentPlayer) {
      playHint.textContent = `Esperando a ${currentPlayer.name}...`;
    } else {
      playHint.textContent = '';
    }
    return; // don't proceed to normal rendering
  }

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
  SFX.card();
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
    const isPerfect = r.pilisGained < 0;
    const piliClass = isPerfect ? 'pilis-zero' : 'pilis-gained';
    const betClass  = isPerfect ? 'perfect-bet' : 'bad-bet';

    const totalPlayer = state.players.find(p => p.id === r.id);
    const totalPilis = totalPlayer ? totalPlayer.pilis : r.totalPilis;

    let piliDisplay = isPerfect ? '−1 🎯' : '+' + r.pilisGained + ' 🌶️';
    if (r.lastTrickPenalty) {
      piliDisplay += ' <span title="Última baza" style="color:#f59e0b;font-size:0.85em">+1 🃏</span>';
    }

    tr.innerHTML = `
      <td style="font-weight:700">${escHtml(r.name)}</td>
      <td class="${betClass}">${r.bet}</td>
      <td>${r.tricksWon}</td>
      <td class="${piliClass}">${piliDisplay}</td>
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
      <div class="card-wild-icon">🌶️</div>
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
