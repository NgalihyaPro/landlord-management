const { pool } = require('../database/db');

const getAll = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM notifications
       WHERE organization_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.organization_id, req.user.id]
    );

    const [[{ unread }]] = await pool.execute(
      'SELECT COUNT(*) as unread FROM notifications WHERE organization_id = ? AND user_id = ? AND is_read = FALSE',
      [req.user.organization_id, req.user.id]
    );

    res.json({ notifications: rows, unread: Number(unread) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};

const markRead = async (req, res) => {
  try {
    if (req.params.id === 'all') {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE organization_id = ? AND user_id = ?',
        [req.user.organization_id, req.user.id]
      );
    } else {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND organization_id = ? AND user_id = ?',
        [req.params.id, req.user.organization_id, req.user.id]
      );
    }

    res.json({ message: 'Notifications marked as read.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
};

module.exports = { getAll, markRead };
