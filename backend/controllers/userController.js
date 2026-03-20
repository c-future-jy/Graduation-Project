const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcryptjs');

/**
 * 用户登录（微信登录）
 * POST /api/users/login
 */
exports.login = async (req, res, next) => {
  try {
    const { code, nickname, avatarUrl, role = 1 } = req.body;
    
    // 调用微信API，用code换取openid
    let openid;
    if (code) {
      try {
        const axios = require('axios');
        const appId = process.env.WECHAT_APPID;
        const appSecret = process.env.WECHAT_APPSECRET;
        
        const response = await axios.get(`https://api.weixin.qq.com/sns/jscode2session`, {
          params: {
            appid: appId,
            secret: appSecret,
            js_code: code,
            grant_type: 'authorization_code'
          }
        });
        
        openid = response.data.openid;
        if (!openid) {
          // 开发环境使用模拟数据
          if (process.env.NODE_ENV === 'development') {
            openid = code || 'test_openid';
          } else {
            return res.status(401).json({
              success: false,
              message: '微信登录失败，无法获取openid'
            });
          }
        }
      } catch (wechatError) {
        console.error('微信API调用失败:', wechatError);
        // 开发环境使用模拟数据
        if (process.env.NODE_ENV === 'development') {
          openid = code || 'test_openid';
        } else {
          return res.status(500).json({
            success: false,
            message: '微信登录服务暂时不可用'
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        message: '缺少登录凭证'
      });
    }
    
    // 查找用户（利用uk_openid索引）
    const [users] = await pool.query(
      'SELECT id, openid, nickname, avatar_url, role, merchant_id, phone, password FROM user WHERE openid = ?',
      [openid]
    );
    
    let user;
    
    if (users.length === 0) {
      // 用户不存在，创建新用户
      const [result] = await pool.query(
        'INSERT INTO user (openid, nickname, avatar_url, role) VALUES (?, ?, ?, ?)',
        [openid, nickname || '新用户', avatarUrl || '', role]
      );
      
      user = {
        id: result.insertId,
        openid,
        nickname: nickname || '新用户',
        avatar_url: avatarUrl || '',
        role
      };
    } else {
      user = users[0];
      // 更新用户信息
      if (nickname || avatarUrl) {
        await pool.query(
          'UPDATE user SET nickname = ?, avatar_url = ? WHERE openid = ?',
          [nickname || user.nickname, avatarUrl || user.avatar_url, openid]
        );
        user.nickname = nickname || user.nickname;
        user.avatar_url = avatarUrl || user.avatar_url;
      }
    }
    
    // 生成Token
    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role,
      merchant_id: user.merchant_id
    });
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          role: user.role,
          merchant_id: user.merchant_id
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 账号密码登录
 * POST /api/users/login/account
 */
exports.accountLogin = async (req, res, next) => {
  try {
    const { phone, password, role = 1 } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入手机号和密码'
      });
    }
    
    // 查找用户
    const [users] = await pool.query(
      'SELECT id, openid, nickname, avatar_url, role, merchant_id, phone, password FROM user WHERE phone = ?',
      [phone]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '账号不存在'
      });
    }
    
    const user = users[0];
    
    // 验证密码
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '密码错误'
      });
    }
    
    // 生成Token
    const token = generateToken({
      id: user.id,
      openid: user.openid,
      role: user.role,
      merchant_id: user.merchant_id
    });
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          phone: user.phone,
          role: user.role,
          merchant_id: user.merchant_id
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 统一注册接口
 * POST /api/auth/register
 * 支持微信授权注册和账号密码注册
 */
exports.register = async (req, res, next) => {
  try {
    const { code, nickname, avatarUrl, phone, password, role = 1, username } = req.body;
    
    let openid;
    
    // 微信授权注册模式
    if (code) {
      try {
        const axios = require('axios');
        const appId = process.env.WECHAT_APPID;
        const appSecret = process.env.WECHAT_APPSECRET;
        
        const response = await axios.get(`https://api.weixin.qq.com/sns/jscode2session`, {
          params: {
            appid: appId,
            secret: appSecret,
            js_code: code,
            grant_type: 'authorization_code'
          }
        });
        
        openid = response.data.openid;
        if (!openid) {
          // 开发环境使用模拟数据
          if (process.env.NODE_ENV === 'development') {
            openid = code || 'test_openid';
          } else {
            return res.status(400).json({
              success: false,
              message: '微信授权失败，无法获取openid'
            });
          }
        }
      } catch (wechatError) {
        console.error('微信API调用失败:', wechatError);
        // 开发环境使用模拟数据
        if (process.env.NODE_ENV === 'development') {
          openid = code || 'test_openid';
        } else {
          return res.status(500).json({
            success: false,
            message: '微信授权服务暂时不可用'
          });
        }
      }
      
      // 检查openid是否已存在
      const [existingUsersByOpenid] = await pool.query(
        'SELECT id FROM user WHERE openid = ?',
        [openid]
      );
      
      if (existingUsersByOpenid.length > 0) {
        return res.status(409).json({
          success: false,
          message: '该账号已注册'
        });
      }
    } 
    // 账号密码注册模式
    else if (phone && password) {
      // 检查手机号是否已存在
      const [existingUsersByPhone] = await pool.query(
        'SELECT id FROM user WHERE phone = ?',
        [phone]
      );
      
      if (existingUsersByPhone.length > 0) {
        return res.status(409).json({
          success: false,
          message: '手机号已被注册'
        });
      }
      
      // 密码强度校验
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,18}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: '密码需6-18位且包含字母和数字'
        });
      }
      
      // 为账号密码注册生成默认openid
      openid = `phone_${phone}_${Date.now()}`;
    } else {
      return res.status(400).json({
        success: false,
        message: '缺少注册凭证'
      });
    }
    
    // 检查用户名是否已存在（如果提供了用户名）
    if (username) {
      const [existingUsersByUsername] = await pool.query(
        'SELECT id FROM user WHERE username = ?',
        [username]
      );
      
      if (existingUsersByUsername.length > 0) {
        return res.status(409).json({
          success: false,
          message: '用户名已存在'
        });
      }
    }
    
    // 加密密码（如果提供了密码）
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }
    
    // 创建用户
    const [result] = await pool.query(
      'INSERT INTO user (openid, nickname, avatar_url, phone, password, username, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [openid, nickname || '新用户', avatarUrl || '', phone || null, hashedPassword, username || null, role]
    );
    
    // 生成Token
    const token = generateToken({
      id: result.insertId,
      openid,
      role,
      merchant_id: null
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        userId: result.insertId,
        token,
        user: {
          id: result.insertId,
          openid,
          nickname: nickname || '新用户',
          avatarUrl: avatarUrl || '',
          phone: phone || null,
          username: username || null,
          role
        }
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

/**
 * 检查用户名是否已被占用
 * POST /api/auth/check-username
 */
exports.checkUsername = async (req, res, next) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '缺少用户名参数'
      });
    }
    
    const [existingUsers] = await pool.query(
      'SELECT id FROM user WHERE username = ?',
      [username]
    );
    
    if (existingUsers.length > 0) {
      return res.json({
        success: true,
        data: {
          available: false,
          message: '用户名已存在'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        available: true,
        message: '用户名可用'
      }
    });
  } catch (error) {
    console.error('检查用户名失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

/**
 * 检查手机号是否已注册
 * POST /api/auth/check-phone
 */
exports.checkPhone = async (req, res, next) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: '缺少手机号参数'
      });
    }
    
    // 手机号格式校验
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '请输入正确的手机号'
      });
    }
    
    const [existingUsers] = await pool.query(
      'SELECT id FROM user WHERE phone = ?',
      [phone]
    );
    
    if (existingUsers.length > 0) {
      return res.json({
        success: true,
        data: {
          registered: true,
          message: '手机号已注册'
        }
      });
    }
    
    res.json({
      success: true,
      data: {
        registered: false,
        message: '手机号未注册'
      }
    });
  } catch (error) {
    console.error('检查手机号失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
};

/**
 * 获取个人信息
 * GET /api/users/profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [users] = await pool.query(
      'SELECT id, openid, nickname, avatar_url, phone, role, created_at FROM user WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: users[0]
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新个人信息
 * PUT /api/users/profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nickname, avatarUrl } = req.body;
    
    await pool.query(
      'UPDATE user SET nickname = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?',
      [nickname, avatarUrl, userId]
    );
    
    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户列表（管理员）
 * GET /api/users/list
 */
exports.getUserList = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT id, openid, nickname, phone, role, created_at FROM user';
    let countQuery = 'SELECT COUNT(*) as total FROM user';
    let queryParams = [];
    
    if (role) {
      query += ' WHERE role = ?';
      countQuery += ' WHERE role = ?';
      queryParams.push(role);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [users] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total: countResult[0].total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 解密微信手机号
 * POST /api/users/decrypt-phone
 */
exports.decryptWeixinPhone = async (req, res, next) => {
  try {
    const { encryptedData, iv } = req.body;
    
    if (!encryptedData || !iv) {
      return res.status(400).json({
        success: false,
        message: '缺少加密数据'
      });
    }
    
    // 这里需要实现微信手机号解密逻辑
    // 实际项目中需要使用微信提供的解密库
    // 为了演示，这里返回模拟数据
    const phoneNumber = '13800138000';
    
    // 更新用户手机号
    await pool.query(
      'UPDATE user SET phone = ? WHERE id = ?',
      [phoneNumber, req.user.id]
    );
    
    res.json({
      success: true,
      data: {
        phoneNumber
      }
    });
  } catch (error) {
    next(error);
  }
};