const { pool } = require('../config/db');

// 验证地址数据
const validateAddressData = (data) => {
  const errors = [];
  
  // 验证收货人姓名
  if (!data.receiver_name || data.receiver_name.trim().length < 2 || data.receiver_name.trim().length > 20) {
    errors.push('收货人姓名长度应为2-20个字符');
  }
  
  // 验证手机号
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!data.phone || !phoneRegex.test(data.phone)) {
    errors.push('请输入正确的手机号');
  }
  
  // 验证地区信息
  if (!data.province || !data.city || !data.district) {
    errors.push('请选择完整的地址');
  }
  
  // 验证详细地址
  if (!data.detail || data.detail.trim().length === 0) {
    errors.push('请输入详细地址');
  }
  if (data.detail && data.detail.length > 100) {
    errors.push('详细地址不能超过100个字符');
  }
  
  return errors;
};

// 获取地址列表
exports.getAddressList = async (req, res, next) => {
  try {
    const [addresses] = await pool.query('SELECT * FROM address WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [req.user.id]);
    res.json({ success: true, data: addresses });
  } catch (error) {
    next(error);
  }
};

// 创建地址
exports.createAddress = async (req, res, next) => {
  try {
    const { receiver_name, phone, province, city, district, detail, is_default } = req.body;
    
    // 验证数据
    const errors = validateAddressData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 如果设置为默认地址，先取消其他默认
      if (is_default) {
        await pool.query('UPDATE address SET is_default = 0 WHERE user_id = ?', [req.user.id]);
      }
      
      const [result] = await pool.query(
        'INSERT INTO address (user_id, receiver_name, phone, province, city, district, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, receiver_name, phone, province, city, district, detail, is_default || 0]
      );
      
      await pool.query('COMMIT');
      res.status(201).json({ success: true, data: { addressId: result.insertId } });
    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
};

// 更新地址
exports.updateAddress = async (req, res, next) => {
  try {
    const { receiver_name, phone, province, city, district, detail, is_default } = req.body;
    
    // 验证数据
    const errors = validateAddressData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors[0] });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      if (is_default) {
        await pool.query('UPDATE address SET is_default = 0 WHERE user_id = ?', [req.user.id]);
      }
      
      const [result] = await pool.query(
        'UPDATE address SET receiver_name = ?, phone = ?, province = ?, city = ?, district = ?, detail = ?, is_default = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
        [receiver_name, phone, province, city, district, detail, is_default, req.params.id, req.user.id]
      );
      
      if (result.affectedRows === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ success: false, message: '地址不存在' });
      }
      
      await pool.query('COMMIT');
      res.json({ success: true, message: '更新成功' });
    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
};

// 删除地址
exports.deleteAddress = async (req, res, next) => {
  try {
    // 检查用户地址数量
    const [addressCount] = await pool.query('SELECT COUNT(*) as count FROM address WHERE user_id = ?', [req.user.id]);
    
    if (addressCount[0].count <= 1) {
      return res.status(400).json({ success: false, message: '至少保留一个收货地址' });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      const [result] = await pool.query('DELETE FROM address WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      
      if (result.affectedRows === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ success: false, message: '地址不存在' });
      }
      
      await pool.query('COMMIT');
      res.json({ success: true, message: '删除成功' });
    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
};

// 设置默认地址
exports.setDefaultAddress = async (req, res, next) => {
  try {
    // 检查地址是否存在
    const [addresses] = await pool.query('SELECT id FROM address WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    
    if (addresses.length === 0) {
      return res.status(404).json({ success: false, message: '地址不存在' });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      await pool.query('UPDATE address SET is_default = 0 WHERE user_id = ?', [req.user.id]);
      await pool.query('UPDATE address SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
      
      await pool.query('COMMIT');
      res.json({ success: true, message: '设置成功' });
    } catch (transactionError) {
      await pool.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error) {
    next(error);
  }
};