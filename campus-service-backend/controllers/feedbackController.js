const { pool } = require('../config/db');

// 获取反馈列表
exports.getFeedbackList = async (req, res, next) => {
  try {
    const [feedbacks] = await pool.query('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json({ success: true, data: { feedbacks } });
  } catch (error) {
    next(error);
  }
};

// 创建反馈
exports.createFeedback = async (req, res, next) => {
  try {
    const { merchant_id, order_id, type, rating, content } = req.body;
    const [result] = await pool.query(
      'INSERT INTO feedback (user_id, merchant_id, order_id, type, rating, content) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, merchant_id, order_id, type, rating, content]
    );
    res.status(201).json({ success: true, data: { feedbackId: result.insertId } });
  } catch (error) {
    next(error);
  }
};

// 回复反馈
exports.replyFeedback = async (req, res, next) => {
  try {
    const { reply } = req.body;
    await pool.query(
      'UPDATE feedback SET reply = ?, reply_time = NOW() WHERE id = ?',
      [reply, req.params.id]
    );
    res.json({ success: true, message: '回复成功' });
  } catch (error) {
    next(error);
  }
};