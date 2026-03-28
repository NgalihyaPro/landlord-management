const { pool } = require('../database/db');

const getOverview = async (req, res) => {
  try {
    const { month, property_id } = req.query;
    const organizationId = req.user.organization_id;
    const period = month || new Date().toISOString().substring(0, 7);

    const propertyFilter = property_id ? ' AND p.id = ?' : '';
    const paymentPropertyFilter = property_id ? ' AND pay.property_id = ?' : '';
    const tenantPropertyFilter = property_id ? ' AND t.property_id = ?' : '';
    const occupancyPropertyFilter = property_id ? ' AND p.id = ?' : '';

    const [incomeByProperty] = await pool.execute(
      `SELECT p.id, p.name,
              COALESCE(SUM(pay.amount_paid), 0) as total_collected,
              COALESCE(SUM(pay.amount_due), 0) as total_expected,
              COALESCE(SUM(pay.balance), 0) as total_outstanding,
              COUNT(pay.id) as payment_count
       FROM properties p
       LEFT JOIN payments pay
         ON p.id = pay.property_id
        AND pay.period_month = ?
        AND pay.organization_id = p.organization_id
       WHERE p.organization_id = ? AND p.status = 'active'${propertyFilter}
       GROUP BY p.id, p.name
       ORDER BY total_collected DESC`,
      property_id ? [period, organizationId, property_id] : [period, organizationId]
    );

    const [paidTenants] = await pool.execute(
      `SELECT t.full_name, t.phone, u.unit_number, p.name as property_name,
              pay.amount_paid, pay.payment_date, pay.receipt_number, pm.name as method
       FROM payments pay
       JOIN tenants t ON pay.tenant_id = t.id AND t.organization_id = pay.organization_id
       LEFT JOIN units u ON pay.unit_id = u.id AND u.organization_id = pay.organization_id
       LEFT JOIN properties p ON pay.property_id = p.id AND p.organization_id = pay.organization_id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
       WHERE pay.organization_id = ? AND pay.period_month = ? AND pay.payment_status = 'paid'${paymentPropertyFilter}
       ORDER BY pay.payment_date DESC`,
      property_id ? [organizationId, period, property_id] : [organizationId, period]
    );

    const [unpaidTenants] = await pool.execute(
      `SELECT t.id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.payment_status,
              t.outstanding_balance, u.unit_number, p.name as property_name,
              (CURRENT_DATE - t.next_due_date) as days_overdue
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.organization_id = ? AND t.is_active = TRUE AND t.payment_status NOT IN ('paid')${tenantPropertyFilter}
       ORDER BY t.next_due_date ASC`,
      property_id ? [organizationId, property_id] : [organizationId]
    );

    const [overdueTenants] = await pool.execute(
      `SELECT t.id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.outstanding_balance,
              u.unit_number, p.name as property_name,
              (CURRENT_DATE - t.next_due_date) as days_overdue
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.organization_id = ? AND t.is_active = TRUE AND t.payment_status = 'overdue'${tenantPropertyFilter}
       ORDER BY days_overdue DESC`,
      property_id ? [organizationId, property_id] : [organizationId]
    );

    const [dueSoonTenants] = await pool.execute(
      `SELECT t.id, t.full_name, t.phone, t.next_due_date, t.monthly_rent, t.payment_status,
              u.unit_number, p.name as property_name,
              (t.next_due_date - CURRENT_DATE) as days_until_due
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.organization_id = ?
         AND t.is_active = TRUE
         AND t.next_due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
         AND t.payment_status NOT IN ('paid')${tenantPropertyFilter}
       ORDER BY t.next_due_date ASC`,
      property_id ? [organizationId, property_id] : [organizationId]
    );

    const [occupancy] = await pool.execute(
      `SELECT p.id, p.name, p.total_units,
              COUNT(u.id) as actual_units,
              SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) as occupied,
              SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) as vacant,
              SUM(CASE WHEN u.status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
              ROUND((SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(u.id), 0)) * 100, 1) as occupancy_rate
       FROM properties p
       LEFT JOIN units u ON p.id = u.property_id AND u.organization_id = p.organization_id
       WHERE p.organization_id = ? AND p.status = 'active'${occupancyPropertyFilter}
       GROUP BY p.id, p.name, p.total_units`,
      property_id ? [organizationId, property_id] : [organizationId]
    );

    const [monthlyTrend] = await pool.execute(
      `SELECT period_month,
              SUM(amount_paid) as collected,
              SUM(amount_due) as expected,
              COUNT(*) as transactions
       FROM payments
       WHERE organization_id = ?
         AND period_month >= TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM')
         ${property_id ? 'AND property_id = ?' : ''}
       GROUP BY period_month
       ORDER BY period_month ASC`,
      property_id ? [organizationId, property_id] : [organizationId]
    );

    res.json({
      period,
      income_by_property: incomeByProperty,
      paid_tenants: paidTenants,
      unpaid_tenants: unpaidTenants,
      overdue_tenants: overdueTenants,
      due_soon_tenants: dueSoonTenants,
      occupancy,
      monthly_trend: monthlyTrend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { from_date, to_date, property_id } = req.query;
    const from = from_date || new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const to = to_date || new Date().toISOString().split('T')[0];
    const params = [req.user.organization_id, from, to];

    let query = `
      SELECT pay.*, t.full_name as tenant_name, t.phone, u.unit_number,
             p.name as property_name, pm.name as method
      FROM payments pay
      JOIN tenants t ON pay.tenant_id = t.id AND t.organization_id = pay.organization_id
      LEFT JOIN units u ON pay.unit_id = u.id AND u.organization_id = pay.organization_id
      LEFT JOIN properties p ON pay.property_id = p.id AND p.organization_id = pay.organization_id
      LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
      WHERE pay.organization_id = ? AND pay.payment_date BETWEEN ? AND ?
    `;

    if (property_id) {
      query += ' AND pay.property_id = ?';
      params.push(property_id);
    }

    query += ' ORDER BY pay.payment_date DESC';

    const [rows] = await pool.execute(query, params);
    const total = rows.reduce((sum, row) => sum + Number(row.amount_paid), 0);

    res.json({ payments: rows, total_collected: total, from_date: from, to_date: to });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment history.' });
  }
};

module.exports = { getOverview, getPaymentHistory };
