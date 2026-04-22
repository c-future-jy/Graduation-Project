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
      // role=2 商家，携带 merchant_id，避免额外查 owner_user_id
      req.user = { id: 9, role: 2, merchant_id: 7 };
      next();
    },
    checkRole: () => (_req, _res, next) => next()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('GET /api/feedback/my (images disabled)', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('即便数据库返回 images 字段，也不会在响应中暴露', async () => {
    pool.query.mockImplementation(async (sql) => {
      const normalizedSql = String(sql || '').replace(/\s+/g, ' ').trim();

      if (normalizedSql.startsWith('SHOW COLUMNS FROM `feedback`')) {
        return [[{ Field: 'id' }, { Field: 'created_at' }, { Field: 'images' }, { Field: 'type' }, { Field: 'status' }]];
      }
      if (normalizedSql.startsWith('SHOW COLUMNS FROM `user`')) {
        return [[{ Field: 'id' }, { Field: 'nickname' }]];
      }
      if (normalizedSql.startsWith('SHOW COLUMNS FROM `order`')) {
        return [[{ Field: 'id' }, { Field: 'order_no' }]];
      }

      if (normalizedSql.includes('FROM feedback f')) {
        return [
          [
            {
              id: 1,
              type: 1,
              order_id: 2,
              merchant_id: 7,
              rating: 5,
              content: '好评',
              images: '["/uploads/files/a.jpg","/uploads/files/b.jpg"]',
              created_at: '2026-04-10 12:00:00',
              reply: null,
              reply_time: null,
              status: 0,
              user_name: '张三',
              order_no: 'NO123'
            }
          ]
        ];
      }

      throw new Error(`Unexpected SQL in test: ${normalizedSql}`);
    });

    const res = await request(app).get('/api/feedback/my');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const list = res.body.data && res.body.data.feedbacks;
    expect(Array.isArray(list)).toBe(true);

    expect(list[0]).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(list[0], 'images')).toBe(false);
  });
});
