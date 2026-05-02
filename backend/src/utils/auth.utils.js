const crypto = require('crypto');

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'landlordpro_token';
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE_NAME || 'landlordpro_csrf';

const parseCookies = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;

      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[AUTH_COOKIE_NAME] || null;
};

// Cross-origin production cookies require SameSite=None and Secure.
// SameSite=Lax is friendlier for local development and same-site deployments.
const IS_DEPLOYED = process.env.NODE_ENV === 'production';

const buildAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.AUTH_COOKIE_SAMESITE || (IS_DEPLOYED ? 'none' : 'lax'),
  secure: IS_DEPLOYED,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
});

const buildCsrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: process.env.AUTH_COOKIE_SAMESITE || (IS_DEPLOYED ? 'none' : 'lax'),
  secure: IS_DEPLOYED,
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
});

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...buildAuthCookieOptions(),
    expires: new Date(0),
  });
};

const setCsrfCookie = (res, token) => {
  res.cookie(CSRF_COOKIE_NAME, token, buildCsrfCookieOptions());
};

const clearCsrfCookie = (res) => {
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...buildCsrfCookieOptions(),
    expires: new Date(0),
  });
};

const getCsrfTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[CSRF_COOKIE_NAME] || null;
};

const generateCsrfToken = () => {
  const random = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now().toString(36);
  const payload = `${random}.${timestamp}`;
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
};

const validateCsrfToken = (token) => {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [random, timestamp, sig] = parts;
  const payload = `${random}.${timestamp}`;
  const expected = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
      return false;
    }
  } catch {
    return false;
  }
  const issuedAt = parseInt(timestamp, 36);
  return Date.now() - issuedAt < 7 * 24 * 60 * 60 * 1000;
};

const createRequestId = () => crypto.randomUUID();

module.exports = {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  parseCookies,
  getTokenFromRequest,
  getCsrfTokenFromRequest,
  buildAuthCookieOptions,
  buildCsrfCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  setCsrfCookie,
  clearCsrfCookie,
  generateCsrfToken,
  validateCsrfToken,
  createRequestId,
};
