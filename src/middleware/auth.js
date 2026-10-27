'use strict';

const db = require('../../db');
const { verifyToken, hashValue } = require('../utils/security');

function authMiddleware(req, res, next) {
  const token = req.cookies?.sena_jwt || req.cookies?.sena_session || null;
  if (!token) {
    req.user = null;
    return next();
  }

  const revoked = !!db.prepare('SELECT 1 FROM revoked_tokens WHERE token_hash=? AND expires_at>?').get(hashValue(token), Date.now());
  if (revoked) {
    req.user = null;
    return next();
  }

  const payload = verifyToken(token);
  if (!payload || !payload.active) {
    req.user = null;
    return next();
  }

  req.user = {
    id: payload.sub,
    name: payload.name,
    email: payload.email,
    role: payload.role,
    active: !!payload.active,
    csrf: payload.csrf,
  };
  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
  return next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permissão insuficiente.' });
  }
  return next();
}

function csrfGuard(req, res, next) {
  if (req.method === 'GET') return next();
  if (!req.user || String(req.headers['x-csrf-token'] || '') !== String(req.user.csrf)) {
    return res.status(403).json({ error: 'Token CSRF inválido.' });
  }
  return next();
}

module.exports = { authMiddleware, requireAuth, requireAdmin, csrfGuard };
