const { pool } = require('./db');
const bcrypt = require('bcryptjs');
const { ensureOrganizationDefaults, slugifyOrganizationName } = require('../utils/organization.utils');

const seed = async () => {
  console.log('Seeding PostgreSQL database...');

  await pool.execute(
    `INSERT INTO roles (id, name, description) VALUES
      (1, 'admin', 'Full access - Landlord/Owner'),
      (2, 'manager', 'Property manager/caretaker access'),
      (3, 'viewer', 'Read-only access')
     ON CONFLICT (id) DO NOTHING`
  );

  const organizationName = 'Mwangi Property Group';
  const organizationSlug = `${slugifyOrganizationName(organizationName)}-demo`;
  const [organizationResult] = await pool.execute(
    `INSERT INTO organizations (id, name, slug, owner_email, phone, address, is_active, approval_status, approved_at, approved_by_email)
     VALUES (1, ?, ?, ?, ?, ?, TRUE, 'approved', NOW(), 'system-seed')
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         slug = EXCLUDED.slug,
         owner_email = EXCLUDED.owner_email,
         phone = EXCLUDED.phone,
         address = EXCLUDED.address,
         is_active = EXCLUDED.is_active,
         approval_status = EXCLUDED.approval_status,
         approved_at = EXCLUDED.approved_at,
         approved_by_email = EXCLUDED.approved_by_email`,
    [organizationName, organizationSlug, 'admin@landlordpro.com', '+255712345678', 'Dar es Salaam, Tanzania']
  );
  const organizationId = organizationResult.insertId || 1;

  const adminHash = await bcrypt.hash('Admin123!', 10);
  await pool.execute(
    `INSERT INTO users (
      id, organization_id, role_id, full_name, email, phone, password_hash, password_set_at
     ) VALUES (1, ?, 1, 'John Mwangi', 'admin@landlordpro.com', '+255712345678', ?, NOW())
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         role_id = EXCLUDED.role_id,
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         password_set_at = NOW(),
         is_active = TRUE`,
    [organizationId, adminHash]
  );

  const managerHash = await bcrypt.hash('Manager123!', 10);
  await pool.execute(
    `INSERT INTO users (
      id, organization_id, role_id, full_name, email, phone, password_hash, password_set_at
     ) VALUES (2, ?, 2, 'Grace Kamau', 'manager@landlordpro.com', '+255787654321', ?, NOW())
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         role_id = EXCLUDED.role_id,
         full_name = EXCLUDED.full_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         password_set_at = NOW(),
         is_active = TRUE`,
    [organizationId, managerHash]
  );

  await ensureOrganizationDefaults(pool, organizationId, {
    business_name: organizationName,
    business_phone: '+255712345678',
    business_email: 'admin@landlordpro.com',
    business_address: 'Dar es Salaam, Tanzania',
  });

  await pool.execute(
    `INSERT INTO properties (
      id, organization_id, owner_id, name, address, city, region, total_units
     ) VALUES
      (1, ?, 1, 'Mwangi Apartments', 'Plot 45, Mbezi Beach Road', 'Dar es Salaam', 'Dar es Salaam', 6),
      (2, ?, 1, 'Kilimani Heights', '12 Kilimani Street, Mikocheni', 'Dar es Salaam', 'Dar es Salaam', 4),
      (3, ?, 1, 'Arusha View Flats', '89 Sokoine Drive', 'Arusha', 'Arusha', 4)
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         owner_id = EXCLUDED.owner_id,
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         region = EXCLUDED.region,
         total_units = EXCLUDED.total_units`,
    [organizationId, organizationId, organizationId]
  );

  await pool.execute(
    `INSERT INTO units (
      id, organization_id, property_id, unit_number, unit_type, monthly_rent, deposit_amount, status
     ) VALUES
      (1, ?, 1, 'A1', 'apartment', 450000, 900000, 'occupied'),
      (2, ?, 1, 'A2', 'apartment', 450000, 900000, 'occupied'),
      (3, ?, 1, 'A3', 'apartment', 450000, 900000, 'occupied'),
      (4, ?, 1, 'B1', 'room', 280000, 560000, 'occupied'),
      (5, ?, 1, 'B2', 'room', 280000, 560000, 'vacant'),
      (6, ?, 1, 'B3', 'studio', 350000, 700000, 'occupied'),
      (7, ?, 2, 'K1', 'apartment', 550000, 1100000, 'occupied'),
      (8, ?, 2, 'K2', 'apartment', 550000, 1100000, 'vacant'),
      (9, ?, 2, 'K3', 'apartment', 550000, 1100000, 'occupied'),
      (10, ?, 2, 'K4', 'apartment', 550000, 1100000, 'vacant'),
      (11, ?, 3, 'AV1', 'apartment', 400000, 800000, 'occupied'),
      (12, ?, 3, 'AV2', 'apartment', 400000, 800000, 'occupied'),
      (13, ?, 3, 'AV3', 'apartment', 400000, 800000, 'vacant'),
      (14, ?, 3, 'AV4', 'apartment', 400000, 800000, 'occupied')
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         property_id = EXCLUDED.property_id,
         unit_number = EXCLUDED.unit_number,
         unit_type = EXCLUDED.unit_type,
         monthly_rent = EXCLUDED.monthly_rent,
         deposit_amount = EXCLUDED.deposit_amount,
         status = EXCLUDED.status`,
    [
      organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId,
      organizationId, organizationId, organizationId, organizationId, organizationId, organizationId, organizationId,
    ]
  );

  const today = new Date();
  const fmt = (date) => date.toISOString().split('T')[0];
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  const subDays = (date, days) => addDays(date, -days);

  await pool.execute(
    `INSERT INTO tenants (
      id, organization_id, unit_id, property_id, full_name, phone, email, national_id, lease_start, next_due_date,
      monthly_rent, deposit_amount, deposit_paid, outstanding_balance, payment_status
     ) VALUES
      (1, ?, 1, 1, 'Alice Moshi', '+255712000001', 'alice@email.com', 'TZ001234', '2025-01-01', ?, 450000, 900000, 900000, 0, 'paid'),
      (2, ?, 2, 1, 'Bob Juma', '+255712000002', 'bob@email.com', 'TZ001235', '2025-02-01', ?, 450000, 900000, 900000, 0, 'overdue'),
      (3, ?, 3, 1, 'Carol Ndege', '+255712000003', 'carol@email.com', 'TZ001236', '2024-12-01', ?, 450000, 900000, 450000, 225000, 'partial'),
      (4, ?, 4, 1, 'David Okello', '+255712000004', NULL, 'TZ001237', '2025-03-01', ?, 280000, 560000, 560000, 0, 'due_soon'),
      (5, ?, 6, 1, 'Eva Tarimo', '+255712000005', 'eva@email.com', 'TZ001238', '2025-01-15', ?, 350000, 700000, 700000, 0, 'paid'),
      (6, ?, 7, 2, 'Frank Ouma', '+255712000006', NULL, 'TZ001239', '2025-02-15', ?, 550000, 1100000, 1100000, 0, 'overdue'),
      (7, ?, 9, 2, 'Grace Waweru', '+255712000007', 'grace@email.com', 'TZ001240', '2025-03-01', ?, 550000, 1100000, 550000, 0, 'unpaid'),
      (8, ?, 11, 3, 'Henry Msigwa', '+255712000008', NULL, 'TZ001241', '2025-01-01', ?, 400000, 800000, 800000, 0, 'paid'),
      (9, ?, 12, 3, 'Irene Lema', '+255712000009', 'irene@email.com', 'TZ001242', '2025-02-01', ?, 400000, 800000, 800000, 0, 'due_soon'),
      (10, ?, 14, 3, 'James Kiwia', '+255712000010', NULL, 'TZ001243', '2025-03-01', ?, 400000, 800000, 400000, 200000, 'partial')
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         unit_id = EXCLUDED.unit_id,
         property_id = EXCLUDED.property_id,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         national_id = EXCLUDED.national_id,
         lease_start = EXCLUDED.lease_start,
         next_due_date = EXCLUDED.next_due_date,
         monthly_rent = EXCLUDED.monthly_rent,
         deposit_amount = EXCLUDED.deposit_amount,
         deposit_paid = EXCLUDED.deposit_paid,
         outstanding_balance = EXCLUDED.outstanding_balance,
         payment_status = EXCLUDED.payment_status,
         is_active = TRUE`,
    [
      organizationId, fmt(addDays(today, 5)),
      organizationId, fmt(subDays(today, 10)),
      organizationId, fmt(subDays(today, 5)),
      organizationId, fmt(addDays(today, 3)),
      organizationId, fmt(addDays(today, 12)),
      organizationId, fmt(subDays(today, 15)),
      organizationId, fmt(addDays(today, 1)),
      organizationId, fmt(addDays(today, 8)),
      organizationId, fmt(addDays(today, 6)),
      organizationId, fmt(subDays(today, 3)),
    ]
  );

  const [paymentMethods] = await pool.execute(
    'SELECT id, name FROM payment_methods WHERE organization_id = ?',
    [organizationId]
  );
  const methodIdByName = Object.fromEntries(paymentMethods.map((method) => [method.name, method.id]));

  const payMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = today.getMonth() === 0
    ? `${today.getFullYear() - 1}-12`
    : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`;

  await pool.execute(
    `INSERT INTO payments (
      id, organization_id, tenant_id, unit_id, property_id, payment_method_id, amount_due, amount_paid, balance,
      payment_date, period_month, reference_number, payment_status, recorded_by, receipt_number
     ) VALUES
      (1, ?, 1, 1, 1, ?, 450000, 450000, 0, ?, ?, 'CASH-001', 'paid', 1, 'RCP-2024-001'),
      (2, ?, 5, 6, 1, ?, 350000, 350000, 0, ?, ?, 'MPESA-001', 'paid', 1, 'RCP-2024-002'),
      (3, ?, 8, 11, 3, ?, 400000, 400000, 0, ?, ?, 'CASH-002', 'paid', 1, 'RCP-2024-003'),
      (4, ?, 3, 3, 1, ?, 450000, 225000, 225000, ?, ?, 'TIGO-001', 'partial', 1, 'RCP-2024-004'),
      (5, ?, 10, 14, 3, ?, 400000, 200000, 200000, ?, ?, 'MPESA-002', 'partial', 1, 'RCP-2024-005'),
      (6, ?, 1, 1, 1, ?, 450000, 450000, 0, ?, ?, 'CASH-003', 'paid', 1, 'RCP-2024-006'),
      (7, ?, 5, 6, 1, ?, 350000, 350000, 0, ?, ?, 'MPESA-003', 'paid', 1, 'RCP-2024-007'),
      (8, ?, 8, 11, 3, ?, 400000, 400000, 0, ?, ?, 'CASH-004', 'paid', 1, 'RCP-2024-008')
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         tenant_id = EXCLUDED.tenant_id,
         unit_id = EXCLUDED.unit_id,
         property_id = EXCLUDED.property_id,
         payment_method_id = EXCLUDED.payment_method_id,
         amount_due = EXCLUDED.amount_due,
         amount_paid = EXCLUDED.amount_paid,
         balance = EXCLUDED.balance,
         payment_date = EXCLUDED.payment_date,
         period_month = EXCLUDED.period_month,
         reference_number = EXCLUDED.reference_number,
         payment_status = EXCLUDED.payment_status,
         recorded_by = EXCLUDED.recorded_by,
         receipt_number = EXCLUDED.receipt_number`,
    [
      organizationId, methodIdByName.Cash, fmt(today), payMonth,
      organizationId, methodIdByName['M-Pesa'], fmt(today), payMonth,
      organizationId, methodIdByName.Cash, fmt(today), payMonth,
      organizationId, methodIdByName['Tigo Pesa'], fmt(subDays(today, 2)), payMonth,
      organizationId, methodIdByName['M-Pesa'], fmt(subDays(today, 1)), payMonth,
      organizationId, methodIdByName.Cash, fmt(subDays(today, 32)), lastMonth,
      organizationId, methodIdByName['M-Pesa'], fmt(subDays(today, 32)), lastMonth,
      organizationId, methodIdByName.Cash, fmt(subDays(today, 32)), lastMonth,
    ]
  );

  await pool.execute(
    `INSERT INTO notifications (id, organization_id, user_id, tenant_id, type, title, message) VALUES
      (1, ?, 1, 2, 'overdue', 'Overdue Rent - Bob Juma', 'Bob Juma (Unit A2) has overdue rent. 10 days past due date.'),
      (2, ?, 1, 6, 'overdue', 'Overdue Rent - Frank Ouma', 'Frank Ouma (Unit K1) has overdue rent. 15 days past due date.'),
      (3, ?, 1, 4, 'due_soon', 'Rent Due Soon - David Okello', 'David Okello (Unit B1) rent is due in 3 days.'),
      (4, ?, 1, 9, 'due_soon', 'Rent Due Soon - Irene Lema', 'Irene Lema (Unit AV2) rent is due in 6 days.')
     ON CONFLICT (id) DO UPDATE
     SET organization_id = EXCLUDED.organization_id,
         user_id = EXCLUDED.user_id,
         tenant_id = EXCLUDED.tenant_id,
         type = EXCLUDED.type,
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         is_read = FALSE`,
    [organizationId, organizationId, organizationId, organizationId]
  );

  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('organizations', 'id'), COALESCE((SELECT MAX(id) FROM organizations), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('properties', 'id'), COALESCE((SELECT MAX(id) FROM properties), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('units', 'id'), COALESCE((SELECT MAX(id) FROM units), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('tenants', 'id'), COALESCE((SELECT MAX(id) FROM tenants), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('payment_methods', 'id'), COALESCE((SELECT MAX(id) FROM payment_methods), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('notifications', 'id'), COALESCE((SELECT MAX(id) FROM notifications), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('settings', 'id'), COALESCE((SELECT MAX(id) FROM settings), 1), true)`
  );
  await pool.execute(
    `SELECT setval(pg_get_serial_sequence('audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM audit_logs), 1), true)`
  );

  console.log('Seed completed successfully');
  console.log('Demo credentials:');
  console.log('Owner:   admin@landlordpro.com / Admin123!');
  console.log('Manager: manager@landlordpro.com / Manager123!');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
