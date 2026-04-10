const { pool } = require('../database/db');
const { sendSMS } = require('./sms.service');

const requiredAmountExpression = 'COALESCE(NULLIF(t.required_amount, 0), t.monthly_rent)';

async function runDailyAlerts() {
  const res = await pool.query(
    `SELECT u.id, u.phone, u.organization_id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(r.name) = 'admin'
       AND u.is_active = TRUE
       AND u.phone IS NOT NULL
       AND TRIM(u.phone) != ''`
  );

  for (const landlord of res.rows) {
    try {
      await checkOverdueRent(landlord.organization_id, landlord.phone);
      await checkUpcomingRent(landlord.organization_id, landlord.phone);
      await checkLeaseExpiry(landlord.organization_id, landlord.phone);
    } catch (error) {
      console.error(`[SMS ALERTS] Failed for landlord ${landlord.id}:`, error);
    }
  }
}

async function checkOverdueRent(organizationId, landlordPhone) {
  const res = await pool.query(
    `SELECT
       t.full_name,
       t.phone,
       u.unit_number,
       p.name AS property_name,
       (${requiredAmountExpression} - COALESCE(SUM(pay.amount_paid), 0)) AS balance_due,
       t.next_due_date AS rent_due_date,
       (CURRENT_DATE - t.next_due_date) AS days_overdue
     FROM tenants t
     JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
     JOIN properties p ON p.id = COALESCE(t.property_id, u.property_id) AND p.organization_id = t.organization_id
     LEFT JOIN payments pay
       ON pay.tenant_id = t.id
      AND pay.organization_id = t.organization_id
      AND pay.payment_date >= DATE_TRUNC('month', CURRENT_DATE)
     WHERE t.is_active = TRUE
       AND t.organization_id = $1
       AND t.next_due_date < CURRENT_DATE
     GROUP BY t.id, t.full_name, t.phone, t.required_amount, t.monthly_rent, t.next_due_date, u.unit_number, p.name
     HAVING (${requiredAmountExpression} - COALESCE(SUM(pay.amount_paid), 0)) > 0`,
    [organizationId]
  );

  for (const row of res.rows) {
    const msg =
      `LandlordPro: OVERDUE - ${row.full_name} ` +
      `(${row.property_name}, Unit ${row.unit_number}) ` +
      `owes TZS ${Number(row.balance_due).toLocaleString()}. ` +
      `${Number(row.days_overdue)} day(s) late.`;
    await sendSMS(landlordPhone, msg);
  }
}

async function checkUpcomingRent(organizationId, landlordPhone) {
  const res = await pool.query(
    `SELECT
       t.full_name,
       u.unit_number,
       p.name AS property_name,
       t.monthly_rent,
       t.next_due_date AS rent_due_date
     FROM tenants t
     JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
     JOIN properties p ON p.id = COALESCE(t.property_id, u.property_id) AND p.organization_id = t.organization_id
     WHERE t.is_active = TRUE
       AND t.organization_id = $1
       AND t.next_due_date = CURRENT_DATE + INTERVAL '3 days'`,
    [organizationId]
  );

  for (const row of res.rows) {
    const msg =
      `LandlordPro: DUE SOON - ${row.full_name} ` +
      `(${row.property_name}, Unit ${row.unit_number}) ` +
      `TZS ${Number(row.monthly_rent).toLocaleString()} ` +
      `due ${new Date(row.rent_due_date).toLocaleDateString('en-GB')}.`;
    await sendSMS(landlordPhone, msg);
  }
}

async function checkLeaseExpiry(organizationId, landlordPhone) {
  const res = await pool.query(
    `SELECT
       t.full_name,
       u.unit_number,
       p.name AS property_name,
       COALESCE(t.lease_end_date, t.lease_end) AS lease_end_date,
       (COALESCE(t.lease_end_date, t.lease_end) - CURRENT_DATE) AS days_remaining
     FROM tenants t
     JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
     JOIN properties p ON p.id = COALESCE(t.property_id, u.property_id) AND p.organization_id = t.organization_id
     WHERE t.is_active = TRUE
       AND t.organization_id = $1
       AND COALESCE(t.lease_end_date, t.lease_end) IS NOT NULL
       AND COALESCE(t.lease_end_date, t.lease_end) BETWEEN CURRENT_DATE
           AND CURRENT_DATE + INTERVAL '30 days'`,
    [organizationId]
  );

  for (const row of res.rows) {
    const msg =
      `LandlordPro: LEASE EXPIRING - ${row.full_name} ` +
      `(${row.property_name}, Unit ${row.unit_number}) ` +
      `ends ${new Date(row.lease_end_date).toLocaleDateString('en-GB')}. ` +
      `${Number(row.days_remaining)} days left.`;
    await sendSMS(landlordPhone, msg);
  }
}

module.exports = {
  runDailyAlerts,
  checkOverdueRent,
  checkUpcomingRent,
  checkLeaseExpiry,
};
