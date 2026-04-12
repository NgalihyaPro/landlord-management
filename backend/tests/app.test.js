const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.DISABLE_CRON = 'true';

const { createApp } = require('../server');

const startTestServer = async () => {
  const app = createApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};

const getCsrfContext = async (server) => {
  const response = await fetch(`${server.baseUrl}/api/auth/csrf-token`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  const cookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);

  assert.ok(payload.csrf_token);
  assert.ok(cookies.some((cookie) => cookie.startsWith('landlordpro_csrf=')));

  return {
    csrfToken: payload.csrf_token,
    cookieHeader: `landlordpro_csrf=${payload.csrf_token}`,
  };
};

test('GET /health returns the lightweight Render keepalive payload', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/health`);
    assert.equal(response.status, 200);

    const payload = await response.json();
    assert.deepEqual(payload, {
      ok: true,
      service: 'alive',
    });
  } finally {
    await server.close();
  }
});

test('POST /api/auth/login rejects requests without a CSRF token', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });

    assert.equal(response.status, 403);

    const payload = await response.json();
    assert.equal(payload.error, 'Invalid CSRF token.');
  } finally {
    await server.close();
  }
});

test('POST /api/auth/login rejects invalid payload after CSRF validation passes', async () => {
  const server = await startTestServer();

  try {
    const csrf = await getCsrfContext(server);
    const response = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: csrf.cookieHeader,
        'X-CSRF-Token': csrf.csrfToken,
      },
      body: JSON.stringify({ email: 'not-an-email', password: '' }),
    });

    assert.equal(response.status, 422);

    const payload = await response.json();
    assert.equal(payload.error, 'Validation failed.');
    assert.ok(Array.isArray(payload.details));
    assert.ok(payload.details.length >= 1);
  } finally {
    await server.close();
  }
});

test('GET /api/unknown returns JSON 404 response', async () => {
  const server = await startTestServer();

  try {
    const response = await fetch(`${server.baseUrl}/api/unknown`);
    assert.equal(response.status, 404);

    const payload = await response.json();
    assert.equal(payload.error, 'Route not found.');
    assert.ok(payload.request_id);
  } finally {
    await server.close();
  }
});
