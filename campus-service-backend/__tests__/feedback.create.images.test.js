const request = require('supertest');

jest.mock('../config/db', () => {
  return {
    pool: {
      query: jest.fn()
    },
    testConnection: jest.fn()
  };
});

jest.mock('../middleware/auth', () => {
  return {
    auth: (req, _res, next) => {
      req.user = { id: 1, role: 1 };
      next();
    },
    checkRole: () => (_req, _res, next) => next()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('POST /api/feedback (images)', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('当请求携带 images 时，直接拒绝（400）且不触发数据库写入', async () => {
    const images = ['/uploads/files/a.jpg', '/uploads/files/b.jpg'];

    const res = await request(app)
      .post('/api/feedback')
      .send({
        type: 3,
        content: '商品不错',
        images
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('暂不支持');

    expect(pool.query).not.toHaveBeenCalled();
  });
});
