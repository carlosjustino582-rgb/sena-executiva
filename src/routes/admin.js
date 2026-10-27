'use strict';

const express = require('express');
const db = require('../../db');
const { authMiddleware, requireAuth, csrfGuard } = require('../middleware/auth');
const { upload, processUploadedImage } = require('../services/uploadService');

const router = express.Router();

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

function slugify(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
}

function articleInput(body) {
  const title = String(body.title || '').trim();
  const excerpt = String(body.excerpt || '').trim();
  const category = String(body.category || '').trim();
  const rawBody = typeof body.body === 'string' ? body.body : Array.isArray(body.body) ? body.body.join('\n\n') : '';
  if (!title || !excerpt || !category || !rawBody) {
    throw Object.assign(new Error('Campos obrigatórios: título, resumo, categoria e corpo.'), { status: 400 });
  }

  const bodyJson = JSON.stringify(rawBody.split(/\n\s*\n/).filter(Boolean).map((paragraph) => ({ t: 'p', v: paragraph.trim() })));
  const art = ['xadrez', 'rede', 'barras', 'aneis', 'circuito', 'circulos', 'linha', 'pontos'].includes(String(body.art || '')) ? String(body.art) : 'xadrez';
  return {
    title,
    excerpt,
    category,
    body_json: bodyJson,
    art,
    featured: body.featured === true || body.featured === 'true' ? 1 : 0,
    trending: body.trending === true || body.trending === 'true' ? 1 : 0,
    status: ['draft', 'published', 'archived'].includes(String(body.status || '')) ? String(body.status) : 'draft',
    image_url: body.image_url || body.image || null,
  };
}

router.use(authMiddleware);

router.get('/api/admin/dashboard', requireAuth, (req, res) => {
  const dashboard = {
    articles: db.prepare('SELECT status, COUNT(*) n FROM articles GROUP BY status').all(),
    contacts: db.prepare('SELECT status,COUNT(*) n FROM contacts GROUP BY status').all(),
    subscribers: db.prepare('SELECT COUNT(*) n FROM subscribers').get().n,
    users: db.prepare('SELECT COUNT(*) n FROM users').get().n,
    recent: db.prepare('SELECT id,action,entity,created_at FROM audit ORDER BY id DESC LIMIT 12').all(),
  };
  return res.json(dashboard);
});

router.get('/api/admin/articles', requireAuth, (req, res) => {
  return res.json(db.prepare('SELECT * FROM articles ORDER BY updated_at DESC,id DESC').all());
});

router.post('/api/admin/articles', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const values = articleInput(req.body || {});
    const imageUrl = req.file ? await processUploadedImage(req.file) : values.image_url || null;
    const slug = slugify(req.body.slug || values.title) || 'artigo';
    const row = db.prepare('INSERT INTO articles(slug,title,excerpt,category,body_json,art,image_url,featured,trending,status,published_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(
      slug,
      values.title,
      values.excerpt,
      values.category,
      values.body_json,
      values.art,
      imageUrl,
      values.featured,
      values.trending,
      values.status,
      values.status === 'published' ? new Date().toISOString().slice(0, 10) : null,
    );
    return res.status(201).json({ id: row.lastInsertRowid });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/articles/:id', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM articles WHERE id=?').get(id);
    if (!current) return res.status(404).json({ error: 'Artigo não encontrado.' });
    const values = articleInput(req.body || {});
    const imageUrl = req.file ? await processUploadedImage(req.file) : values.image_url || current.image_url || null;
    db.prepare('UPDATE articles SET title=?,excerpt=?,category=?,body_json=?,art=?,image_url=?,featured=?,trending=?,status=?,published_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(
      values.title,
      values.excerpt,
      values.category,
      values.body_json,
      values.art,
      imageUrl,
      values.featured,
      values.trending,
      values.status,
      values.status === 'published' ? (current.published_at || new Date().toISOString().slice(0, 10)) : current.published_at,
      id,
    );
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.delete('/api/admin/articles/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT id FROM articles WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Artigo não encontrado.' });
  db.prepare('DELETE FROM articles WHERE id=?').run(id);
  return res.json({ ok: true });
});

router.get('/api/admin/contacts', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM contacts ORDER BY id DESC').all()));

router.patch('/api/admin/contacts/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '');
  const notes = String(req.body?.notes || '');
  if (!['new', 'in_progress', 'resolved'].includes(status) || notes.length > 2000) {
    return res.status(400).json({ error: 'Estado ou observações inválidos.' });
  }
  db.prepare('UPDATE contacts SET status=?,notes=? WHERE id=?').run(status, notes, id);
  return res.json({ ok: true });
});

router.get('/api/admin/subscribers', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM subscribers ORDER BY id DESC').all()));
router.get('/api/admin/settings', requireAuth, (req, res) => res.json(Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map((x) => [x.key, x.value]))));

router.put('/api/admin/settings', requireAuth, csrfGuard, (req, res) => {
  const allowed = ['company', 'email', 'phone', 'location', 'about'];
  const payload = req.body || {};
  for (const key of Object.keys(payload)) {
    if (!allowed.includes(key) || typeof payload[key] !== 'string' || payload[key].length > 1000) {
      return res.status(400).json({ error: 'Configuração inválida.' });
    }
  }
  const insert = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const [key, value] of Object.entries(payload)) insert.run(key, value);
  return res.json({ ok: true });
});

router.get('/api/admin/users', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permissão insuficiente.' });
  return res.json(db.prepare('SELECT id,name,email,role,active,created_at FROM users ORDER BY id DESC').all());
});

router.post('/api/admin/users', requireAuth, csrfGuard, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permissão insuficiente.' });
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || 'editor');
  const password = String(req.body?.password || '');
  if (!name || !validEmail(email) || !['admin', 'editor'].includes(role) || password.length < 12) {
    return res.status(400).json({ error: 'Utilizador inválido; palavra-passe mínima de 12 caracteres.' });
  }
  const bcrypt = require('bcrypt');
  const passwordHash = bcrypt.hashSync(password, 12);
  const row = db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run(name, email, passwordHash, role);
  return res.status(201).json({ id: row.lastInsertRowid });
});

router.patch('/api/admin/users/:id', requireAuth, csrfGuard, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permissão insuficiente.' });
  const id = Number(req.params.id);
  const role = String(req.body?.role || 'editor');
  const active = !!req.body?.active;
  if (!['admin', 'editor'].includes(role) || typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'Permissões inválidas.' });
  }
  db.prepare('UPDATE users SET role=?,active=? WHERE id=?').run(role, active ? 1 : 0, id);
  return res.json({ ok: true });
});

module.exports = router;
