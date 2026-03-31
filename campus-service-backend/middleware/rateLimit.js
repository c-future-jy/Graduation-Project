/**
 * 登录接口防刷中间件
 * 限制同一IP或账号在单位时间内的请求次数
 */

// 存储请求记录的对象
const requestRecords = new Map();

let cleanupTimerStarted = false;

/**
 * 清理过期的请求记录
 */
const cleanupExpiredRecords = () => {
  const now = Date.now();
  for (const [key, record] of requestRecords.entries()) {
    if (now - record.timestamp > record.windowMs) {
      requestRecords.delete(key);
    }
  }
};

const ensureCleanupTimer = () => {
  if (cleanupTimerStarted) return;
  cleanupTimerStarted = true;

  // 测试环境下避免残留定时器导致 Jest 不退出
  if (process.env.NODE_ENV === 'test') return;

  // 每5分钟清理一次过期记录
  const timer = setInterval(cleanupExpiredRecords, 5 * 60 * 1000);
  // 不阻塞进程退出（例如在脚本/测试场景）
  if (timer && typeof timer.unref === 'function') timer.unref();
};

/**
 * 登录防刷中间件
 * @param {Object} options - 配置选项
 * @param {number} options.max - 单位时间内最大请求次数
 * @param {number} options.windowMs - 时间窗口（毫秒）
 * @param {string} options.message - 超出限制时的提示信息
 */
const loginRateLimit = (options = {}) => {
  const {
    max = 5, // 默认5次
    windowMs = 60000, // 默认1分钟
    message = '请求过于频繁，请稍后再试'
  } = options;

  ensureCleanupTimer();

  return (req, res, next) => {
    // 获取客户端IP
    const ip = req.ip || req.connection.remoteAddress;
    
    // 获取账号标识（手机号或openid）
    let accountKey = '';
    if (req.body.phone) {
      accountKey = `account:${req.body.phone}`;
    } else if (req.body.code) {
      accountKey = `wechat:${req.body.code}`;
    }

    // 清理过期记录
    cleanupExpiredRecords();

    // 检查IP限制
    const ipKey = `ip:${ip}`;
    const ipRecord = requestRecords.get(ipKey);

    if (ipRecord) {
      if (ipRecord.count >= max) {
        return res.status(429).json({
          success: false,
          message: message
        });
      }
      // 更新IP请求记录
      requestRecords.set(ipKey, {
        count: ipRecord.count + 1,
        timestamp: ipRecord.timestamp,
        windowMs
      });
    } else {
      // 创建新的IP请求记录
      requestRecords.set(ipKey, {
        count: 1,
        timestamp: Date.now(),
        windowMs
      });
    }

    // 检查账号限制
    if (accountKey) {
      const accountRecord = requestRecords.get(accountKey);
      
      if (accountRecord) {
        if (accountRecord.count >= max) {
          return res.status(429).json({
            success: false,
            message: message
          });
        }
        // 更新账号请求记录
        requestRecords.set(accountKey, {
          count: accountRecord.count + 1,
          timestamp: accountRecord.timestamp,
          windowMs
        });
      } else {
        // 创建新的账号请求记录
        requestRecords.set(accountKey, {
          count: 1,
          timestamp: Date.now(),
          windowMs
        });
      }
    }

    next();
  };
};

module.exports = loginRateLimit;