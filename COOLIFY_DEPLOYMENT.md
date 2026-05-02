# Coolify Deployment Guide

This repository is a monorepo:

- Backend: Node.js / Express API with PostgreSQL, in `backend`
- Frontend: React / Vite static app, in `frontend`
- Database: PostgreSQL

Deploy the database, backend, and frontend as three separate Coolify resources.

## Recommended Domains

- Frontend: `https://landlordpro.co.tz`
- Frontend alias: `https://www.landlordpro.co.tz`
- Backend API: `https://api.landlordpro.co.tz`

## 1. Create PostgreSQL In Coolify

1. Create a new PostgreSQL database resource in Coolify.
2. Choose a persistent volume.
3. Copy the internal connection string from Coolify.
4. Use that value as the backend `DATABASE_URL`.

Use the internal Coolify database URL for backend-to-database traffic when the backend is on the same Coolify server/network.

## 2. Deploy Backend API

Create a new application resource.

- Resource name: `landlordpro-backend`
- Build pack: `Nixpacks`
- Base directory: `backend`
- Port: `3000`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Domain: `https://api.landlordpro.co.tz`

Backend environment variables:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
API_PUBLIC_URL=https://api.landlordpro.co.tz/api
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
DB_SSL=false
FRONTEND_URL=https://landlordpro.co.tz
FRONTEND_URLS=https://landlordpro.co.tz,https://www.landlordpro.co.tz,http://localhost:5173,http://localhost:3000
JWT_SECRET=replace_with_a_long_random_secret
SESSION_SECRET=replace_with_a_long_random_session_secret
AUTH_COOKIE_SAMESITE=none
TRUST_PROXY=true
PLATFORM_ADMIN_EMAILS=admin@landlordpro.co.tz
EMAIL_DELIVERY_REQUIRED=true
DEFAULT_ADMIN_EMAIL=admin@landlordpro.co.tz
DEFAULT_ADMIN_PASSWORD=change_this_before_seeding
DEFAULT_ADMIN_NAME=System Admin
DEFAULT_ORG_NAME=LandlordPro
DEFAULT_ORG_SLUG=landlordpro-default
SEED_CONTINUE_ON_ERROR=true
```

Add email/SMS variables only when those services are ready:

```env
ZEPTO_API_TOKEN=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=invites@landlordpro.co.tz
BEEM_API_KEY=
BEEM_SECRET_KEY=
BEEM_SENDER_ID=LandlordPro
```

After the first successful backend deployment, open the backend resource terminal and run:

```bash
npm run deploy:migrate
npm run deploy:seed
```

Do not run `npm run seed:demo` in production.

Health checks:

- `https://api.landlordpro.co.tz/api/health`
- `https://api.landlordpro.co.tz/api/readiness`

## 3. Deploy Frontend

Create a second application resource.

- Resource name: `landlordpro-frontend`
- Build pack: `Nixpacks`
- Base directory: `frontend`
- Port: `3000`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Domain: `https://landlordpro.co.tz`
- Additional domain: `https://www.landlordpro.co.tz`

Frontend environment variables:

```env
VITE_API_URL=https://api.landlordpro.co.tz/api
```

The frontend build bakes `VITE_API_URL` into the static assets. If you change the API URL, rebuild and redeploy the frontend.

## 4. Local Development

Backend:

```bash
cd backend
npm install
npm run migrate
npm run seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Local frontend defaults to `http://localhost:5173`. Local backend can run on any `PORT`, but `3000` is the production default for Coolify.

## 5. Troubleshooting

- Backend fails immediately: confirm `JWT_SECRET`, `DATABASE_URL`, and `PORT` are set.
- Database readiness fails: confirm the Coolify internal PostgreSQL URL, database credentials, and `DB_SSL=false`.
- Login works but cookies are missing: confirm backend is HTTPS, `AUTH_COOKIE_SAMESITE=none`, `TRUST_PROXY=true`, and frontend domains are in `FRONTEND_URLS`.
- CORS blocked: add the exact frontend origin to `FRONTEND_URLS`, with no path after the domain.
- Frontend calls the wrong API: confirm `VITE_API_URL` and redeploy the frontend.
- Schema errors: run `npm run deploy:migrate` from the backend resource terminal.
- Missing admin account: set `DEFAULT_ADMIN_*` variables and run `npm run deploy:seed`.

Dockerfiles are not required for this project. Nixpacks is suitable because both apps are standard Node.js applications with clear install, build, and start commands.
