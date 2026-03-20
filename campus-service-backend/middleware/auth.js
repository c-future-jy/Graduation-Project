const jwt = require('jsonwebtoken');

/**
 * 验证JWT Token的中间件
 */
const auth = (req, res, next) => {
  try {
    // 从请求头获取token (格式: Bearer <token>)
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token格式错误'
      });
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 将用户信息附加到请求对象
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token已过期，请重新登录'
      });
    }
    
    return res.status(403).json({
      success: false,
      message: 'Token无效',
      error: error.message
    });
  }
};

/**
 * 角色权限验证中间件
 * @param {Array} allowedRoles - 允许访问的角色数组 [1, 2, 3]
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问此资源'
      });
    }

    next();
  };
};

/**
 * 商家权限验证中间件
 * 确保商家只能访问自己的资源
 */
const checkMerchantAccess = (merchantIdField = 'merchant_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未授权访问'
      });
    }

    // 管理员可以访问所有商家资源
    if (req.user.role === 3) {
      return next();
    }

    // 商家只能访问自己的资源
    if (req.user.role === 2) {
      const targetMerchantId = req.params[merchantIdField] || req.body[merchantIdField] || req.query[merchantIdField];
      
      if (!targetMerchantId) {
        return res.status(400).json({
          success: false,
          message: '缺少商家ID参数'
        });
      }

      if (req.user.merchant_id && parseInt(targetMerchantId) === req.user.merchant_id) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: '权限不足，只能访问自己的商家资源'
      });
    }

    return res.status(403).json({
      success: false,
      message: '权限不足，只有商家和管理员可以访问此资源'
    });
  };
};

module.exports = {
  auth,
  checkRole,
  checkMerchantAccess
};