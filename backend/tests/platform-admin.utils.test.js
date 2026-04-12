const test = require('node:test');
const assert = require('node:assert/strict');

const utilsPath = '../src/utils/platform-admin.utils';

test('DEFAULT_ADMIN_EMAIL is treated as a platform admin fallback', () => {
  const previousPlatformAdmins = process.env.PLATFORM_ADMIN_EMAILS;
  const previousDefaultAdmin = process.env.DEFAULT_ADMIN_EMAIL;

  process.env.PLATFORM_ADMIN_EMAILS = '';
  process.env.DEFAULT_ADMIN_EMAIL = 'admin@landlordpro.com';

  delete require.cache[require.resolve(utilsPath)];
  const { getPlatformAdminEmails, isPlatformAdminEmail } = require(utilsPath);

  assert.deepEqual(getPlatformAdminEmails(), ['admin@landlordpro.com']);
  assert.equal(isPlatformAdminEmail('admin@landlordpro.com'), true);

  if (previousPlatformAdmins === undefined) {
    delete process.env.PLATFORM_ADMIN_EMAILS;
  } else {
    process.env.PLATFORM_ADMIN_EMAILS = previousPlatformAdmins;
  }

  if (previousDefaultAdmin === undefined) {
    delete process.env.DEFAULT_ADMIN_EMAIL;
  } else {
    process.env.DEFAULT_ADMIN_EMAIL = previousDefaultAdmin;
  }
});

test('PLATFORM_ADMIN_EMAILS and DEFAULT_ADMIN_EMAIL are combined case-insensitively', () => {
  const previousPlatformAdmins = process.env.PLATFORM_ADMIN_EMAILS;
  const previousDefaultAdmin = process.env.DEFAULT_ADMIN_EMAIL;

  process.env.PLATFORM_ADMIN_EMAILS = 'owner@example.com, second@example.com';
  process.env.DEFAULT_ADMIN_EMAIL = 'ADMIN@LANDLORDPRO.COM';

  delete require.cache[require.resolve(utilsPath)];
  const { getPlatformAdminEmails, isPlatformAdminEmail } = require(utilsPath);

  assert.deepEqual(getPlatformAdminEmails(), [
    'owner@example.com',
    'second@example.com',
    'admin@landlordpro.com',
  ]);
  assert.equal(isPlatformAdminEmail('Admin@LandlordPro.com'), true);
  assert.equal(isPlatformAdminEmail('owner@example.com'), true);
  assert.equal(isPlatformAdminEmail('missing@example.com'), false);

  if (previousPlatformAdmins === undefined) {
    delete process.env.PLATFORM_ADMIN_EMAILS;
  } else {
    process.env.PLATFORM_ADMIN_EMAILS = previousPlatformAdmins;
  }

  if (previousDefaultAdmin === undefined) {
    delete process.env.DEFAULT_ADMIN_EMAIL;
  } else {
    process.env.DEFAULT_ADMIN_EMAIL = previousDefaultAdmin;
  }
});
