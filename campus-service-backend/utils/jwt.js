const jwt = require('jsonwebtoken');

/**
 * 生成JWT Token
 * @param {Object} payload - 载荷数据 { id, openid, role, merchant_id }
 * @returns {String} token
 */
const generateToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id,
      openid: payload.openid,
      role: payload.role,
      merchant_id: payload.merchant_id
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * 验证Token
 * @param {String} token 
 * @returns {Object} 解码后的数据
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken
};