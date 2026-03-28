const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'landlord_db',
  max: 10,
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
});

function normalizeParams(params = []) {
  return params.map((param) => (param === undefined ? null : param));
}

function replacePlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function shouldAppendReturningId(sql) {
  const trimmed = sql.trim().replace(/;$/, '');
  return /^insert\s+into/i.test(trimmed) && !/\breturning\b/i.test(trimmed);
}

function normalizeSql(sql) {
  const converted = replacePlaceholders(sql);
  return shouldAppendReturningId(converted) ? `${converted} RETURNING id` : converted;
}

function formatResult(result) {
  if (result.command === 'SELECT') {
    return [result.rows];
  }

  return [{
    rowCount: result.rowCount,
    affectedRows: result.rowCount,
    insertId: result.rows?.[0]?.id,
    rows: result.rows,
  }];
}

async function executeQuery(executor, sql, params = []) {
  const result = await executor.query(normalizeSql(sql), normalizeParams(params));
  return formatResult(result);
}

function createConnection(client) {
  return {
    query: (sql, params = []) => executeQuery(client, sql, params),
    execute: (sql, params = []) => executeQuery(client, sql, params),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

pool.execute = (sql, params = []) => executeQuery(pool, sql, params);
pool.getConnection = async () => createConnection(await pool.connect());

const testConnection = async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
