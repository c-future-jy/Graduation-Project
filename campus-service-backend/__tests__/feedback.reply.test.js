const request = require('supertest');

jest.mock('../config/db', () => {
  return {
    pool: {
      query: jest.fn(),
      getConnection: jest.fn()
    },
    testConnection: jest.fn()
  };
});

jest.mock('../middleware/auth', () => {
  return {
    auth: (req, _res, next) => {
      // 商家身份（role=2），并在 token 中携带 merchant_id，避免额外查库
      req.user = { id: 111, role: 2, merchant_id: 7 };
      next();
    },
    checkRole: () => (_req, _res, next) => next()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('PUT /api/feedback/:id/reply', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('推送通知内容包含真实回复文本', async () => {
    const conn = {
      beginTransaction: jest.fn().mockResolvedValueOnce(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValueOnce(),
      rollback: jest.fn().mockResolvedValueOnce(),
      release: jest.fn()
    };

    pool.getConnection.mockResolvedValueOnce(conn);

    // hasTableColumn('feedback','type') -> SHOW COLUMNS FROM `feedback`
    pool.query.mockResolvedValueOnce([[{ Field: 'id' }, { Field: 'type' }, { Field: 'content' }]]);

    // 1) SELECT feedback
    conn.query.mockResolvedValueOnce([
      [{ id: 123, user_id: 222, merchant_id: 7, type: 2, content: '配送速度较慢' }]
    ]);

    // 2) UPDATE feedback
    conn.query.mockResolvedValueOnce([{}]);

    // 3) INSERT notification
    conn.query.mockResolvedValueOnce([{}]);

    const replyText = '已优化出餐流程';

    const res = await request(app)
      .put('/api/feedback/123/reply')
      .send({ reply: replyText });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 找到 INSERT notification 的那次调用，断言 content 包含回复
    const insertCall = conn.query.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO notification')
    );

    expect(insertCall).toBeTruthy();
    const params = insertCall[1];
    expect(params[0]).toBe(222); // user_id
    expect(params[1]).toBe('反馈已回复');
    expect(String(params[2])).toContain(replyText);
    expect(String(params[2])).toContain('配送速度较慢');
    expect(params[3]).toBe(1); // type=反馈

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });
});
