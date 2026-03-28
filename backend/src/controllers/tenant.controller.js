const { pool } = require('../database/db');

const autoUpdateTenantStatuses = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const dueSoonStr = sevenDaysLater.toISOString().split('T')[0];

    await pool.execute(
      `UPDATE tenants
       SET payment_status = 'overdue', updated_at = NOW()
       WHERE is_active = TRUE
         AND next_due_date < ?
         AND payment_status NOT IN ('paid')`,
      [today]
    );

    await pool.execute(
      `UPDATE tenants
       SET payment_status = 'due_soon', updated_at = NOW()
       WHERE is_active = TRUE
         AND next_due_date BETWEEN ? AND ?
         AND payment_status = 'unpaid'`,
      [today, dueSoonStr]
    );

    console.log('Tenant statuses auto-updated');
  } catch (err) {
    console.error('Auto-update failed:', err.message);
  }
};

const getAll = async (req, res) => {
  try {
    const { search, status, property_id, page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const offset = (pageNumber - 1) * pageSize;

    let query = `
      SELECT t.*, u.unit_number, p.name as property_name,
             (CURRENT_DATE - t.next_due_date) as days_overdue
      FROM tenants t
      LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
      LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
      WHERE t.organization_id = ? AND t.is_active = TRUE
    `;
    const params = [req.user.organization_id];

    if (search) {
      query += ' AND (t.full_name ILIKE ? OR t.phone ILIKE ? OR t.national_id ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND t.payment_status = ?';
      params.push(status);
    }

    if (property_id) {
      query += ' AND t.property_id = ?';
      params.push(property_id);
    }

    query += ' ORDER BY t.full_name ASC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows] = await pool.execute(query, params);

    let countQuery = 'SELECT COUNT(*) as total FROM tenants t WHERE t.organization_id = ? AND t.is_active = TRUE';
    const countParams = [req.user.organization_id];

    if (search) {
      countQuery += ' AND (t.full_name ILIKE ? OR t.phone ILIKE ? OR t.national_id ILIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      countQuery += ' AND t.payment_status = ?';
      countParams.push(status);
    }

    if (property_id) {
      countQuery += ' AND t.property_id = ?';
      countParams.push(property_id);
    }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    res.json({ tenants: rows, total: Number(total), page: pageNumber, pages: Math.ceil(Number(total) / pageSize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenants.' });
  }
};

const getOne = async (req, res) => {
  try {
    const [tenants] = await pool.execute(
      `SELECT t.*, u.unit_number, u.unit_type, u.floor_number, p.name as property_name, p.address
       FROM tenants t
       LEFT JOIN units u ON t.unit_id = u.id AND u.organization_id = t.organization_id
       LEFT JOIN properties p ON t.property_id = p.id AND p.organization_id = t.organization_id
       WHERE t.id = ? AND t.organization_id = ?`,
      [req.params.id, req.user.organization_id]
    );

    if (!tenants.length) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const [payments] = await pool.execute(
      `SELECT pay.*, pm.name as method_name
       FROM payments pay
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
       WHERE pay.tenant_id = ? AND pay.organization_id = ?
       ORDER BY pay.payment_date DESC`,
      [req.params.id, req.user.organization_id]
    );

    res.json({ ...tenants[0], payment_history: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenant.' });
  }
};

const create = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      unit_id,
      property_id,
      full_name,
      phone,
      email,
      national_id,
      emergency_contact_name,
      emergency_contact_phone,
      lease_start,
      lease_end,
      next_due_date,
      monthly_rent,
      deposit_amount,
      deposit_paid,
      notes,
    } = req.body;

    if (!full_name || !phone || !unit_id || !property_id || !lease_start || !next_due_date || !monthly_rent) {
      await conn.rollback();
      return res.status(400).json({ error: 'Required fields missing.' });
    }

    const [units] = await conn.execute(
      `SELECT id, property_id, status
       FROM units
       WHERE id = ? AND property_id = ? AND organization_id = ?`,
      [unit_id, property_id, req.user.organization_id]
    );

    if (!units.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Unit not found.' });
    }

    if (units[0].status === 'occupied') {
      await conn.rollback();
      return res.status(400).json({ error: 'Unit is already occupied.' });
    }

    const balance = Number(monthly_rent) - Number(deposit_paid || 0);
    const [result] = await conn.execute(
      `INSERT INTO tenants (
        organization_id, unit_id, property_id, full_name, phone, email, national_id,
        emergency_contact_name, emergency_contact_phone, lease_start, lease_end, next_due_date,
        monthly_rent, deposit_amount, deposit_paid, outstanding_balance, payment_status, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.organization_id,
        unit_id,
        property_id,
        full_name,
        phone,
        email || null,
        national_id || null,
        emergency_contact_name || null,
        emergency_contact_phone || null,
        lease_start,
        lease_end || null,
        next_due_date,
        monthly_rent,
        deposit_amount || 0,
        deposit_paid || 0,
        balance > 0 ? balance : 0,
        'unpaid',
        notes || null,
      ]
    );

    await conn.execute(
      "UPDATE units SET status = 'occupied', updated_at = NOW() WHERE id = ? AND organization_id = ?",
      [unit_id, req.user.organization_id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'CREATE_TENANT', 'tenants', result.insertId]
    );

    await conn.commit();
    res.status(201).json({ id: result.insertId, message: 'Tenant added successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to add tenant.' });
  } finally {
    conn.release();
  }
};

const update = async (req, res) => {
  try {
    const {
      full_name,
      phone,
      email,
      national_id,
      emergency_contact_name,
      emergency_contact_phone,
      lease_end,
      notes,
      monthly_rent,
    } = req.body;

    const [result] = await pool.execute(
      `UPDATE tenants
       SET full_name = ?, phone = ?, email = ?, national_id = ?,
           emergency_contact_name = ?, emergency_contact_phone = ?, lease_end = ?, notes = ?,
           monthly_rent = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [
        full_name,
        phone,
        email,
        national_id,
        emergency_contact_name,
        emergency_contact_phone,
        lease_end || null,
        notes,
        monthly_rent,
        req.params.id,
        req.user.organization_id,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_TENANT', 'tenants', req.params.id]
    );

    res.json({ message: 'Tenant updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update tenant.' });
  }
};

const remove = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [tenants] = await conn.execute(
      'SELECT unit_id FROM tenants WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    if (!tenants.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    await conn.execute(
      'UPDATE tenants SET is_active = FALSE, updated_at = NOW() WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    if (tenants[0].unit_id) {
      await conn.execute(
        "UPDATE units SET status = 'vacant', updated_at = NOW() WHERE id = ? AND organization_id = ?",
        [tenants[0].unit_id, req.user.organization_id]
      );
    }

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'REMOVE_TENANT', 'tenants', req.params.id]
    );

    await conn.commit();
    res.json({ message: 'Tenant removed successfully.' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Failed to remove tenant.' });
  } finally {
    conn.release();
  }
};

module.exports = { getAll, getOne, create, update, remove, autoUpdateTenantStatuses };
