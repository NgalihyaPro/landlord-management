const getPrimaryFrontendUrl = () =>
  (
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_URLS ||
    'http://127.0.0.1:3000'
  )
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || 'http://127.0.0.1:3000';

const buildFrontendUrl = (path) => {
  const baseUrl = getPrimaryFrontendUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

module.exports = {
  getPrimaryFrontendUrl,
  buildFrontendUrl,
};
