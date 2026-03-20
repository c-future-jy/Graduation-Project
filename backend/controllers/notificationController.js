const { pool } = require('../config/db');

// 获取通知列表
exports.getNotificationList = async (req, res, next) => {
  try {
    const [notifications] = await pool.query(
      'SELECT * FROM notification WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: { notifications } });
  } catch (error) {
    next(error);
  }
};

// 标记为已读
exports.markAsRead = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notification SET is_read = 1, read_time = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    next(error);
  }
};

// 标记全部为已读
exports.markAllAsRead = async (req, res, next) => {
  try {
    await pool.query(
      'UPDATE notification SET is_read = 1, read_time = NOW() WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, message: '全部已标记为已读' });
  } catch (error) {
    next(error);
  }
};