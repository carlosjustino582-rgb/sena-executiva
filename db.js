'use strict';

require('./src/config/env');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const tablesWithoutNumericId = new Set(['settings', 'rate_limits']);

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? Number(value) : value]),
  ));
}

function postgresStatement(statement) {
  let sql = statement.trim();
  const ignoredInsert = /^INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
  if (ignoredInsert) {
    sql = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, 'INSERT INTO');
    if (!/\bON\s+CONFLICT\b/i.test(sql)) sql += ' ON CONFLICT DO NOTHING';
  }

  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function createDatabase(client) {
  return {
    prepare(statement) {
      const sql = postgresStatement(statement);
      return {
        async all(...params) {
          return normalizeRows(await client.$queryRawUnsafe(sql, ...params));
        },
        async get(...params) {
          const rows = normalizeRows(await client.$queryRawUnsafe(sql, ...params));
          return rows[0];
        },
        async run(...params) {
          const insert = /^\s*INSERT\s+INTO\s+"?([a-z_]+)"?/i.exec(sql);
          if (insert && !tablesWithoutNumericId.has(insert[1])) {
            const rows = normalizeRows(await client.$queryRawUnsafe(`${sql} RETURNING id`, ...params));
            return { lastInsertRowid: rows[0]?.id ?? 0 };
          }
          return { changes: await client.$executeRawUnsafe(sql, ...params) };
        },
      };
    },
    async transaction(work) {
      if (client !== prisma) throw new Error('Transações aninhadas não são suportadas.');
      return prisma.$transaction((transactionClient) => work(createDatabase(transactionClient)));
    },
    connect: () => prisma.$connect(),
    disconnect: () => prisma.$disconnect(),
  };
}

module.exports = createDatabase(prisma);
