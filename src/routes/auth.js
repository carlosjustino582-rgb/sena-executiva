'use strict';

const express = require('express');
const crypto = require('node:crypto');
const db = require('../../db');
const { signToken, verifyPassword, hashValue } = require('../utils/security');
const { sendPasswordResetEmail } = require('../services/emailService');
const { authMiddleware, requireAuth, csrfGuard } = require('../middleware/auth');
const { APP_URL } = require('../config/env');

const router = express.Router();

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

function loginBlocked(key) {
  const row = db.prepare('SELECT count,reset_at FROM rate_limits WHERE key=?').get(key);
  return !!row && row.reset_at >= Date.now() && row.count >= 8;
}

function recordLoginFailure(key) {
  const now = Date.now();
  db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END').run(key, 1, now + 15 * 60000, now, now);
}

router.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const key = 'login:' + req.socket.remoteAddress + ':' + crypto.createHash('sha256').update(email).digest('hex');

  if (loginBlocked(key)) {
    return res.status(429).json({ error: 'Aguarde antes de tentar novamente.' });
  }

  const account = db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);
  const ok = account ? verifyPassword(account.password_hash, password) : false;
  if (!account || !ok) {
    recordLoginFailure(key);
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  db.prepare('DELETE FROM rate_limits WHERE key=?').run(key);
  const csrf = crypto.randomBytes(24).toString('hex');
  const token = signToken({ ...account, active: true }, csrf);
  res.cookie('sena_jwt', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({ user: { id: account.id, name: account.name, role: account.role }, csrf });
});

router.get('/api/auth/me', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Sessão não iniciada.' });
  }
  return res.json({ user: { id: req.user.id, name: req.user.name, role: req.user.role }, csrf: req.user.csrf });
});

router.post('/api/auth/logout', authMiddleware, requireAuth, csrfGuard, (req, res) => {
  const token = req.cookies?.sena_jwt;
  if (token) {
    db.prepare('INSERT OR IGNORE INTO revoked_tokens(token_hash,expires_at) VALUES(?,?)').run(hashValue(token), Date.now() + 24 * 60 * 60 * 1000);
  }
  res.clearCookie('sena_jwt', { path: '/' });
  return res.json({ ok: true });
});

router.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }

  const user = db.prepare('SELECT id,name,email FROM users WHERE email=? AND active=1').get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000;
    db.prepare('INSERT INTO password_reset_tokens(email,token,expires_at) VALUES(?,?,?)').run(email, token, expiresAt);
    await sendPasswordResetEmail(email, token);
  }

  return res.json({ ok: true, resetUrl: `${APP_URL}/reset-password.html` });
});

router.post('/api/auth/reset-password', (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  if (!token || password.length < 12) {
    return res.status(400).json({ error: 'Token ou palavra-passe inválidos.' });
  }

  const candidate = db.prepare('SELECT * FROM password_reset_tokens WHERE token=? AND used=0 AND expires_at>?').get(token, Date.now());
  if (!candidate) {
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  }

  const bcrypt = require('bcrypt');
  const passwordHash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash=? WHERE email=?').run(passwordHash, candidate.email);
  db.prepare('UPDATE password_reset_tokens SET used=1 WHERE token=?').run(token);
  return res.json({ ok: true, message: 'Palavra-passe redefinida com sucesso.' });
});

module.exports = router;
