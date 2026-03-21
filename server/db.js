'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, 'data');
const dbPath  = path.join(dataDir, 'users.json');

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath))  fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
}

function readDb() {
  ensureDb();
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
  catch (_) { return { users: [] }; }
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ——— ELO ——————————————————————————————————————
const ELO_LEVELS = [
  { min: 0,    name: 'Novato',           emoji: '🌱' },
  { min: 400,  name: 'Amateur',          emoji: '🃏' },
  { min: 700,  name: 'Avanzado',         emoji: '⭐' },
  { min: 1000, name: 'Pro',              emoji: '🔥' },
  { min: 1300, name: 'Experto',          emoji: '💎' },
  { min: 1600, name: 'Ratilla Suprema',  emoji: '🐭' },
];

function getLevel(elo) {
  let level = ELO_LEVELS[0];
  for (const l of ELO_LEVELS) { if (elo >= l.min) level = l; }
  return level;
}

/** Multiplayer ELO update. players: [{userId, elo, rank}] rank 0=best */
function calcEloChanges(players) {
  const n = players.length;
  const K = 32;
  return players.map((p, i) => {
    const actualScore = (n - 1 - i) / Math.max(1, n - 1);
    let expected = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) expected += 1 / (1 + Math.pow(10, (players[j].elo - p.elo) / 400));
    }
    expected /= (n - 1);
    const change = Math.round(K * (actualScore - expected));
    return { userId: p.userId, change, newElo: Math.max(0, p.elo + change) };
  });
}

// ——— User CRUD ————————————————————————————————
function findUserByEmail(email) {
  const { users } = readDb();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findUserByNickname(nick) {
  const { users } = readDb();
  return users.find(u => u.nickname.toLowerCase() === nick.toLowerCase()) || null;
}

function findUserById(id) {
  const { users } = readDb();
  return users.find(u => u.id === id) || null;
}

function createUser({ email, nickname, passwordHash }) {
  const db = readDb();
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    nickname: nickname.trim(),
    passwordHash,
    emailVerified: false,
    verificationToken: crypto.randomBytes(32).toString('hex'),
    resetToken: null,
    resetTokenExpires: null,
    elo: 500,
    gamesPlayed: 0,
    wins: 0,
    createdAt: Date.now(),
  };
  db.users.push(user);
  writeDb(db);
  return user;
}

function updateUser(id, updates) {
  const db = readDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  db.users[idx] = { ...db.users[idx], ...updates };
  writeDb(db);
  return db.users[idx];
}

function applyEloChanges(changes) {
  const db = readDb();
  for (const c of changes) {
    const idx = db.users.findIndex(u => u.id === c.userId);
    if (idx !== -1) {
      db.users[idx].elo = c.newElo;
      db.users[idx].gamesPlayed = (db.users[idx].gamesPlayed || 0) + 1;
    }
  }
  writeDb(db);
}

module.exports = { readDb, writeDb, findUserByEmail, findUserByNickname, findUserById, createUser, updateUser, applyEloChanges, getLevel, calcEloChanges, ELO_LEVELS };
