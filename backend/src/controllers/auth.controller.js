const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  ensureOrganizationDefaults,
  slugifyOrganizationName,
} = require('../utils/organization.utils');
const {
  clearAuthCookie,
  setAuthCookie,
  clearCsrfCookie,
} = require('../utils/auth.utils');
const { isPlatformAdminEmail } = require('../utils/platform-admin.utils');
const {
  RESET_PASSWORD_HOURS,
  createPasswordResetLink,
  sendPasswordResetEmail,
} = require('../services/email.service');
const { issueCsrfToken } = require('../middleware/csrf.middleware');

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const PASSWORD_RESET_RESPONSE = {
  message: 'If an active account matches that email, a password reset link has been sent.',
};

const signAuthToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const getRoleNameById = async (roleId) => {
  const [roles] = await pool.execute('SELECT name FROM roles WHERE id = ?', [roleId]);
  return roles[0]?.name || 'manager';
};

const getUserById = async (userId) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.organization_id, u.full_name, u.email, u.phone, u.avatar,
            r.name as role, org.name as organization_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     JOIN organizations org ON u.organization_id = org.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!rows[0]) return null;

  return {
    ...rows[0],
    is_platform_admin: isPlatformAdminEmail(rows[0].email),
  };
};

const getOwnerInviteByToken = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT id, email, full_name, expires_at, used_at, invited_by_email
     FROM owner_registration_invites
     WHERE invite_token_hash = ?`,
    [tokenHash]
  );

  return rows[0];
};

const getPasswordResetByToken = async (tokenHash) => {
  const [rows] = await pool.execute(
    `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
            u.full_name, u.email, u.organization_id, u.is_active,
            org.name as organization_name, org.is_active as organization_active, org.approval_status
     FROM password_reset_tokens prt
     JOIN users u ON prt.user_id = u.id
     JOIN organizations org ON u.organization_id = org.id
     WHERE prt.token_hash = ?`,
    [tokenHash]
  );

  return rows[0];
};

const registerOwner = async (req, res) => {
  if (process.env.PUBLIC_OWNER_REGISTRATION_ENABLED !== 'true') {
    return res.status(403).json({
      error: 'Public landlord registration is disabled. Use a secure registration invite link from the platform administrator.',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      full_name,
      email,
      password,
      business_name,
      phone,
      business_phone,
      business_address,
    } = req.body;

    if (!full_name || !email || !password || !business_name) {
      await conn.rollback();
      return res.status(400).json({ error: 'Full name, business name, email, and password are required.' });
    }

    if (password.length < 8) {
      await conn.rollback();
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const slugBase = slugifyOrganizationName(business_name);
    const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

    const [organizationResult] = await conn.execute(
      `INSERT INTO organizations (name, slug, owner_email, phone, address, is_active, approval_status)
       VALUES (?, ?, ?, ?, ?, FALSE, 'pending')`,
      [business_name.trim(), slug, normalizedEmail, business_phone || phone || null, business_address || null]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute(
      `INSERT INTO users (
        organization_id, role_id, full_name, email, phone, password_hash, is_active, password_set_at
      ) VALUES (?, 1, ?, ?, ?, ?, FALSE, NOW())`,
      [organizationResult.insertId, full_name.trim(), normalizedEmail, phone || business_phone || null, passwordHash]
    );

    await ensureOrganizationDefaults(conn, organizationResult.insertId, {
      business_name: business_name.trim(),
      business_phone: business_phone || phone || '',
      business_email: normalizedEmail,
      business_address: business_address || '',
    });

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [organizationResult.insertId, userResult.insertId, 'REGISTER_OWNER', 'users', userResult.insertId]
    );

    await conn.commit();
    res.status(201).json({
      message: 'Registration submitted successfully. A platform administrator must approve your landlord account before you can sign in.',
      approval_status: 'pending',
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === '23505') {
      if (err.constraint === 'users_email_key') {
        return res.status(400).json({ error: 'An account with that email already exists.' });
      }
      if (err.constraint === 'organizations_slug_key') {
        return res.status(400).json({ error: 'That business name is temporarily unavailable. Please try again.' });
      }
      return res.status(400).json({ error: 'This landlord account could not be created because some details already exist.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  } finally {
    conn.release();
  }
};

const getOwnerInviteDetails = async (req, res) => {
  try {
    const invite = await getOwnerInviteByToken(hashInviteToken(req.params.token));

    if (!invite) {
      return res.status(404).json({ error: 'Registration invite link is invalid.' });
    }

    if (invite.used_at) {
      return res.status(400).json({ error: 'This registration invite has already been used.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This registration invite has expired.' });
    }

    res.json({
      email: invite.email,
      full_name: invite.full_name,
      expires_at: invite.expires_at,
      invited_by_email: invite.invited_by_email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to validate registration invite.' });
  }
};

const registerOwnerFromInvite = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const invite = await getOwnerInviteByToken(hashInviteToken(req.body.token));
    if (!invite) {
      await conn.rollback();
      return res.status(404).json({ error: 'Registration invite link is invalid.' });
    }

    if (invite.used_at) {
      await conn.rollback();
      return res.status(400).json({ error: 'This registration invite has already been used.' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ error: 'This registration invite has expired.' });
    }

    const {
      full_name,
      password,
      business_name,
      phone,
      business_phone,
      business_address,
    } = req.body;

    const normalizedEmail = invite.email.trim().toLowerCase();
    const slugBase = slugifyOrganizationName(business_name);
    const slug = `${slugBase}-${Date.now().toString().slice(-6)}`;

    const [organizationResult] = await conn.execute(
      `INSERT INTO organizations (
        name, slug, owner_email, phone, address, is_active, approval_status, approved_at, approved_by_email
      ) VALUES (?, ?, ?, ?, ?, TRUE, 'approved', NOW(), ?)`,
      [
        business_name.trim(),
        slug,
        normalizedEmail,
        business_phone || phone || null,
        business_address || null,
        invite.invited_by_email || 'platform-admin',
      ]
    );

    const passwordHash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute(
      `INSERT INTO users (
        organization_id, role_id, full_name, email, phone, password_hash, is_active, password_set_at
      ) VALUES (?, 1, ?, ?, ?, ?, TRUE, NOW())`,
      [organizationResult.insertId, full_name.trim(), normalizedEmail, phone || business_phone || null, passwordHash]
    );

    await ensureOrganizationDefaults(conn, organizationResult.insertId, {
      business_name: business_name.trim(),
      business_phone: business_phone || phone || '',
      business_email: normalizedEmail,
      business_address: business_address || '',
    });

    await conn.execute(
      'UPDATE owner_registration_invites SET used_at = NOW() WHERE id = ?',
      [invite.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [organizationResult.insertId, userResult.insertId, 'REGISTER_OWNER_FROM_INVITE', 'users', userResult.insertId]
    );

    await conn.commit();

    const user = await getUserById(userResult.insertId);
    setAuthCookie(res, signAuthToken(user));
    issueCsrfToken(req, res);
    res.status(201).json({
      message: 'Landlord account created successfully.',
      user,
    });
  } catch (error) {
    await conn.rollback();
    if (error.code === '23505') {
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({ error: 'An account with that email already exists.' });
      }
      if (error.constraint === 'organizations_slug_key') {
        return res.status(400).json({ error: 'That business name is temporarily unavailable. Please try again.' });
      }
    }

    console.error(error);
    res.status(500).json({ error: 'Failed to create landlord account from invite.' });
  } finally {
    conn.release();
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [rows] = await pool.execute(
      `SELECT u.*, r.name as role_name, org.name as organization_name, org.is_active as organization_active,
              org.approval_status, org.approval_notes
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN organizations org ON u.organization_id = org.id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    if (user.approval_status === 'pending') {
      return res.status(403).json({ error: 'Your landlord account is waiting for administrator approval.' });
    }
    if (user.approval_status === 'rejected') {
      return res.status(403).json({
        error: user.approval_notes
          ? `Registration was not approved: ${user.approval_notes}`
          : 'Your landlord account registration was not approved.',
      });
    }
    if (!user.organization_active) {
      return res.status(403).json({ error: 'This landlord account is inactive.' });
    }
    if (user.invite_token_hash && !user.password_set_at) {
      return res.status(403).json({ error: 'Account setup required. Use your invitation link to set a password first.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account is disabled. Please contact the landlord owner.' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    setAuthCookie(res, signAuthToken({
      id: user.id,
      email: user.email,
      role: user.role_name,
      organization_id: user.organization_id,
    }));
    issueCsrfToken(req, res);
    res.json({
      user: {
        id: user.id,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role_name,
        avatar: user.avatar,
        is_platform_admin: isPlatformAdminEmail(user.email),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
};

const getCsrfToken = async (req, res) => {
  const csrfToken = issueCsrfToken(req, res);
  res.json({ csrf_token: csrfToken });
};

const forgotPassword = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const normalizedEmail = req.body.email.trim().toLowerCase();
    const [rows] = await conn.execute(
      `SELECT u.id, u.organization_id, u.full_name, u.email, u.is_active, u.password_set_at,
              org.is_active as organization_active, org.approval_status
       FROM users u
       JOIN organizations org ON u.organization_id = org.id
       WHERE u.email = ?
       LIMIT 1`,
      [normalizedEmail]
    );

    const user = rows[0];
    const canSendReset =
      user &&
      user.is_active &&
      user.organization_active &&
      user.approval_status === 'approved' &&
      (!user.password_set_at ? false : true);

    if (!canSendReset) {
      await conn.rollback();
      return res.json(PASSWORD_RESET_RESPONSE);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashInviteToken(resetToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * RESET_PASSWORD_HOURS);
    const resetLink = createPasswordResetLink(resetToken);

    await conn.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    await conn.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, expiresAt.toISOString()]
    );

    await sendPasswordResetEmail({
      email: user.email,
      fullName: user.full_name,
      resetLink,
      expiresAt: expiresAt.toISOString(),
    });

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [user.organization_id, user.id, 'REQUEST_PASSWORD_RESET', 'users', user.id]
    );

    await conn.commit();

    res.json({
      ...PASSWORD_RESET_RESPONSE,
      reset_link: process.env.NODE_ENV === 'production' ? undefined : resetLink,
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: error.message === 'Email delivery is not configured.' ? error.message : 'Failed to start password reset.' });
  } finally {
    conn.release();
  }
};

const getResetPasswordDetails = async (req, res) => {
  try {
    const reset = await getPasswordResetByToken(hashInviteToken(req.params.token));

    if (!reset || reset.used_at) {
      return res.status(404).json({ error: 'Password reset link is invalid.' });
    }

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This password reset link has expired.' });
    }

    if (!reset.organization_active || reset.approval_status !== 'approved' || !reset.is_active) {
      return res.status(400).json({ error: 'This account is not currently allowed to reset its password.' });
    }

    res.json({
      email: reset.email,
      full_name: reset.full_name,
      organization_name: reset.organization_name,
      expires_at: reset.expires_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to validate password reset link.' });
  }
};

const resetPassword = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const reset = await getPasswordResetByToken(hashInviteToken(req.body.token));

    if (!reset || reset.used_at) {
      await conn.rollback();
      return res.status(404).json({ error: 'Password reset link is invalid.' });
    }

    if (new Date(reset.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ error: 'This password reset link has expired.' });
    }

    if (!reset.organization_active || reset.approval_status !== 'approved' || !reset.is_active) {
      await conn.rollback();
      return res.status(400).json({ error: 'This account is not currently allowed to reset its password.' });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 10);

    await conn.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [passwordHash, reset.user_id]
    );

    await conn.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?',
      [reset.id]
    );

    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [reset.organization_id, reset.user_id, 'RESET_PASSWORD', 'users', reset.user_id]
    );

    await conn.commit();

    res.json({ message: 'Password reset successfully. You can sign in now.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to reset password.' });
  } finally {
    conn.release();
  }
};

const getMe = async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
};

const getInvitationDetails = async (req, res) => {
  try {
    const tokenHash = hashInviteToken(req.params.token);
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.password_set_at,
              u.invite_expires_at, r.name as role, org.name as organization_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN organizations org ON u.organization_id = org.id
       WHERE u.invite_token_hash = ? AND org.is_active = TRUE`,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invitation link is invalid.' });
    }

    const invitation = rows[0];
    if (invitation.password_set_at) {
      return res.status(400).json({ error: 'This invitation has already been used.' });
    }
    if (!invitation.invite_expires_at || new Date(invitation.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invitation link has expired.' });
    }

    res.json({
      full_name: invitation.full_name,
      email: invitation.email,
      phone: invitation.phone,
      role: invitation.role,
      organization_name: invitation.organization_name,
      invite_expires_at: invitation.invite_expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate invitation.' });
  }
};

const setupAccount = async (req, res) => {
  try {
    const { token, password, full_name, phone } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Invitation token and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const tokenHash = hashInviteToken(token);
    const [rows] = await pool.execute(
      `SELECT id, organization_id, role_id, email, invite_expires_at, password_set_at
       FROM users
       WHERE invite_token_hash = ?`,
      [tokenHash]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invitation link is invalid.' });
    }

    const user = rows[0];
    if (user.password_set_at) {
      return res.status(400).json({ error: 'This invitation has already been used.' });
    }
    if (!user.invite_expires_at || new Date(user.invite_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invitation link has expired.' });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.execute(
      `UPDATE users
       SET password_hash = ?, full_name = COALESCE(?, full_name), phone = COALESCE(?, phone),
           is_active = TRUE, password_set_at = NOW(), invite_token_hash = NULL, invite_expires_at = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [hash, full_name || null, phone || null, user.id]
    );

    const role = await getRoleNameById(user.role_id);
    const createdUser = await getUserById(user.id);
    setAuthCookie(res, signAuthToken({
      id: user.id,
      email: user.email,
      role,
      organization_id: user.organization_id,
    }));
    issueCsrfToken(req, res);

    res.json({
      message: 'Account setup completed successfully.',
      user: createdUser,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete account setup.' });
  }
};

const logout = async (req, res) => {
  clearAuthCookie(res);
  clearCsrfCookie(res);
  res.json({ message: 'Signed out successfully.' });
};

const updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;

    await pool.execute(
      `UPDATE users
       SET full_name = ?, phone = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [full_name.trim(), phone || null, req.user.id, req.user.organization_id]
    );

    const user = await getUserById(req.user.id);

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_PROFILE', 'users', req.user.id]
    );

    res.json({
      message: 'Profile updated successfully.',
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ? AND organization_id = ?',
      [req.user.id, req.user.organization_id]
    );

    const isValid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ? AND organization_id = ?', [hash, req.user.id, req.user.organization_id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
};

module.exports = {
  registerOwner,
  registerOwnerFromInvite,
  getOwnerInviteDetails,
  getCsrfToken,
  login,
  forgotPassword,
  getResetPasswordDetails,
  resetPassword,
  logout,
  updateProfile,
  getMe,
  getInvitationDetails,
  setupAccount,
  changePassword,
};
