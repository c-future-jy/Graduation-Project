const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const path = require('path');

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
    message: '校园一站式服务平台API运行正常',
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

const startServer = async () => {
  try {
    // 测试数据库连接
    await testConnection();
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log('==========================================');
      console.log(`🚀 服务器运行在端口 ${PORT}`);
      console.log(`📚 环境: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API地址: http://localhost:${PORT}/api`);
      console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`);
      console.log('==========================================');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;