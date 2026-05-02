# LandlordPro

LandlordPro is a multi-tenant landlord management system built for real property operations. Each landlord owner gets a separate organization, staff join by invite only, and data is isolated per organization.

## Current stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, TypeScript
- Backend: Node.js, Express, PostgreSQL
- Auth: secure httpOnly session cookie + JWT signing
- Reporting/export: PDF and CSV

## Core product flow

- Platform administrator creates a secure landlord invite link
- Landlord owner opens the invite-only registration link and creates their organization
- Owner signs in and creates properties
- The setup flow moves directly from property -> unit -> tenant -> first payment
- Owner invites managers or staff with a setup link
- Staff set their password once and then sign in normally

## Local setup

### 1. Database

Create a PostgreSQL database named `landlord_db`, then run the schema:

```bash
psql -U postgres -d landlord_db -f backend/src/database/schema.sql
```

Seed only default admin (idempotent, safe to run multiple times):

```bash
cd backend
npm install
npm run seed
```

Optional full demo dataset (owner + manager + sample properties/tenants):

```bash
cd backend
npm install
npm run seed:demo
```

Credentials:

- Default admin seed (`npm run seed`): `admin@landlordpro.com` / `Admin123!`
- Demo seed (`npm run seed:demo`) also adds: `manager@landlordpro.com` / `Manager123!`

Use demo accounts only for local testing.

### 2. Backend

Create `backend/.env` from `backend/.env.example`.

Important variables:

- `PORT=5001`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DATABASE_URL` (recommended in production, alternative to DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME)
- `JWT_SECRET`
- `FRONTEND_URLS`
- `AUTH_COOKIE_SAMESITE`
- `PLATFORM_ADMIN_EMAILS`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`
- `SEED_CONTINUE_ON_ERROR`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

Run:

```bash
cd backend
npm install
npm run dev
```

Useful backend commands:

```bash
npm run check
npm test
```

API URLs:

- Health: `http://127.0.0.1:5001/api/health`
- Readiness: `http://127.0.0.1:5001/api/readiness`

### 3. Frontend

Create `frontend/.env` from `frontend/.env.example`.

For local development:

```env
VITE_API_URL=http://127.0.0.1:5001/api
```

Run:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Useful frontend commands:

```bash
npm run typecheck
npm run build
```

Local app URL:

- `http://127.0.0.1:3000`

## Production environment notes

### Backend

Required:

- `NODE_ENV=production`
- `JWT_SECRET=<long random secret>`
- `DB_HOST=<production postgres host>`
- `DB_PORT=<production postgres port>`
- `DB_USER=<production postgres user>`
- `DB_PASSWORD=<production postgres password>`
- `DB_NAME=<production postgres database>`
- `FRONTEND_URLS=https://app.yourdomain.com`

Recommended:

- `TRUST_PROXY=true` when behind Nginx, a platform proxy, or load balancer
- `DB_SSL=true` for managed PostgreSQL
- `AUTH_COOKIE_SAMESITE=none` when frontend and backend are on different domains
- `AUTH_COOKIE_SAMESITE=lax` when served from the same site

### Frontend

Set:

```env
VITE_API_URL=https://api.yourdomain.com/api
```

If your reverse proxy serves frontend and backend from one domain and forwards `/api`, you can also use:

```env
VITE_API_URL=/api
```

## Production checklist

Before deploying:

1. Create a fresh production PostgreSQL database.
2. Run `backend/src/database/schema.sql`.
3. Do not run the demo seed in production (`npm run seed:demo`).
4. Ensure default admin seed env vars are set (or accept defaults).
5. Set a strong `JWT_SECRET`.
6. Set real `FRONTEND_URLS`.
7. Build frontend with `npm run build`.
8. Verify backend with `npm run check` and `npm test`.
9. Verify frontend with `npm run typecheck` and `npm run build`.
10. Confirm `/api/health` and `/api/readiness` return success.

## Deploying

### Backend

```bash
cd backend
npm install
npm run check
npm test
npm run build
npm start
```

### Coolify backend commands

Build Command:

```bash
npm ci && npm run build
```

Start Command:

```bash
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run typecheck
npm run build
```

Deploy the built frontend to your static host or Node-based frontend host depending on your platform.

## Admin usage notes

- Open public landlord registration is disabled by default.
- Platform administrators should generate landlord invite links and send them privately.
- Platform administrators can send landlord invite emails directly from `/admin/approvals`.
- Staff should not self-register.
- Staff should be invited from the Users page after owner login.
- Use the setup link to let staff create their own password.
- Users can reset their password from `/forgot-password`.
- Owners can disable staff access from the Users page.
- Platform administrators can create landlord invite links and manage approvals at `/admin/approvals`.

## Monitoring readiness

The backend exposes:

- `GET /api/health` for liveness
- `GET /api/readiness` for readiness and database connectivity

Each API response includes an `X-Request-Id` header to help trace production errors in logs.
