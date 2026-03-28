require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const { pool, testConnection } = require('./src/database/db');
const { createRequestId } = require('./src/utils/auth.utils');
const { requireCsrf } = require('./src/middleware/csrf.middleware');

const authRoutes = require('./src/routes/auth.routes');
const propertyRoutes = require('./src/routes/property.routes');
const unitRoutes = require('./src/routes/unit.routes');
const tenantRoutes = require('./src/routes/tenant.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const reportRoutes = require('./src/routes/report.routes');
const notificationRoutes = require('./src/routes/notification.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const userRoutes = require('./src/routes/user.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const platformAdminRoutes = require('./src/routes/platform-admin.routes');
const { autoUpdateTenantStatuses } = require('./src/controllers/tenant.controller');

const PORT = Number(process.env.PORT || 5000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Missing required environment variable: JWT_SECRET');
}

if (IS_PRODUCTION && JWT_SECRET === 'your_super_secret_jwt_key_change_in_production') {
  throw new Error('Replace the default JWT_SECRET before deploying to production');
}

let scheduledJobs = false;

const getAllowedOrigins = () =>
  (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    'http://localhost:3000,http://127.0.0.1:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : 0);

  morgan.token('request-id', (req) => req.id);
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || createRequestId();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api/', limiter);
  app.use(morgan(IS_PRODUCTION ? ':method :url :status :response-time ms req=:request-id' : 'dev'));
  app.use('/api', requireCsrf);

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: process.env.APP_NAME || 'LandlordPro API',
      environment: process.env.NODE_ENV || 'development',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/readiness', async (req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'ready',
        database: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/properties', propertyRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/tenants', tenantRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/platform-admin', platformAdminRoutes);

  // Serve frontend static files in production
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        error: 'Route not found.',
        request_id: req.id,
      });
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;
    const isCorsError = err.message?.startsWith('CORS blocked');

    if (status >= 500 || isCorsError) {
      console.error(`[${req.id}]`, err.stack || err.message || err);
    }

    res.status(isCorsError ? 403 : status).json({
      error: isCorsError
        ? 'This origin is not allowed to access the API.'
        : status >= 500
          ? 'Internal server error.'
          : err.message || 'Request failed.',
      request_id: req.id,
      ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
    });
  });

  return app;
};

const scheduleJobs = () => {
  if (scheduledJobs || process.env.DISABLE_CRON === 'true') {
    return;
  }

  cron.schedule('0 0 * * *', async () => {
    console.log('[cron] Running daily tenant status update');
    await autoUpdateTenantStatuses();
  });
  scheduledJobs = true;
};

const start = async () => {
  await testConnection();
  scheduleJobs();

  const app = createApp();
  return app.listen(PORT, () => {
    console.log(`LandlordPro API running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
};

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { createApp, start, scheduleJobs };
