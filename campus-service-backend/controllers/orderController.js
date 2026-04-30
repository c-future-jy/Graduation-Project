const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

let _cachedOrderPaymentMethodColumnIsNumeric = null;

async function isOrderPaymentMethodColumnNumeric() {
  if (_cachedOrderPaymentMethodColumnIsNumeric !== null) {
    return _cachedOrderPaymentMethodColumnIsNumeric;
  }
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM `order` LIKE 'payment_method'");
    const type = (rows && rows[0] && rows[0].Type) ? String(rows[0].Type).toLowerCase() : '';
    _cachedOrderPaymentMethodColumnIsNumeric = /(tinyint|smallint|mediumint|int|bigint|decimal|numeric)/i.test(type);
  } catch (e) {
    // 保守处理：如果无法探测列类型，按字符串处理（避免错误映射）
    _cachedOrderPaymentMethodColumnIsNumeric = false;
  }
  return _cachedOrderPaymentMethodColumnIsNumeric;
}

function normalizePaymentMethodString(payment_method) {
  const v = String(payment_method || 'wechat').trim().toLowerCase();
  return v || 'wechat';
}

function paymentMethodToDbValue(paymentMethodStr, columnIsNumeric) {
  const method = normalizePaymentMethodString(paymentMethodStr);

  if (!columnIsNumeric) {
    return method;
  }

  // 兼容：部分历史库把 payment_method 存成 tinyint
  // 约定：1=微信支付，9=模拟支付（仅用于开发/演示）
  if (method === 'mock') return 9;
  if (method === 'wechat' || method === 'wxpay' || method === 'weixin') return 1;

  const n = parseInt(method, 10);
  if (Number.isFinite(n)) return n;
  return 1;
}

function paymentMethodToResponseValue(paymentMethodValue) {
  if (paymentMethodValue === null || paymentMethodValue === undefined) return null;
  const raw = String(paymentMethodValue).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === 'mock' || lower === 'wechat' || lower === 'wxpay' || lower === 'weixin') {
    return lower === 'wxpay' || lower === 'weixin' ? 'wechat' : lower;
  }

  const n = parseInt(lower, 10);
  if (Number.isFinite(n)) {
    if (n === 9) return 'mock';
    if (n === 1) return 'wechat';
  }

  return raw;
}

async function getMerchantOwnerUserIdByMerchantId(merchantId, connOrPool = pool) {
  if (!merchantId) return null;
  const [rows] = await connOrPool.query(
    'SELECT owner_user_id FROM merchant WHERE id = ? LIMIT 1',
    [merchantId]
  );
  const ownerUserId = rows && rows[0] && rows[0].owner_user_id;
  return ownerUserId ? parseInt(ownerUserId, 10) : null;
}

async function insertOrderNotification(connOrPool, userId, title, content) {
  if (!userId) return;
  await connOrPool.query(
    'INSERT INTO notification (user_id, title, content, type, created_at) VALUES (?, ?, ?, ?, NOW())',
    [userId, title, content, 3]
  );
}

// 生成订单号
const generateOrderNo = () => {
  const timestamp = Date.now().toString();
  const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
  return 'ORD' + timestamp + randomStr;
};

// 生成临时订单号（用于待支付阶段占位，支付完成后会被正式 ORD 号替换）
const generateTempOrderNo = () => {
  const timestamp = Date.now().toString();
  const randomStr = Math.random().toString(36).substr(2, 9).toUpperCase();
  return 'TMP' + timestamp + randomStr;
};

let _cachedOrderNoColumnExists = null;
async function hasOrderNoColumn() {
  if (_cachedOrderNoColumnExists !== null) return _cachedOrderNoColumnExists;
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM `order` LIKE 'order_no'");
    _cachedOrderNoColumnExists = !!(rows && rows.length > 0);
  } catch (e) {
    _cachedOrderNoColumnExists = false;
  }
  return _cachedOrderNoColumnExists;
}

// 获取订单列表
exports.getOrderList = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit, pageSize } = req.query;
    const resolvedLimitRaw = limit != null && String(limit).trim() !== '' ? limit : pageSize;
    const resolvedLimit = Math.max(1, parseInt(resolvedLimitRaw || 10, 10) || 10);
    const resolvedPage = Math.max(1, parseInt(page || 1, 10) || 1);
    const offset = (resolvedPage - 1) * resolvedLimit;
    
    // 构建查询语句
    let query = `
      SELECT 
        o.*, 
        m.name as merchantName, 
        m.logo as merchantLogo
      FROM 
        \`order\` o
      JOIN 
        merchant m ON o.merchant_id = m.id
      WHERE 
        o.user_id = ?
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM `order` WHERE user_id = ?';
    let params = [userId];
    
    // 状态筛选
    if (status) {
      query += ' AND o.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }
    
    // 分页和排序
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(resolvedLimit, offset);
    
    // 执行查询
    const [orders] = await pool.query(query, params);

    // 将订单项聚合到列表返回中，避免前端为列表 N+1 请求。
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id).filter(Boolean);
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => '?').join(',');
        const [items] = await pool.query(
          `SELECT order_id, product_id, product_name, product_image, price, quantity
           FROM order_item
           WHERE order_id IN (${placeholders})
           ORDER BY id ASC`,
          orderIds
        );

        const grouped = {};
        (items || []).forEach(it => {
          const oid = it.order_id;
          if (!oid) return;
          if (!grouped[oid]) grouped[oid] = [];
          grouped[oid].push({
            goodsId: it.product_id,
            name: it.product_name,
            image: it.product_image,
            price: it.price,
            quantity: it.quantity
          });
        });

        orders.forEach(o => {
          const goodsList = grouped[o.id] || [];
          o.goodsList = goodsList;
          o.totalQuantity = goodsList.reduce((sum, g) => sum + (parseInt(g.quantity, 10) || 0), 0);
        });
      }
    }

    orders.forEach(o => {
      o.payment_method = paymentMethodToResponseValue(o.payment_method);
    });
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    
    // 统计各状态订单数量
    const [statusCounts] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `order` WHERE user_id = ? GROUP BY status',
      [userId]
    );
    
    const statusCountMap = {};
    statusCounts.forEach(item => {
      statusCountMap[item.status] = item.count;
    });
    
    successResponse(res, {
      orders,
      pagination: {
        page: resolvedPage,
        pageSize: resolvedLimit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / resolvedLimit)
      },
      statusCounts: statusCountMap
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 获取订单详情
exports.getOrderById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    // 查询订单信息
    const [orders] = await pool.query(
      `
        SELECT 
          o.*, 
          m.name as merchantName, 
          m.logo as merchantLogo
        FROM 
          \`order\` o
        JOIN 
          merchant m ON o.merchant_id = m.id
        WHERE 
          o.id = ? AND o.user_id = ?
      `,
      [orderId, userId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }

    orders[0].payment_method = paymentMethodToResponseValue(orders[0].payment_method);
    
    // 查询订单详情
    const [items] = await pool.query('SELECT * FROM order_item WHERE order_id = ?', [orderId]);
    
    successResponse(res, {
      order: orders[0],
      items
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 创建订单
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { merchant_id, items, address_id, remark, payment_method = 'wechat', delivery_type, pickup_time } = req.body;
    const payMethod = normalizePaymentMethodString(payment_method);
    const paymentMethodDb = paymentMethodToDbValue(payMethod, await isOrderPaymentMethodColumnNumeric());
    
    // 验证参数
    if (!merchant_id || !items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, '缺少必要参数');
    }

    const normalizedDeliveryType = String(delivery_type || 'delivery').trim().toLowerCase() === 'self'
      ? 'self'
      : 'delivery';

    // 校验商家状态：禁用/休息/未通过审核时，不允许下单
    let merchantRows;
    try {
      [merchantRows] = await pool.query(
        'SELECT status, audit_status, name, address, phone FROM merchant WHERE id = ?',
        [merchant_id]
      );
    } catch (e) {
      const msg = e && e.message ? String(e.message) : '';
      const missingAuditCol =
        (e && e.code === 'ER_BAD_FIELD_ERROR') ||
        msg.includes("Unknown column 'audit_status'") ||
        msg.includes('Unknown column audit_status');
      if (!missingAuditCol) throw e;
      [merchantRows] = await pool.query(
        'SELECT status, name, address, phone FROM merchant WHERE id = ?',
        [merchant_id]
      );
    }
    if (merchantRows.length === 0) {
      return errorResponse(res, 400, '商家不存在');
    }
    const merchantStatus = parseInt(merchantRows[0].status, 10);
    const auditStatus = merchantRows[0].audit_status === undefined ? null : parseInt(merchantRows[0].audit_status, 10);

    if (merchantStatus !== 1) {
      return errorResponse(res, 400, '商家已休息或被禁用，暂无法下单');
    }
    if (auditStatus !== null && auditStatus !== 2) {
      return errorResponse(res, 400, '商家未通过审核，暂无法下单');
    }
    
    // 验证地址（配送上门才需要）
    let receiverName, receiverPhone, receiverAddress;
    if (normalizedDeliveryType === 'delivery') {
      if (address_id) {
        const [addresses] = await pool.query(
          'SELECT receiver_name, phone, province, city, district, detail FROM address WHERE id = ? AND user_id = ?',
          [address_id, userId]
        );

        if (addresses.length === 0) {
          return errorResponse(res, 400, '地址不存在');
        }

        const address = addresses[0];
        receiverName = address.receiver_name;
        receiverPhone = address.phone;
        receiverAddress = `${address.province}${address.city}${address.district}${address.detail}`;
      } else {
        return errorResponse(res, 400, '请选择收货地址');
      }
    } else {
      // 到店自取：使用商家地址做收货信息兜底（避免表字段非空导致插入失败）
      const m = merchantRows[0] || {};
      receiverName = '到店自取';
      receiverPhone = m.phone ? String(m.phone) : '';
      receiverAddress = m.address ? String(m.address) : (m.name ? String(m.name) : '到店自取');
    }

    // 将自取时间写入备注（不新增数据库字段，保持兼容）
    let finalRemark = remark;
    if (normalizedDeliveryType === 'self' && pickup_time) {
      const t = String(pickup_time).trim();
      if (t) {
        finalRemark = finalRemark ? `${finalRemark}；自取时间:${t}` : `自取时间:${t}`;
      }
    }

    // 注意：mysql2 的 pool.query('START TRANSACTION') 不能保证后续查询在同一连接上，
    // 必须使用同一条 connection 才能保证事务正确。
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 订单号：待支付时用临时号占位；支付完成后（status=1）生成正式 ORD 号
      // 说明：部分库的 order_no 为 UNIQUE NOT NULL，必须在创建时写入一个值。
      const orderNo = generateTempOrderNo();

      // 计算总金额
      let totalAmount = 0;
      const productCache = new Map();

      // 校验库存并扣减
      for (const item of items) {
        const productId = item && item.product_id;
        const qty = parseInt(item && item.quantity, 10);

        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          await conn.rollback();
          return errorResponse(res, 400, '商品信息不完整');
        }

        // FOR UPDATE 锁定行，避免并发超卖
        const [products] = await conn.query(
          'SELECT stock, name, image, price FROM product WHERE id = ? AND merchant_id = ? AND status = 1 FOR UPDATE',
          [productId, merchant_id]
        );

        if (!products || products.length === 0) {
          await conn.rollback();
          return errorResponse(res, 400, '商品不存在或已下架');
        }

        const product = products[0];
        if (qty > product.stock) {
          await conn.rollback();
          return errorResponse(res, 400, `商品 ${product.name} 库存不足`);
        }

        const [upd] = await conn.query(
          'UPDATE product SET stock = stock - ? WHERE id = ? AND stock >= ?',
          [qty, productId, qty]
        );
        if (!upd || upd.affectedRows !== 1) {
          await conn.rollback();
          return errorResponse(res, 400, `商品 ${product.name} 库存不足`);
        }

        productCache.set(String(productId), product);
        totalAmount += product.price * qty;
      }

      // 订单创建后统一进入待支付（status=0）。
      // 模拟支付的“支付成功”由前端确认后调用 /orders/:id/status 变更为 status=1。
      const orderStatus = 0;
      const [orderResult] = await conn.query(
        `
          INSERT INTO \`order\` (
            order_no,
            user_id,
            merchant_id,
            total_amount,
            receiver_name,
            receiver_phone,
            receiver_address,
            remark,
            payment_method,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [orderNo, userId, merchant_id, totalAmount, receiverName, receiverPhone, receiverAddress, finalRemark, paymentMethodDb, orderStatus]
      );

      // 订单创建后通知商家（owner_user_id）有新订单待处理
      try {
        const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(merchant_id, conn);
        if (merchantOwnerUserId) {
          await insertOrderNotification(
            conn,
            merchantOwnerUserId,
            '新订单待处理',
            `收到新订单${orderNo ? `（${orderNo}）` : ''}，请及时处理`
          );
        }
      } catch (_) {
        // 通知失败不影响下单主流程
      }



      // 创建订单详情
      for (const item of items) {
        const productId = item.product_id;
        const qty = parseInt(item.quantity, 10);
        const product = productCache.get(String(productId));
        if (!product) {
          await conn.rollback();
          return errorResponse(res, 400, '商品信息不完整');
        }

        const subtotal = product.price * qty;
        await conn.query(
          `
            INSERT INTO order_item (
              order_id,
              product_id,
              product_name,
              product_image,
              price,
              quantity,
              subtotal
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [orderResult.insertId, productId, product.name, product.image, product.price, qty, subtotal]
        );
      }

      // 清理购物车中已购买的商品：优先删除 selected=1（结算页使用选中项）
      try {
        await conn.query('DELETE FROM cart WHERE user_id = ? AND selected = 1', [userId]);
      } catch (e) {
        // 兼容旧表/异常：退化为删除本次下单的商品
        const ids = items.map((x) => x.product_id).filter(Boolean);
        if (ids.length > 0) {
          await conn.query(
            `DELETE FROM cart WHERE user_id = ? AND merchant_id = ? AND product_id IN (${ids.map(() => '?').join(',')})`,
            [userId, merchant_id, ...ids]
          );
        }
      }

      await conn.commit();

      successResponse(res, {
        orderId: orderResult.insertId,
        orderNo,
        pay: {
          provider: payMethod === 'mock' ? 'mock' : 'wechat',
          status: 'pending'
        }
      }, '订单创建成功');
    } catch (transactionError) {
      try {
        await conn.rollback();
      } catch (_) {
        // ignore
      }
      console.error('创建订单失败:', {
        code: transactionError && transactionError.code,
        errno: transactionError && transactionError.errno,
        sqlState: transactionError && transactionError.sqlState,
        sqlMessage: transactionError && transactionError.sqlMessage,
        message: transactionError && transactionError.message,
        sql: transactionError && transactionError.sql
      });
      errorResponse(res, 500, '订单创建失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('创建订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 取消订单
exports.cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT id, order_no, status, merchant_id FROM `order` WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 检查订单状态
    if (order.status !== 0 && order.status !== 1) {
      return errorResponse(res, 400, '该订单状态不允许取消');
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE `order` SET status = 4, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [orderId, userId]
      );

      const [items] = await conn.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await conn.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      // 通知商家：用户取消订单
      const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);
      if (merchantOwnerUserId) {
        await insertOrderNotification(
          conn,
          merchantOwnerUserId,
          '订单已取消',
          `用户已取消订单${order.order_no ? `（${order.order_no}）` : ''}`
        );
      }

      await conn.commit();
      successResponse(res, null, '订单已取消');
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('取消订单失败:', transactionError);
      errorResponse(res, 500, '取消订单失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('取消订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 确认收货/完成订单
exports.completeOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const [orders] = await pool.query(
      'SELECT id, order_no, status, merchant_id FROM `order` WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    if (!orders || orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }

    const order = orders[0];
    if (parseInt(order.status, 10) !== 2) {
      return errorResponse(res, 400, '该订单状态不允许确认收货');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE `order` SET status = 3, complete_time = NOW(), updated_at = NOW() WHERE id = ? AND user_id = ?',
        [orderId, userId]
      );

      // 通知商家：订单完成
      const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);
      if (merchantOwnerUserId) {
        await insertOrderNotification(
          conn,
          merchantOwnerUserId,
          '订单已完成',
          `用户已确认收货${order.order_no ? `（${order.order_no}）` : ''}`
        );
      }

      await conn.commit();
      successResponse(res, null, '已确认收货');
    } catch (e) {
      await conn.rollback().catch(() => {});
      console.error('确认收货失败:', e);
      errorResponse(res, 500, '确认收货失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('确认收货失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 更新订单状态
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const orderId = req.params.id;
    const { status } = req.body;
    const statusNum = status === undefined || status === null || status === '' ? NaN : parseInt(status, 10);
    
    // 验证参数
    if (!Number.isFinite(statusNum)) {
      return errorResponse(res, 400, '缺少状态参数');
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT id, order_no, status, merchant_id, user_id FROM `order` WHERE id = ?',
      [orderId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 权限验证
    if (userRole !== 3) {
      if (userRole === 1 && order.user_id !== userId) {
        return errorResponse(res, 403, '无权操作该订单');
      }
      if (userRole === 2 && order.merchant_id !== req.user.merchant_id) {
        return errorResponse(res, 403, '无权操作该订单');
      }
    }
    
    // 状态流转验证
    const validTransitions = {
      0: [1, 4], // 待支付 → 待发货/已取消
      1: [2, 4], // 待发货 → 已发货/已取消
      2: [3],     // 已发货 → 已完成
      3: [],      // 已完成 → 无
      4: []       // 已取消 → 无
    };
    
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(statusNum)) {
      return errorResponse(res, 400, '无效的状态变更');
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let updateFields = ['status = ?', 'updated_at = NOW()'];
      let updateParams = [statusNum];

      if (statusNum === 1) {
        updateFields.push('payment_time = NOW()');

        // 支付完成后生成正式订单号：ORD + 时间戳 + 随机串
        // 若库结构不包含 order_no，则跳过（兼容旧库）。
        if (await hasOrderNoColumn()) {
          updateFields.push('order_no = ?');
          updateParams.push(generateOrderNo());
        }
      } else if (statusNum === 2) {
        updateFields.push('delivery_time = NOW()');
      } else if (statusNum === 3) {
        updateFields.push('complete_time = NOW()');
      }

      updateParams.push(orderId);
      await conn.query(`UPDATE \`order\` SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

      // 若是取消（0/1 -> 4），恢复库存
      if (statusNum === 4 && (order.status === 0 || order.status === 1)) {
        const [items] = await conn.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [orderId]);
        for (const item of items) {
          await conn.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      const orderNoSuffix = order.order_no ? `（${order.order_no}）` : '';
      const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);

      if (statusNum === 1) {
        if (merchantOwnerUserId) {
          await insertOrderNotification(conn, merchantOwnerUserId, '新订单待处理', `订单已支付，待发货${orderNoSuffix}`);
        }
      } else if (statusNum === 2) {
        await insertOrderNotification(conn, order.user_id, '订单已发货', `您的订单已发货，请注意查收${orderNoSuffix}`);
      } else if (statusNum === 3) {
        if (merchantOwnerUserId) {
          await insertOrderNotification(conn, merchantOwnerUserId, '订单已完成', `订单已完成${orderNoSuffix}`);
        }
      } else if (statusNum === 4) {
        await insertOrderNotification(conn, order.user_id, '订单已取消', `您的订单已取消${orderNoSuffix}`);
        if (merchantOwnerUserId) {
          await insertOrderNotification(conn, merchantOwnerUserId, '订单已取消', `订单已取消${orderNoSuffix}`);
        }
      }

      await conn.commit();
      successResponse(res, null, '订单状态更新成功');
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('更新订单状态失败:', transactionError);
      errorResponse(res, 500, '更新订单状态失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('更新订单状态失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 删除订单
exports.deleteOrder = async (req, res, next) => {
  try {
    // 仅管理员允许删除订单（路由层已做 checkRole，这里再做一层兜底）
    if (!req.user || parseInt(req.user.role, 10) !== 3) {
      return errorResponse(res, 403, '权限不足，无法访问此资源');
    }
    const orderId = req.params.id;

    const [orders] = await pool.query('SELECT id FROM `order` WHERE id = ?', [orderId]);
    if (!orders || orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query('DELETE FROM order_item WHERE order_id = ?', [orderId]);
      await conn.query('DELETE FROM `order` WHERE id = ?', [orderId]);

      await conn.commit();
      return successResponse(res, null, '订单删除成功');
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('删除订单失败:', transactionError);
      return errorResponse(res, 500, '删除订单失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('删除订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 用户：再次购买（把订单商品加入购物车）
// POST /api/orders/:id/buy-again
exports.buyAgain = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    const [orders] = await pool.query(
      'SELECT id, merchant_id FROM `order` WHERE id = ? AND user_id = ?',
      [orderId, userId]
    );
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }

    const merchantId = orders[0].merchant_id;
    const [items] = await pool.query(
      'SELECT product_id, quantity FROM order_item WHERE order_id = ?',
      [orderId]
    );
    if (!items || items.length === 0) {
      return errorResponse(res, 400, '订单无可再次购买的商品');
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const productId = item.product_id;
      const qty = Math.max(parseInt(item.quantity, 10) || 0, 0);
      if (!productId || qty <= 0) {
        skippedCount++;
        continue;
      }

      const [products] = await pool.query(
        'SELECT id, stock, status, merchant_id FROM product WHERE id = ?',
        [productId]
      );
      if (products.length === 0) {
        skippedCount++;
        continue;
      }

      const product = products[0];
      const stock = Math.max(parseInt(product.stock, 10) || 0, 0);
      if (parseInt(product.status, 10) !== 1 || parseInt(product.merchant_id, 10) !== parseInt(merchantId, 10) || stock <= 0) {
        skippedCount++;
        continue;
      }

      const addQty = Math.min(qty, stock, 99);
      if (addQty <= 0) {
        skippedCount++;
        continue;
      }

      // spec 字段在部分库中为 NOT NULL，这里统一用空字符串作为默认规格
      const spec = '';

      await pool.query(
        `INSERT INTO cart (user_id, product_id, merchant_id, quantity, spec, selected)
         VALUES (?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
         quantity = LEAST(quantity + VALUES(quantity), ?),
         merchant_id = VALUES(merchant_id),
         selected = 1,
         updated_at = NOW()`,
        [userId, productId, merchantId, addQty, spec, stock]
      );

      addedCount++;
    }

    successResponse(res, { addedCount, skippedCount }, '商品已加入购物车');
  } catch (error) {
    console.error('再次购买失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 商家获取订单列表
exports.getMerchantOrders = async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;
    const { status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;
    
    // 验证商家身份
    if (!merchantId) {
      return errorResponse(res, 403, '商家身份验证失败');
    }
    
    // 构建查询语句
    let query = `
      SELECT 
        o.*, 
        u.nickname as user_nickname, 
        u.avatar_url as user_avatar, 
        u.phone as user_phone
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      WHERE 
        o.merchant_id = ?
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total 
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      WHERE 
        o.merchant_id = ?
    `;
    let params = [merchantId];
    
    // 状态筛选
    if (status) {
      query += ' AND o.status = ?';
      countQuery += ' AND o.status = ?';
      params.push(status);
    }
    
    // 关键词搜索
    if (keyword) {
      query += ' AND (o.order_no LIKE ? OR u.nickname LIKE ?)';
      countQuery += ' AND (o.order_no LIKE ? OR u.nickname LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    
    // 分页和排序
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    // 执行查询
    const [orders] = await pool.query(query, params);
    orders.forEach(o => {
      o.payment_method = paymentMethodToResponseValue(o.payment_method);
    });
    const [countResult] = await pool.query(countQuery, params.slice(0, -2));
    
    // 获取每个订单的商品信息
    for (const order of orders) {
      const [items] = await pool.query('SELECT * FROM order_item WHERE order_id = ?', [order.id]);
      order.products = items;
    }
    
    successResponse(res, {
      orders,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取商家订单列表失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 商家获取订单详情
exports.getMerchantOrderById = async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;
    const orderId = req.params.id;
    
    // 验证商家身份
    if (!merchantId) {
      return errorResponse(res, 403, '商家身份验证失败');
    }
    
    // 查询订单信息
    const [orders] = await pool.query(
      `
        SELECT 
          o.*, 
          u.nickname as user_nickname, 
          u.avatar_url as user_avatar, 
          u.phone as user_phone
        FROM 
          \`order\` o
        LEFT JOIN 
          user u ON o.user_id = u.id
        WHERE 
          o.id = ? AND o.merchant_id = ?
      `,
      [orderId, merchantId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    order.payment_method = paymentMethodToResponseValue(order.payment_method);
    
    // 查询订单详情
    const [items] = await pool.query('SELECT * FROM order_item WHERE order_id = ?', [orderId]);
    order.products = items;
    
    successResponse(res, {
      order
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 商家发货
exports.shipOrder = async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;
    const orderId = req.params.id;
    
    // 验证商家身份
    if (!merchantId) {
      return errorResponse(res, 403, '商家身份验证失败');
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT status, user_id FROM `order` WHERE id = ? AND merchant_id = ?',
      [orderId, merchantId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 检查订单状态
    if (order.status !== 1) {
      return errorResponse(res, 400, '该订单状态不允许发货');
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE `order` SET status = 2, delivery_time = NOW(), updated_at = NOW() WHERE id = ? AND merchant_id = ?',
        [orderId, merchantId]
      );

      await insertOrderNotification(conn, order.user_id, '订单已发货', '您的订单已发货，请注意查收');

      await conn.commit();
      successResponse(res, null, '发货成功');
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('发货失败:', transactionError);
      errorResponse(res, 500, '发货失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('发货失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 商家取消订单
exports.merchantCancelOrder = async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;
    const orderId = req.params.id;
    const { reason } = req.body;
    
    // 验证商家身份
    if (!merchantId) {
      return errorResponse(res, 403, '商家身份验证失败');
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query(
      'SELECT status, user_id FROM `order` WHERE id = ? AND merchant_id = ?',
      [orderId, merchantId]
    );
    
    if (orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }
    
    const order = orders[0];
    
    // 检查订单状态
    if (order.status !== 1) {
      return errorResponse(res, 400, '该订单状态不允许取消');
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE `order` SET status = 4, cancel_reason = ?, updated_at = NOW() WHERE id = ? AND merchant_id = ?',
        [reason, orderId, merchantId]
      );

      const [items] = await conn.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await conn.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      await insertOrderNotification(
        conn,
        order.user_id,
        '订单已取消',
        `您的订单已被商家取消，原因：${reason || '无'}`
      );

      await conn.commit();
      successResponse(res, null, '订单已取消');
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('取消订单失败:', transactionError);
      errorResponse(res, 500, '取消订单失败');
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('取消订单失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 管理员获取订单列表
exports.getAdminOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      order_no,
      keyword,
      user_id,
      merchant_id,
      status,
      startTime,
      endTime
    } = req.query;
    const resolvedPage = parseInt(page, 10) || 1;
    const resolvedPageSize = parseInt(pageSize, 10) || 10;
    const offset = (resolvedPage - 1) * resolvedPageSize;
    
    let query = `
      SELECT 
        o.*,
        u.nickname as user_name,
        m.name as merchant_name,
        (SELECT GROUP_CONCAT(DISTINCT product_image) FROM order_item WHERE order_id = o.id LIMIT 3) as product_images
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
    `;
    let countQuery = `
      SELECT 
        COUNT(*) as total
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
    `;
    const whereClause = [];
    const whereParams = [];
    
    // 构建筛选条件
    if (order_no) {
      whereClause.push('o.order_no LIKE ?');
      whereParams.push(`%${order_no}%`);
    }

    // 关键字搜索：订单号/用户昵称/商家名称/订单ID
    if (keyword) {
      whereClause.push('(o.order_no LIKE ? OR u.nickname LIKE ? OR m.name LIKE ? OR CAST(o.id AS CHAR) LIKE ?)');
      const like = `%${keyword}%`;
      whereParams.push(like, like, like, like);
    }
    
    if (user_id) {
      whereClause.push('o.user_id = ?');
      whereParams.push(user_id);
    }
    
    if (merchant_id) {
      whereClause.push('o.merchant_id = ?');
      whereParams.push(merchant_id);
    }
    
    if (status !== undefined) {
      whereClause.push('o.status = ?');
      whereParams.push(status);
    }
    
    if (startTime) {
      whereClause.push('o.created_at >= ?');
      whereParams.push(startTime);
    }
    
    if (endTime) {
      whereClause.push('o.created_at <= ?');
      whereParams.push(endTime);
    }
    
    // 添加WHERE子句
    const whereSql = whereClause.length > 0 ? ' WHERE ' + whereClause.join(' AND ') : '';
    query += whereSql;
    countQuery += whereSql;
    
    // 添加排序和分页
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    const listParams = [...whereParams, resolvedPageSize, offset];

    const [orders] = await pool.query(query, listParams);
    orders.forEach(o => {
      o.payment_method = paymentMethodToResponseValue(o.payment_method);
    });

    const [countResult] = await pool.query(countQuery, whereParams);

    const statusCountQuery = `
      SELECT o.status, COUNT(*) as count
      FROM \`order\` o
      LEFT JOIN user u ON o.user_id = u.id
      LEFT JOIN merchant m ON o.merchant_id = m.id
      ${whereSql}
      GROUP BY o.status
    `;
    const [statusCountRows] = await pool.query(statusCountQuery, whereParams);
    const statusCounts = {};
    statusCountRows.forEach(row => {
      statusCounts[row.status] = row.count;
    });
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / resolvedPageSize);
    
    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: resolvedPage,
          pageSize: resolvedPageSize,
          totalPages
        },
        statusCounts
      }
    });
  } catch (error) {
    console.error('获取管理员订单列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 获取订单详情（管理员）
 * GET /api/admin/orders/:id
 */
exports.getAdminOrderDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 获取订单基本信息
    const [orders] = await pool.query(`
      SELECT 
        o.*,
        u.nickname as user_name,
        u.phone as user_phone,
        m.name as merchant_name,
        m.phone as merchant_phone
      FROM 
        \`order\` o
      LEFT JOIN 
        user u ON o.user_id = u.id
      LEFT JOIN 
        merchant m ON o.merchant_id = m.id
      WHERE 
        o.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    order.payment_method = paymentMethodToResponseValue(order.payment_method);
    
    // 获取订单商品明细
    const [items] = await pool.query(`
      SELECT 
        *
      FROM 
        order_item
      WHERE 
        order_id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        order,
        items
      }
    });
  } catch (error) {
    console.error('获取订单详情失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 更新订单状态（管理员）
 * PUT /api/admin/orders/:id/status
 */
exports.updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;
    
    if (status === undefined) {
      return res.status(400).json({ success: false, message: '缺少状态参数' });
    }
    
    // 检查订单是否存在
    const [orders] = await pool.query('SELECT id, status, merchant_id, user_id FROM `order` WHERE id = ?', [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    
    // 状态流转验证
    const validTransitions = {
      0: [1, 4], // 待支付 → 待发货/已取消
      1: [2, 4], // 待发货 → 已发货/已取消
      2: [3],     // 已发货 → 已完成
      3: [],      // 已完成 → 无
      4: []       // 已取消 → 无
    };
    
    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      return res.status(400).json({ success: false, message: '无效的状态变更' });
    }
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let updateFields = ['status = ?', 'updated_at = NOW()'];
      let updateParams = [status, id];

      if (status === 1) {
        updateFields.push('payment_time = NOW()');
      } else if (status === 2) {
        updateFields.push('delivery_time = NOW()');
      } else if (status === 3) {
        updateFields.push('complete_time = NOW()');
      }

      await conn.query(`UPDATE \`order\` SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

      // 若是取消（0/1 -> 4），恢复库存
      if (status === 4 && (order.status === 0 || order.status === 1)) {
        const [items] = await conn.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [id]);
        for (const item of items) {
          await conn.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
        }
      }

      await conn.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_order_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, `更新订单状态为 ${status}`, id]
      );

      await insertOrderNotification(
        conn,
        order.user_id,
        '订单状态更新',
        `您的订单状态已更新为 ${getStatusText(status)}`
      );

      const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);
      if (merchantOwnerUserId) {
        await insertOrderNotification(
          conn,
          merchantOwnerUserId,
          '订单状态更新',
          `订单状态已更新为 ${getStatusText(status)}`
        );
      }

      await conn.commit();
      res.json({ success: true, message: '订单状态更新成功' });
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('更新订单状态失败:', transactionError);
      res.status(500).json({ success: false, message: '更新订单状态失败' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('更新订单状态失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

/**
 * 强制取消订单
 * POST /api/admin/orders/:id/force-cancel
 */
exports.forceCancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    const adminId = req.user.id;
    
    // 检查订单是否存在
    const [orders] = await pool.query('SELECT id, status, merchant_id, user_id FROM `order` WHERE id = ?', [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: '订单不存在' });
    }
    
    const order = orders[0];
    
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE `order` SET status = 4, cancel_reason = ?, cancel_admin_id = ?, updated_at = NOW() WHERE id = ?',
        [cancel_reason, adminId, id]
      );

      const [items] = await conn.query('SELECT product_id, quantity FROM order_item WHERE order_id = ?', [id]);
      for (const item of items) {
        await conn.query('UPDATE product SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
      }

      await conn.query(
        'INSERT INTO admin_operation_log (admin_id, operation, target_order_id, created_at) VALUES (?, ?, ?, NOW())',
        [adminId, '强制取消订单', id]
      );

      await insertOrderNotification(
        conn,
        order.user_id,
        '订单被取消',
        `您的订单已被管理员强制取消，原因：${cancel_reason || '无'}`
      );

      const merchantOwnerUserId = await getMerchantOwnerUserIdByMerchantId(order.merchant_id, conn);
      if (merchantOwnerUserId) {
        await insertOrderNotification(
          conn,
          merchantOwnerUserId,
          '订单被取消',
          `订单已被管理员强制取消，原因：${cancel_reason || '无'}`
        );
      }

      await conn.commit();
      res.json({ success: true, message: '订单已强制取消' });
    } catch (transactionError) {
      await conn.rollback().catch(() => {});
      console.error('强制取消订单失败:', transactionError);
      res.status(500).json({ success: false, message: '强制取消订单失败' });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('强制取消订单失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    0: '待支付',
    1: '待发货',
    2: '已发货',
    3: '已完成',
    4: '已取消'
  };
  return statusMap[status] || '未知状态';
};

// 获取订单数量统计
exports.getOrderCounts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // 查询各状态订单数量
    const [statusCounts] = await pool.query(
      'SELECT status, COUNT(*) as count FROM `order` WHERE user_id = ? GROUP BY status',
      [userId]
    );
    
    const statusCountMap = {};
    statusCounts.forEach(item => {
      statusCountMap[item.status] = item.count;
    });
    
    successResponse(res, {
      pendingPay: statusCountMap[0] || 0,           // 待支付
      pendingDeliver: statusCountMap[1] || 0,       // 待发货
      delivered: statusCountMap[2] || 0,            // 已发货
      completed: statusCountMap[3] || 0,            // 已完成
      cancelled: statusCountMap[4] || 0             // 已取消
    });
  } catch (error) {
    console.error('获取订单数量失败:', error);
    errorResponse(res, 500, '服务器内部错误');
  }
};

// 用户修改订单收货地址（未发货前）
// PUT /api/orders/:id/address
exports.updateOrderAddress = async (req, res, next) => {
  try {
    const userId = req.user && req.user.id;
    const orderId = parseInt(req.params.id, 10);
    const addressId = req.body && req.body.address_id ? parseInt(req.body.address_id, 10) : null;

    if (!userId) {
      return errorResponse(res, 401, '未授权访问');
    }
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return errorResponse(res, 400, '订单ID不合法');
    }
    if (!Number.isFinite(addressId) || addressId <= 0) {
      return errorResponse(res, 400, '请选择收货地址');
    }

    const [orders] = await pool.query(
      'SELECT id, status FROM `order` WHERE id = ? AND user_id = ? LIMIT 1',
      [orderId, userId]
    );
    if (!orders || orders.length === 0) {
      return errorResponse(res, 404, '订单不存在');
    }

    const status = orders[0] && orders[0].status != null ? String(orders[0].status) : '';
    if (status !== '0' && status !== '1') {
      return errorResponse(res, 400, '当前订单状态不允许修改地址');
    }

    const [addresses] = await pool.query(
      'SELECT receiver_name, phone, province, city, district, detail FROM address WHERE id = ? AND user_id = ? LIMIT 1',
      [addressId, userId]
    );
    if (!addresses || addresses.length === 0) {
      return errorResponse(res, 400, '地址不存在');
    }

    const a = addresses[0];
    const receiverName = a.receiver_name;
    const receiverPhone = a.phone;
    const receiverAddress = `${a.province}${a.city}${a.district}${a.detail}`;

    await pool.query(
      'UPDATE `order` SET receiver_name = ?, receiver_phone = ?, receiver_address = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [receiverName, receiverPhone, receiverAddress, orderId, userId]
    );

    return successResponse(res, { orderId }, '地址已更新');
  } catch (error) {
    console.error('修改订单地址失败:', error);
    return errorResponse(res, 500, '服务器内部错误');
  }
};