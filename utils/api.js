/**
 * 校园一站式服务平台 - API 接口封装
 * 作者：蔡建懿
 * 日期：2026-03-11
 */
// API 基础配置
const BASE_URL = 'http://192.168.3.194:3000/api';
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
        console.log('API 响应:', res.data);
        
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
        console.error('API 请求失败:', err);
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
export function register(data) {
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
export function login(code, nickname, avatarUrl, role = 1) {
  return request({
    url: '/users/login',
    method: 'POST',
    data: { code, nickname, avatarUrl, role }
  });
}
/**
 * 获取个人信息
 */
export function getUserProfile() {
  return request({
    url: '/users/profile',
    method: 'GET'
  });
}
/**
 * 更新个人信息
 * @param {Object} data 用户信息
 */
export function updateProfile(data) {
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
export function decryptWeixinPhone(data) {
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
export function uploadAvatar(filePath) {
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
export function getMerchants(params) {
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
export function getMerchantById(id) {
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
export function getProducts(params) {
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
export function getProductById(id) {
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
export function getCategories(params) {
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
export function getOrders(params) {
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
export function createOrder(data) {
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
export function getOrderById(id) {
  return request({
    url: `/orders/${id}`,
    method: 'GET'
  });
}

/**
 * 取消订单
 * @param {Number} id 订单 ID
 */
export function cancelOrder(id) {
  return request({
    url: `/orders/${id}/cancel`,
    method: 'PUT'
  });
}

/**
 * 确认收货/完成订单
 * @param {Number} id 订单 ID
 */
export function completeOrder(id) {
  return request({
    url: `/orders/${id}/complete`,
    method: 'PUT'
  });
}
//地址模块
/**
 * 获取地址列表
 */
export function getAddresses() {
    return request({
        url: '/addresses',
        method: 'GET'
    });
}
/**
 * 创建地址
 * @param {Object} data 地址数据
 */
export function createAddress(data) {
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
export function updateAddress(id, data) {
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
export function deleteAddress(id) {
  return request({
    url: `/addresses/${id}`,
    method: 'DELETE'
  });
}

/**
 * 设置默认地址
 * @param {Number} id 地址 ID
 */
export function setDefaultAddress(id) {
  return request({
    url: `/addresses/${id}/default`,
    method: 'PUT'
  });
}
//反馈模块
/**
 * 获取反馈列表
 */
export function getFeedbacks(params) {
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
export function createFeedback(data) {
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
export function getNotifications() {
  return request({
    url: '/notifications',
    method: 'GET'
  });
}

/**
 * 标记通知为已读
 * @param {Number} id 通知 ID
 */
export function markNotificationAsRead(id) {
  return request({
    url: `/notifications/${id}/read`,
    method: 'PUT'
  });
}

/**
 * 标记全部通知为已读
 */
export function markAllNotificationsAsRead() {
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
export function getCartList(params) {
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
export function addToCart(data) {
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
export function updateCartItem(id, data) {
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
export function deleteCartItem(id) {
  return request({
    url: `/cart/items/${id}`,
    method: 'DELETE'
  });
}

/**
 * 删除选中的购物车商品
 */
export function deleteSelectedItems() {
  return request({
    url: '/cart/items/selected',
    method: 'DELETE'
  });
}

/**
 * 清空购物车
 */
export function clearCart() {
  return request({
    url: '/cart/clear',
    method: 'DELETE'
  });
}

/**
 * 删除失效商品
 */
export function deleteInvalidItems() {
  return request({
    url: '/cart/items/invalid',
    method: 'DELETE'
  });
}

/**
 * 获取选中的购物车商品
 */
export function getSelectedItems() {
  return request({
    url: '/cart/selected',
    method: 'GET'
  });
}

// 导出 request 供外部使用
export { request };
