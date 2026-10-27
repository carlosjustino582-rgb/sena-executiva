'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const cookieParser = require('cookie-parser');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');

const app = express();
const publicDir = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use('/img', express.static(path.join(publicDir, 'img')));
app.use(express.static(publicDir));

app.get('/reset-password', (req, res) => {
  const file = path.join(publicDir, 'reset-password.html');
  if (!fs.existsSync(file)) {
    return res.status(404).send('Página de recuperação não encontrada.');
  }
  return res.sendFile(file);
});

app.use(publicRoutes);
app.use(authRoutes);
app.use(adminRoutes);

app.use((err, req, res, next) => {
  if (err && err.statusCode === 413) {
    return res.status(413).json({ error: 'Pedido demasiado grande.' });
  }
  if (err) {
    console.error('APP_ERROR', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
  return next();
});

app.use((req, res) => res.status(404).json({ error: 'Rota inexistente.' }));

module.exports = app;
