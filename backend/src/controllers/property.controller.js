const { pool } = require('../database/db');

const getAll = async (req, res) => {
  try {
    const { search, status } = req.query;
    const params = [req.user.organization_id, req.user.organization_id];

    let query = `
      SELECT p.*,
             COALESCE(stats.unit_count, 0) as unit_count,
             COALESCE(stats.occupied_count, 0) as occupied_count,
             COALESCE(stats.vacant_count, 0) as vacant_count
      FROM properties p
      LEFT JOIN (
        SELECT property_id,
               COUNT(*) as unit_count,
               SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_count,
               SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant_count
        FROM units
        WHERE organization_id = ?
        GROUP BY property_id
      ) stats ON stats.property_id = p.id
      WHERE p.organization_id = ?
    `;

    if (search) {
      query += ' AND (p.name ILIKE ? OR p.address ILIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status && status !== 'all') {
      query += ' AND p.status = ?';
      params.push(status);
    } else if (!status) {
      query += " AND p.status = 'active'";
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch properties.' });
  }
};

const getOne = async (req, res) => {
  try {
    const [properties] = await pool.execute(
      'SELECT * FROM properties WHERE id = ? AND organization_id = ?',
      [req.params.id, req.user.organization_id]
    );

    if (!properties.length) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    const [units] = await pool.execute(
      `SELECT u.*,
              t.id as tenant_id, t.full_name as tenant_name, t.phone as tenant_phone,
              t.payment_status, t.next_due_date, t.monthly_rent as tenant_rent
       FROM units u
       LEFT JOIN tenants t
         ON t.unit_id = u.id
        AND t.is_active = TRUE
        AND t.organization_id = u.organization_id
       WHERE u.property_id = ? AND u.organization_id = ?
       ORDER BY u.unit_number`,
      [req.params.id, req.user.organization_id]
    );

    res.json({ ...properties[0], units });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch property.' });
  }
};

const create = async (req, res) => {
  try {
    const { name, address, city, region, country, description, total_units } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO properties (
        organization_id, owner_id, name, address, city, region, country, description, total_units
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        req.user.organization_id,
        req.user.id,
        name,
        address,
        city || null,
        region || null,
        country || 'Tanzania',
        description || null,
        total_units || 0,
      ]
    );

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'CREATE_PROPERTY', 'properties', result.insertId]
    );

    res.status(201).json({ id: result.insertId, message: 'Property created successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create property.' });
  }
};

const update = async (req, res) => {
  try {
    const { name, address, city, region, country, description, total_units, status } = req.body;

    const [result] = await pool.execute(
      `UPDATE properties
       SET name = ?, address = ?, city = ?, region = ?, country = ?, description = ?, total_units = ?,
           status = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [name, address, city, region, country, description, total_units, status, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_PROPERTY', 'properties', req.params.id]
    );

    res.json({ message: 'Property updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update property.' });
  }
};

const remove = async (req, res) => {
  try {
    const [[tenantStats]] = await pool.execute(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = TRUE) as active_tenants,
         COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_tenants
       FROM tenants
       WHERE property_id = ? AND organization_id = ?`,
      [req.params.id, req.user.organization_id]
    );

    if (Number(tenantStats.active_tenants) > 0) {
      return res.status(400).json({ error: 'Cannot delete property with active tenants. Remove or archive the tenants first.' });
    }

    const [[unitStats]] = await pool.execute(
      `SELECT COUNT(*) as count
       FROM units
       WHERE property_id = ? AND organization_id = ? AND status = 'occupied'`,
      [req.params.id, req.user.organization_id]
    );

    if (Number(unitStats.count) > 0) {
      return res.status(400).json({ error: 'Cannot delete property with occupied units.' });
    }

    const [result] = await pool.execute(
      "UPDATE properties SET status = 'inactive', updated_at = NOW() WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'DELETE_PROPERTY', 'properties', req.params.id]
    );

    res.json({ message: 'Property deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete property.' });
  }
};

module.exports = { getAll, getOne, create, update, remove };
