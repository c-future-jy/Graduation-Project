function getBaseUrl() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const url = app && app.globalData && app.globalData.baseUrl;
    if (url) return String(url).trim();

    // 兜底：如果全局还没初始化，尝试读取本地配置
    const stored = String(wx.getStorageSync('baseUrl') || '').trim();
    return stored || 'http://localhost:3000/api';
  } catch (e) {
    try {
      const stored = String(wx.getStorageSync('baseUrl') || '').trim();
      return stored || 'http://localhost:3000/api';
    } catch (_) {
      return 'http://localhost:3000/api';
    }
  }
}

/**
 * 封装请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const silent = !!(options && options.silent);
    // 获取本地存储的 token
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: getBaseUrl() + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        console.log('API response:', res.statusCode, res.data);
        // 成功响应
        if ((res.statusCode === 200 || res.statusCode === 201) && res.data.success) {
          // 若后端返回新 token（常见于角色/merchant_id 变更后的自动刷新），则更新本地 token
          const refreshedToken = res.data && res.data.data && res.data.data.token;
          if (refreshedToken) {
            wx.setStorageSync('token', refreshedToken);
          }
          resolve(res.data);
        } 
        // 401 未授权，只在非登录/注册接口时跳转登录
        else if (res.statusCode === 401 && !options.url.includes('/login') && !options.url.includes('/register')) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.reLaunch({
            url: '/pages/login/login'
          });
          reject({ message: '请先登录' });
        } 
        // 500 服务器错误
        else if (res.statusCode === 500) {
          console.error('Server error:', res.data);
          reject({ 
            message: res.data.message || '服务器内部错误',
            error: res.data.error,
            stack: res.data.stack
          });
        }
        // 其他错误
        else {
          // 登录/注册接口的错误不显示toast，由调用方处理
          if (!silent && !options.url.includes('/login') && !options.url.includes('/register')) {
            wx.showToast({
              title: res.data.message || '请求失败',
              icon: 'none',
              duration: 2000
            });
          }
          reject(res.data);
        }
      },
      fail: (err) => {
        if (!silent) {
          wx.showToast({
            title: '网络连接失败',
            icon: 'none',
            duration: 2000
          });
        }
        reject(err);
      }
    });
  });
}

//用户模块
/**
 * 注册
 * @param {Object} data 注册数据
 */
function register(data) {
  return request({
    url: '/users/auth/register',
    method: 'POST',
    data
  });
}

/**
 * 微信登录
 * @param {String} code 微信登录 code
 * @param {String} nickname 用户昵称
 * @param {String} avatarUrl 用户头像
 * @param {Number} role 用户角色
 */
function login(code, nickname, avatarUrl, role = 1) {
  return request({
    url: '/users/login',
    method: 'POST',
    data: { code, nickname, avatarUrl, role }
  });
}

/**
 * 账号密码登录
 * @param {Object} data { username, password, role? }
 */
function accountLogin(data) {
  return request({
    url: '/users/login/account',
    method: 'POST',
    data
  });
}
/**
 * 获取个人信息
 */
function getUserProfile(options) {
  return request({
    url: '/users/profile',
    method: 'GET',
    ...(options || {})
  });
}
/**
 * 更新个人信息
 * @param {Object} data 用户信息
 */
function updateProfile(data) {
  return request({
    url: '/users/profile',
    method: 'PUT',
    data
  });
}
/**
 * 使用微信加密数据解密手机号
 * @param {Object} data { encryptedData, iv }
 */
function decryptWeixinPhone(data) {
  return request({
    url: '/users/decrypt-phone',
    method: 'POST',
    data
  });
}

/**
 * 上传头像文件（示例）
 * @param {String} filePath 本地文件路径
 */
function uploadAvatar(filePath) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.uploadFile({
      url: getBaseUrl() + '/upload/avatar',
      filePath,
      name: 'avatar',
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (res.statusCode === 200 && data.success) {
            resolve(data);
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
            reject(data);
          }
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}

/**
 * 通用图片上传
 * @param {String} filePath 本地文件路径
 */
function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.uploadFile({
      url: getBaseUrl() + '/upload',
      filePath,
      name: 'file',
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if ((res.statusCode === 200 || res.statusCode === 201) && data.success) {
            resolve(data);
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
            reject(data);
          }
        } catch (err) {
          reject(err);
        }
      },
      fail: (err) => {
        wx.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      }
    });
  });
}
//商家模块
/**
 * 获取商家列表
 * @param {Object} params 查询参数
 */
function getMerchants(params) {
  return request({
    url: '/merchants',
    method: 'GET',
    data: params
  });
}
/**
 * 获取商家详情
 * @param {Number} id 商家 ID
 */
function getMerchantById(id) {
  return request({
    url: `/merchants/${id}`,
    method: 'GET'
  });
}

/**
 * 申请成为商家
 * @param {Object} data 申请信息
 */
function applyMerchant(data) {
  return request({
    url: '/merchants/apply',
    method: 'POST',
    data
  });
}

/**
 * 获取当前登录用户的商家信息（商家端）
 */
function getMyMerchant(options) {
  return request({
    url: '/merchants/me',
    method: 'GET',
    ...(options || {})
  });
}

/**
 * 更新商家信息（商家/管理员）
 * @param {Number} id 商家 ID
 * @param {Object} data 更新字段
 */
function updateMerchant(id, data) {
  return request({
    url: `/merchants/${id}`,
    method: 'PUT',
    data
  });
}
//商品模块
/**
 * 获取商品列表
 * @param {Object} params 查询参数 (merchant_id, category_id, page, limit)
 */
function getProducts(params) {
  return request({
    url: '/products',
    method: 'GET',
    data: params
  });
}

/**
 * 商家端：获取我的商品列表（含上/下架）
 * @param {Object} params 查询参数 (category_id, keyword, status, page, limit)
 */
function getMyProducts(params) {
  return request({
    url: '/products/my',
    method: 'GET',
    data: params
  });
}

/**
 * 获取商品详情
 * @param {Number} id 商品 ID
 */
function getProductById(id) {
  return request({
    url: `/products/${id}`,
    method: 'GET'
  });
}

/**
 * 创建商品（商家/管理员）
 * @param {Object} data 商品字段 { merchant_id?, category_id, name, description, price, stock, image, status? }
 */
function createProduct(data) {
  return request({
    url: '/products',
    method: 'POST',
    data
  });
}

/**
 * 更新商品（商家/管理员）
 * @param {Number|String} id 商品ID
 * @param {Object} data 更新字段 { name, description, price, stock, image, status }
 */
function updateProduct(id, data) {
  return request({
    url: `/products/${id}`,
    method: 'PUT',
    data
  });
}

/**
 * 删除商品（商家/管理员）
 * @param {Number|String} id 商品ID
 */
function deleteProduct(id) {
  return request({
    url: `/products/${id}`,
    method: 'DELETE'
  });
}
//分类模块
/**
 * 获取分类列表
 * @param {Object} params 查询参数 (type, merchant_id)
 */
function getCategories(params) {
  return request({
    url: '/categories',
    method: 'GET',
    data: params
  });
}

/**
 * 创建分类（商家/管理员）
 * @param {Object} data 分类字段 { name, icon?, type?, sort_order?, merchant_id? }
 */
function createCategory(data) {
  return request({
    url: '/categories',
    method: 'POST',
    data
  });
}

// 搜索模块
/**
 * 聚合搜索（商家 + 商品）
 * @param {Object} params 查询参数（keyword 或 q）
 */
function searchAll(params) {
  return request({
    url: '/search',
    method: 'GET',
    data: params
  });
}
//订单模块
/**
 * 获取订单列表
 * @param {Object} params 查询参数 (status, page, limit)
 */
function getOrders(params) {
  return request({
    url: '/orders',
    method: 'GET',
    data: params
  });
}

/**
 * 创建订单
 * @param {Object} data 订单数据
 */
function createOrder(data) {
  return request({
    url: '/orders',
    method: 'POST',
    data
  });
}

/**
 * 获取订单详情
 * @param {Number} id 订单 ID
 */
function getOrderById(id) {
  return request({
    url: `/orders/${id}`,
    method: 'GET'
  });
}

/**
 * 取消订单
 * @param {Number} id 订单 ID
 */
function cancelOrder(id) {
  return request({
    url: `/orders/${id}/cancel`,
    method: 'PUT'
  });
}

/**
 * 确认收货/完成订单
 * @param {Number} id 订单 ID
 */
function completeOrder(id) {
  return request({
    url: `/orders/${id}/complete`,
    method: 'PUT'
  });
}

/**
 * 删除订单
 * @param {Number|String} id 订单ID
 */
function deleteOrder(id) {
  return request({
    url: `/orders/${id}`,
    method: 'DELETE'
  });
}

/**
 * 获取订单数量统计（待支付、待发货等）
 */
function getOrderCounts() {
  return request({
    url: '/orders/counts',
    method: 'GET'
  });
}

/**
 * 再次购买：将订单商品加入购物车
 * @param {Number|String} orderId 订单ID
 */
function buyAgain(orderId) {
  return request({
    url: `/orders/${orderId}/buy-again`,
    method: 'POST'
  });
}
//地址模块
/**
 * 获取地址列表
 */
function getAddresses() {
    return request({
        url: '/addresses',
        method: 'GET'
    });
}
/**
 * 创建地址
 * @param {Object} data 地址数据
 */
function createAddress(data) {
  return request({
    url: '/addresses',
    method: 'POST',
    data
  });
}

/**
 * 更新地址
 * @param {Number} id 地址 ID
 * @param {Object} data 地址数据
 */
function updateAddress(id, data) {
  return request({
    url: `/addresses/${id}`,
    method: 'PUT',
    data
  });
}

/**
 * 删除地址
 * @param {Number} id 地址 ID
 */
function deleteAddress(id) {
  return request({
    url: `/addresses/${id}`,
    method: 'DELETE'
  });
}

/**
 * 设置默认地址
 * @param {Number} id 地址 ID
 */
function setDefaultAddress(id) {
  return request({
    url: `/addresses/${id}/default`,
    method: 'PUT'
  });
}
//反馈模块
/**
 * 获取反馈列表
 */
function getFeedbacks(params) {
  return request({
    url: '/feedback',
    method: 'GET',
    data: params
  });
}

/**
 * 创建反馈
 * @param {Object} data 反馈数据
 */
function createFeedback(data) {
  return request({
    url: '/feedback',
    method: 'POST',
    data
  });
}

/**
 * 商家：获取自己的反馈列表
 */
function getMerchantFeedbacks() {
  return request({
    url: '/feedback/my',
    method: 'GET'
  });
}

/**
 * 商家：回复反馈
 * @param {Number|String} id 反馈ID
 * @param {String} reply 回复内容
 */
function replyMerchantFeedback(id, reply) {
  return request({
    url: `/feedback/${id}/reply`,
    method: 'PUT',
    data: { reply }
  });
}
//通知模块
/**
 * 获取通知列表
 */
function getNotifications() {
  return request({
    url: '/notifications',
    method: 'GET'
  });
}

/**
 * 标记通知为已读
 * @param {Number} id 通知 ID
 */
function markNotificationAsRead(id) {
  return request({
    url: `/notifications/${id}/read`,
    method: 'PUT'
  });
}

/**
 * 标记全部通知为已读
 */
function markAllNotificationsAsRead() {
  return request({
    url: '/notifications/read-all',
    method: 'POST'
  });
}

//购物车模块
/**
 * 获取购物车列表
 * @param {Object} params 查询参数 (page, pageSize)
 */
function getCartList(params) {
  return request({
    url: '/cart',
    method: 'GET',
    data: params
  });
}

/**
 * 添加商品到购物车
 * @param {Object} data 购物车商品数据
 */
function addToCart(data) {
  return request({
    url: '/cart/items',
    method: 'POST',
    data
  });
}

/**
 * 更新购物车商品
 * @param {Number} id 购物车商品 ID
 * @param {Object} data 更新数据
 */
function updateCartItem(id, data) {
  return request({
    url: `/cart/items/${id}`,
    method: 'PUT',
    data
  });
}

/**
 * 删除购物车商品
 * @param {Number} id 购物车商品 ID
 */
function deleteCartItem(id) {
  return request({
    url: `/cart/items/${id}`,
    method: 'DELETE'
  });
}

/**
 * 删除选中的购物车商品
 */
function deleteSelectedItems() {
  return request({
    url: '/cart/items/selected',
    method: 'DELETE'
  });
}

/**
 * 清空购物车
 */
function clearCart() {
  return request({
    url: '/cart/clear',
    method: 'DELETE'
  });
}

/**
 * 删除失效商品
 */
function deleteInvalidItems() {
  return request({
    url: '/cart/items/invalid',
    method: 'DELETE'
  });
}

/**
 * 获取选中的购物车商品
 */
function getSelectedItems() {
  return request({
    url: '/cart/selected',
    method: 'GET'
  });
}



// 管理员模块
/**
 * 获取管理员用户列表
 * @param {Object} params 查询参数 (page, pageSize, role, keyword, startTime, endTime)
 */
function getAdminUserList(params) {
  return request({
    url: '/admin/users',
    method: 'GET',
    data: params
  });
}

/**
 * 获取管理员用户详情
 * @param {Number|String} id 用户 ID
 */
function getAdminUserDetail(id) {
  return request({
    url: `/admin/users/${id}`,
    method: 'GET'
  });
}

/**
 * 更新用户状态（管理员）
 * @param {Number|String} id 用户 ID
 * @param {Number} status 1 正常, 0 禁用
 */
function updateAdminUserStatus(id, status) {
  return request({
    url: `/admin/users/${id}/status`,
    method: 'PUT',
    data: { status }
  });
}

/**
 * 重置用户密码（管理员）
 * @param {Number|String} id 用户 ID
 */
function resetAdminUserPassword(id) {
  return request({
    url: `/admin/users/${id}/reset-password`,
    method: 'POST'
  });
}

/**
 * 获取管理员商家列表
 * @param {Object} params 查询参数 (page, pageSize, status, audit_status, keyword, category_id)
 */
function getAdminMerchantList(params) {
  return request({
    url: '/admin/merchants',
    method: 'GET',
    data: params
  });
}

/**
 * 获取管理员商家详情
 * @param {Number|String} id 商家 ID
 */
function getAdminMerchantDetail(id) {
  return request({
    url: `/admin/merchants/${id}`,
    method: 'GET'
  });
}

/**
 * 更新管理员商家状态（营业/休息/禁用）
 * @param {Number|String} id 商家 ID
 * @param {Number} status 0 休息/禁用, 1 营业
 */
function updateAdminMerchantStatus(id, status) {
  return request({
    url: `/admin/merchants/${id}/status`,
    method: 'PUT',
    data: { status }
  });
}

/**
 * 审核商家
 * @param {Number|String} id 商家 ID
 * @param {Object} data { audit_status: 2|3, audit_remark?: string }
 */
function auditAdminMerchant(id, data) {
  return request({
    url: `/admin/merchants/${id}/audit`,
    method: 'PUT',
    data
  });
}

/**
 * 获取管理员商品列表
 * @param {Object} params 查询参数 (page, pageSize, merchant_id, category_id, status, keyword, stock_warning)
 */
function getAdminProductList(params) {
  return request({
    url: '/admin/products',
    method: 'GET',
    data: params
  });
}

/**
 * 更新商品状态（管理员）
 * @param {Number|String} id 商品 ID
 * @param {Number} status 1 上架, 0 下架
 * @param {String} offline_reason 下架原因（可选）
 */
function updateAdminProductStatus(id, status, offline_reason = '') {
  return request({
    url: `/admin/products/${id}/status`,
    method: 'PUT',
    data: { status, offline_reason }
  });
}

/**
 * 批量更新商品（管理员）
 * @param {Number[]} product_ids 商品ID列表
 * @param {Number} status 1 上架, 0 下架
 * @param {String} offline_reason 下架原因（可选）
 */
function batchUpdateAdminProducts(product_ids, status, offline_reason = '') {
  return request({
    url: '/admin/products/batch-update',
    method: 'POST',
    data: { product_ids, status, offline_reason }
  });
}

/**
 * 获取管理员订单列表
 * @param {Object} params 查询参数 (page, pageSize, order_no, user_id, merchant_id, status, startTime, endTime)
 */
function getAdminOrderList(params) {
  return request({
    url: '/admin/orders',
    method: 'GET',
    data: params
  });
}

/**
 * 强制取消订单（管理员）
 * @param {Number|String} id 订单 ID
 * @param {String} cancel_reason 取消原因（可选）
 */
function forceCancelAdminOrder(id, cancel_reason = '') {
  return request({
    url: `/admin/orders/${id}/force-cancel`,
    method: 'POST',
    data: { cancel_reason }
  });
}

/**
 * 获取管理员订单详情
 * @param {Number|String} id 订单 ID
 */
function getAdminOrderDetail(id) {
  return request({
    url: `/admin/orders/${id}`,
    method: 'GET'
  });
}

/**
 * 更新订单状态（管理员）
 * @param {Number|String} id 订单 ID
 * @param {Number} status 目标状态
 */
function updateAdminOrderStatus(id, status) {
  return request({
    url: `/admin/orders/${id}/status`,
    method: 'PUT',
    data: { status }
  });
}

/**
 * 获取管理员反馈列表
 * @param {Object} params 查询参数 (page, pageSize, type, status, user_id, merchant_id, startTime, endTime)
 */
function getAdminFeedbackList(params) {
  return request({
    url: '/admin/feedbacks',
    method: 'GET',
    data: params
  });
}

/**
 * 回复反馈
 * @param {Number} id 反馈ID
 * @param {String} reply 回复内容
 */
function replyFeedback(id, reply) {
  return request({
    url: `/admin/feedbacks/${id}/reply`,
    method: 'PUT',
    data: { reply }
  });
}

/**
 * 驳回反馈
 * @param {Number} id 反馈ID
 * @param {String} reason 驳回原因
 */
function rejectFeedback(id, reason) {
  return request({
    url: `/admin/feedbacks/${id}/reject`,
    method: 'PUT',
    data: { reason }
  });
}

/**
 * 删除反馈（管理员）
 */
function deleteAdminFeedback(id) {
  return request({
    url: `/admin/feedbacks/${id}`,
    method: 'DELETE'
  });
}

/**
 * 批量删除反馈（管理员）
 * @param {Number[]} ids
 */
function batchDeleteAdminFeedbacks(ids) {
  return request({
    url: '/admin/feedbacks/batch-delete',
    method: 'POST',
    data: { feedback_ids: ids }
  });
}

/**
 * 商家仪表盘：核心统计
 */
function getMerchantDashboardStats(options) {
  return request({
    url: '/merchant/dashboard/stats',
    method: 'GET',
    ...(options || {})
  });
}

/**
 * 商家仪表盘：趋势
 * @param {Object} params { days }
 */
function getMerchantDashboardTrend(params) {
  return request({
    url: '/merchant/dashboard/trend',
    method: 'GET',
    data: params
  });
}

/**
 * 商家仪表盘：热销商品
 * @param {Object} params { limit }
 */
function getMerchantDashboardTopProducts(params) {
  return request({
    url: '/merchant/dashboard/top-products',
    method: 'GET',
    data: params
  });
}

/**
 * 商家仪表盘：最近订单
 * @param {Object} params { limit }
 */
function getMerchantDashboardRecentOrders(params) {
  return request({
    url: '/merchant/dashboard/recent-orders',
    method: 'GET',
    data: params
  });
}

/**
 * 商家仪表盘：库存预警
 * @param {Object} params { threshold, limit }
 */
function getMerchantDashboardLowStock(params) {
  return request({
    url: '/merchant/dashboard/low-stock',
    method: 'GET',
    data: params
  });
}

/**
 * 商家仪表盘：订单状态分布
 * @param {Object} params { days } 或 { startDate, endDate }
 */
function getMerchantDashboardOrderStatus(params) {
  return request({
    url: '/merchant/dashboard/order-status',
    method: 'GET',
    data: params
  });
}

/**
 * 获取反馈详情（管理员）
 * @param {Number} id 反馈ID
 */
function getAdminFeedbackDetail(id) {
  return request({
    url: `/admin/feedbacks/${id}`,
    method: 'GET'
  });
}

/**
 * 获取管理员通知列表
 * @param {Object} params 查询参数 (page, pageSize, type, user_id, is_read, startTime, endTime)
 */
function getAdminNotificationList(params) {
  return request({
    url: '/admin/notifications',
    method: 'GET',
    data: params
  });
}

/**
 * 发布通知（管理员）
 * @param {Object} data 通知数据 (title, content, type, receive_scope, role_ids?, user_ids?, scheduled_time?)
 */
function createAdminNotification(data) {
  return request({
    url: '/admin/notifications',
    method: 'POST',
    data
  });
}

/**
 * 删除通知（管理员）
 * @param {Number} id 通知ID
 */
function deleteAdminNotification(id) {
  return request({
    url: `/admin/notifications/${id}`,
    method: 'DELETE'
  });
}

/**
 * 标记通知已读（管理员）
 * @param {Number} id 通知ID
 */
function markAdminNotificationAsRead(id) {
  return request({
    url: `/admin/notifications/${id}/read`,
    method: 'PUT'
  });
}

/**
 * 批量标记通知已读（管理员）
 * @param {Number[]} ids 通知ID列表
 */
function batchMarkAdminNotificationsAsRead(ids) {
  return request({
    url: '/admin/notifications/batch-read',
    method: 'POST',
    data: { notification_ids: ids }
  });
}

/**
 * 批量删除通知（管理员）
 * @param {Number[]} ids 通知ID列表
 */
function batchDeleteAdminNotifications(ids) {
  return request({
    url: '/admin/notifications/batch-delete',
    method: 'POST',
    data: { notification_ids: ids }
  });
}

/**
 * 获取管理员仪表盘统计数据
 */
function getAdminDashboardStats() {
  return request({
    url: '/admin/dashboard/stats',
    method: 'GET'
  });
}

/**
 * 获取管理员订单趋势数据
 * @param {Object} params 查询参数 (startTime, endTime, granularity)
 */
function getAdminOrderTrend(params) {
  return request({
    url: '/admin/dashboard/order-trend',
    method: 'GET',
    data: params
  });
}

/**
 * 获取管理员用户趋势数据
 * @param {Object} params 查询参数 (startTime, endTime, granularity)
 */
function getAdminUserTrend(params) {
  return request({
    url: '/admin/dashboard/user-trend',
    method: 'GET',
    data: params
  });
}

/**
 * 获取管理员营业额数据
 * @param {Object} params 查询参数 (startTime, endTime)
 */
function getAdminRevenue(params) {
  return request({
    url: '/admin/dashboard/revenue',
    method: 'GET',
    data: params
  });
}

/**
 * 获取管理员商家分类分布数据
 */
function getAdminMerchantCategories() {
  return request({
    url: '/admin/dashboard/merchant-categories',
    method: 'GET'
  });
}

// 导出 request 供外部使用
module.exports = {
  register,
  login,
  accountLogin,
  getUserProfile,
  updateProfile,
  decryptWeixinPhone,
  uploadAvatar,
  uploadImage,
  createCategory,
  getMerchants,
  getMerchantById,
  applyMerchant,
  getMyMerchant,
  updateMerchant,
  getProducts,
  getMyProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  searchAll,
  getOrders,
  createOrder,
  getOrderById,
  cancelOrder,
  completeOrder,
  getOrderCounts,
  buyAgain,
  deleteOrder,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getFeedbacks,
  createFeedback,
  getMerchantFeedbacks,
  replyMerchantFeedback,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getCartList,
  addToCart,
  updateCartItem,
  deleteCartItem,
  deleteSelectedItems,
  clearCart,
  deleteInvalidItems,
  getSelectedItems,
  getAdminUserList,
  getAdminUserDetail,
  updateAdminUserStatus,
  resetAdminUserPassword,
  getAdminMerchantList,
  getAdminMerchantDetail,
  updateAdminMerchantStatus,
  auditAdminMerchant,
  getAdminProductList,
  updateAdminProductStatus,
  batchUpdateAdminProducts,
  getAdminOrderList,
  forceCancelAdminOrder,
  getAdminOrderDetail,
  updateAdminOrderStatus,
  getAdminFeedbackList,
  replyFeedback,
  rejectFeedback,
  getAdminFeedbackDetail,
  deleteAdminFeedback,
  batchDeleteAdminFeedbacks,
  getAdminNotificationList,
  createAdminNotification,
  deleteAdminNotification,
  batchDeleteAdminNotifications,
  markAdminNotificationAsRead,
  batchMarkAdminNotificationsAsRead,
  getAdminDashboardStats,
  getAdminOrderTrend,
  getAdminUserTrend,
  getAdminRevenue,
  getAdminMerchantCategories,
  getMerchantDashboardStats,
  getMerchantDashboardTrend,
  getMerchantDashboardTopProducts,
  getMerchantDashboardRecentOrders,
  getMerchantDashboardLowStock,
  getMerchantDashboardOrderStatus,
  request
};
