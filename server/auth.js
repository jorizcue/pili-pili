'use strict';

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { findUserByEmail, findUserByNickname, findUserById, createUser, updateUser, getLevel } = require('./db');
const { sendVerificationEmail, sendResetEmail } = require('./email');

const JWT_SECRET = process.env.JWT_SECRET || 'pochaset-dev-secret-change-in-prod';
const JWT_EXPIRES = '30d';

function signToken(user) {
  return jwt.sign({ userId: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch (_) { return null; }
}

function userPublic(user) {
  const level = getLevel(user.elo);
  return {
    id: user.id,
    nickname: user.nickname,
    email: user.email,
    emailVerified: user.emailVerified,
    elo: user.elo,
    level,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
  };
}

/** Mount auth routes on an Express app */
function mountAuthRoutes(app) {

  // POST /api/auth/register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, nickname, password } = req.body || {};
      if (!email || !nickname || !password)
        return res.status(400).json({ error: 'Faltan campos requeridos (email, nickname, password)' });
      if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      if (nickname.trim().length < 2 || nickname.trim().length > 20)
        return res.status(400).json({ error: 'El apodo debe tener entre 2 y 20 caracteres' });

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return res.status(400).json({ error: 'Email no válido' });

      if (findUserByEmail(email))
        return res.status(409).json({ error: 'Este email ya está registrado' });
      if (findUserByNickname(nickname))
        return res.status(409).json({ error: 'Este apodo ya está en uso' });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = createUser({ email: email.toLowerCase().trim(), nickname: nickname.trim(), passwordHash });

      await sendVerificationEmail(user.email, user.verificationToken);

      res.json({ ok: true, message: 'Cuenta creada. Revisa tu email para verificar la cuenta.' });
    } catch (e) {
      console.error('[Auth] Register error:', e);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña requeridos' });

      const user = findUserByEmail(email);
      if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

      if (!user.emailVerified)
        return res.status(403).json({ error: 'Debes verificar tu email antes de iniciar sesión' });

      const token = signToken(user);
      res.json({ ok: true, token, user: userPublic(user) });
    } catch (e) {
      console.error('[Auth] Login error:', e);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // GET /api/auth/verify-email?token=xxx
  app.get('/api/auth/verify-email', (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).send('Token inválido');

    const { users } = require('./db').readDb();
    const user = users.find(u => u.verificationToken === token);
    if (!user) return res.status(400).send('Token inválido o expirado');

    updateUser(user.id, { emailVerified: true, verificationToken: null });

    // Redirect to home with success message
    res.redirect('/?verified=1');
  });

  // POST /api/auth/forgot-password
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body || {};
      const user = findUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists
        return res.json({ ok: true, message: 'Si el email existe, recibirás un enlace en breve' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      const expires = Date.now() + 60 * 60 * 1000; // 1 hour
      updateUser(user.id, { resetToken: token, resetTokenExpires: expires });
      await sendResetEmail(user.email, token);
      res.json({ ok: true, message: 'Si el email existe, recibirás un enlace en breve' });
    } catch (e) {
      console.error('[Auth] Forgot password error:', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // POST /api/auth/reset-password
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body || {};
      if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos' });
      if (password.length < 6) return res.status(400).json({ error: 'Contraseña demasiado corta' });

      const { users } = require('./db').readDb();
      const user = users.find(u => u.resetToken === token && u.resetTokenExpires > Date.now());
      if (!user) return res.status(400).json({ error: 'Token inválido o expirado' });

      const passwordHash = await bcrypt.hash(password, 10);
      updateUser(user.id, { passwordHash, resetToken: null, resetTokenExpires: null });
      res.json({ ok: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (e) {
      console.error('[Auth] Reset password error:', e);
      res.status(500).json({ error: 'Error interno' });
    }
  });

  // GET /api/auth/me  (requires Authorization: Bearer <token>)
  app.get('/api/auth/me', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });
    const payload = verifyToken(auth.slice(7));
    if (!payload) return res.status(401).json({ error: 'Token inválido' });
    const user = findUserById(payload.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ ok: true, user: userPublic(user) });
  });
}

module.exports = { mountAuthRoutes, verifyToken, userPublic };
