const { pool } = require('../database/db');

const getAll = async (req, res) => {
  try {
    const { tenant_id, property_id, from_date, to_date, status, page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;

    let query = `
      SELECT pay.*, t.full_name as tenant_name, t.phone as tenant_phone,
             u.unit_number, p.name as property_name, pm.name as method_name
      FROM payments pay
      JOIN tenants t ON pay.tenant_id = t.id AND t.organization_id = pay.organization_id
      LEFT JOIN units u ON pay.unit_id = u.id AND u.organization_id = pay.organization_id
      LEFT JOIN properties p ON pay.property_id = p.id AND p.organization_id = pay.organization_id
      LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
      WHERE pay.organization_id = ?
    `;
    const params = [req.user.organization_id];

    if (tenant_id) {
      query += ' AND pay.tenant_id = ?';
      params.push(tenant_id);
    }
    if (property_id) {
      query += ' AND pay.property_id = ?';
      params.push(property_id);
    }
    if (from_date) {
      query += ' AND pay.payment_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      query += ' AND pay.payment_date <= ?';
      params.push(to_date);
    }
    if (status) {
      query += ' AND pay.payment_status = ?';
      params.push(status);
    }
    query += ' ORDER BY pay.created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM payments pay WHERE pay.organization_id = ?';
    const countParams = [req.user.organization_id];
    if (tenant_id) {
      countQuery += ' AND pay.tenant_id = ?';
      countParams.push(tenant_id);
    }
    if (property_id) {
      countQuery += ' AND pay.property_id = ?';
      countParams.push(property_id);
    }
    if (from_date) {
      countQuery += ' AND pay.payment_date >= ?';
      countParams.push(from_date);
    }
    if (to_date) {
      countQuery += ' AND pay.payment_date <= ?';
      countParams.push(to_date);
    }
    if (status) {
      countQuery += ' AND pay.payment_status = ?';
      countParams.push(status);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    res.json({ payments: rows, total: Number(total), page: pageNumber, pages: Math.ceil(Number(total) / pageSize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
};

const create = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      tenant_id,
      payment_method_id,
      amount_paid,
      payment_date,
      reference_number,
      notes,
    } = req.body;

    if (!tenant_id || !amount_paid || !payment_date) {
      await conn.rollback();
      return res.status(400).json({ error: 'Tenant ID, amount, and date are required.' });
    }

    const [tenants] = await conn.execute(
      'SELECT * FROM tenants WHERE id = ? AND organization_id = ? AND is_active = TRUE',
      [tenant_id, req.user.organization_id]
    );

    if (!tenants.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    if (payment_method_id) {
      const [methods] = await conn.execute(
        'SELECT id FROM payment_methods WHERE id = ? AND organization_id = ? AND is_active = TRUE',
        [payment_method_id, req.user.organization_id]
      );

      if (!methods.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Payment method not found.' });
      }
    }

    const tenant = tenants[0];
    const tenantRequiredAmount = Number(
      tenant.required_amount || (Number(tenant.monthly_rent) * Number(tenant.months_rented || 1))
    );
    const [[paymentTotals]] = await conn.execute(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_paid
       FROM payments
       WHERE tenant_id = ? AND organization_id = ?`,
      [tenant_id, req.user.organization_id]
    );
    const totalPaidBefore = Number(paymentTotals.total_paid || 0);
    const amountDue = Math.max(0, tenantRequiredAmount - totalPaidBefore);
    const amountPaid = Number(amount_paid);
    const totalPaidAfter = totalPaidBefore + amountPaid;
    const balance = Math.max(0, tenantRequiredAmount - totalPaidAfter);
    const receiptNum = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payDate = new Date(payment_date);
    const periodMonth = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`;
    const payStatus = balance === 0 ? 'paid' : 'partial';

    const [result] = await conn.execute(
      `INSERT INTO payments (
        organization_id, tenant_id, unit_id, property_id, payment_method_id, amount_due, amount_paid, balance,
        payment_date, period_month, reference_number, payment_status, recorded_by, receipt_number, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.organization_id,
        tenant_id,
        tenant.unit_id,
        tenant.property_id,
        payment_method_id || null,
        amountDue,
        amountPaid,
        balance,
        payment_date,
        periodMonth,
        reference_number || null,
        payStatus,
        req.user.id,
        receiptNum,
        notes || null,
      ]
    );

    const currentDue = new Date(tenant.next_due_date);
    const nextDue = new Date(currentDue);
    nextDue.setMonth(nextDue.getMonth() + 1);
    const nextDueStr = nextDue.toISOString().split('T')[0];
    const tenantPayStatus = balance === 0 ? 'paid' : 'partial';

    await conn.execute(
      `UPDATE tenants
       SET payment_status = ?, outstanding_balance = ?, next_due_date = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [tenantPayStatus, balance, payStatus === 'paid' ? nextDueStr : tenant.next_due_date, tenant_id, req.user.organization_id]
    );

    await conn.execute(
      `INSERT INTO notifications (organization_id, user_id, tenant_id, type, title, message)
       VALUES (?,?,?,?,?,?)`,
      [
        req.user.organization_id,
        req.user.id,
        tenant_id,
        'payment_received',
        `Payment Received - ${tenant.full_name}`,
        `TZS ${amountPaid.toLocaleString()} received from ${tenant.full_name}. ${
          balance > 0 ? `Balance due: TZS ${balance.toLocaleString()}` : 'Fully paid.'
        }`,
      ]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'CREATE_PAYMENT', 'payments', result.insertId]
    );

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      receipt_number: receiptNum,
      message: 'Payment recorded successfully.',
      balance,
      status: payStatus,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment.' });
  } finally {
    conn.release();
  }
};

const getReceipt = async (req, res) => {
  try {
    const [payments] = await pool.execute(
      `SELECT pay.*, t.full_name as tenant_name, t.phone as tenant_phone, t.national_id,
              u.unit_number, u.unit_type, p.name as property_name, p.address,
              pm.name as method_name, us.full_name as recorded_by_name
       FROM payments pay
       JOIN tenants t ON pay.tenant_id = t.id AND t.organization_id = pay.organization_id
       LEFT JOIN units u ON pay.unit_id = u.id AND u.organization_id = pay.organization_id
       LEFT JOIN properties p ON pay.property_id = p.id AND p.organization_id = pay.organization_id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
       LEFT JOIN users us ON pay.recorded_by = us.id AND us.organization_id = pay.organization_id
       WHERE pay.id = ? AND pay.organization_id = ?`,
      [req.params.id, req.user.organization_id]
    );

    if (!payments.length) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const [settingsRows] = await pool.execute(
      'SELECT setting_key, setting_value FROM settings WHERE organization_id = ?',
      [req.user.organization_id]
    );

    const settingsObj = {};
    settingsRows.forEach((setting) => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    res.json({ payment: payments[0], settings: settingsObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch receipt.' });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM payment_methods WHERE organization_id = ? AND is_active = TRUE ORDER BY name',
      [req.user.organization_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment methods.' });
  }
};

const remove = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [payments] = await conn.execute(
      'SELECT * FROM payments WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    if (!payments.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const payment = payments[0];

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, old_values) VALUES (?,?,?,?,?,?)',
      [
        req.user.organization_id,
        req.user.id,
        'DELETE_PAYMENT',
        'payments',
        payment.id,
        JSON.stringify({
          tenant_id: payment.tenant_id,
          amount_paid: payment.amount_paid,
          payment_date: payment.payment_date,
          receipt_number: payment.receipt_number,
        }),
      ]
    );

    await conn.execute(
      'DELETE FROM payments WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    await conn.commit();
    res.json({ message: 'Payment deleted successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to delete payment.' });
  } finally {
    conn.release();
  }
};

module.exports = { getAll, create, getReceipt, getPaymentMethods, remove };
