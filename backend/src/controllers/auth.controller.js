const { pool } = require('../database/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  ensureOrganizationDefaults,
  slugifyOrganizationName,
} = require('../utils/organization.utils');
const { buildFrontendUrl } = require('../utils/frontend-url.utils');
const {
  clearAuthCookie,
  setAuthCookie,
  clearCsrfCookie,
  parseCookies,
  buildAuthCookieOptions,
} = require('../utils/auth.utils');
const { isPlatformAdminEmail } = require('../utils/platform-admin.utils');
const {
  RESET_PASSWORD_HOURS,
  createPasswordResetLink,
  sendPasswordResetEmail,
} = require('../services/email.service');
const { issueCsrfToken } = require('../middleware/csrf.middleware');

const hashInviteToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const GOOGLE_INVITE_COOKIE_NAME = process.env.GOOGLE_INVITE_COOKIE_NAME || 'landlordpro_google_invite';
const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile'];
const GOOGLE_OAUTH_TIMEOUT_MS = Number(process.env.GOOGLE_OAUTH_TIMEOUT_MS || 15000);
const PASSWORD_RESET_RESPONSE = {
  message: 'If an active account matches that email, a password reset link has been sent.',
};

const base64UrlEncode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const base64UrlDecode = (value) =>
  JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

const signPayload = (payload) =>
  crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('base64url');

const createSignedPayload = (payload) => {
  const encoded = base64UrlEncode(payload);
  return `${encoded}.${signPayload(encoded)}`;
};

const readSignedPayload = (signedValue) => {
  if (!signedValue) return null;
  const [encoded, signature] = signedValue.split('.');
  if (!encoded || !signature) return null;

  const expected = signPayload(encoded);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  const payload = base64UrlDecode(encoded);
  if (payload.exp && Date.now() > payload.exp) {
    return null;
  }

  return payload;
};

const createGoogleState = ({ mode, token }) =>
  createSignedPayload({
    mode,
    token: token || null,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: Date.now() + 10 * 60 * 1000,
  });

const getGoogleOAuthConfig = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || `${process.env.API_PUBLIC_URL?.replace(/\/api\/?$/, '') || ''}/api/auth/google/callback`;

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('Google sign-in is not configured.');
  }

  return { clientId, clientSecret, callbackUrl };
};

const getGoogleProfile = async (code) => {
  const { clientId, clientSecret, callbackUrl } = getGoogleOAuthConfig();
  const tokenController = new AbortController();
  const tokenTimeout = setTimeout(() => tokenController.abort(), GOOGLE_OAUTH_TIMEOUT_MS);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    }),
    signal: tokenController.signal,
  });
  clearTimeout(tokenTimeout);

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  }

  const tokenData = await tokenResponse.json();
  const profileController = new AbortController();
  const profileTimeout = setTimeout(() => profileController.abort(), GOOGLE_OAUTH_TIMEOUT_MS);
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    signal: profileController.signal,
  });
  clearTimeout(profileTimeout);

  if (!profileResponse.ok) {
    throw new Error(`Google profile request failed (${profileResponse.status}).`);
  }

  const profile = await profileResponse.json();
  if (!profile.email || !profile.email_verified || !profile.sub) {
    throw new Error('Google account email could not be verified.');
  }

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    fullName: profile.name || profile.email,
  };
};

const redirectWithGoogleError = (res, message, token, mode = 'login') => {
  const path = mode === 'owner_register' && token ? `/register/${token}` : mode === 'staff_setup' && token ? `/setup-account/${token}` : '/login';
  const url = buildFrontendUrl(`${path}?google_error=${encodeURIComponent(message)}`);
  return res.redirect(url);
};

const setGoogleInviteCookie = (res, payload) => {
  res.cookie(GOOGLE_INVITE_COOKIE_NAME, createSignedPayload({
    ...payload,
    exp: Date.now() + 15 * 60 * 1000,
  }), {
    ...buildAuthCookieOptions(),
    maxAge: 15 * 60 * 1000,
  });
};

const clearGoogleInviteCookie = (res) => {
  res.clearCookie(GOOGLE_INVITE_COOKIE_NAME, {
    ...buildAuthCookieOptions(),
    expires: new Date(0),
  });
};

const getGoogleInviteClaim = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return readSignedPayload(cookies[GOOGLE_INVITE_COOKIE_NAME]);
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

const getLoginUserByEmail = async (email) => {
  const [rows] = await pool.execute(
    `SELECT u.*, r.name as role_name, org.name as organization_name, org.is_active as organization_active,
            org.approval_status, org.approval_notes
     FROM users u
     JOIN roles r ON u.role_id = r.id
     JOIN organizations org ON u.organization_id = org.id
     WHERE u.email = ?`,
    [email.trim().toLowerCase()]
  );

  return rows[0] || null;
};

const assertUserCanSignIn = (user) => {
  if (!user) {
    return 'No active account is linked to this Google email.';
  }
  if (user.approval_status === 'pending') {
    return 'Your landlord account is waiting for administrator approval.';
  }
  if (user.approval_status === 'rejected') {
    return user.approval_notes
      ? `Registration was not approved: ${user.approval_notes}`
      : 'Your landlord account registration was not approved.';
  }
  if (!user.organization_active) {
    return 'This landlord account is inactive.';
  }
  if (user.invite_token_hash && !user.password_set_at && !user.google_linked_at) {
    return 'Account setup required. Use your invitation link first.';
  }
  if (!user.is_active) {
    return 'Your account is disabled. Please contact the landlord owner.';
  }

  return null;
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

const startGoogleAuth = async (req, res) => {
  try {
    const { clientId, callbackUrl } = getGoogleOAuthConfig();
    const mode = ['login', 'staff_setup', 'owner_register'].includes(req.query.mode)
      ? req.query.mode
      : 'login';
    const token = req.query.token || null;

    if ((mode === 'staff_setup' || mode === 'owner_register') && !token) {
      return res.status(400).json({ error: 'Invitation token is required for Google registration.' });
    }

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '));
    url.searchParams.set('state', createGoogleState({ mode, token }));
    url.searchParams.set('prompt', 'select_account');

    return res.redirect(url.toString());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message === 'Google sign-in is not configured.' ? error.message : 'Failed to start Google sign-in.' });
  }
};

const googleCallback = async (req, res) => {
  let mode = 'login';
  let token = null;
  try {
    const state = readSignedPayload(req.query.state);
    mode = state?.mode || 'login';
    token = state?.token || null;

    if (!state || !req.query.code) {
      return redirectWithGoogleError(res, 'Google sign-in request is invalid or expired.', token, mode);
    }

    const profile = await getGoogleProfile(req.query.code);

    if (mode === 'staff_setup') {
      const tokenHash = hashInviteToken(token);
      const [rows] = await pool.execute(
        `SELECT u.id, u.email, u.invite_expires_at, u.password_set_at, u.google_linked_at, org.is_active as organization_active
         FROM users u
         JOIN organizations org ON u.organization_id = org.id
         WHERE u.invite_token_hash = ?`,
        [tokenHash]
      );
      const invitation = rows[0];

      if (!invitation || !invitation.organization_active) {
        return redirectWithGoogleError(res, 'Invitation link is invalid.', token, mode);
      }
      if (invitation.password_set_at || invitation.google_linked_at) {
        return redirectWithGoogleError(res, 'This invitation has already been used.', token, mode);
      }
      if (!invitation.invite_expires_at || new Date(invitation.invite_expires_at) < new Date()) {
        return redirectWithGoogleError(res, 'This invitation link has expired.', token, mode);
      }
      if (profile.email !== invitation.email.trim().toLowerCase()) {
        return redirectWithGoogleError(res, 'Google email must match the invited email address.', token, mode);
      }

      await pool.execute(
        `UPDATE users
         SET is_active = TRUE, password_set_at = NOW(), google_sub = ?, google_email = ?, google_linked_at = NOW(),
             invite_token_hash = NULL, invite_expires_at = NULL, updated_at = NOW()
         WHERE id = ?`,
        [profile.sub, profile.email, invitation.id]
      );

      const user = await getUserById(invitation.id);
      setAuthCookie(res, signAuthToken(user));
      issueCsrfToken(req, res);
      return res.redirect(buildFrontendUrl('/dashboard?google_auth=success'));
    }

    if (mode === 'owner_register') {
      const invite = await getOwnerInviteByToken(hashInviteToken(token));
      if (!invite) {
        return redirectWithGoogleError(res, 'Registration invite link is invalid.', token, mode);
      }
      if (invite.used_at) {
        return redirectWithGoogleError(res, 'This registration invite has already been used.', token, mode);
      }
      if (new Date(invite.expires_at) < new Date()) {
        return redirectWithGoogleError(res, 'This registration invite has expired.', token, mode);
      }
      if (profile.email !== invite.email.trim().toLowerCase()) {
        return redirectWithGoogleError(res, 'Google email must match the invited email address.', token, mode);
      }

      setGoogleInviteCookie(res, {
        mode,
        token,
        email: profile.email,
        googleSub: profile.sub,
        fullName: profile.fullName,
      });
      return res.redirect(buildFrontendUrl(`/register/${token}?google_verified=1`));
    }

    const user = await getLoginUserByEmail(profile.email);
    const signInError = assertUserCanSignIn(user);
    if (signInError) {
      return redirectWithGoogleError(res, signInError, token, mode);
    }

    if (!user.google_sub) {
      await pool.execute(
        'UPDATE users SET google_sub = ?, google_email = ?, google_linked_at = NOW(), updated_at = NOW() WHERE id = ?',
        [profile.sub, profile.email, user.id]
      );
    } else if (user.google_sub !== profile.sub) {
      return redirectWithGoogleError(res, 'This email is already linked to a different Google account.', token, mode);
    }

    await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    setAuthCookie(res, signAuthToken({
      id: user.id,
      email: user.email,
      role: user.role_name,
      organization_id: user.organization_id,
    }));
    issueCsrfToken(req, res);
    return res.redirect(buildFrontendUrl('/dashboard?google_auth=success'));
  } catch (error) {
    console.error(error);
    return redirectWithGoogleError(res, 'Google sign-in failed. Please try again.', token, mode);
  }
};

const registerOwnerFromGoogleInvite = async (req, res) => {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const claim = getGoogleInviteClaim(req);
    if (!claim || claim.mode !== 'owner_register' || claim.token !== req.body.token) {
      await conn.rollback();
      return res.status(400).json({ error: 'Google registration verification is missing or expired.' });
    }

    const invite = await getOwnerInviteByToken(hashInviteToken(req.body.token));
    if (!invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ error: 'Registration invite link is invalid or expired.' });
    }

    const normalizedEmail = invite.email.trim().toLowerCase();
    if (claim.email !== normalizedEmail) {
      await conn.rollback();
      return res.status(400).json({ error: 'Google email must match the invited email address.' });
    }

    const {
      full_name,
      business_name,
      phone,
      business_phone,
      business_address,
    } = req.body;

    if (!full_name || !business_name) {
      await conn.rollback();
      return res.status(400).json({ error: 'Full name and business name are required.' });
    }

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

    const temporaryHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [userResult] = await conn.execute(
      `INSERT INTO users (
        organization_id, role_id, full_name, email, phone, password_hash, is_active, password_set_at,
        google_sub, google_email, google_linked_at
      ) VALUES (?, 1, ?, ?, ?, ?, TRUE, NOW(), ?, ?, NOW())`,
      [organizationResult.insertId, full_name.trim(), normalizedEmail, phone || business_phone || null, temporaryHash, claim.googleSub, claim.email]
    );

    await ensureOrganizationDefaults(conn, organizationResult.insertId, {
      business_name: business_name.trim(),
      business_phone: business_phone || phone || '',
      business_email: normalizedEmail,
      business_address: business_address || '',
    });

    await conn.execute('UPDATE owner_registration_invites SET used_at = NOW() WHERE id = ?', [invite.id]);
    await conn.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name, record_id) VALUES (?,?,?,?,?)',
      [organizationResult.insertId, userResult.insertId, 'REGISTER_OWNER_FROM_GOOGLE_INVITE', 'users', userResult.insertId]
    );

    await conn.commit();
    clearGoogleInviteCookie(res);

    const user = await getUserById(userResult.insertId);
    setAuthCookie(res, signAuthToken(user));
    issueCsrfToken(req, res);
    res.status(201).json({
      message: 'Landlord account created successfully with Google.',
      user,
    });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: 'Failed to create landlord account with Google.' });
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
    const normalizedFullName = full_name?.trim();
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!normalizedFullName) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    if (normalizedPhone && !/^\+\d{10,}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Phone number must start with + and include at least 10 digits.' });
    }

    await pool.execute(
      `UPDATE users
       SET full_name = ?, phone = ?, updated_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [normalizedFullName, normalizedPhone || null, req.user.id, req.user.organization_id]
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
  registerOwnerFromGoogleInvite,
  getOwnerInviteDetails,
  startGoogleAuth,
  googleCallback,
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
