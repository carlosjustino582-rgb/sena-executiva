'use strict';

const express = require('express');
const crypto = require('node:crypto');
const db = require('../../db');
const { signToken, verifyPassword, hashValue } = require('../utils/security');
const { sendPasswordResetEmail } = require('../services/emailService');
const { authMiddleware, requireAuth, csrfGuard } = require('../middleware/auth');
const { APP_URL } = require('../config/env');
const { wrapRouter } = require('../utils/asyncRouter');

const router = wrapRouter(express.Router());

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

async function loginBlocked(key) {
  const row = await db.prepare('SELECT count,reset_at FROM rate_limits WHERE key=?').get(key);
  return !!row && row.reset_at >= Date.now() && row.count >= 8;
}

async function recordLoginFailure(key) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + 15 * 60000);
  await db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<? THEN 1 ELSE rate_limits.count+1 END, reset_at=CASE WHEN rate_limits.reset_at<? THEN excluded.reset_at ELSE rate_limits.reset_at END').run(key, 1, resetAt, now, now);
}

router.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const key = 'login:' + req.socket.remoteAddress + ':' + crypto.createHash('sha256').update(email).digest('hex');

  if (await loginBlocked(key)) {
    return res.status(429).json({ error: 'Aguarde antes de tentar novamente.' });
  }

  const account = await db.prepare('SELECT * FROM users WHERE lower(email)=lower(?) AND active=TRUE').get(email);
  const ok = account ? verifyPassword(account.password_hash, password) : false;
  if (!account || !ok) {
    await recordLoginFailure(key);
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  await db.prepare('DELETE FROM rate_limits WHERE key=?').run(key);
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

router.post('/api/auth/logout', authMiddleware, requireAuth, csrfGuard, async (req, res) => {
  const token = req.cookies?.sena_jwt;
  if (token) {
    await db.prepare('INSERT OR IGNORE INTO revoked_tokens(token_hash,expires_at) VALUES(?,?)').run(hashValue(token), new Date(Date.now() + 24 * 60 * 60 * 1000));
  }
  res.clearCookie('sena_jwt', { path: '/' });
  return res.json({ ok: true });
});

router.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }

  const user = await db.prepare('SELECT id,name,email FROM users WHERE lower(email)=lower(?) AND active=TRUE').get(email);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.prepare('INSERT INTO password_reset_tokens(email,token,expires_at) VALUES(?,?,?)').run(email, token, expiresAt);
    await sendPasswordResetEmail(email, token);
  }

  return res.json({ ok: true, resetUrl: `${APP_URL}/reset-password.html` });
});

router.post('/api/auth/reset-password', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const password = String(req.body?.password || '');
  if (!token || password.length < 12) {
    return res.status(400).json({ error: 'Token ou palavra-passe inválidos.' });
  }

  const candidate = await db.prepare('SELECT * FROM password_reset_tokens WHERE token=? AND used=FALSE AND expires_at>?').get(token, new Date());
  if (!candidate) {
    return res.status(400).json({ error: 'Token inválido ou expirado.' });
  }

  const bcrypt = require('bcrypt');
  const passwordHash = bcrypt.hashSync(password, 12);
  await db.prepare('UPDATE users SET password_hash=? WHERE lower(email)=lower(?)').run(passwordHash, candidate.email);
  await db.prepare('UPDATE password_reset_tokens SET used=TRUE WHERE token=?').run(token);
  return res.json({ ok: true, message: 'Palavra-passe redefinida com sucesso.' });
});

module.exports = router;
