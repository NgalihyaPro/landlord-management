const { pool } = require('../database/db');

const getAll = async (req, res) => {
  try {
    const { property_id, status } = req.query;
    const params = [req.user.organization_id];

    let query = `
      SELECT u.*, p.name as property_name,
             t.id as tenant_id, t.full_name as tenant_name, t.phone as tenant_phone,
             t.payment_status, t.next_due_date
      FROM units u
      JOIN properties p ON u.property_id = p.id AND p.organization_id = u.organization_id
      LEFT JOIN tenants t
        ON t.unit_id = u.id
       AND t.is_active = TRUE
       AND t.organization_id = u.organization_id
      WHERE u.organization_id = ?
    `;

    if (property_id) {
      query += ' AND u.property_id = ?';
      params.push(property_id);
    }

    if (status) {
      query += ' AND u.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.name, u.unit_number';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch units.' });
  }
};

const getOne = async (req, res) => {
  try {
    const [units] = await pool.execute(
      `SELECT u.*, p.name as property_name,
              t.id as tenant_id, t.full_name as tenant_name, t.phone as tenant_phone,
              t.payment_status, t.next_due_date, t.lease_start, t.monthly_rent as tenant_rent
       FROM units u
       JOIN properties p ON u.property_id = p.id AND p.organization_id = u.organization_id
       LEFT JOIN tenants t
         ON t.unit_id = u.id
        AND t.is_active = TRUE
        AND t.organization_id = u.organization_id
       WHERE u.id = ? AND u.organization_id = ?`,
      [req.params.id, req.user.organization_id]
    );

    if (!units.length) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    const [payments] = await pool.execute(
      `SELECT pay.*, t.full_name as tenant_name, pm.name as method_name
       FROM payments pay
       JOIN tenants t ON pay.tenant_id = t.id AND t.organization_id = pay.organization_id
       LEFT JOIN payment_methods pm ON pay.payment_method_id = pm.id AND pm.organization_id = pay.organization_id
       WHERE pay.unit_id = ? AND pay.organization_id = ?
       ORDER BY pay.payment_date DESC
       LIMIT 12`,
      [req.params.id, req.user.organization_id]
    );

    res.json({ ...units[0], payment_history: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch unit.' });
  }
};

const create = async (req, res) => {
  try {
    const { property_id, unit_number, floor_number, unit_type, monthly_rent, deposit_amount, description } = req.body;

    if (!property_id || !unit_number || !monthly_rent) {
      return res.status(400).json({ error: 'Property, unit number, and rent amount are required.' });
    }

    const [properties] = await pool.execute(
      'SELECT id FROM properties WHERE id = ? AND organization_id = ?',
      [property_id, req.user.organization_id]
    );

    if (!properties.length) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO units (
        organization_id, property_id, unit_number, floor_number, unit_type, monthly_rent, deposit_amount, description
      ) VALUES (?,?,?,?,?,?,?,?)`,
      [
        req.user.organization_id,
        property_id,
        unit_number,
        floor_number || 1,
        unit_type || 'room',
        monthly_rent,
        deposit_amount || 0,
        description || null,
      ]
    );

    await pool.execute(
      `UPDATE properties
       SET total_units = (
         SELECT COUNT(*) FROM units WHERE property_id = ? AND organization_id = ?
       ),
       updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [property_id, req.user.organization_id, property_id, req.user.organization_id]
    );

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'CREATE_UNIT', 'units', result.insertId]
    );

    res.status(201).json({ id: result.insertId, message: 'Unit created successfully.' });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Unit number already exists in this property.' });
    }
    res.status(500).json({ error: 'Failed to create unit.' });
  }
};

const update = async (req, res) => {
  try {
    const { unit_number, floor_number, unit_type, monthly_rent, deposit_amount, status, description } = req.body;

    const [result] = await pool.execute(
      `UPDATE units
       SET unit_number = ?, floor_number = ?, unit_type = ?, monthly_rent = ?, deposit_amount = ?,
           status = ?, description = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [unit_number, floor_number, unit_type, monthly_rent, deposit_amount, status, description, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_UNIT', 'units', req.params.id]
    );

    res.json({ message: 'Unit updated successfully.' });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Unit number already exists in this property.' });
    }
    res.status(500).json({ error: 'Failed to update unit.' });
  }
};

const remove = async (req, res) => {
  try {
    const [[{ count }]] = await pool.execute(
      'SELECT COUNT(*) as count FROM tenants WHERE unit_id = ? AND organization_id = ? AND is_active = TRUE',
      [req.params.id, req.user.organization_id]
    );

    if (Number(count) > 0) {
      return res.status(400).json({ error: 'Cannot delete unit with an active tenant.' });
    }

    const [units] = await pool.execute(
      'SELECT id, property_id FROM units WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    if (!units.length) {
      return res.status(404).json({ error: 'Unit not found.' });
    }

    await pool.execute('DELETE FROM units WHERE id = ? AND organization_id = ?', [req.params.id, req.user.organization_id]);

    await pool.execute(
      `UPDATE properties
       SET total_units = (
         SELECT COUNT(*) FROM units WHERE property_id = ? AND organization_id = ?
       ),
       updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [units[0].property_id, req.user.organization_id, units[0].property_id, req.user.organization_id]
    );

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'DELETE_UNIT', 'units', req.params.id]
    );

    res.json({ message: 'Unit deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete unit.' });
  }
};

module.exports = { getAll, getOne, create, update, remove };
