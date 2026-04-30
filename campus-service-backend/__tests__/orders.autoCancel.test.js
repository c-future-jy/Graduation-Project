jest.mock('../config/db', () => {
  return {
    pool: {
      query: jest.fn(),
      getConnection: jest.fn()
    },
    testConnection: jest.fn()
  };
});

const { pool } = require('../config/db');
const { runAutoCancelOnce } = require('../utils/orderAutoCancel');

describe('order auto-cancel (pending > N minutes)', () => {
  beforeEach(() => {
    pool.query.mockReset();
    pool.getConnection.mockReset();
  });

  test('cancels expired pending orders and restores stock', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 10, merchant_id: 2, order_no: 'TMP123' }]]);

    const conn = {
      beginTransaction: jest.fn().mockResolvedValueOnce(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValueOnce(),
      rollback: jest.fn().mockResolvedValueOnce(),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValueOnce(conn);

    conn.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([[{ product_id: 5, quantity: 2 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ owner_user_id: 99 }]])
      .mockResolvedValueOnce([{}]);

    const res = await runAutoCancelOnce({ pool, expireMinutes: 5, batchSize: 10 });

    expect(res).toMatchObject({ scanned: 1, cancelled: 1 });
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);

    const updateOrderCall = conn.query.mock.calls[0];
    expect(updateOrderCall[0]).toContain('UPDATE `order` SET status = 4');

    const restoreStockCall = conn.query.mock.calls.find((c) => String(c[0]).includes('UPDATE product SET stock = stock +'));
    expect(restoreStockCall).toBeTruthy();
    expect(restoreStockCall[1]).toEqual([2, 5]);
  });

  test('skips if order status already changed', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 11, merchant_id: 2, order_no: 'TMP999' }]]);

    const conn = {
      beginTransaction: jest.fn().mockResolvedValueOnce(),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValueOnce(),
      rollback: jest.fn().mockResolvedValueOnce(),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValueOnce(conn);

    conn.query.mockResolvedValueOnce([{ affectedRows: 0 }]);

    const res = await runAutoCancelOnce({ pool, expireMinutes: 5, batchSize: 10 });

    expect(res).toMatchObject({ scanned: 1, cancelled: 0 });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(0);
    expect(conn.release).toHaveBeenCalledTimes(1);
  });
});
