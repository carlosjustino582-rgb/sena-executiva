'use strict';

require('dotenv').config();
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('PostgreSQL integration', { skip: !testDatabaseUrl && 'Configure TEST_DATABASE_URL para executar os testes de integração.' }, async (t) => {
  const { PrismaClient } = require('@prisma/client');
  const schema = `sena_test_${crypto.randomUUID().replace(/-/g, '')}`;
  const schemaUrl = new URL(testDatabaseUrl);
  schemaUrl.searchParams.set('schema', schema);
  const owner = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
  let schemaCreated = false;
  let db;
  let server;
  let base;
  let cookie = '';
  let csrf = '';

  async function request(route, method = 'GET', data, authenticated = false) {
    const response = await fetch(base + route, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated ? { Cookie: cookie, 'X-CSRF-Token': csrf } : {}),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }

  try {
    await owner.$connect();
    await owner.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await owner.$disconnect();

    process.env.DATABASE_URL = schemaUrl.toString();
    process.env.NODE_ENV = 'test';
    const prismaCli = path.join(__dirname, '..', 'node_modules', 'prisma', 'build', 'index.js');
    const push = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate'], {
      env: { ...process.env, DATABASE_URL: schemaUrl.toString() },
      encoding: 'utf8',
      timeout: 60000,
    });
    if (push.status !== 0) throw new Error(`Não foi possível preparar o schema de teste (código ${push.status}).`);

    db = require('../db');
    const app = require('../src/app');
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    await db.connect();
    base = `http://127.0.0.1:${server.address().port}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = `${salt}:${crypto.scryptSync('long-test-password-123', salt, 64).toString('hex')}`;
    await db.prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)').run('Admin', 'admin@test.ao', hash, 'admin');

    await t.test('public routes and persistence', async () => {
      assert.equal((await request('/api/public/articles')).status, 200);
      assert.equal((await request('/api/newsletter', 'POST', { email: 'reader@example.ao' })).status, 201);
      assert.equal((await request('/api/newsletter', 'POST', { email: 'READER@example.ao' })).status, 201);
      assert.equal((await db.prepare('SELECT COUNT(*) n FROM subscribers').get()).n, 1);
      assert.equal((await request('/api/contact', 'POST', { name: 'Teste', email: 'contact@example.ao', subject: 'Parceria', message: 'Bom dia' })).status, 201);
      assert.equal((await db.prepare('SELECT COUNT(*) n FROM contacts').get()).n, 1);
    });

    await t.test('authentication and CSRF protection', async () => {
      assert.equal((await request('/api/admin/dashboard')).status, 401);
      assert.equal((await request('/api/auth/login', 'POST', { email: 'admin@test.ao', password: 'errada' })).status, 401);
      const login = await request('/api/auth/login', 'POST', { email: 'admin@test.ao', password: 'long-test-password-123' });
      assert.equal(login.status, 200);
      cookie = login.headers.get('set-cookie').split(';')[0];
      csrf = login.body.csrf;
      assert.equal((await request('/api/admin/dashboard', 'GET', undefined, true)).status, 200);
      const bad = await fetch(base + '/api/admin/articles', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}',
      });
      assert.equal(bad.status, 403);
    });

    await t.test('failed login attempts do not block another account on the same IP', async () => {
      for (let i = 0; i < 8; i++) {
        assert.equal((await request('/api/auth/login', 'POST', { email: 'mistyped@example.ao', password: 'incorrect' })).status, 401);
      }
      assert.equal((await request('/api/auth/login', 'POST', { email: 'admin@test.ao', password: 'long-test-password-123' })).status, 200);
    });

    await t.test('article publish, edit, unpublish and delete', async () => {
      const input = {
        title: 'Economia de Angola',
        excerpt: 'Análise executiva',
        category: 'Economia',
        body: 'Primeiro parágrafo.\n\nSegundo parágrafo.',
        status: 'published',
        featured: true,
      };
      const created = await request('/api/admin/articles', 'POST', input, true);
      assert.equal(created.status, 201);
      const publicArticles = (await request('/api/public/articles')).body;
      assert.equal(publicArticles.length, 1);
      assert.equal(publicArticles[0].title, input.title);
      assert.equal(publicArticles[0].body.length, 2);
      assert.equal((await request(`/api/admin/articles/${created.body.id}`, 'PUT', { ...input, status: 'draft' }, true)).status, 200);
      assert.equal((await request('/api/public/articles')).body.length, 0);
      assert.equal((await request(`/api/admin/articles/${created.body.id}`, 'DELETE', undefined, true)).status, 200);
      assert.equal((await db.prepare('SELECT COUNT(*) n FROM articles').get()).n, 0);
    });

    await t.test('sponsored content insert and update', async () => {
      const input = {
        brand: 'Parceiro de teste',
        title: 'Conteúdo patrocinado',
        text: 'Texto de teste',
        cta: 'Saber mais',
        href: 'https://example.com',
        active: true,
      };
      const created = await request('/api/admin/sponsored', 'POST', input, true);
      assert.equal(created.status, 201);
      const updated = await request(`/api/admin/sponsored/${created.body.id}`, 'PUT', { ...input, title: 'Conteúdo atualizado' }, true);
      assert.equal(updated.status, 200);
      const rows = await request('/api/admin/sponsored', 'GET', undefined, true);
      assert.equal(rows.body[0].title, 'Conteúdo atualizado');
    });

    await t.test('password reset and login', async () => {
      assert.equal((await request('/api/auth/forgot-password', 'POST', { email: 'admin@test.ao' })).status, 200);
      const tokenRow = await db.prepare('SELECT token FROM password_reset_tokens WHERE email=? ORDER BY created_at DESC LIMIT 1').get('admin@test.ao');
      assert.ok(tokenRow?.token);
      assert.equal((await request('/api/auth/reset-password', 'POST', { token: tokenRow.token, password: 'new-long-test-password-123' })).status, 200);
      const login = await request('/api/auth/login', 'POST', { email: 'admin@test.ao', password: 'new-long-test-password-123' });
      assert.equal(login.status, 200);
      assert.ok(login.headers.get('set-cookie')?.includes('sena_jwt='));
    });

    await t.test('settings and logout', async () => {
      assert.equal((await request('/api/admin/settings', 'PUT', { phone: '+244 900 000 000' }, true)).status, 200);
      assert.equal((await request('/api/public/settings')).body.phone, '+244 900 000 000');
      assert.equal((await request('/api/auth/logout', 'POST', {}, true)).status, 200);
      assert.equal((await request('/api/admin/dashboard', 'GET', undefined, true)).status, 401);
    });
  } finally {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (db) await db.disconnect();
    if (schemaCreated) {
      const cleanup = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
      await cleanup.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      await cleanup.$disconnect();
    }
    await owner.$disconnect();
  }
});
