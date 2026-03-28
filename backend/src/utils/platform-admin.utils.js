const getPlatformAdminEmails = () =>
  (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const isPlatformAdminEmail = (email) =>
  Boolean(email) && getPlatformAdminEmails().includes(String(email).trim().toLowerCase());

module.exports = {
  getPlatformAdminEmails,
  isPlatformAdminEmail,
};
