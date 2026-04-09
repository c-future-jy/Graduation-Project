const { pool } = require('../config/db');
const { generateToken } = require('../utils/jwt');
const bcrypt = require('bcryptjs');

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tableName, columnName]
  );
  return (rows[0] && rows[0].cnt > 0) || false;
}

/**
 * 用户登录（微信登录）
 * POST /api/users/login
 */
exports.login = async (req, res, next) => {
  try {
    const { code, nickname, avatarUrl } = req.body;
    
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
          return res.status(401).json({
            success: false,
            message: '微信登录失败，无法获取openid'
          });
        }
      } catch (wechatError) {
        console.error('微信API调用失败:', wechatError);
        return res.status(500).json({
          success: false,
          message: '微信登录服务暂时不可用'
        });
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
        [openid, nickname || '新用户', avatarUrl || '', 1]
      );
      
      user = {
        id: result.insertId,
        openid,
        nickname: nickname || '新用户',
        avatar_url: avatarUrl || '',
        role: 1
      };
    } else {
      user = users[0];

      // 说明：merchant.status 在前端用于“营业中/休息中”，不应作为“禁用登录”的条件。

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
    const { account, username, phone, password } = req.body;
    const accountValue = String(account || username || '').trim();
    const phoneValue = String(phone || '').trim();

    if ((!accountValue && !phoneValue) || !password) {
      return res.status(400).json({
        success: false,
        message: '请输入账号或手机号和密码'
      });
    }

    const hasAccountColumn = await columnExists('user', 'account');
    const hasUsernameColumn = await columnExists('user', 'username');
    const hasPhoneColumn = await columnExists('user', 'phone');

    const conditions = [];
    const params = [];

    if (accountValue) {
      if (hasAccountColumn) {
        conditions.push('account = ?');
        params.push(accountValue);
      }
      if (hasUsernameColumn) {
        conditions.push('username = ?');
        params.push(accountValue);
      }
      // 兼容：用户把手机号当“账号”输入
      if (hasPhoneColumn && /^\d{6,15}$/.test(accountValue)) {
        conditions.push('phone = ?');
        params.push(accountValue);
      }
    }

    if (phoneValue && hasPhoneColumn) {
      conditions.push('phone = ?');
      params.push(phoneValue);
    }

    if (conditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请输入账号或手机号和密码'
      });
    }

    // 查找用户（兼容 account/username/phone 任一字段）
    const [users] = await pool.query(
      `SELECT id, openid, nickname, avatar_url, role, merchant_id, phone, account, password FROM user WHERE (${conditions.join(' OR ')})`,
      params
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '账号不存在'
      });
    }
    
    const user = users[0];

    // 说明：merchant.status 在前端用于“营业中/休息中”，不应作为“禁用登录”的条件。
    
    // 验证密码
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
          account: user.account || null,
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
    const { code, nickname, avatarUrl, phone, account, password, username } = req.body;
    const phoneValue = String(phone || '').trim();
    const accountValue = String(account || '').trim();
    const hasAccountColumn = await columnExists('user', 'account');
    const nicknameToSave = nickname || username || '新用户';

    const hasTable = async (tableName) => {
      try {
        const [rows] = await pool.query('SHOW TABLES LIKE ?', [tableName]);
        return Array.isArray(rows) && rows.length > 0;
      } catch (_) {
        return false;
      }
    };

    const resolveMerchantTableName = async () => {
      if (await hasTable('merchant')) return 'merchant';
      if (await hasTable('merchants')) return 'merchants';
      return 'merchant';
    };

    const getTableColumns = async (tableName) => {
      try {
        const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        const names = (rows || []).map((r) => r && r.Field).filter(Boolean);
        return new Set(names);
      } catch (_) {
        return new Set();
      }
    };

    // 注册默认学生；商家需走“申请成为商家”并经管理员审核
    const roleInt = 1;
    
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
          return res.status(400).json({
            success: false,
            message: '微信授权失败，无法获取openid'
          });
        }
      } catch (wechatError) {
        console.error('微信API调用失败:', wechatError);
        return res.status(500).json({
          success: false,
          message: '微信授权服务暂时不可用'
        });
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
    // 账号密码注册模式（账号与手机号分离）
    else if (accountValue && password) {
      // 账号格式校验：6-11 位纯数字
      if (!/^\d{6,11}$/.test(accountValue)) {
        return res.status(400).json({
          success: false,
          message: '账号需6-11位纯数字'
        });
      }

      // 账号唯一性校验（需要数据库已迁移出 user.account 列）
      if (hasAccountColumn) {
        const [existingUsersByAccount] = await pool.query(
          'SELECT id FROM user WHERE account = ?',
          [accountValue]
        );
        if (existingUsersByAccount.length > 0) {
          return res.status(409).json({
            success: false,
            message: '账号已被注册'
          });
        }
      } else {
        console.warn('user.account 列不存在：请执行 migrate_schema_compat.js 添加 account 字段以启用账号注册/登录');
      }

      // 手机号可选：若提供则做格式校验与重复校验
      if (phoneValue) {
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phoneValue)) {
          return res.status(400).json({
            success: false,
            message: '请输入正确的手机号'
          });
        }

        const [existingUsersByPhone] = await pool.query(
          'SELECT id FROM user WHERE phone = ?',
          [phoneValue]
        );
        if (existingUsersByPhone.length > 0) {
          return res.status(409).json({
            success: false,
            message: '手机号已被注册'
          });
        }
      }

      // 检查手机号是否已存在
      // 密码强度校验
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,18}$/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message: '密码需6-18位且包含字母和数字'
        });
      }
      
      // 为账号密码注册生成默认openid
      openid = `account_${accountValue}_${Date.now()}`;
    }
    // 兼容：旧版仍允许 phone+password 注册
    else if (phoneValue && password) {
      // 检查手机号是否已存在
      const [existingUsersByPhone] = await pool.query(
        'SELECT id FROM user WHERE phone = ?',
        [phoneValue]
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
      openid = `phone_${phoneValue}_${Date.now()}`;
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
    let result;
    if (hasAccountColumn) {
      [result] = await pool.query(
        'INSERT INTO user (openid, nickname, avatar_url, account, phone, password, username, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [openid, nicknameToSave, avatarUrl || '', accountValue || null, phoneValue || null, hashedPassword, username || null, roleInt]
      );
    } else {
      // 兼容：数据库未迁移时仍可注册，但无法保存 account 字段
      [result] = await pool.query(
        'INSERT INTO user (openid, nickname, avatar_url, phone, password, username, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [openid, nicknameToSave, avatarUrl || '', phoneValue || null, hashedPassword, username || null, roleInt]
      );
    }

    const userId = result.insertId;

    const merchantId = null;
    
    // 生成Token
    const token = generateToken({
      id: userId,
      openid,
      role: roleInt,
      merchant_id: merchantId
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        userId,
        token,
        user: {
          id: userId,
          openid,
          nickname: nicknameToSave,
          avatarUrl: avatarUrl || '',
          account: hasAccountColumn ? (accountValue || null) : null,
          phone: phoneValue || null,
          username: username || null,
          role: roleInt,
          merchant_id: merchantId
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

    const hasMerchantId = await columnExists('user', 'merchant_id');
    const hasUsername = await columnExists('user', 'username');
    const hasAccount = await columnExists('user', 'account');
    const fields = ['id', 'openid', 'nickname', 'avatar_url', 'phone', 'role', 'status', 'created_at'];
    if (hasUsername) fields.push('username');
    if (hasAccount) fields.push('account');
    if (hasMerchantId) fields.push('merchant_id');

    const [users] = await pool.query(
      `SELECT ${fields.join(', ')} FROM user WHERE id = ?`,
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const user = users[0];

    const tokenRole = req.user && typeof req.user.role === 'number' ? req.user.role : parseInt(req.user && req.user.role, 10);
    const tokenMerchantId = req.user && req.user.merchant_id !== undefined && req.user.merchant_id !== null
      ? parseInt(req.user.merchant_id, 10)
      : null;

    let dbRole = typeof user.role === 'number' ? user.role : parseInt(user.role, 10);
    let dbMerchantId = hasMerchantId && user.merchant_id !== undefined && user.merchant_id !== null
      ? parseInt(user.merchant_id, 10)
      : null;

    // 兜底：
    // - 若 role=2 但店铺不存在/未审核通过 => 降级为学生
    // - 若 role!=2 但存在“审核通过”的店铺（可能因历史 bug/缓存导致 user.role 被写错）=> 自愈恢复为商家
    // 注意：merchant.status 在前端用于“营业中/休息中”，不应影响商家身份与商家端管理权限。
    try {
      // 先检查/修正 role=2 的合法性
      if (dbRole === 2) {
        if (!dbMerchantId) {
          dbRole = 1;
        } else {
          const [mrows] = await pool.query('SELECT audit_status FROM merchant WHERE id = ? LIMIT 1', [dbMerchantId]);
          if (!mrows || mrows.length === 0) {
            dbRole = 1;
            dbMerchantId = null;
          } else {
            const auditNum = mrows[0].audit_status === undefined ? null : parseInt(mrows[0].audit_status, 10);
            const approved = auditNum === null ? true : auditNum === 2;
            if (!approved) {
              dbRole = 1;
              dbMerchantId = null;
            }
          }
        }

        if (dbRole !== 2) {
          if (hasMerchantId) {
            await pool.query('UPDATE user SET role = 1, merchant_id = NULL WHERE id = ? LIMIT 1', [userId]);
          } else {
            await pool.query('UPDATE user SET role = 1 WHERE id = ? LIMIT 1', [userId]);
          }
        }
      }

      // 再尝试自愈：如果用户不是商家，但存在审核通过的店铺，则恢复为商家
      if (dbRole !== 2) {
        const [owned] = await pool.query(
          'SELECT id, audit_status FROM merchant WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1',
          [userId]
        );
        const m = owned && owned[0] ? owned[0] : null;
        const auditNum = m && m.audit_status !== undefined && m.audit_status !== null && m.audit_status !== ''
          ? parseInt(m.audit_status, 10)
          : null;
        if (m && m.id && (auditNum === null || auditNum === 2)) {
          dbRole = 2;
          dbMerchantId = parseInt(m.id, 10);
          if (hasMerchantId) {
            await pool.query('UPDATE user SET role = 2, merchant_id = ? WHERE id = ? LIMIT 1', [dbMerchantId, userId]);
          } else {
            await pool.query('UPDATE user SET role = 2 WHERE id = ? LIMIT 1', [userId]);
          }
        }
      }
    } catch (_) {
      // ignore
    }

    // 若用户角色/merchant_id 已变更（常见于管理员审核通过/驳回后），下发新 token
    const needRefreshToken = (Number.isFinite(tokenRole) ? tokenRole : null) !== dbRole || tokenMerchantId !== dbMerchantId;

    const safeUser = { ...user, role: dbRole };
    if (hasMerchantId) safeUser.merchant_id = dbMerchantId;

    const data = { user: safeUser };
    if (needRefreshToken) {
      data.token = generateToken({
        id: safeUser.id,
        openid: safeUser.openid,
        role: dbRole,
        merchant_id: dbMerchantId
      });
    }

    res.json({ success: true, data });
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
    const nickname = req.body && req.body.nickname;
    const avatarUrl = req.body && (req.body.avatarUrl || req.body.avatar_url);
    const phone = req.body && req.body.phone;

    const fields = [];
    const values = [];

    if (nickname !== undefined) {
      fields.push('nickname = ?');
      values.push(nickname);
    }

    if (avatarUrl !== undefined) {
      fields.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone);
    }

    if (fields.length === 0) {
      return res.json({ success: true, message: '无需更新' });
    }

    fields.push('updated_at = NOW()');
    values.push(userId);

    await pool.query(
      `UPDATE user SET ${fields.join(', ')} WHERE id = ?`,
      values
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
    
    // 构建查询语句
    let query = 'SELECT id, openid, nickname, phone, role, status, created_at FROM user';
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
    
    // 实现微信手机号解密逻辑
    // 实际项目中需要使用微信提供的解密库
    // 这里需要引入微信解密库并实现解密逻辑
    const phoneNumber = ''; // 解密后获取真实手机号
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: '手机号解密失败'
      });
    }
    
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

/**
 * 获取用户列表（管理员）
 * GET /api/admin/users
 */
exports.getAdminUserList = async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, role, status, keyword, startTime, endTime } = req.query;
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT 
        u.id, u.openid, u.nickname, u.avatar_url, u.phone, u.role, u.status, u.created_at,
        m.name as merchant_name
      FROM 
        user u
      LEFT JOIN 
        merchant m ON u.merchant_id = m.id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        user u
      LEFT JOIN 
        merchant m ON u.merchant_id = m.id
    `;
    let queryParams = [];
    let whereClause = [];
    
    // 构建筛选条件
    if (role) {
      whereClause.push('u.role = ?');
      queryParams.push(role);
    }

    if (status !== undefined && status !== '') {
      whereClause.push('u.status = ?');
      queryParams.push(status);
    }
    
    if (keyword) {
      whereClause.push('(u.nickname LIKE ? OR u.phone LIKE ?)');
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    if (startTime) {
      whereClause.push('u.created_at >= ?');
      queryParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('u.created_at <= ?');
      queryParams.push(endTime);
    }
    
    // 添加WHERE子句
    if (whereClause.length > 0) {
      query += ' WHERE ' + whereClause.join(' AND ');
      countQuery += ' WHERE ' + whereClause.join(' AND ');
    }
    
    // 添加排序和分页
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), parseInt(offset));
    
    const [users] = await pool.query(query, queryParams);
    const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户详情（管理员）
 * GET /api/admin/users/:id
 */
exports.getAdminUserDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tableExists = async (tableName) => {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as cnt
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [tableName]
      );
      return (rows[0] && rows[0].cnt > 0) || false;
    };

    const findFirstExistingTable = async (candidates) => {
      for (const name of candidates) {
        if (await tableExists(name)) return name;
      }
      return null;
    };
    
    // 获取用户基本信息
    const [users] = await pool.query(`
      SELECT 
        u.*,
        m.name as merchant_name,
        m.status as merchant_status
      FROM 
        user u
      LEFT JOIN 
        merchant m ON u.merchant_id = m.id
      WHERE 
        u.id = ?
    `, [id]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const user = users[0];
    
    // 获取用户订单统计
    const [orderStats] = await pool.query(`
      SELECT 
        COUNT(*) as order_count,
        SUM(total_amount) as total_spent
      FROM 
        \`order\`
      WHERE 
        user_id = ?
    `, [id]);

    const [feedbackCountRows] = await pool.query(
      'SELECT COUNT(*) as feedback_count FROM feedback WHERE user_id = ?',
      [id]
    );

    let favoriteCount = 0;
    try {
      // 收藏表在不同项目中命名可能不同：这里做存在性探测，若没有则返回 0
      const favoriteTable = await findFirstExistingTable([
        'favorite',
        'favorites',
        'user_favorite',
        'collection',
        'collect',
        'user_collect'
      ]);

      if (favoriteTable) {
        // 默认优先 user_id 字段
        const [colRows] = await pool.query(
          `SELECT column_name as columnName
           FROM information_schema.columns
           WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN ('user_id','uid')`,
          [favoriteTable]
        );
        const userCol = colRows.some(r => r.columnName === 'user_id')
          ? 'user_id'
          : (colRows.some(r => r.columnName === 'uid') ? 'uid' : null);

        if (userCol) {
          const [favRows] = await pool.query(
            `SELECT COUNT(*) as cnt FROM \`${favoriteTable}\` WHERE \`${userCol}\` = ?`,
            [id]
          );
          favoriteCount = (favRows[0] && favRows[0].cnt) || 0;
        }
      }
    } catch (e) {
      // 收藏统计为非关键字段，失败时兜底 0
      favoriteCount = 0;
    }
    
    // 获取用户反馈记录
    const [feedbacks] = await pool.query(`
      SELECT 
        id, content, reply, rating, created_at
      FROM 
        feedback
      WHERE 
        user_id = ?
      ORDER BY 
        created_at DESC
    `, [id]);
    
    // 获取用户地址列表
    const [addresses] = await pool.query(`
      SELECT 
        id,
        receiver_name as name,
        receiver_name,
        phone,
        province,
        city,
        district,
        detail,
        is_default
      FROM 
        address
      WHERE 
        user_id = ?
    `, [id]);

    const merchant = user.merchant_id ? {
      id: user.merchant_id,
      name: user.merchant_name || null,
      status: user.merchant_status,
      statusText: user.merchant_status === 1 ? '营业中' : (user.merchant_status === 0 ? '休息中' : null)
    } : null;
    
    res.json({
      success: true,
      data: {
        user,
        orderStats: orderStats[0],
        counts: {
          orderCount: orderStats[0] ? (orderStats[0].order_count || 0) : 0,
          feedbackCount: feedbackCountRows[0] ? (feedbackCountRows[0].feedback_count || 0) : 0,
          favoriteCount
        },
        merchant,
        feedbacks,
        addresses
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户状态（管理员）
 * PUT /api/admin/users/:id/status
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }
    
    // 更新用户状态
    await pool.query(
      'UPDATE user SET status = ? WHERE id = ?',
      [status, id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, status ? '启用用户' : '禁用用户', id]
    );
    
    res.json({
      success: true,
      message: status ? '用户已启用' : '用户已禁用'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 重置用户密码（管理员）
 * POST /api/admin/users/:id/reset-password
 */
exports.resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    // 生成随机密码（8-12位，字母+数字）
    const generateRandomPassword = () => {
      const length = Math.floor(Math.random() * 5) + 8; // 8-12位
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let password = '';
      for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };
    
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新用户密码
    await pool.query(
      'UPDATE user SET password = ?, force_change_password = 1 WHERE id = ?',
      [hashedPassword, id]
    );
    
    // 记录操作日志
    await pool.query(
      'INSERT INTO admin_operation_log (admin_id, operation, target_user_id, created_at) VALUES (?, ?, ?, NOW())',
      [adminId, '重置用户密码', id]
    );
    
    // 插入通知
    await pool.query(
      'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, '密码重置通知', `您的密码已被管理员重置为：${newPassword}，请登录后修改密码`, 2]
    );
    
    res.json({
      success: true,
      message: '密码重置成功',
      data: {
        newPassword
      }
    });
  } catch (error) {
    next(error);
  }
};