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

const buildAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: process.env.AUTH_COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 1000 * 60 * 60 * 24 * 7,
});

const buildCsrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: process.env.AUTH_COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
  secure: process.env.NODE_ENV === 'production',
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

const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

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
  createRequestId,
};
