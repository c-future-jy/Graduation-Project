const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// 导入配置
const { testConnection } = require('./config/db');

// 导入中间件
const { errorHandler, notFound } = require('./middleware/errorHandler');

// 导入路由
const routes = require('./routes/index');

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({
  origin: '*', // 生产环境应该设置为具体的域名
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  next();
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '多模式履约校园商城API运行正常',
    timestamp: new Date().toISOString()
  });
});

// 注册路由
app.use('/api', routes);

// 404处理
app.use(notFound);

// 全局错误处理
app.use(errorHandler);

// 启动服务器
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

const startServer = async () => {
  try {
    // 测试数据库连接
    await testConnection();

    // 启动 HTTP
    const httpServer = http.createServer(app);
    httpServer.listen(PORT, () => {
      console.log('==========================================');
      console.log(`🚀 HTTP 服务器运行在端口 ${PORT}`);
      console.log(`📚 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API地址: http://localhost:${PORT}/api`);
      console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`);
      console.log('==========================================');
    });

    // 可选：启动 HTTPS（微信小程序图片等场景需要）
    const sslKeyPath = process.env.SSL_KEY_PATH;
    const sslCertPath = process.env.SSL_CERT_PATH;
    const httpsEnabled = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true' || (sslKeyPath && sslCertPath);

    if (httpsEnabled && sslKeyPath && sslCertPath) {
      try {
        const key = fs.readFileSync(sslKeyPath);
        const cert = fs.readFileSync(sslCertPath);
        const httpsServer = https.createServer({ key, cert }, app);
        httpsServer.listen(HTTPS_PORT, () => {
          console.log('==========================================');
          console.log(`🔒 HTTPS 服务器运行在端口 ${HTTPS_PORT}`);
          console.log(`🔗 API地址: https://localhost:${HTTPS_PORT}/api`);
          console.log(`🖼️  静态资源: https://localhost:${HTTPS_PORT}/uploads/...`);
          console.log('==========================================');
        });
      } catch (e) {
        console.warn('⚠️ HTTPS 启动失败（将继续使用 HTTP）:', e && e.message ? e.message : e);
      }
    } else {
      console.log('ℹ️ 未启用 HTTPS（如需：设置 HTTPS_ENABLED=true 且提供 SSL_KEY_PATH/SSL_CERT_PATH）');
    }
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;