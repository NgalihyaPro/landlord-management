const { pool } = require('../database/db');
const crypto = require('crypto');
const { buildFrontendUrl } = require('../utils/frontend-url.utils');
const { sendOwnerInviteEmail } = require('../services/email.service');

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createOwnerRegistrationLink = (token) => buildFrontendUrl(`/register/${token}`);

const createOwnerInvite = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenHash = hashInviteToken(inviteToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    const inviteLink = createOwnerRegistrationLink(inviteToken);

    await conn.execute(
      `INSERT INTO owner_registration_invites (
        email, full_name, invite_token_hash, invited_by_user_id, invited_by_email, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.body.email,
        req.body.full_name || null,
        inviteTokenHash,
        req.user.id,
        req.user.email,
        expiresAt.toISOString(),
      ]
    );

    await sendOwnerInviteEmail({
      email: req.body.email,
      fullName: req.body.full_name || null,
      inviteLink,
      expiresAt: expiresAt.toISOString(),
      invitedByEmail: req.user.email,
    });

    await conn.commit();

    res.status(201).json({
      message: 'Owner registration email sent successfully.',
      invite_link: inviteLink,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A registration invite with that token already exists. Please try again.' });
    }

    res.status(500).json({ error: error.message === 'Email delivery is not configured.' ? error.message : 'Failed to create owner registration invite.' });
  } finally {
    conn.release();
  }
};

const getRegistrations = async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const params = [];
    let whereClause = '';

    if (status && status !== 'all') {
      whereClause = 'WHERE org.approval_status = ?';
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT org.id, org.name, org.slug, org.owner_email, org.phone, org.address, org.is_active,
              org.approval_status, org.approved_at, org.approved_by_email, org.approval_notes, org.created_at,
              owner.id as owner_user_id, owner.full_name as owner_name, owner.email as owner_login_email, owner.phone as owner_phone
       FROM organizations org
       LEFT JOIN users owner
         ON owner.organization_id = org.id
        AND owner.role_id = 1
       ${whereClause}
       ORDER BY
         CASE org.approval_status
           WHEN 'pending' THEN 0
           WHEN 'rejected' THEN 1
           ELSE 2
         END,
         org.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load landlord registrations.' });
  }
};

const getOrganizationById = async (conn, organizationId) => {
  const [organizations] = await conn.execute(
    'SELECT id, name, owner_email, is_active, approval_status FROM organizations WHERE id = ?',
    [organizationId]
  );

  return organizations[0] || null;
};

const approveRegistration = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const organization = await getOrganizationById(conn, req.params.id);

    if (!organization) {
      await conn.rollback();
      return res.status(404).json({ error: 'Registration not found.' });
    }

    await conn.execute(
      `UPDATE organizations
       SET is_active = TRUE,
           approval_status = 'approved',
           approved_at = NOW(),
           approved_by_email = ?,
           approval_notes = COALESCE(?, approval_notes),
           updated_at = NOW()
       WHERE id = ?`,
      [req.user.email, req.body.notes || null, req.params.id]
    );

    await conn.execute(
      'UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE organization_id = ? AND role_id = 1',
      [req.params.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, new_values) VALUES (?,?,?,?,?,?)',
      [
        req.params.id,
        req.user.id,
        'APPROVE_ORGANIZATION_REGISTRATION',
        'organizations',
        req.params.id,
        JSON.stringify({ approved_by_email: req.user.email, notes: req.body.notes || null }),
      ]
    );

    await conn.commit();
    res.json({ message: 'Landlord registration approved successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to approve landlord registration.' });
  } finally {
    conn.release();
  }
};

const rejectRegistration = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const organization = await getOrganizationById(conn, req.params.id);

    if (!organization) {
      await conn.rollback();
      return res.status(404).json({ error: 'Registration not found.' });
    }

    await conn.execute(
      `UPDATE organizations
       SET is_active = FALSE,
           approval_status = 'rejected',
           approved_at = NULL,
           approved_by_email = ?,
           approval_notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [req.user.email, req.body.notes || null, req.params.id]
    );

    await conn.execute(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE organization_id = ? AND role_id = 1',
      [req.params.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, new_values) VALUES (?,?,?,?,?,?)',
      [
        req.params.id,
        req.user.id,
        'REJECT_ORGANIZATION_REGISTRATION',
        'organizations',
        req.params.id,
        JSON.stringify({ approved_by_email: req.user.email, notes: req.body.notes || null }),
      ]
    );

    await conn.commit();
    res.json({ message: 'Landlord registration rejected.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to reject landlord registration.' });
  } finally {
    conn.release();
  }
};

const restrictRegistration = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const organization = await getOrganizationById(conn, req.params.id);

    if (!organization) {
      await conn.rollback();
      return res.status(404).json({ error: 'Landlord account not found.' });
    }

    if (organization.approval_status !== 'approved') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only approved landlord accounts can be restricted.' });
    }

    if (!organization.is_active) {
      await conn.rollback();
      return res.status(400).json({ error: 'This landlord account is already restricted.' });
    }

    await conn.execute(
      `UPDATE organizations
       SET is_active = FALSE,
           approval_notes = COALESCE(?, approval_notes),
           updated_at = NOW()
       WHERE id = ?`,
      [req.body.notes || null, req.params.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, new_values) VALUES (?,?,?,?,?,?)',
      [
        req.params.id,
        req.user.id,
        'RESTRICT_ORGANIZATION_ACCESS',
        'organizations',
        req.params.id,
        JSON.stringify({ restricted_by_email: req.user.email, notes: req.body.notes || null }),
      ]
    );

    await conn.commit();
    res.json({ message: 'Landlord account access has been restricted.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to restrict landlord account access.' });
  } finally {
    conn.release();
  }
};

const restoreRegistration = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const organization = await getOrganizationById(conn, req.params.id);

    if (!organization) {
      await conn.rollback();
      return res.status(404).json({ error: 'Landlord account not found.' });
    }

    if (organization.approval_status !== 'approved') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only approved landlord accounts can be restored.' });
    }

    if (organization.is_active) {
      await conn.rollback();
      return res.status(400).json({ error: 'This landlord account is already active.' });
    }

    await conn.execute(
      `UPDATE organizations
       SET is_active = TRUE,
           approval_notes = COALESCE(?, approval_notes),
           updated_at = NOW()
       WHERE id = ?`,
      [req.body.notes || null, req.params.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, new_values) VALUES (?,?,?,?,?,?)',
      [
        req.params.id,
        req.user.id,
        'RESTORE_ORGANIZATION_ACCESS',
        'organizations',
        req.params.id,
        JSON.stringify({ restored_by_email: req.user.email, notes: req.body.notes || null }),
      ]
    );

    await conn.commit();
    res.json({ message: 'Landlord account access has been restored.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to restore landlord account access.' });
  } finally {
    conn.release();
  }
};

const deleteRegistration = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const organization = await getOrganizationById(conn, req.params.id);

    if (!organization) {
      await conn.rollback();
      return res.status(404).json({ error: 'Landlord account not found.' });
    }

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id, old_values) VALUES (?,?,?,?,?,?)',
      [
        null,
        req.user.id,
        'DELETE_ORGANIZATION_ACCOUNT',
        'organizations',
        req.params.id,
        JSON.stringify({
          name: organization.name,
          owner_email: organization.owner_email,
          approval_status: organization.approval_status,
          was_active: organization.is_active,
          deleted_by_email: req.user.email,
        }),
      ]
    );

    await conn.execute('DELETE FROM organizations WHERE id = ?', [req.params.id]);

    await conn.commit();
    res.json({ message: 'Landlord account deleted permanently.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to delete landlord account.' });
  } finally {
    conn.release();
  }
};

module.exports = {
  createOwnerInvite,
  getRegistrations,
  approveRegistration,
  rejectRegistration,
  restrictRegistration,
  restoreRegistration,
  deleteRegistration,
};
