const {
  pool,
  initializeSchema,
  ensureTenantBillingColumns,
  ensureSmsAlertColumns,
} = require('./db');

async function runMigrations() {
  await pool.query('SELECT 1');
  await initializeSchema();
  await ensureTenantBillingColumns();
  await ensureSmsAlertColumns();
  console.log('Database migrations completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error('Database migration failed:', error);
      await pool.end();
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
};
