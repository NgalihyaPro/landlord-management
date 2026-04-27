const {
  generateCsrfToken,
  validateCsrfToken,
  getCsrfTokenFromRequest,
  setCsrfCookie,
} = require('../utils/auth.utils');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const issueCsrfToken = (req, res) => {
  const existingToken = getCsrfTokenFromRequest(req);
  const csrfToken = existingToken || generateCsrfToken();

  if (!existingToken) {
    setCsrfCookie(res, csrfToken);
  }

  return csrfToken;
};

const requireCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    issueCsrfToken(req, res);
    return next();
  }

  const cookieToken = getCsrfTokenFromRequest(req);
  const headerToken = req.headers['x-csrf-token'];

  if (!headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  if (cookieToken) {
    // Same-origin / cookie available: double-submit cookie check
    if (cookieToken !== headerToken) {
      return res.status(403).json({ error: 'Invalid CSRF token.' });
    }
  } else {
    // Cross-origin (cookie blocked by browser): validate HMAC signature
    if (!validateCsrfToken(headerToken)) {
      return res.status(403).json({ error: 'Invalid CSRF token.' });
    }
  }

  return next();
};

module.exports = {
  issueCsrfToken,
  requireCsrf,
};
