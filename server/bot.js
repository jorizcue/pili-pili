'use strict';

const crypto = require('crypto');

// ——— Nombres de bots ————————————————————————————————
const BOT_NAMES = [
  'Pepillo Bot', 'La Máquina', 'RoboChef', 'Calculín', 'El Androide',
  'HAL-9001', 'Botifarra', 'R2-Pili', 'AlphaPocha', 'Deepillo',
  'Máquina Infernal', 'Robo Croupier', 'ChatBot Jr.', 'RoboSeta',
];
const _usedNames = new Set();

function pickBotName() {
  const available = BOT_NAMES.filter(n => !_usedNames.has(n));
  const pool = available.length > 0 ? available : BOT_NAMES;
  const name = pool[Math.floor(Math.random() * pool.length)];
  _usedNames.add(name);
  return name;
}

function releaseBotName(name) {
  _usedNames.delete(name);
}

// ——— Clase Bot ————————————————————————————————————————
class Bot {
  constructor(difficulty = 'normal') {
    this.id         = 'bot_' + crypto.randomUUID().slice(0, 8);
    this.name       = pickBotName();
    this.difficulty = difficulty; // 'easy' | 'normal' | 'hard'
  }

  /** Tiempo de "pensar" en ms (para simular que el bot razona) */
  thinkTime() {
    const base = { easy: 700, normal: 1300, hard: 1900 }[this.difficulty] ?? 1300;
    return base + Math.floor(Math.random() * 500);
  }

  // ——— APUESTA ——————————————————————————————————————
  decideBet(myCards, gameState) {
    const { mission, forbiddenBet } = gameState;
    if (!mission) return 0;

    const rule      = mission.rule;
    const cpp       = mission.cardsPerPlayer;
    const deckSize  = gameState.config?.deckSize ?? 55;
    const median    = deckSize / 2;

    const isBlind   = ['blind', 'blind_lowest', 'full_blind', 'full_blind_lowest'].includes(rule);
    const isIndian  = rule === 'indian';
    const lowestWins = ['lowest', 'blind_lowest', 'pass_lowest', 'transparent_lowest', 'full_blind_lowest'].includes(rule);

    let bet = 0;

    if (isBlind || isIndian || !myCards || myCards.length === 0) {
      // No puede ver sus cartas: apuesta conservadora/aleatoria
      if (this.difficulty === 'hard') {
        bet = Math.floor(cpp / 2);
      } else {
        bet = Math.random() < 0.4 ? 1 : 0;
      }
    } else {
      // Contar cartas "ganadoras" según el modo
      let winCards = 0;
      for (const card of myCards) {
        if (card.isWild) {
          winCards += rule === 'joker_loses' ? 0 : 1;
        } else if (lowestWins) {
          if (card.value < median * 0.65) winCards++;
        } else {
          if (card.value > median * 1.25) winCards++;
        }
      }
      bet = winCards;

      // Ruido según dificultad
      if (this.difficulty === 'easy') {
        bet += Math.floor(Math.random() * 3) - 1;
      } else if (this.difficulty === 'normal') {
        if (Math.random() < 0.25) bet += Math.random() < 0.5 ? 1 : -1;
      }
      // hard: apuesta exacta
    }

    // Clamp al rango válido
    bet = Math.max(0, Math.min(cpp, Math.round(bet)));

    // Evitar apuesta prohibida
    if (forbiddenBet != null && bet === forbiddenBet) {
      bet = bet < cpp ? bet + 1 : bet - 1;
      bet = Math.max(0, Math.min(cpp, bet));
      if (bet === forbiddenBet) bet = bet > 0 ? bet - 1 : bet + 1;
      bet = Math.max(0, Math.min(cpp, bet));
    }

    return bet;
  }

  // ——— JUGAR CARTA ————————————————————————————————
  decidePlay(myCards, gameState) {
    if (!myCards || myCards.length === 0) return 0;

    const { mission, players, myId } = gameState;
    if (!mission) return 0;
    const rule = mission.rule;

    const me          = players?.find(p => p.id === myId);
    const tricksNeeded = (me?.bet ?? 0) - (me?.tricksWon ?? 0);

    const isFullBlind  = ['full_blind', 'full_blind_lowest'].includes(rule);
    const lowestWins   = ['lowest', 'blind_lowest', 'pass_lowest', 'transparent_lowest', 'full_blind_lowest'].includes(rule);

    if (isFullBlind || this.difficulty === 'easy') {
      return Math.floor(Math.random() * myCards.length);
    }

    // Ordenar cartas por valor efectivo
    const sorted = myCards
      .map((card, idx) => ({
        idx,
        val: card.isWild ? (rule === 'joker_loses' ? 0 : 56) : card.value,
      }))
      .sort((a, b) => a.val - b.val);

    const wantToWin = tricksNeeded > 0;

    if (lowestWins) {
      return wantToWin ? sorted[0].idx : sorted[sorted.length - 1].idx;
    } else {
      return wantToWin ? sorted[sorted.length - 1].idx : sorted[0].idx;
    }
  }

  // ——— PASAR CARTA ————————————————————————————————
  decidePass(myCards, gameState) {
    if (!myCards || myCards.length === 0) return 0;

    const { mission } = gameState;
    if (!mission) return 0;
    const rule      = mission.rule;
    const lowestWins = rule === 'pass_lowest';
    const deckSize  = gameState.config?.deckSize ?? 55;
    const median    = deckSize / 2;

    // Pasar la carta que menos nos interesa según el modo
    const sorted = myCards
      .map((card, idx) => {
        let goodness;
        if (card.isWild) {
          goodness = lowestWins ? -100 : 100; // comodín: muy bueno en normal, pésimo en lowest
        } else {
          goodness = lowestWins ? (median - card.value) : (card.value - median);
        }
        return { idx, goodness };
      })
      .sort((a, b) => a.goodness - b.goodness); // peor primero

    return sorted[0].idx;
  }
}

module.exports = { Bot, releaseBotName };
