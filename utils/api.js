// API 基础配置
const BASE_URL = 'http://localhost:3000/api';
/**
 * 封装请求方法
 */
function request(options) {
  return new Promise((resolve, reject) => {
    // 获取本地存储的 token
    const token = wx.getStorageSync('token');
    
    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        // 成功响应
        if (res.statusCode === 200 && res.data.success) {
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
        // 其他错误
        else {
          // 登录/注册接口的错误不显示toast，由调用方处理
          if (!options.url.includes('/login') && !options.url.includes('/register')) {
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
        wx.showToast({
          title: '网络连接失败',
          icon: 'none',
          duration: 2000
        });
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
 * 获取个人信息
 */
function getUserProfile() {
  return request({
    url: '/users/profile',
    method: 'GET'
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
      url: BASE_URL + '/upload/avatar',
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
 * 获取商品详情
 * @param {Number} id 商品 ID
 */
function getProductById(id) {
  return request({
    url: `/products/${id}`,
    method: 'GET'
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
  getUserProfile,
  updateProfile,
  decryptWeixinPhone,
  uploadAvatar,
  getMerchants,
  getMerchantById,
  getProducts,
  getProductById,
  getCategories,
  getOrders,
  createOrder,
  getOrderById,
  cancelOrder,
  completeOrder,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getFeedbacks,
  createFeedback,
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
  getAdminMerchantList,
  getAdminProductList,
  getAdminOrderList,
  getAdminFeedbackList,
  getAdminNotificationList,
  getAdminDashboardStats,
  getAdminOrderTrend,
  getAdminRevenue,
  getAdminMerchantCategories,
  request
};
