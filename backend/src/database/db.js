const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');
require('dotenv').config();

const getSslConfig = () => {
  if (process.env.DB_SSL !== 'true') {
    return false;
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
};

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10),
      ssl: getSslConfig(),
    }
    : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'landlord_db',
      max: Number(process.env.DB_POOL_MAX || 10),
      ssl: getSslConfig(),
    }
);

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

const initializeSchema = async () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');

  if (!schemaSql.trim()) {
    return;
  }

  await pool.query(schemaSql);
};

const ensureTenantBillingColumns = async () => {
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS months_rented INTEGER NOT NULL DEFAULT 1');
  await pool.query('ALTER TABLE tenants ADD COLUMN IF NOT EXISTS required_amount NUMERIC(12, 2) NOT NULL DEFAULT 0');
  await pool.query(
    `UPDATE tenants
     SET months_rented = 1
     WHERE months_rented IS NULL OR months_rented < 1`
  );
  await pool.query(
    `UPDATE tenants
     SET required_amount = ROUND((COALESCE(monthly_rent, 0) * COALESCE(months_rented, 1))::numeric, 2)
     WHERE required_amount IS NULL OR required_amount <= 0`
  );
  await pool.query(
    `UPDATE tenants t
     SET outstanding_balance = GREATEST(
       0,
       t.required_amount - COALESCE((
         SELECT SUM(pay.amount_paid)
         FROM payments pay
         WHERE pay.tenant_id = t.id
           AND pay.organization_id = t.organization_id
       ), 0)
     )`
  );
};

const ensurePropertyLandlordColumn = async () => {
  await pool.query(
    'ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_id INTEGER REFERENCES users(id)'
  );
  await pool.query(
    `UPDATE properties
     SET landlord_id = owner_id
     WHERE landlord_id IS NULL AND owner_id IS NOT NULL`
  );
};

const ensureSmsAlertColumns = async () => {
  await pool.query(
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)'
  );
  await pool.query(
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS lease_end_date DATE'
  );
  await pool.query(
    `UPDATE tenants
     SET lease_end_date = lease_end
     WHERE lease_end_date IS NULL AND lease_end IS NOT NULL`
  );
  await ensurePropertyLandlordColumn();
};

module.exports = {
  pool,
  testConnection,
  initializeSchema,
  ensureTenantBillingColumns,
  ensurePropertyLandlordColumn,
  ensureSmsAlertColumns,
};
