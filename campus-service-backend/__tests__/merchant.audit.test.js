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
      req.user = { id: 999, role: 3 };
      next();
    },
    checkRole: () => (_req, _res, next) => next()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('PUT /api/admin/merchants/:id/audit', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('approves merchant without columnExists ReferenceError', async () => {
    const conn = {
      beginTransaction: jest.fn().mockResolvedValueOnce(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValueOnce(),
      rollback: jest.fn().mockResolvedValueOnce(),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValueOnce(conn);

    // 1) SELECT merchant
    conn.query.mockResolvedValueOnce([[{ id: 5, owner_user_id: 123 }]]);

    // 2) UPDATE merchant audit fields
    conn.query.mockResolvedValueOnce([{}]);

    // 3) UPDATE merchant status
    conn.query.mockResolvedValueOnce([{}]);

    // 4) columnExists(user, merchant_id) -> count 0
    conn.query.mockResolvedValueOnce([[{ cnt: 0 }]]);

    // 5) UPDATE user role only
    conn.query.mockResolvedValueOnce([{}]);

    // 6) INSERT notification
    conn.query.mockResolvedValueOnce([{}]);

    // 7) SHOW TABLES LIKE admin_operation_log -> missing
    conn.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .put('/api/admin/merchants/5/audit')
      .send({ audit_status: 2, audit_remark: '' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('审核通过');

    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalledTimes(0);
  });
});
