const request = require('supertest');

jest.mock('../config/db', () => {
  return {
    pool: {
      query: jest.fn()
    },
    testConnection: jest.fn()
  };
});

// Bypass real auth: inject a fake user id
jest.mock('../middleware/auth', () => {
  return {
    auth: (req, _res, next) => {
      req.user = { id: 123, role: 1 };
      next();
    },
    checkRole: () => (_req, _res, next) => next()
  };
});

const { pool } = require('../config/db');
const app = require('../app');

describe('POST /api/merchants/apply', () => {
  beforeEach(() => {
    pool.query.mockReset();
  });

  test('submits application even when admin_operation_log table is missing', async () => {
    // 1) SELECT role FROM user WHERE id = ?
    pool.query.mockResolvedValueOnce([[{ role: 1 }]]);
    // 2) SELECT id, audit_status FROM merchant WHERE owner_user_id = ?
    pool.query.mockResolvedValueOnce([[]]);
    // 3) information_schema.columns for merchant table
    pool.query.mockResolvedValueOnce([
      [
        { COLUMN_NAME: 'owner_user_id' },
        { COLUMN_NAME: 'name' },
        { COLUMN_NAME: 'status' },
        { COLUMN_NAME: 'phone' },
        { COLUMN_NAME: 'address' },
        { COLUMN_NAME: 'description' },
        { COLUMN_NAME: 'logo' },
        { COLUMN_NAME: 'audit_status' },
        { COLUMN_NAME: 'created_at' },
        { COLUMN_NAME: 'updated_at' }
      ]
    ]);
    // 4) INSERT INTO merchant ...
    pool.query.mockResolvedValueOnce([{ insertId: 456 }]);
    // 5) SHOW TABLES LIKE 'admin_operation_log' => missing
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/merchants/apply')
      .send({ nickname: '测试店铺', phone: '' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.merchantId).toBe(456);

    // Ensure we attempted to insert with optional fields & NOW()
    const insertCall = pool.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO merchant')
    );
    expect(insertCall).toBeTruthy();
    const [insertSql, insertParams] = insertCall;
    expect(insertSql).toEqual(expect.stringContaining('owner_user_id'));
    expect(insertSql).toEqual(expect.stringContaining('phone'));
    expect(insertSql).toEqual(expect.stringContaining('audit_status'));
    expect(insertSql).toEqual(expect.stringContaining('NOW()'));

    // Params should contain our user id and nickname
    expect(insertParams).toEqual(expect.arrayContaining([123, '测试店铺']));

    // Since log table is missing, there should be no INSERT into admin_operation_log
    const wroteLog = pool.query.mock.calls.some(([sql]) =>
      String(sql).includes('INSERT INTO admin_operation_log')
    );
    expect(wroteLog).toBe(false);
  });

  test('allows reapply when previous application was rejected', async () => {
    // 1) SELECT role FROM user WHERE id = ?
    pool.query.mockResolvedValueOnce([[{ role: 1 }]]);
    // 2) existing merchant row with audit_status=3 (rejected)
    pool.query.mockResolvedValueOnce([[{ id: 777, audit_status: 3 }]]);
    // 3) information_schema.columns for merchant table (for UPDATE field selection)
    pool.query.mockResolvedValueOnce([
      [
        { COLUMN_NAME: 'name' },
        { COLUMN_NAME: 'phone' },
        { COLUMN_NAME: 'status' },
        { COLUMN_NAME: 'audit_status' },
        { COLUMN_NAME: 'audit_remark' },
        { COLUMN_NAME: 'updated_at' }
      ]
    ]);
    // 4) UPDATE merchant ...
    pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    // 5) SHOW TABLES LIKE 'admin_operation_log' => missing
    pool.query.mockResolvedValueOnce([[]]);

    const res = await request(app)
      .post('/api/merchants/apply')
      .send({ nickname: '再次申请店铺', phone: '123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.merchantId).toBe(777);

    const updateCall = pool.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE merchant SET')
    );
    expect(updateCall).toBeTruthy();
    const [updateSql, updateParams] = updateCall;
    expect(updateSql).toEqual(expect.stringContaining('audit_status'));
    expect(updateSql).toEqual(expect.stringContaining('audit_remark'));
    expect(updateSql).toEqual(expect.stringContaining('updated_at = NOW()'));
    expect(updateParams[updateParams.length - 1]).toBe(777);
  });

  test('returns 400 when nickname is missing', async () => {
    const res = await request(app).post('/api/merchants/apply').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
