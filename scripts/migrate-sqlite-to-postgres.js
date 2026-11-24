'use strict';

require('dotenv').config();
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const tables = [
  'users',
  'sessions',
  'articles',
  'subscribers',
  'contacts',
  'settings',
  'audit',
  'rate_limits',
  'password_reset_tokens',
  'revoked_tokens',
  'ads',
  'categories',
  'slides',
  'sponsored',
  'partners',
];
const uniqueColumns = {
  users: 'email',
  sessions: 'id_hash',
  articles: 'slug',
  subscribers: 'email',
  settings: 'key',
  rate_limits: 'key',
  password_reset_tokens: 'token',
  revoked_tokens: 'token_hash',
  categories: 'name',
};
const booleanColumns = new Set(['active', 'featured', 'trending', 'used', 'is_top']);
const timestampColumns = new Set(['created_at', 'updated_at']);
const epochColumns = new Set(['expires_at', 'reset_at']);
const sourcePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data', 'sena.sqlite');
const connectionUrl = process.env.DATABASE_URL || process.env.External_Database_URL;

function safeErrorMessage(error) {
  return String(error?.message || error).replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[URL de conexão ocultada]');
}

function toTimestamp(value, column) {
  if (value == null) return null;
  if (epochColumns.has(column)) return new Date(Number(value));
  const text = String(value);
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
    ? text
    : `${text.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`Data inválida na coluna "${column}".`);
  return date;
}

function toPostgresRow(row) {
  return Object.fromEntries(Object.entries(row).map(([column, value]) => {
    if (booleanColumns.has(column)) return [column, Boolean(value)];
    if (timestampColumns.has(column) || epochColumns.has(column)) return [column, toTimestamp(value, column)];
    return [column, value];
  }));
}

async function insertRow(tx, table, sourceRow, userIds) {
  const row = toPostgresRow(sourceRow);
  if (table === 'users') {
    const existing = await tx.$queryRawUnsafe('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', row.email);
    if (existing.length) {
      userIds.set(sourceRow.id, existing[0].id);
      return false;
    }
  }

  if (table === 'categories') {
    const existing = await tx.$queryRawUnsafe('SELECT id FROM categories WHERE lower(name)=lower($1) LIMIT 1', row.name);
    if (existing.length) return false;
  }

  if (table === 'subscribers') {
    const existing = await tx.$queryRawUnsafe('SELECT id FROM subscribers WHERE lower(email)=lower($1) LIMIT 1', row.email);
    if (existing.length) return false;
  }

  if (table === 'sessions' || table === 'audit') {
    if (row.user_id != null) {
      const targetUserId = userIds.get(sourceRow.user_id);
      if (targetUserId == null) {
        if (table === 'sessions') throw new Error('Uma sessão SQLite não tem usuário correspondente no destino.');
        row.user_id = null;
      } else {
        row.user_id = targetUserId;
      }
    }
  }

  delete row.id;
  const columns = Object.keys(row);
  const conflictColumn = uniqueColumns[table];
  const onConflict = conflictColumn ? ` ON CONFLICT ("${conflictColumn}") DO NOTHING` : '';
  const values = columns.map((_, index) => `$${index + 1}`).join(', ');
  const returned = await tx.$queryRawUnsafe(
    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${values})${onConflict} RETURNING 1 AS imported`,
    ...columns.map((column) => row[column]),
  );

  if (table === 'users') {
    const targetUser = await tx.$queryRawUnsafe('SELECT id FROM users WHERE lower(email)=lower($1) LIMIT 1', row.email);
    if (!targetUser.length) throw new Error('Não foi possível confirmar o usuário migrado.');
    userIds.set(sourceRow.id, targetUser[0].id);
  }
  return returned.length > 0;
}

async function main() {
  if (!connectionUrl) throw new Error('Defina DATABASE_URL no ficheiro .env.');
  if (!/^postgres(?:ql)?:\/\//i.test(connectionUrl)) throw new Error('DATABASE_URL deve apontar para PostgreSQL.');

  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const prisma = new PrismaClient();

  try {
    const sourceTables = new Set(
      source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map((row) => row.name),
    );
    const sourceRows = new Map();
    for (const table of tables) {
      if (!sourceTables.has(table)) throw new Error(`A tabela SQLite "${table}" não existe; a cópia foi cancelada.`);
      sourceRows.set(table, source.prepare(`SELECT * FROM "${table}"`).all());
    }

    await prisma.$connect();
    const previousImport = await prisma.$queryRawUnsafe(
      'SELECT 1 FROM sqlite_imports WHERE source_path=$1 LIMIT 1',
      sourcePath,
    );
    if (previousImport.length) {
      console.log('Esta base SQLite já foi importada; nenhum dado foi alterado.');
      return;
    }

    const before = new Map();
    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      before.set(table, Number(result[0].count));
    }

    const imported = new Map(tables.map((table) => [table, 0]));
    const userIds = new Map();
    await prisma.$transaction(async (tx) => {
      for (const table of tables) {
        for (const row of sourceRows.get(table)) {
          if (await insertRow(tx, table, row, userIds)) imported.set(table, imported.get(table) + 1);
        }
      }
      await tx.$executeRawUnsafe(
        'INSERT INTO sqlite_imports(source_path) VALUES($1)',
        sourcePath,
      );
    }, { maxWait: 10000, timeout: 120000 });

    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${table}"`);
      const expected = before.get(table) + imported.get(table);
      const actual = Number(result[0].count);
      if (actual !== expected) {
        throw new Error(`Contagem divergente em "${table}": esperado=${expected}, atual=${actual}.`);
      }
      const skipped = sourceRows.get(table).length - imported.get(table);
      console.log(`${table}: ${imported.get(table)} importado(s), ${skipped} já existente(s) preservado(s)`);
    }
  } finally {
    source.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`Migração cancelada: ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
