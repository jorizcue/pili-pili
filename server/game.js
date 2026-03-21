'use strict';

const MISSIONS = [
  { id: 1,  name: "Normal",           cardsPerPlayer: 1, rule: 'normal',           desc: '1 carta por jugador. Gana la más alta.' },
  { id: 2,  name: "Normal",           cardsPerPlayer: 2, rule: 'normal',           desc: '2 cartas por jugador. Gana la más alta.' },
  { id: 3,  name: "Normal",           cardsPerPlayer: 3, rule: 'normal',           desc: '3 cartas por jugador. Gana la más alta.' },
  { id: 4,  name: "Normal",           cardsPerPlayer: 4, rule: 'normal',           desc: '4 cartas por jugador. Gana la más alta.' },
  { id: 5,  name: "Normal",           cardsPerPlayer: 5, rule: 'normal',           desc: '5 cartas por jugador. Gana la más alta.' },
  { id: 6,  name: "Normal",           cardsPerPlayer: 6, rule: 'normal',           desc: '6 cartas por jugador. Gana la más alta.' },
  { id: 7,  name: "Normal",           cardsPerPlayer: 7, rule: 'normal',           desc: '7 cartas por jugador. Gana la más alta.' },
  { id: 8,  name: "¡Al Revés!",       cardsPerPlayer: 2, rule: 'lowest',           desc: '2 cartas. Gana la carta más baja.' },
  { id: 9,  name: "¡Al Revés!",       cardsPerPlayer: 3, rule: 'lowest',           desc: '3 cartas. Gana la carta más baja.' },
  { id: 10, name: "¡Al Revés!",       cardsPerPlayer: 4, rule: 'lowest',           desc: '4 cartas. Gana la carta más baja.' },
  { id: 11, name: "¡Al Revés!",       cardsPerPlayer: 5, rule: 'lowest',           desc: '5 cartas. Gana la carta más baja.' },
  { id: 12, name: "A Ciegas",         cardsPerPlayer: 3, rule: 'blind',            desc: '3 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 13, name: "A Ciegas",         cardsPerPlayer: 4, rule: 'blind',            desc: '4 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 14, name: "A Ciegas",         cardsPerPlayer: 5, rule: 'blind',            desc: '5 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 15, name: "Doble Pili",       cardsPerPlayer: 2, rule: 'double',           desc: '2 cartas. ¡Cada error vale 2 pilis!' },
  { id: 16, name: "Doble Pili",       cardsPerPlayer: 3, rule: 'double',           desc: '3 cartas. ¡Cada error vale 2 pilis!' },
  { id: 17, name: "Doble Pili",       cardsPerPlayer: 4, rule: 'double',           desc: '4 cartas. ¡Cada error vale 2 pilis!' },
  { id: 18, name: "Ciegas al Revés",  cardsPerPlayer: 3, rule: 'blind_lowest',     desc: '3 cartas. Apuesta sin ver. Gana la más baja.' },
  { id: 19, name: "Ciegas al Revés",  cardsPerPlayer: 4, rule: 'blind_lowest',     desc: '4 cartas. Apuesta sin ver. Gana la más baja.' },
  { id: 20, name: "Comodín Pierde",   cardsPerPlayer: 4, rule: 'joker_loses',      desc: '4 cartas. El comodín es la carta más baja.' },
  // --- Nuevos modos ---
  { id: 21, name: "Pasa la Carta",    cardsPerPlayer: 3, rule: 'pass',             desc: '3 cartas. ¡Elige carta(s) para pasar al jugador de tu izquierda!' },
  { id: 22, name: "Pasa la Carta",    cardsPerPlayer: 4, rule: 'pass',             desc: '4 cartas. ¡Elige carta(s) para pasar al jugador de tu izquierda!' },
  { id: 23, name: "Pasa la Carta",    cardsPerPlayer: 5, rule: 'pass',             desc: '5 cartas. ¡Elige carta(s) para pasar al jugador de tu izquierda!' },
  { id: 24, name: "¡Pasa al Revés!",  cardsPerPlayer: 3, rule: 'pass_lowest',      desc: '3 cartas. Pasa carta(s) al vecino. ¡Gana la carta más baja!' },
  { id: 25, name: "¡Pasa al Revés!",  cardsPerPlayer: 4, rule: 'pass_lowest',      desc: '4 cartas. Pasa carta(s) al vecino. ¡Gana la carta más baja!' },
  { id: 26, name: "Manos Abiertas",         cardsPerPlayer: 3, rule: 'transparent',       desc: '3 cartas. Al apostar ves la mitad de las cartas de cada rival. ¡Gana la más alta!' },
  { id: 27, name: "Manos Abiertas",         cardsPerPlayer: 4, rule: 'transparent',       desc: '4 cartas. Al apostar ves la mitad de las cartas de cada rival. ¡Gana la más alta!' },
  { id: 28, name: "Manos Abiertas",         cardsPerPlayer: 5, rule: 'transparent',       desc: '5 cartas. Al apostar ves la mitad de las cartas de cada rival. ¡Gana la más alta!' },
  { id: 29, name: "Manos Abiertas al Revés",cardsPerPlayer: 3, rule: 'transparent_lowest',desc: '3 cartas. Al apostar ves la mitad de las cartas de cada rival. ¡Gana la más baja!' },
  { id: 30, name: "Manos Abiertas al Revés",cardsPerPlayer: 4, rule: 'transparent_lowest',desc: '4 cartas. Al apostar ves la mitad de las cartas de cada rival. ¡Gana la más baja!' },
  { id: 31, name: "A Oscuras",              cardsPerPlayer: 3, rule: 'full_blind',         desc: '3 cartas. ¡Nadie puede ver ninguna carta! Juegas completamente a ciegas.' },
  { id: 32, name: "A Oscuras",              cardsPerPlayer: 4, rule: 'full_blind',         desc: '4 cartas. ¡Nadie puede ver ninguna carta! Juegas completamente a ciegas.' },
  { id: 33, name: "A Oscuras al Revés",     cardsPerPlayer: 3, rule: 'full_blind_lowest',  desc: '3 cartas. Nadie ve sus cartas y gana la más baja. ¡El caos total!' },
  { id: 34, name: "El Indio",               cardsPerPlayer: 1, rule: 'indian',             desc: '1 carta. Ves las cartas de todos menos la tuya propia. ¡Adivina tu propio valor!' },
  { id: 35, name: "Última Baza",            cardsPerPlayer: 3, rule: 'last_trick_pili',    desc: '3 cartas. Apuesta bazas normalmente, pero ¡quien gana la última baza recibe +1 pili extra!' },
  { id: 36, name: "Última Baza",            cardsPerPlayer: 4, rule: 'last_trick_pili',    desc: '4 cartas. Apuesta bazas normalmente, pero ¡quien gana la última baza recibe +1 pili extra!' },
  { id: 37, name: "Última Baza",            cardsPerPlayer: 5, rule: 'last_trick_pili',    desc: '5 cartas. Apuesta bazas normalmente, pero ¡quien gana la última baza recibe +1 pili extra!' },
];

const MODE_FAMILIES = {
  normal:       'Normal',
  lowest:       'Al Revés',
  blind:        'A Ciegas',
  double:       'Doble Pili',
  joker_loses:  'Comodín Pierde',
  pass:         'Pasa la Carta',
  transparent:  'Manos Abiertas',
  full_blind:       'A Oscuras',
  indian:           'El Indio',
  last_trick_pili:  'Última Baza',
};

// Map rule → family key
const RULE_FAMILY = {
  normal:             'normal',
  lowest:             'lowest',
  blind:              'blind',
  blind_lowest:       'blind',
  double:             'double',
  joker_loses:        'joker_loses',
  pass:               'pass',
  pass_lowest:        'pass',
  transparent:        'transparent',
  transparent_lowest: 'transparent',
  full_blind:         'full_blind',
  full_blind_lowest:  'full_blind',
  indian:             'indian',
  last_trick_pili:    'last_trick_pili',
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck(deckSize = 55) {
  const cards = [];
  for (let i = 1; i <= deckSize; i++) {
    cards.push({ value: i, isWild: false });
  }
  cards.push({ value: deckSize + 1, isWild: true }); // wild is always highest
  return cards;
}

function cardEffectiveValue(card, rule) {
  if (card.isWild) {
    if (rule === 'joker_loses') return 0;
    return 56; // wild always 56 (highest in normal, highest=worst in lowest)
  }
  return card.value;
}

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.state = 'lobby';
    this.players = []; // { id, name, pilis, bet, tricksWon, hand, connected, disconnectTimer }
    this.hostId = null;
    this.dealerIndex = 0;
    this.round = 0;
    this.missions = [];
    this.mission = null;
    this.currentTrick = [];
    this.trickLeaderIndex = 0;
    this.currentBetterIndex = 0;
    this.roundResults = [];
    this.winner = null;
    this.isBlindPhase = false;
    this.passingCards = {}; // playerIndex -> array of cards chosen to pass
    this.passCount = 0;
    this.config = {
      deckSize: 55,        // number of numbered cards (+ 1 wild always added)
      enabledFamilies: null, // null = all enabled
    };
  }

  setConfig(config) {
    if (this.state !== 'lobby') return;
    if (typeof config.deckSize === 'number') {
      this.config.deckSize = Math.max(10, Math.min(99, Math.floor(config.deckSize)));
    }
    if (Array.isArray(config.enabledFamilies)) {
      this.config.enabledFamilies = config.enabledFamilies;
    }
  }

  addBot(botId, botName) {
    if (this.state !== 'lobby') return { success: false, error: 'La partida ya comenzó' };
    if (this.players.length >= 8) return { success: false, error: 'La sala está llena (máx. 8 jugadores)' };
    this.players.push({
      id: botId, name: botName,
      pilis: 0, bet: null, tricksWon: 0, hand: [],
      connected: true, disconnectTimer: null, isBot: true,
    });
    return { success: true };
  }

  removeBot(botId) {
    if (this.state !== 'lobby') return { success: false, error: 'La partida ya comenzó' };
    const idx = this.players.findIndex(p => p.id === botId && p.isBot);
    if (idx === -1) return { success: false, error: 'Bot no encontrado' };
    this.players.splice(idx, 1);
    return { success: true };
  }

  addPlayer(id, name) {
    if (this.state !== 'lobby') {
      // Allow reconnect
      const existing = this.players.find(p => p.name === name);
      if (existing) {
        existing.id = id;
        existing.connected = true;
        if (existing.disconnectTimer) {
          clearTimeout(existing.disconnectTimer);
          existing.disconnectTimer = null;
        }
        return { success: true, playerId: id, reconnected: true };
      }
      return { success: false, error: 'La partida ya comenzó' };
    }
    if (this.players.length >= 8) {
      return { success: false, error: 'La sala está llena (máx. 8 jugadores)' };
    }
    if (this.players.find(p => p.name === name)) {
      return { success: false, error: 'Ese nombre ya está en uso' };
    }
    const player = {
      id,
      name,
      pilis: 0,
      bet: null,
      tricksWon: 0,
      hand: [],
      connected: true,
      disconnectTimer: null,
    };
    this.players.push(player);
    if (this.players.length === 1) {
      this.hostId = id;
    }
    return { success: true, playerId: id, reconnected: false };
  }

  removePlayer(id, onGamePause) {
    const player = this.players.find(p => p.id === id);
    if (!player) return;
    player.connected = false;

    if (this.state === 'lobby') {
      this.players = this.players.filter(p => p.id !== id);
      if (this.hostId === id && this.players.length > 0) {
        this.hostId = this.players[0].id;
      }
      return;
    }

    // In game: hold spot for 30 seconds
    player.disconnectTimer = setTimeout(() => {
      this.players = this.players.filter(p => p.id !== id);
      if (this.hostId === id && this.players.length > 0) {
        this.hostId = this.players.find(p => p.connected)?.id || this.players[0].id;
      }
      if (onGamePause) onGamePause();
    }, 30000);

    // Reassign host if needed
    if (this.hostId === id) {
      const nextConnected = this.players.find(p => p.id !== id && p.connected);
      if (nextConnected) this.hostId = nextConnected.id;
    }

    if (onGamePause) onGamePause();
  }

  reconnectPlayer(id, name) {
    const player = this.players.find(p => p.name === name);
    if (!player) return { success: false, error: 'No se encontró tu lugar en la sala' };
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
    }
    player.id = id;
    player.connected = true;
    return { success: true, playerId: id };
  }

  startGame() {
    if (this.players.length < 2) return { success: false, error: 'Se necesitan al menos 2 jugadores' };

    // Filter missions by enabled families
    let pool = MISSIONS;
    if (this.config.enabledFamilies && this.config.enabledFamilies.length > 0) {
      pool = MISSIONS.filter(m => {
        const fam = RULE_FAMILY[m.rule];
        return this.config.enabledFamilies.includes(fam);
      });
      if (pool.length === 0) pool = MISSIONS; // fallback
    }
    this.missions = shuffle([...pool]);

    this.state = 'playing'; // transitional
    this.dealerIndex = 0;
    this.round = 0;
    return this.startRound();
  }

  startRound() {
    if (this.round >= this.missions.length) {
      return { success: false, error: 'No hay más misiones' };
    }
    this.mission = this.missions[this.round];
    this.round++;

    const numPlayers = this.players.length;
    let cpp = this.mission.cardsPerPlayer;
    const totalCards = this.config.deckSize + 1; // numbered + wild
    if (cpp * numPlayers > totalCards) {
      cpp = Math.floor(totalCards / numPlayers);
    }
    this.mission = { ...this.mission, cardsPerPlayer: cpp };

    // Reset player state
    for (const p of this.players) {
      p.bet = null;
      p.tricksWon = 0;
      p.hand = [];
    }

    const deck = shuffle(createDeck(this.config.deckSize));
    for (let i = 0; i < cpp; i++) {
      for (const p of this.players) {
        p.hand.push(deck.pop());
      }
    }

    this.currentTrick = [];
    // Betting starts with player left of dealer
    this.currentBetterIndex = (this.dealerIndex + 1) % numPlayers;
    this.trickLeaderIndex = (this.dealerIndex + 1) % numPlayers;

    const isBlind = ['blind', 'blind_lowest', 'full_blind', 'full_blind_lowest'].includes(this.mission.rule);

    this.isBlindPhase = isBlind;
    this.passingCards = {};

    // Determine how many cards to pass (random count)
    const isPass = this.mission.rule === 'pass' || this.mission.rule === 'pass_lowest';
    if (isPass) {
      const maxPass = Math.max(1, Math.floor(cpp / 2));
      this.passCount = Math.floor(Math.random() * maxPass) + 1;
    } else {
      this.passCount = 0;
    }

    this.state = 'betting'; // siempre se apuesta primero

    return { success: true };
  }

  passCard(playerId, cardIndex) {
    if (this.state !== 'passing') return { success: false, error: 'No es momento de pasar cartas' };
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, error: 'Jugador no encontrado' };

    // Initialize array for this player
    if (!Array.isArray(this.passingCards[playerIndex])) {
      this.passingCards[playerIndex] = [];
    }
    const chosen = this.passingCards[playerIndex];

    if (chosen.length >= this.passCount) {
      return { success: false, error: `Ya has elegido ${this.passCount} carta(s)` };
    }

    const player = this.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: 'Índice de carta inválido' };
    }

    const card = player.hand.splice(cardIndex, 1)[0];
    chosen.push(card);

    // Check if all players have finished choosing
    const allDone = this.players.every((_, i) =>
      Array.isArray(this.passingCards[i]) && this.passingCards[i].length >= this.passCount
    );

    if (allDone) {
      const n = this.players.length;
      for (let i = 0; i < n; i++) {
        const recipient = (i + 1) % n;
        for (const c of this.passingCards[i]) {
          this.players[recipient].hand.push(c);
        }
      }
      this.passingCards = {};
      this.state = 'playing';
      return { success: true, allPassed: true };
    }

    return { success: true, allPassed: false };
  }

  placeBet(playerId, bet) {
    if (this.state !== 'betting') return { success: false, error: 'No es momento de apostar' };
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, error: 'Jugador no encontrado' };
    if (playerIndex !== this.currentBetterIndex) return { success: false, error: 'No es tu turno de apostar' };

    const player = this.players[playerIndex];
    const maxBet = this.mission.cardsPerPlayer;
    if (typeof bet !== 'number' || !Number.isInteger(bet) || bet < 0 || bet > maxBet) {
      return { success: false, error: `La apuesta debe ser entre 0 y ${maxBet}` };
    }

    // Regla: la suma de apuestas NO puede ser igual a cardsPerPlayer
    // → el último en apostar tiene un valor prohibido
    const allOthersHaveBet = this.players.every((p, i) => i === playerIndex || p.bet !== null);
    if (allOthersHaveBet) {
      const sumOthers = this.players.reduce((s, p, i) => i === playerIndex ? s : s + p.bet, 0);
      const forbidden = this.mission.cardsPerPlayer - sumOthers;
      if (bet === forbidden && forbidden >= 0 && forbidden <= maxBet) {
        return { success: false, error: `No puedes apostar ${forbidden} — la suma total no puede ser igual al número de cartas (${this.mission.cardsPerPlayer})` };
      }
    }

    player.bet = bet;

    // Advance to next better
    const numPlayers = this.players.length;
    let next = (this.currentBetterIndex + 1) % numPlayers;
    let checked = 0;
    while (checked < numPlayers) {
      if (this.players[next].bet === null) {
        this.currentBetterIndex = next;
        return { success: true };
      }
      next = (next + 1) % numPlayers;
      checked++;
    }

    // All bets placed
    if (this.isBlindPhase) {
      this.isBlindPhase = false;
    }

    // Si es modo pase → ir a fase de pase; si no → directamente a jugar
    const isPass = this.mission.rule === 'pass' || this.mission.rule === 'pass_lowest';
    this.state = isPass ? 'passing' : 'playing';
    this.currentBetterIndex = -1;
    return { success: true, allBetsPlaced: true };
  }

  playCard(playerId, cardIndex) {
    if (this.state !== 'playing') return { success: false, error: 'No es momento de jugar' };
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return { success: false, error: 'Jugador no encontrado' };

    // Determine whose turn it is
    const expectedIndex = this.getCurrentPlayerIndex();
    if (playerIndex !== expectedIndex) return { success: false, error: 'No es tu turno' };

    const player = this.players[playerIndex];
    if (cardIndex < 0 || cardIndex >= player.hand.length) {
      return { success: false, error: 'Índice de carta inválido' };
    }

    const card = player.hand.splice(cardIndex, 1)[0];
    this.currentTrick.push({ playerIndex, playerName: player.name, card });

    // Check if trick is complete
    if (this.currentTrick.length === this.players.length) {
      return { success: true, trickComplete: true };
    }

    return { success: true, trickComplete: false };
  }

  getCurrentPlayerIndex() {
    // The player who should play next in the trick
    const numPlayers = this.players.length;
    const offset = this.currentTrick.length;
    return (this.trickLeaderIndex + offset) % numPlayers;
  }

  resolveTrick() {
    const rule = this.mission.rule;
    const trick = this.currentTrick;

    let winnerEntry = trick[0];
    for (let i = 1; i < trick.length; i++) {
      const challenger = trick[i];
      const wVal = cardEffectiveValue(winnerEntry.card, rule);
      const cVal = cardEffectiveValue(challenger.card, rule);

      const lowestWins = ['lowest', 'blind_lowest', 'pass_lowest', 'transparent_lowest', 'full_blind_lowest'].includes(rule);
      if (lowestWins) {
        if (cVal < wVal) winnerEntry = challenger;
      } else {
        // Highest wins (normal, blind, double, joker_loses, pass, transparent, full_blind, indian)
        if (cVal > wVal) winnerEntry = challenger;
      }
    }

    const winnerPlayer = this.players[winnerEntry.playerIndex];
    winnerPlayer.tricksWon++;
    this.trickLeaderIndex = winnerEntry.playerIndex;

    const trickResult = {
      winnerName: winnerPlayer.name,
      trick: [...this.currentTrick],
    };
    this.currentTrick = [];
    return trickResult;
  }

  isRoundOver() {
    return this.players.every(p => p.hand.length === 0) && this.currentTrick.length === 0;
  }

  scoreRound() {
    const isDouble = this.mission.rule === 'double';
    const isLastTrickPili = this.mission.rule === 'last_trick_pili';
    // trickLeaderIndex is set by the last resolveTrick() call → last trick winner
    const lastTrickWinnerIndex = this.trickLeaderIndex;
    const results = [];

    for (const p of this.players) {
      const i = this.players.indexOf(p);
      const diff = Math.abs((p.bet ?? 0) - p.tricksWon);
      let pilisGained;
      if (diff === 0) {
        // Apuesta perfecta: resta 1 pili (mínimo 0)
        pilisGained = -1;
        p.pilis = Math.max(0, p.pilis - 1);
      } else {
        pilisGained = isDouble ? diff * 2 : diff;
        p.pilis += pilisGained;
      }

      // Última Baza: +1 pili extra al ganador de la última baza
      const lastTrickPenalty = isLastTrickPili && i === lastTrickWinnerIndex;
      if (lastTrickPenalty) {
        p.pilis += 1;
      }

      results.push({
        id: p.id,
        name: p.name,
        bet: p.bet ?? 0,
        tricksWon: p.tricksWon,
        pilisGained,
        lastTrickPenalty,
        totalPilis: p.pilis,
      });
    }

    this.roundResults = results;
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    this.state = 'round_end';
    return results;
  }

  checkGameEnd() {
    const loser = this.players.find(p => p.pilis >= 7);
    if (!loser) return false;

    // Winner = player with fewest pilis
    let minPilis = Infinity;
    let winner = null;
    for (const p of this.players) {
      if (p.pilis < minPilis) {
        minPilis = p.pilis;
        winner = p.name;
      }
    }
    this.winner = winner;
    this.state = 'game_end';
    return true;
  }

  nextRound() {
    if (this.state !== 'round_end') return { success: false, error: 'No se puede avanzar ahora' };
    if (this.round >= this.missions.length) {
      this.state = 'game_end';
      // Determine winner
      let minPilis = Infinity;
      let winner = null;
      for (const p of this.players) {
        if (p.pilis < minPilis) {
          minPilis = p.pilis;
          winner = p.name;
        }
      }
      this.winner = winner;
      return { success: true, gameEnd: true };
    }
    return this.startRound();
  }

  getStateForPlayer(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const myIndex = this.players.findIndex(p => p.id === playerId);

    const isBlind = this.isBlindPhase;
    const rule = this.mission ? this.mission.rule : null;
    const isTransparent = rule === 'transparent' || rule === 'transparent_lowest';
    const isFullBlind   = rule === 'full_blind'  || rule === 'full_blind_lowest';
    const isIndian      = rule === 'indian';

    const playersInfo = this.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      pilis: p.pilis,
      bet: p.bet,
      tricksWon: p.tricksWon,
      cardCount: p.hand.length,
      isDealer: i === this.dealerIndex,
      isCurrentBetter: this.state === 'betting' && i === this.currentBetterIndex,
      isCurrentPlayer: this.state === 'playing' && i === this.getCurrentPlayerIndex(),
      connected: p.connected,
      isBot: p.isBot || false,
      // Para modo transparente: en apuesta muestra mitad aleatoria; en juego, ninguna
      // Para modo indio: muestra carta completa del oponente (en apuesta Y en juego)
      hand: (isTransparent && i !== myIndex && this.state === 'betting')
        ? shuffle([...p.hand]).slice(0, Math.floor(p.hand.length / 2))
        : (isIndian && i !== myIndex)
        ? p.hand
        : undefined,
      // Para fase de pase: indica si este jugador ya eligió todas sus cartas
      hasPassed: this.state === 'passing'
        ? (Array.isArray(this.passingCards[i]) && this.passingCards[i].length >= this.passCount)
        : undefined,
    }));

    // myCards vacío si: fase ciega de apuesta O si es full_blind (siempre ocultas) O si es indian (no ves tu propia carta)
    let myCards = [];
    if (player && !isBlind && !isFullBlind && !isIndian) {
      myCards = player.hand;
    }

    // Apuesta prohibida para el último apostador
    let forbiddenBet = null;
    if (this.state === 'betting' && this.currentBetterIndex === myIndex && myIndex !== -1) {
      const allOthersHaveBet = this.players.every((p, i) => i === myIndex || p.bet !== null);
      if (allOthersHaveBet) {
        const sumOthers = this.players.reduce((s, p, i) => i === myIndex ? s : s + p.bet, 0);
        const forbidden = this.mission.cardsPerPlayer - sumOthers;
        if (forbidden >= 0 && forbidden <= this.mission.cardsPerPlayer) {
          forbiddenBet = forbidden;
        }
      }
    }

    // Info de la fase de pase
    let passPhase = null;
    if (this.state === 'passing') {
      const myChosen = Array.isArray(this.passingCards[myIndex]) ? this.passingCards[myIndex].length : 0;
      passPhase = {
        myHasPassed: myChosen >= this.passCount,
        myPassedCount: myChosen,
        passCount: this.passCount,
        passedCount: this.players.filter((_, i) => Array.isArray(this.passingCards[i]) && this.passingCards[i].length >= this.passCount).length,
        totalPlayers: this.players.length,
      };
    }

    return {
      state: this.state,
      roomId: this.roomId,
      myId: playerId,
      myCards,
      players: playersInfo,
      mission: this.mission,
      currentTrick: this.currentTrick.map(t => ({
        playerName: t.playerName,
        card: t.card,
      })),
      trickLeaderIndex: this.trickLeaderIndex,
      dealerIndex: this.dealerIndex,
      round: this.round,
      totalRounds: this.missions.length,
      roundResults: this.roundResults,
      winner: this.winner,
      hostId: this.hostId,
      isBlindPhase: isBlind,
      isFullBlind,
      isIndian,
      myIndex,
      passPhase,
      forbiddenBet,
      config: this.config,
      modeFamilies: Object.keys(MODE_FAMILIES).map(k => ({ key: k, label: MODE_FAMILIES[k] })),
    };
  }
}

module.exports = { Game, MODE_FAMILIES, RULE_FAMILY };
