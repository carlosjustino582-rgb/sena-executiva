'use strict';

const express = require('express');
const crypto = require('node:crypto');
const db = require('../../db');

const router = express.Router();

function validEmail(x) {
  return typeof x === 'string' && x.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x);
}

function settings() {
  return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((x) => [x.key, x.value]));
}

function escapeHTML(v) {
  return String(v ?? '').replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
}

function limit(key, max = 8, minutes = 15) {
  const now = Date.now();
  const row = db.prepare('SELECT * FROM rate_limits WHERE key=?').get(key);
  if (!row || row.reset_at < now) {
    db.prepare('INSERT INTO rate_limits(key,count,reset_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET count=1, reset_at=excluded.reset_at').run(key, 1, now + minutes * 60000);
    return false;
  }
  db.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').run(key);
  return row.count >= max;
}

function publicArticles() {
  return db.prepare("SELECT slug,title,excerpt,category,body_json,art,image_url,read_minutes,featured,trending,published_at FROM articles WHERE status='published' ORDER BY published_at DESC,id DESC").all().map((a) => ({
    id: a.slug,
    title: escapeHTML(a.title),
    excerpt: escapeHTML(a.excerpt),
    cat: escapeHTML(a.category),
    body: JSON.parse(a.body_json).map((b) => ({ t: b.t, v: Array.isArray(b.v) ? b.v.map(escapeHTML) : escapeHTML(b.v) })),
    art: a.art,
    image_url: a.image_url,
    read: a.read_minutes,
    featured: !!a.featured,
    trend: !!a.trending,
    date: a.published_at || '2026-01-01',
  }));
}

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.get('/bootstrap.js', (req, res) => {
  const rows = publicArticles();
  const cats = db.prepare("SELECT category,COUNT(*) n FROM articles WHERE status='published' GROUP BY category").all();
  rows.slice(0, 4).forEach((x, i) => { x.pop = i + 1; });
  const payload = `window.__ARTICLES__=${JSON.stringify(rows).replace(/</g, '\\u003c')};window.__CATEGORIES__=${JSON.stringify(cats).replace(/</g, '\\u003c')};`;
  res.type('application/javascript; charset=utf-8').set('Cache-Control', 'no-store').send(payload);
});

router.get('/api/public/settings', (req, res) => res.json(settings()));
router.get('/api/public/articles', (req, res) => res.json(publicArticles()));

router.post('/api/newsletter', (req, res) => {
  if (limit('newsletter:' + req.socket.remoteAddress, 20, 60)) {
    return res.status(429).json({ error: 'Demasiados pedidos.' });
  }
  const email = String(req.body?.email || '').trim();
  if (!validEmail(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  db.prepare('INSERT OR IGNORE INTO subscribers(email) VALUES(?)').run(email);
  return res.status(201).json({ message: 'Subscrição registada.' });
});

router.post('/api/contact', (req, res) => {
  if (limit('contact:' + req.socket.remoteAddress, 10, 60)) {
    return res.status(429).json({ error: 'Demasiados pedidos.' });
  }
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  if (!validEmail(email) || !name || !subject || !message || name.length > 120 || subject.length > 200 || message.length > 5000) {
    return res.status(400).json({ error: 'Dados de contacto inválidos.' });
  }
  db.prepare('INSERT INTO contacts(name,email,subject,message) VALUES(?,?,?,?)').run(name, email, subject, message);
  return res.status(201).json({ message: 'Mensagem recebida.' });
});

module.exports = router;
