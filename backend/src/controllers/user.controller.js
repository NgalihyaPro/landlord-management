const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { buildFrontendUrl } = require('../utils/frontend-url.utils');
const { sendStaffInviteEmail } = require('../services/email.service');

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createInviteLink = (token) => buildFrontendUrl(`/setup-account/${token}`);

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.last_login, u.created_at,
              u.password_set_at, u.invited_at, u.invite_expires_at,
              CASE WHEN u.invite_token_hash IS NOT NULL AND u.password_set_at IS NULL THEN TRUE ELSE FALSE END AS invitation_pending,
              r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.organization_id = ?
       ORDER BY u.created_at DESC`,
      [req.user.organization_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

const create = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const { full_name, email, phone, role_id } = req.body;
    if (!full_name || !email) {
      await conn.rollback();
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [roles] = await conn.execute('SELECT id, name FROM roles WHERE id = ?', [role_id || 2]);
    if (!roles.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Selected role does not exist.' });
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = hashInviteToken(inviteToken);
    const temporaryHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const setupLink = createInviteLink(inviteToken);

    const [organizationRows] = await conn.execute(
      'SELECT name FROM organizations WHERE id = ?',
      [req.user.organization_id]
    );

    const [result] = await conn.execute(
      `INSERT INTO users (
        organization_id, role_id, full_name, email, phone, password_hash, is_active, invited_by, invited_at,
        invite_token_hash, invite_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, FALSE, ?, NOW(), ?, ?)`,
      [
        req.user.organization_id,
        role_id || 2,
        full_name.trim(),
        normalizedEmail,
        phone || null,
        temporaryHash,
        req.user.id,
        inviteTokenHash,
        expiresAt.toISOString(),
      ]
    );

    await sendStaffInviteEmail({
      email: normalizedEmail,
      fullName: full_name.trim(),
      roleName: roles[0].name,
      organizationName: organizationRows[0]?.name || 'your organization',
      setupLink,
      expiresAt: expiresAt.toISOString(),
      invitedByName: req.user.full_name,
    });

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'INVITE_USER', 'users', result.insertId]
    );

    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      message: 'Invitation email sent successfully.',
      setup_link: setupLink,
      invite_expires_at: expiresAt.toISOString(),
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists.' });
    console.error(err);
    res.status(500).json({ error: err.message === 'Email delivery is not configured.' ? err.message : 'Failed to create user.' });
  } finally {
    conn.release();
  }
};

const update = async (req, res) => {
  try {
    const { full_name, phone, role_id, is_active } = req.body;
    if (Number(req.params.id) === req.user.id && !is_active) {
      return res.status(400).json({ error: 'You cannot disable your own account.' });
    }

    const [roles] = await pool.execute('SELECT id FROM roles WHERE id = ?', [role_id]);
    if (!roles.length) {
      return res.status(400).json({ error: 'Selected role does not exist.' });
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET full_name = ?, phone = ?, role_id = ?, is_active = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [full_name, phone, role_id, is_active, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_USER', 'users', req.params.id]
    );

    res.json({ message: 'User updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
};

const getRoles = async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM roles ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch roles.' });
  }
};

module.exports = { getAll, create, update, getRoles };
