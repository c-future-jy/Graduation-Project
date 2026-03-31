const request = require('supertest');

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

describe('keyword search on public list APIs', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('GET /api/merchants supports keyword', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, name: '奶茶店', description: '好喝' }]]);

    const res = await request(app)
      .get('/api/merchants')
      .query({ keyword: '奶茶' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.merchants).toHaveLength(1);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('FROM merchant'));
    expect(sql).toEqual(expect.stringContaining('LIKE'));
    expect(params).toEqual(expect.arrayContaining(['%奶茶%', '%奶茶%']));
  });

  test('GET /api/products supports keyword and q alias', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 9, name: '炸鸡', description: '香' }]]);

    const res = await request(app)
      .get('/api/products')
      .query({ q: '鸡' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toHaveLength(1);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toEqual(expect.stringContaining('FROM product'));
    expect(sql).toEqual(expect.stringContaining('LIKE'));
    expect(params).toEqual(expect.arrayContaining(['%鸡%', '%鸡%']));
  });
});
