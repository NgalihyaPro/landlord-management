const { pool } = require('../database/db');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM settings WHERE organization_id = ? ORDER BY setting_group, setting_key',
      [req.user.organization_id]
    );

    const obj = {};
    rows.forEach((row) => {
      obj[row.setting_key] = row.setting_value;
    });

    res.json(obj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
};

const update = async (req, res) => {
  try {
    const updates = req.body;
    const entries = Object.entries(updates);

    for (const [key, value] of entries) {
      await pool.execute(
        `INSERT INTO settings (organization_id, setting_key, setting_value, setting_group)
         VALUES (?, ?, ?, COALESCE(
           (SELECT setting_group FROM settings WHERE organization_id = ? AND setting_key = ?),
           'general'
         ))
         ON CONFLICT (organization_id, setting_key) DO UPDATE
         SET setting_value = EXCLUDED.setting_value,
             updated_at = NOW()`,
        [req.user.organization_id, key, value, req.user.organization_id, key]
      );
    }

    await pool.execute(
      'INSERT INTO audit_logs (organization_id, user_id, action, table_name) VALUES (?,?,?,?)',
      [req.user.organization_id, req.user.id, 'UPDATE_SETTINGS', 'settings']
    );

    res.json({ message: 'Settings saved successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
};

module.exports = { getAll, update };
