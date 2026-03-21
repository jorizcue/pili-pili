'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getAllUsers, findUserById, updateUser, deleteUser, getLevel, ELO_LEVELS } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'pochaset-dev-secret-change-in-prod';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    if (!payload.admin) return res.status(403).json({ error: 'Acceso denegado' });
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function mountAdminRoutes(app) {

  // POST /api/admin/login
  app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Contraseña requerida' });

    // Compare with ADMIN_PASSWORD (supports both plain and bcrypt hash)
    let ok = false;
    if (ADMIN_PASSWORD.startsWith('$2')) {
      ok = await bcrypt.compare(password, ADMIN_PASSWORD);
    } else {
      ok = password === ADMIN_PASSWORD;
    }
    if (!ok) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ ok: true, token });
  });

  // GET /api/admin/users
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = getAllUsers().map(u => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      emailVerified: u.emailVerified,
      elo: u.elo,
      level: getLevel(u.elo),
      gamesPlayed: u.gamesPlayed || 0,
      wins: u.wins || 0,
      createdAt: u.createdAt,
      isAdmin: u.isAdmin || false,
    }));
    res.json({ ok: true, users });
  });

  // PATCH /api/admin/users/:id
  app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const user = findUserById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const allowed = ['nickname', 'email', 'emailVerified', 'elo', 'gamesPlayed', 'wins', 'isAdmin'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Validate elo is a number
    if (updates.elo !== undefined) {
      updates.elo = Math.max(0, parseInt(updates.elo) || 0);
    }

    const updated = updateUser(id, updates);
    if (!updated) return res.status(500).json({ error: 'Error al actualizar' });

    res.json({
      ok: true,
      user: {
        id: updated.id,
        nickname: updated.nickname,
        email: updated.email,
        emailVerified: updated.emailVerified,
        elo: updated.elo,
        level: getLevel(updated.elo),
        gamesPlayed: updated.gamesPlayed || 0,
        wins: updated.wins || 0,
        createdAt: updated.createdAt,
        isAdmin: updated.isAdmin || false,
      }
    });
  });

  // DELETE /api/admin/users/:id
  app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { id } = req.params;
    const deleted = deleteUser(id);
    if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true });
  });

  // GET /api/ranking — público, top 15 jugadores por ELO
  app.get('/api/ranking', (req, res) => {
    const top = getAllUsers()
      .filter(u => u.emailVerified)
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 15)
      .map((u, i) => ({
        position: i + 1,
        nickname: u.nickname,
        elo: u.elo,
        level: getLevel(u.elo),
        gamesPlayed: u.gamesPlayed || 0,
        wins: u.wins || 0,
      }));
    res.json({ ok: true, ranking: top });
  });

  // GET /api/admin/stats
  app.get('/api/admin/stats', requireAdmin, (req, res) => {
    const users = getAllUsers();
    res.json({
      ok: true,
      stats: {
        totalUsers: users.length,
        verifiedUsers: users.filter(u => u.emailVerified).length,
        totalGamesPlayed: users.reduce((s, u) => s + (u.gamesPlayed || 0), 0),
        avgElo: users.length ? Math.round(users.reduce((s, u) => s + u.elo, 0) / users.length) : 0,
      }
    });
  });
}

module.exports = { mountAdminRoutes };
