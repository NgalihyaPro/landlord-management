const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');
const { getTokenFromRequest } = require('../utils/auth.utils');
const { isPlatformAdminEmail } = require('../utils/platform-admin.utils');

const authenticate = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      `SELECT u.id, u.organization_id, u.full_name, u.email, u.role_id, r.name as role_name,
              u.is_active, org.name as organization_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN organizations org ON u.organization_id = org.id
       WHERE u.id = ? AND org.is_active = TRUE`,
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Invalid or deactivated account.' });
    }

    req.user = {
      ...rows[0],
      is_platform_admin: isPlatformAdminEmail(rows[0].email),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role_name)) {
    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  }
  next();
};

const isAdmin = authorize('admin');
const isAdminOrManager = authorize('admin', 'manager');
const isPlatformAdmin = (req, res, next) => {
  if (!req.user?.is_platform_admin) {
    return res.status(403).json({ error: 'Access denied. Platform administrator approval required.' });
  }
  next();
};

module.exports = { authenticate, authorize, isAdmin, isAdminOrManager, isPlatformAdmin };
