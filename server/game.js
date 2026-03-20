'use strict';

const MISSIONS = [
  { id: 1,  name: "Normal",          cardsPerPlayer: 1, rule: 'normal',       desc: '1 carta por jugador. Gana la más alta.' },
  { id: 2,  name: "Normal",          cardsPerPlayer: 2, rule: 'normal',       desc: '2 cartas por jugador. Gana la más alta.' },
  { id: 3,  name: "Normal",          cardsPerPlayer: 3, rule: 'normal',       desc: '3 cartas por jugador. Gana la más alta.' },
  { id: 4,  name: "Normal",          cardsPerPlayer: 4, rule: 'normal',       desc: '4 cartas por jugador. Gana la más alta.' },
  { id: 5,  name: "Normal",          cardsPerPlayer: 5, rule: 'normal',       desc: '5 cartas por jugador. Gana la más alta.' },
  { id: 6,  name: "Normal",          cardsPerPlayer: 6, rule: 'normal',       desc: '6 cartas por jugador. Gana la más alta.' },
  { id: 7,  name: "Normal",          cardsPerPlayer: 7, rule: 'normal',       desc: '7 cartas por jugador. Gana la más alta.' },
  { id: 8,  name: "¡Al Revés!",      cardsPerPlayer: 2, rule: 'lowest',       desc: '2 cartas. Gana la carta más baja.' },
  { id: 9,  name: "¡Al Revés!",      cardsPerPlayer: 3, rule: 'lowest',       desc: '3 cartas. Gana la carta más baja.' },
  { id: 10, name: "¡Al Revés!",      cardsPerPlayer: 4, rule: 'lowest',       desc: '4 cartas. Gana la carta más baja.' },
  { id: 11, name: "¡Al Revés!",      cardsPerPlayer: 5, rule: 'lowest',       desc: '5 cartas. Gana la carta más baja.' },
  { id: 12, name: "A Ciegas",        cardsPerPlayer: 3, rule: 'blind',        desc: '3 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 13, name: "A Ciegas",        cardsPerPlayer: 4, rule: 'blind',        desc: '4 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 14, name: "A Ciegas",        cardsPerPlayer: 5, rule: 'blind',        desc: '5 cartas. ¡Apuesta ANTES de ver tus cartas!' },
  { id: 15, name: "Doble Pili",      cardsPerPlayer: 2, rule: 'double',       desc: '2 cartas. ¡Cada error vale 2 pilis!' },
  { id: 16, name: "Doble Pili",      cardsPerPlayer: 3, rule: 'double',       desc: '3 cartas. ¡Cada error vale 2 pilis!' },
  { id: 17, name: "Doble Pili",      cardsPerPlayer: 4, rule: 'double',       desc: '4 cartas. ¡Cada error vale 2 pilis!' },
  { id: 18, name: "Ciegas al Revés", cardsPerPlayer: 3, rule: 'blind_lowest', desc: '3 cartas. Apuesta sin ver. Gana la más baja.' },
  { id: 19, name: "Ciegas al Revés", cardsPerPlayer: 4, rule: 'blind_lowest', desc: '4 cartas. Apuesta sin ver. Gana la más baja.' },
  { id: 20, name: "Comodín Pierde",  cardsPerPlayer: 4, rule: 'joker_loses',  desc: '4 cartas. El comodín es la carta más baja.' },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  const cards = [];
  for (let i = 1; i <= 55; i++) {
    cards.push({ value: i, isWild: false });
  }
  cards.push({ value: 56, isWild: true });
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
    this.missions = shuffle([...MISSIONS]);
    this.mission = null;
    this.currentTrick = [];
    this.trickLeaderIndex = 0;
    this.currentBetterIndex = 0;
    this.roundResults = [];
    this.winner = null;
    this.isBlindPhase = false;
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
    if (cpp * numPlayers > 56) {
      cpp = Math.floor(56 / numPlayers);
    }
    this.mission = { ...this.mission, cardsPerPlayer: cpp };

    // Reset player state
    for (const p of this.players) {
      p.bet = null;
      p.tricksWon = 0;
      p.hand = [];
    }

    const deck = shuffle(createDeck());
    for (let i = 0; i < cpp; i++) {
      for (const p of this.players) {
        p.hand.push(deck.pop());
      }
    }

    this.currentTrick = [];
    // Betting starts with player left of dealer
    this.currentBetterIndex = (this.dealerIndex + 1) % numPlayers;
    this.trickLeaderIndex = (this.dealerIndex + 1) % numPlayers;

    const isBlind = this.mission.rule === 'blind' || this.mission.rule === 'blind_lowest';
    this.isBlindPhase = isBlind;
    this.state = 'betting';

    return { success: true };
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

    player.bet = bet;

    // Advance to next better
    const numPlayers = this.players.length;
    let next = (this.currentBetterIndex + 1) % numPlayers;
    // Go around until we find someone who hasn't bet (one pass)
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
      // Cards revealed now — state transitions to playing
    }
    this.state = 'playing';
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

      if (rule === 'lowest' || rule === 'blind_lowest') {
        // Lowest wins
        if (cVal < wVal) {
          winnerEntry = challenger;
        }
      } else {
        // Highest wins (normal, blind, double, joker_loses)
        if (cVal > wVal) {
          winnerEntry = challenger;
        }
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
    const results = [];

    for (const p of this.players) {
      const diff = Math.abs((p.bet ?? 0) - p.tricksWon);
      const pilisGained = isDouble ? diff * 2 : diff;
      p.pilis += pilisGained;
      results.push({
        id: p.id,
        name: p.name,
        bet: p.bet ?? 0,
        tricksWon: p.tricksWon,
        pilisGained,
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
    }));

    let myCards = [];
    if (player && !isBlind) {
      myCards = player.hand;
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
      roundResults: this.roundResults,
      winner: this.winner,
      hostId: this.hostId,
      isBlindPhase: isBlind,
      myIndex,
    };
  }
}

module.exports = { Game };
