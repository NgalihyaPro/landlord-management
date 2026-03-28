const { pool } = require('../database/db');

const getDashboard = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const today = new Date().toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7);

    const [settingsRows] = await pool.execute(
      `SELECT setting_value
       FROM settings
       WHERE organization_id = ? AND setting_key = 'reminder_days'
       LIMIT 1`,
      [organizationId]
    );

    const reminderDays = Number(settingsRows[0]?.setting_value || 7);
    const dueSoonDate = new Date();
    dueSoonDate.setDate(dueSoonDate.getDate() + reminderDays);
    const dueSoonStr = dueSoonDate.toISOString().split('T')[0];

    const [[{ total_properties }]] = await pool.execute(
      "SELECT COUNT(*) as total_properties FROM properties WHERE organization_id = ? AND status = 'active'",
      [organizationId]
    );

    const [[unitStats]] = await pool.execute(
      `SELECT COUNT(*) as total_units,
              SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_units,
              SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_units,
              SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_units
       FROM units
       WHERE organization_id = ?`,
      [organizationId]
    );

    const [[tenantStats]] = await pool.execute(
      `SELECT COUNT(*) as total_tenants,
              SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tenants,
              SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_tenants,
              SUM(CASE WHEN payment_status = 'overdue' THEN 1 ELSE 0 END) as overdue_tenants,
              SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_tenants,
              SUM(CASE WHEN payment_status = 'due_soon' THEN 1 ELSE 0 END) as due_soon_tenants
       FROM tenants
       WHERE organization_id = ? AND is_active = TRUE`,
      [organizationId]
    );

    const [[monthlyStats]] = await pool.execute(
      `SELECT COALESCE(SUM(amount_paid), 0) as collected_this_month,
              COALESCE(SUM(amount_due), 0) as expected_this_month,
              COALESCE(SUM(balance), 0) as outstanding_this_month
       FROM payments
       WHERE organization_id = ? AND period_month = ?`,
      [organizationId, yearMonth]
    );

    const [dueSoonTenants] = await pool.execute(
      `SELECT t.id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.payment_status,
              u.unit_number, p.name as property_name
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.next_due_date BETWEEN ? AND ?
         AND t.payment_status NOT IN ('paid')
       ORDER BY t.next_due_date ASC
       LIMIT 10`,
      [organizationId, today, dueSoonStr]
    );

    const [overdueTenants] = await pool.execute(
      `SELECT t.id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.outstanding_balance, t.payment_status,
              u.unit_number, p.name as property_name,
              (CURRENT_DATE - t.next_due_date) as days_overdue
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.payment_status = 'overdue'
       ORDER BY t.next_due_date ASC
       LIMIT 10`,
      [organizationId]
    );

    const [recentPayments] = await pool.execute(
      `SELECT p.id, p.amount_paid, p.payment_date, p.receipt_number, p.payment_status,
              t.full_name as tenant_name, u.unit_number, pr.name as property_name, pm.name as payment_method
       FROM payments p
       JOIN tenants t ON p.tenant_id = t.id AND t.organization_id = p.organization_id
       LEFT JOIN units u ON p.unit_id = u.id AND u.organization_id = p.organization_id
       LEFT JOIN properties pr ON p.property_id = pr.id AND pr.organization_id = p.organization_id
       LEFT JOIN payment_methods pm ON p.payment_method_id = pm.id AND pm.organization_id = p.organization_id
       WHERE p.organization_id = ?
       ORDER BY p.created_at DESC
       LIMIT 8`,
      [organizationId]
    );

    const [[notifCount]] = await pool.execute(
      'SELECT COUNT(*) as count FROM notifications WHERE organization_id = ? AND user_id = ? AND is_read = FALSE',
      [organizationId, req.user.id]
    );

    const [propertyIncome] = await pool.execute(
      `SELECT pr.name, pr.id,
              COALESCE(SUM(py.amount_paid), 0) as income,
              COALESCE(SUM(py.amount_due), 0) as expected
       FROM properties pr
       LEFT JOIN payments py
         ON pr.id = py.property_id
        AND py.period_month = ?
        AND py.organization_id = pr.organization_id
       WHERE pr.organization_id = ? AND pr.status = 'active'
       GROUP BY pr.id, pr.name`,
      [yearMonth, organizationId]
    );

    res.json({
      summary: {
        total_properties: Number(total_properties),
        ...unitStats,
        ...tenantStats,
        ...monthlyStats,
        unread_notifications: Number(notifCount.count),
      },
      due_soon_tenants: dueSoonTenants,
      overdue_tenants: overdueTenants,
      recent_payments: recentPayments,
      property_income: propertyIncome,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
};

module.exports = { getDashboard };
