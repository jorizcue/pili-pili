'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ——— Storage backend ————————————————————————————————————————
// Si S3_BUCKET está definido → usa S3.
// Si no → fichero local (útil en local y como fallback).

const USE_S3  = !!process.env.S3_BUCKET;
const S3_KEY  = process.env.S3_KEY || 'pochaset/users.json';

// Instancia del cliente S3 (lazy — sólo si S3_BUCKET está definido)
let s3 = null;
function getS3() {
  if (!s3) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3 = new S3Client({
      region: process.env.AWS_REGION || 'eu-west-1',
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3;
}

// Local fallback
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dbPath  = path.join(dataDir, 'users.json');

// ——— Cache en memoria ————————————————————————————————————————
let _cache       = { users: [] };
let _loaded      = false;
let _saving      = false;
let _pendingSave = false;

// Carga inicial desde S3
async function _loadFromS3() {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  try {
    const res = await getS3().send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key:    S3_KEY,
    }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    _cache = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    console.log(`[DB] ✅ ${_cache.users.length} usuarios cargados desde S3 (${process.env.S3_BUCKET}/${S3_KEY})`);
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
      console.log('[DB] S3: fichero de usuarios no existe aún, empezando vacío');
      _cache = { users: [] };
    } else {
      console.error('[DB] ❌ Error cargando desde S3:', e.message);
      _cache = { users: [] };
    }
  }
}

// Guardado asíncrono a S3 (con cola simple para evitar escrituras simultáneas)
async function _saveToS3() {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await getS3().send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET,
    Key:         S3_KEY,
    Body:        JSON.stringify(_cache, null, 2),
    ContentType: 'application/json',
  }));
}

// Carga inicial desde fichero local
function _loadFromLocal() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ users: [] }, null, 2));
    _cache = { users: [] };
  } else {
    try { _cache = JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
    catch (_) { _cache = { users: [] }; }
  }
  console.log(`[DB] ✅ ${_cache.users.length} usuarios cargados desde ${dbPath}`);
}

// Guardado síncrono en fichero local
function _saveToLocal() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(_cache, null, 2));
}

// Dispara un guardado (con debounce para S3)
function _triggerSave() {
  if (USE_S3) {
    if (_saving) { _pendingSave = true; return; }
    _saving = true;
    _saveToS3()
      .then(() => {
        _saving = false;
        if (_pendingSave) { _pendingSave = false; _triggerSave(); }
      })
      .catch(e => {
        _saving = false;
        console.error('[DB] ❌ Error guardando en S3:', e.message);
        if (_pendingSave) { _pendingSave = false; _triggerSave(); }
      });
  } else {
    _saveToLocal();
  }
}

/**
 * Llama a init() UNA VEZ al arrancar el servidor (antes de escuchar).
 * Carga los datos desde S3 o disco local según configuración.
 */
async function init() {
  if (_loaded) return;
  _loaded = true;
  if (USE_S3) {
    await _loadFromS3();
  } else {
    _loadFromLocal();
  }
}

// ——— API pública (síncrona — usa la caché) ————————————————————

function readDb()       { return _cache; }
function writeDb(data)  { _cache = data; _triggerSave(); }

// ——— ELO ——————————————————————————————————————————————————————
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

/** Actualización ELO multijugador. players: [{userId, elo, rank}] rank 0=mejor */
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

// ——— CRUD usuarios ————————————————————————————————————————————

function findUserByEmail(email) {
  return _cache.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

function findUserByNickname(nick) {
  return _cache.users.find(u => u.nickname.toLowerCase() === nick.toLowerCase()) || null;
}

function findUserById(id) {
  return _cache.users.find(u => u.id === id) || null;
}

function createUser({ email, nickname, passwordHash }) {
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
  _cache.users.push(user);
  _triggerSave();
  return user;
}

function updateUser(id, updates) {
  const idx = _cache.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  _cache.users[idx] = { ..._cache.users[idx], ...updates };
  _triggerSave();
  return _cache.users[idx];
}

function applyEloChanges(changes) {
  for (const c of changes) {
    const idx = _cache.users.findIndex(u => u.id === c.userId);
    if (idx !== -1) {
      _cache.users[idx].elo        = c.newElo;
      _cache.users[idx].gamesPlayed = (_cache.users[idx].gamesPlayed || 0) + 1;
    }
  }
  _triggerSave();
}

function getAllUsers() {
  return _cache.users;
}

function deleteUser(id) {
  const idx = _cache.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  _cache.users.splice(idx, 1);
  _triggerSave();
  return true;
}

module.exports = {
  init,
  readDb, writeDb,
  findUserByEmail, findUserByNickname, findUserById,
  createUser, updateUser, applyEloChanges,
  getLevel, calcEloChanges, ELO_LEVELS,
  getAllUsers, deleteUser,
};
