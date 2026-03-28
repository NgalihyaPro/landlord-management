require('dotenv').config();
const { pool } = require('./src/database/db');

async function test() {
  const [users] = await pool.execute('SELECT id, email, full_name, role_id, is_active FROM users');
  console.log(users);
  process.exit();
}
test();
