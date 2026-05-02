const getPrimaryFrontendUrl = () =>
  (
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_URLS ||
    'http://localhost:5173'
  )
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || 'http://localhost:5173';

const buildFrontendUrl = (path) => {
  const baseUrl = getPrimaryFrontendUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

module.exports = {
  getPrimaryFrontendUrl,
  buildFrontendUrl,
};
