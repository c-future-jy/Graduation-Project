/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  console.error('错误详情:', err);

  // MySQL错误处理
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        return res.status(409).json({
          success: false,
          message: '资源已存在',
          error: err.message
        });
      case 'ER_NO_REFERENCED_ROW_2':
        return res.status(400).json({
          success: false,
          message: '关联的数据不存在',
          error: err.message
        });
      default:
        return res.status(500).json({
          success: false,
          message: '数据库错误',
          error: err.message
        });
    }
  }

  // 默认错误
  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 处理中间件
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `找不到路由 - ${req.originalUrl}`
  });
};

module.exports = {
  errorHandler,
  notFound
};