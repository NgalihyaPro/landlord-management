const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { ensureOrganizationDefaults, slugifyOrganizationName } = require('../utils/organization.utils');

const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@landlordpro.com';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!';
const DEFAULT_ADMIN_NAME = process.env.DEFAULT_ADMIN_NAME || 'System Admin';
const DEFAULT_ADMIN_PHONE = process.env.DEFAULT_ADMIN_PHONE || '';
const DEFAULT_ORG_NAME = process.env.DEFAULT_ORG_NAME || 'LandlordPro';
const DEFAULT_ORG_SLUG = process.env.DEFAULT_ORG_SLUG || `${slugifyOrganizationName(DEFAULT_ORG_NAME)}-default`;

async function seedDefaultAdmin({ continueOnError = true } = {}) {
  console.log('Seeding default admin user...');

  let connection;
  let inTransaction = false;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    inTransaction = true;

    await connection.execute(
      `INSERT INTO roles (name, description)
       VALUES ('admin', 'Full access - Landlord/Owner')
       ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description`
    );

    const [roleRows] = await connection.execute(
      'SELECT id FROM roles WHERE name = ? LIMIT 1',
      ['admin']
    );

    if (!roleRows.length) {
      throw new Error('Admin role could not be created or loaded.');
    }

    const adminRoleId = roleRows[0].id;

    const [organizationResult] = await connection.execute(
      `INSERT INTO organizations (name, slug, owner_email, phone, address, is_active, approval_status, approved_at, approved_by_email)
       VALUES (?, ?, ?, ?, ?, TRUE, 'approved', NOW(), 'system-seed')
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           owner_email = EXCLUDED.owner_email,
           phone = EXCLUDED.phone,
           address = EXCLUDED.address,
           is_active = EXCLUDED.is_active,
           approval_status = EXCLUDED.approval_status,
           approved_at = EXCLUDED.approved_at,
           approved_by_email = EXCLUDED.approved_by_email`,
      [DEFAULT_ORG_NAME, DEFAULT_ORG_SLUG, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PHONE, '']
    );

    const organizationId = organizationResult.insertId;

    if (!organizationId) {
      throw new Error('Default organization could not be created or loaded.');
    }

    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);

    await connection.execute(
      `INSERT INTO users (organization_id, role_id, full_name, email, phone, password_hash, is_active, password_set_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
       ON CONFLICT (email) DO UPDATE
       SET organization_id = EXCLUDED.organization_id,
           role_id = EXCLUDED.role_id,
           full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           is_active = TRUE,
           password_set_at = NOW(),
           updated_at = NOW()`,
      [organizationId, adminRoleId, DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PHONE, passwordHash]
    );

    await ensureOrganizationDefaults(connection, organizationId, {
      business_name: DEFAULT_ORG_NAME,
      business_phone: DEFAULT_ADMIN_PHONE,
      business_email: DEFAULT_ADMIN_EMAIL,
      business_address: '',
    });

    await connection.execute(
      `SELECT setval(pg_get_serial_sequence('organizations', 'id'), COALESCE((SELECT MAX(id) FROM organizations), 1), true)`
    );
    await connection.execute(
      `SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1), true)`
    );
    await connection.execute(
      `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true)`
    );

    await connection.commit();
    inTransaction = false;

    console.log(`Default admin ready: ${DEFAULT_ADMIN_EMAIL}`);
    return { ok: true };
  } catch (error) {
    if (connection && inTransaction) {
      await connection.rollback();
    }
    console.error('Default admin seed failed:', error);

    if (!continueOnError) {
      throw error;
    }

    return { ok: false, error };
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

if (require.main === module) {
  const continueOnError = process.env.SEED_CONTINUE_ON_ERROR !== 'false';

  seedDefaultAdmin({ continueOnError })
    .then(async (result) => {
      await pool.end();
      if (!result.ok && !continueOnError) {
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Seed script crashed:', error);
      await pool.end();
      process.exit(continueOnError ? 0 : 1);
    });
}

module.exports = {
  seedDefaultAdmin,
};
