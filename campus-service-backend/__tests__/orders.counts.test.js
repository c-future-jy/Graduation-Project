const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => {
  return {
    pool: {
      query: jest.fn()
    },
    testConnection: jest.fn()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('GET /api/orders/counts', () => {
  beforeEach(() => {
    pool.query.mockReset();
    process.env.JWT_SECRET = 'test-secret';
  });

  test('未携带 token 时返回 401', async () => {
    const res = await request(app).get('/api/orders/counts');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false
    });
  });

  test('携带 token 时返回统计字段', async () => {
    pool.query.mockResolvedValueOnce([[{ status: 0, count: 2 }, { status: 1, count: 3 }]]);

    const token = jwt.sign({ id: 123, role: 1 }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/api/orders/counts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      pendingPay: 2,
      pendingDeliver: 3,
      delivered: 0,
      completed: 0,
      cancelled: 0
    });
  });
});
