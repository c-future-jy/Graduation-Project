const { pool } = require('../config/db');

/**
 * 获取操作日志列表
 * GET /api/admin/logs
 */
exports.getAdminLogs = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, admin_id, operation, startTime, endTime } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        l.*,
        u.nickname as admin_name
      FROM 
        admin_operation_log l
      LEFT JOIN 
        user u ON l.admin_id = u.id
      WHERE 
        l.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        admin_operation_log l
      LEFT JOIN 
        user u ON l.admin_id = u.id
      WHERE 
        l.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (admin_id) {
      whereClause.push('l.admin_id = ?');
      queryParams.push(admin_id);
    }
    
    if (operation) {
      whereClause.push('l.operation LIKE ?');
      queryParams.push(`%${operation}%`);
    }
    
    if (startTime) {
      whereClause.push('l.created_at >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('l.created_at <= ?');
      queryParams.push(endTime);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' AND ' + whereClause.join(' AND ');
      countQuery += ' AND ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [logs] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 记录操作日志
 * @param {Object} req - 请求对象
 * @param {string} operation - 操作描述
 * @param {number} targetId - 目标ID
 * @param {string} targetTable - 目标表名
 */
exports.logOperation = async (req, res, operation, targetId = null, targetTable = null) => {
  try {
    const adminId = req.user.id;
    const ip = req.ip || req.connection.remoteAddress;
    
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_table, target_id, ip, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [adminId, operation, targetTable, targetId, ip]
    );
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
};