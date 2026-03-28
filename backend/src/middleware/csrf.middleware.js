const {
  generateCsrfToken,
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

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }

  return next();
};

module.exports = {
  issueCsrfToken,
  requireCsrf,
};
