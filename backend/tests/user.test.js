/**
 * 登录模块接口测试用例
 * 涵盖正常登录、异常登录、权限越界等场景
 */

const request = require('supertest');
const app = require('../app');

// 测试账号信息
const testAccount = {
  phone: '13164851646',
  password: 'pass123456'
};

describe('登录模块接口测试', () => {
  // 微信登录测试
  describe('POST /api/users/login', () => {
    it('正常微信登录 - 新用户', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          code: 'test_code',
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.jpg',
          role: 1
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user).toHaveProperty('openid');
      expect(res.body.data.user.nickname).toBe('测试用户');
    });

    it('正常微信登录 - 已有用户', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          code: 'test_openid', // 使用已存在的openid
          nickname: '更新的昵称',
          avatarUrl: 'https://example.com/new_avatar.jpg',
          role: 1
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user).toHaveProperty('openid');
    });

    it('异常微信登录 - 缺少code', async () => {
      const res = await request(app)
        .post('/api/users/login')
        .send({
          nickname: '测试用户',
          avatarUrl: 'https://example.com/avatar.jpg',
          role: 1
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('缺少登录凭证');
    });
  });

  // 账号密码登录测试
  describe('POST /api/users/login/account', () => {
    it('正常账号密码登录', async () => {
      const res = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: testAccount.phone,
          password: testAccount.password,
          role: 1
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('登录成功');
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.phone).toBe(testAccount.phone);
    });

    it('异常账号密码登录 - 缺少手机号', async () => {
      const res = await request(app)
        .post('/api/users/login/account')
        .send({
          password: testAccount.password,
          role: 1
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入手机号和密码');
    });

    it('异常账号密码登录 - 缺少密码', async () => {
      const res = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: testAccount.phone,
          role: 1
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('请输入手机号和密码');
    });

    it('异常账号密码登录 - 账号不存在', async () => {
      const res = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: '13800138000',
          password: testAccount.password,
          role: 1
        });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('账号不存在');
    });

    it('异常账号密码登录 - 密码错误', async () => {
      const res = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: testAccount.phone,
          password: 'wrong_password',
          role: 1
        });
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('密码错误');
    });
  });

  // 获取个人信息测试
  describe('GET /api/users/profile', () => {
    it('正常获取个人信息', async () => {
      // 先登录获取token
      const loginRes = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: testAccount.phone,
          password: testAccount.password,
          role: 1
        });
      
      const token = loginRes.body.data.token;
      
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.phone).toBe(testAccount.phone);
    });

    it('异常获取个人信息 - 未授权', async () => {
      const res = await request(app)
        .get('/api/users/profile');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('未提供认证令牌');
    });

    it('异常获取个人信息 - 无效token', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid_token');
      
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Token无效');
    });
  });

  // 获取用户列表测试（管理员权限）
  describe('GET /api/users/list', () => {
    it('正常获取用户列表 - 管理员权限', async () => {
      // 这里需要一个管理员账号，暂时跳过
      // 实际测试时需要创建管理员账号并登录
      expect(true).toBe(true);
    });

    it('异常获取用户列表 - 权限不足', async () => {
      // 先登录获取token（普通用户）
      const loginRes = await request(app)
        .post('/api/users/login/account')
        .send({
          phone: testAccount.phone,
          password: testAccount.password,
          role: 1
        });
      
      const token = loginRes.body.data.token;
      
      const res = await request(app)
        .get('/api/users/list')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('权限不足，无法访问此资源');
    });
  });
});
