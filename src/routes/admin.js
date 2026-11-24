'use strict';

const express = require('express');
const db = require('../../db');
const { authMiddleware, requireAuth, csrfGuard } = require('../middleware/auth');
const { upload, processUploadedImage, processAdImage, removeUploaded } = require('../services/uploadService');

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

function categoryInput(body) {
  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const color = String(body.color || '#1B2F6E').trim();
  if (!name || name.length > 40) throw Object.assign(new Error('Indique um nome de categoria (até 40 caracteres).'), { status: 400 });
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw Object.assign(new Error('Cor inválida.'), { status: 400 });
  return { name, color };
}

router.get('/api/admin/categories', requireAuth, (req, res) => {
  return res.json(db.prepare('SELECT c.*, (SELECT COUNT(*) FROM articles a WHERE a.category=c.name) AS articles FROM categories c ORDER BY is_top DESC, position, name').all());
});

router.post('/api/admin/categories', requireAuth, csrfGuard, (req, res) => {
  try {
    const v = categoryInput(req.body || {});
    if (db.prepare('SELECT 1 FROM categories WHERE name=?').get(v.name)) throw Object.assign(new Error('Já existe uma categoria com esse nome.'), { status: 409 });
    const row = db.prepare('INSERT INTO categories(name,color,is_top,position) VALUES(?,?,0,100)').run(v.name, v.color);
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/categories/:id', requireAuth, csrfGuard, (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
    if (!cur) throw Object.assign(new Error('Categoria não encontrada.'), { status: 404 });
    const v = categoryInput(req.body || {});
    // as categorias do menu principal mantêm o nome (o menu depende dele)
    const name = cur.is_top ? cur.name : v.name;
    if (name.toLowerCase() !== cur.name.toLowerCase() && db.prepare('SELECT 1 FROM categories WHERE name=? AND id<>?').get(name, id)) {
      throw Object.assign(new Error('Já existe uma categoria com esse nome.'), { status: 409 });
    }
    db.exec('BEGIN');
    try {
      db.prepare('UPDATE categories SET name=?,color=? WHERE id=?').run(name, v.color, id);
      if (name !== cur.name) db.prepare('UPDATE articles SET category=? WHERE category=?').run(name, cur.name);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.delete('/api/admin/categories/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM categories WHERE id=?').get(id);
  if (!cur) return res.status(404).json({ error: 'Categoria não encontrada.' });
  if (cur.is_top) return res.status(400).json({ error: 'As categorias do menu principal não podem ser eliminadas.' });
  const n = db.prepare('SELECT COUNT(*) n FROM articles WHERE category=?').get(cur.name).n;
  if (n > 0) return res.status(409).json({ error: `Esta categoria tem ${n} artigo(s). Mude-os de categoria antes de a eliminar.` });
  db.prepare('DELETE FROM categories WHERE id=?').run(id);
  return res.json({ ok: true });
});

function slideInput(body) {
  const caption = String(body.caption || '').trim().slice(0, 200);
  const href = String(body.href || '').trim();
  if (href && (!/^(https?:\/\/|mailto:)/i.test(href) || href.length > 500)) {
    throw Object.assign(new Error('O link deve começar por http://, https:// ou mailto:.'), { status: 400 });
  }
  return { caption, href, active: body.active === true || body.active === 'true' || body.active === 'on' ? 1 : 0 };
}

router.get('/api/admin/slides', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM slides ORDER BY position, id').all()));

router.post('/api/admin/slides', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const v = slideInput(req.body);
    if (!req.file) throw Object.assign(new Error('Envie a imagem.'), { status: 400 });
    const imageUrl = await processAdImage(req.file);
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM slides').get().p;
    const row = db.prepare('INSERT INTO slides(image_url,caption,href,position,active) VALUES(?,?,?,?,?)').run(imageUrl, v.caption, v.href, pos, v.active);
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/slides/:id', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM slides WHERE id=?').get(id);
    if (!cur) throw Object.assign(new Error('Slide não encontrado.'), { status: 404 });
    const v = slideInput(req.body);
    let imageUrl = cur.image_url;
    if (req.file) { imageUrl = await processAdImage(req.file); removeUploaded(cur.image_url); }
    db.prepare('UPDATE slides SET image_url=?,caption=?,href=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(imageUrl, v.caption, v.href, v.active, id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.post('/api/admin/slides/:id/move', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const dir = req.body?.dir === 'up' ? -1 : req.body?.dir === 'down' ? 1 : 0;
  const rows = db.prepare('SELECT id FROM slides ORDER BY position, id').all().map((r) => r.id);
  const i = rows.indexOf(id);
  if (i < 0 || !dir) return res.status(400).json({ error: 'Pedido inválido.' });
  const j = i + dir;
  if (j >= 0 && j < rows.length) {
    [rows[i], rows[j]] = [rows[j], rows[i]];
    const up = db.prepare('UPDATE slides SET position=? WHERE id=?');
    rows.forEach((rid, k) => up.run(k + 1, rid));
  }
  return res.json({ ok: true });
});

router.delete('/api/admin/slides/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM slides WHERE id=?').get(id);
  if (!cur) return res.status(404).json({ error: 'Slide não encontrado.' });
  db.prepare('DELETE FROM slides WHERE id=?').run(id);
  removeUploaded(cur.image_url);
  return res.json({ ok: true });
});

function sponsoredInput(body) {
  const brand = String(body.brand || '').trim().slice(0, 80);
  const title = String(body.title || '').trim().slice(0, 160);
  const text = String(body.text || '').trim().slice(0, 400);
  const cta = String(body.cta || '').trim().slice(0, 40) || 'Saber mais';
  const href = String(body.href || '').trim();
  if (!title) throw Object.assign(new Error('Indique o título do conteúdo patrocinado.'), { status: 400 });
  if (!href || !/^(https?:\/\/|mailto:)/i.test(href) || href.length > 500) {
    throw Object.assign(new Error('Indique um link de destino começado por http://, https:// ou mailto:.'), { status: 400 });
  }
  return { brand, title, text, cta, href, active: body.active === true || body.active === 'true' || body.active === 'on' ? 1 : 0 };
}

router.get('/api/admin/sponsored', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM sponsored ORDER BY active DESC, id DESC').all()));

router.post('/api/admin/sponsored', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const v = sponsoredInput(req.body);
    const imageUrl = req.file ? await processAdImage(req.file) : null;
    const row = db.prepare('INSERT INTO sponsored(brand,title,text,cta,href,image_url,active) VALUES(?,?,?,?,?,?,?)').run(v.brand, v.title, v.text, v.cta, v.href, imageUrl, v.active);
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/sponsored/:id', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM sponsored WHERE id=?').get(id);
    if (!cur) throw Object.assign(new Error('Conteúdo não encontrado.'), { status: 404 });
    const v = sponsoredInput(req.body);
    let imageUrl = cur.image_url;
    if (req.file) { imageUrl = await processAdImage(req.file); removeUploaded(cur.image_url); }
    else if (req.body.remove_image === 'true') { removeUploaded(cur.image_url); imageUrl = null; }
    db.prepare('UPDATE sponsored SET brand=?,title=?,text=?,cta=?,href=?,image_url=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(v.brand, v.title, v.text, v.cta, v.href, imageUrl, v.active, id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.delete('/api/admin/sponsored/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM sponsored WHERE id=?').get(id);
  if (!cur) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  db.prepare('DELETE FROM sponsored WHERE id=?').run(id);
  removeUploaded(cur.image_url);
  return res.json({ ok: true });
});

function partnerInput(body) {
  const name = String(body.name || '').trim().slice(0, 100);
  const href = String(body.href || '').trim();
  if (!name) throw Object.assign(new Error('Indique o nome do parceiro.'), { status: 400 });
  if (href && (!/^(https?:\/\/|mailto:)/i.test(href) || href.length > 500)) {
    throw Object.assign(new Error('O link deve começar por http://, https:// ou mailto:.'), { status: 400 });
  }
  return { name, href, active: body.active === true || body.active === 'true' || body.active === 'on' ? 1 : 0 };
}

router.get('/api/admin/partners', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM partners ORDER BY position, id').all()));

router.post('/api/admin/partners', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const v = partnerInput(req.body);
    if (!req.file) throw Object.assign(new Error('Envie o logótipo do parceiro.'), { status: 400 });
    const imageUrl = await processAdImage(req.file);
    const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 AS p FROM partners').get().p;
    const row = db.prepare('INSERT INTO partners(name,image_url,href,position,active) VALUES(?,?,?,?,?)').run(v.name, imageUrl, v.href, pos, v.active);
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/partners/:id', requireAuth, csrfGuard, upload.single('image'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = db.prepare('SELECT * FROM partners WHERE id=?').get(id);
    if (!cur) throw Object.assign(new Error('Parceiro não encontrado.'), { status: 404 });
    const v = partnerInput(req.body);
    let imageUrl = cur.image_url;
    if (req.file) { imageUrl = await processAdImage(req.file); removeUploaded(cur.image_url); }
    db.prepare('UPDATE partners SET name=?,image_url=?,href=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(v.name, imageUrl, v.href, v.active, id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.post('/api/admin/partners/:id/move', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const dir = req.body?.dir === 'up' ? -1 : req.body?.dir === 'down' ? 1 : 0;
  const rows = db.prepare('SELECT id FROM partners ORDER BY position, id').all().map((r) => r.id);
  const i = rows.indexOf(id);
  if (i < 0 || !dir) return res.status(400).json({ error: 'Pedido inválido.' });
  const j = i + dir;
  if (j >= 0 && j < rows.length) {
    [rows[i], rows[j]] = [rows[j], rows[i]];
    const up = db.prepare('UPDATE partners SET position=? WHERE id=?');
    rows.forEach((rid, k) => up.run(k + 1, rid));
  }
  return res.json({ ok: true });
});

router.delete('/api/admin/partners/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM partners WHERE id=?').get(id);
  if (!cur) return res.status(404).json({ error: 'Parceiro não encontrado.' });
  db.prepare('DELETE FROM partners WHERE id=?').run(id);
  removeUploaded(cur.image_url);
  return res.json({ ok: true });
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

const AD_SLOTS = {
  leaderboard: { label: 'Topo da página', w: 970, h: 90, mobile: true },
  mid1: { label: 'Entre a lista e os temas', w: 728, h: 90, mobile: true },
  mid2: { label: 'Fim da coluna principal', w: 728, h: 90, mobile: true },
  mpu: { label: 'Barra lateral (topo)', w: 300, h: 250, mobile: false },
  halfpage: { label: 'Barra lateral (fixo)', w: 300, h: 600, mobile: false },
  inline: { label: 'Dentro dos artigos', w: 300, h: 250, mobile: false },
  readerEnd: { label: 'Fim dos artigos', w: 468, h: 60, mobile: true },
};
const adUpload = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'image_mobile', maxCount: 1 }]);

function adInput(body) {
  const name = String(body.name || '').trim().slice(0, 120);
  const slot = String(body.slot || '');
  const href = String(body.href || '').trim();
  const alt = String(body.alt || '').trim().slice(0, 160);
  if (!name) throw Object.assign(new Error('Indique um nome interno para o anúncio.'), { status: 400 });
  if (!AD_SLOTS[slot]) throw Object.assign(new Error('Posição inválida.'), { status: 400 });
  if (href && (!/^(https?:\/\/|mailto:)/i.test(href) || href.length > 500)) {
    throw Object.assign(new Error('O link deve começar por http://, https:// ou mailto:.'), { status: 400 });
  }
  return { name, slot, href, alt, active: body.active === true || body.active === 'true' || body.active === 'on' ? 1 : 0 };
}

router.get('/api/admin/ad-slots', requireAuth, (req, res) => res.json(AD_SLOTS));

router.get('/api/admin/ads', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM ads ORDER BY slot, active DESC, id DESC').all()));

router.post('/api/admin/ads', requireAuth, csrfGuard, adUpload, async (req, res) => {
  try {
    const v = adInput(req.body);
    const img = req.files?.image?.[0];
    if (!img) throw Object.assign(new Error('Envie a imagem do anúncio.'), { status: 400 });
    const imageUrl = await processAdImage(img);
    const mobileUrl = await processAdImage(req.files?.image_mobile?.[0]);
    const row = db.prepare('INSERT INTO ads(name,slot,image_url,image_mobile_url,href,alt,active) VALUES(?,?,?,?,?,?,?)').run(v.name, v.slot, imageUrl, mobileUrl, v.href, v.alt, v.active);
    return res.status(201).json({ id: Number(row.lastInsertRowid) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.put('/api/admin/ads/:id', requireAuth, csrfGuard, adUpload, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = db.prepare('SELECT * FROM ads WHERE id=?').get(id);
    if (!current) throw Object.assign(new Error('Anúncio não encontrado.'), { status: 404 });
    const v = adInput(req.body);
    let imageUrl = current.image_url;
    let mobileUrl = current.image_mobile_url;
    if (req.files?.image?.[0]) { imageUrl = await processAdImage(req.files.image[0]); removeUploaded(current.image_url); }
    if (req.files?.image_mobile?.[0]) { mobileUrl = await processAdImage(req.files.image_mobile[0]); removeUploaded(current.image_mobile_url); }
    else if (req.body.remove_mobile === 'true') { removeUploaded(current.image_mobile_url); mobileUrl = null; }
    db.prepare('UPDATE ads SET name=?,slot=?,image_url=?,image_mobile_url=?,href=?,alt=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(v.name, v.slot, imageUrl, mobileUrl, v.href, v.alt, v.active, id);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro interno do servidor.' });
  }
});

router.delete('/api/admin/ads/:id', requireAuth, csrfGuard, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM ads WHERE id=?').get(id);
  if (!row) return res.status(404).json({ error: 'Anúncio não encontrado.' });
  db.prepare('DELETE FROM ads WHERE id=?').run(id);
  removeUploaded(row.image_url);
  removeUploaded(row.image_mobile_url);
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
