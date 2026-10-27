'use strict';

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function signToken(user, csrf) {
  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: !!user.active,
      csrf,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function verifyPassword(storedHash, password) {
  if (!storedHash || !password) return false;

  if (storedHash.includes(':') && storedHash.split(':').length === 2) {
    const [salt, originalHex] = storedHash.split(':');
    const generated = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(originalHex, 'hex');
    if (expected.length !== generated.length) return false;
    return crypto.timingSafeEqual(generated, expected);
  }

  return require('bcrypt').compareSync(password, storedHash);
}

module.exports = {
  hashValue,
  signToken,
  verifyToken,
  verifyPassword,
};
