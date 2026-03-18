/**
 * 认证管理工具
 */

/**
 * 保存 Token
 * @param {String} token 
 */
export function setToken(token) {
  wx.setStorageSync('token', token);
}

/**
 * 获取 Token
 * @returns {String} token
 */
export function getToken() {
  return wx.getStorageSync('token');
}

/**
 * 移除 Token
 */
export function removeToken() {
  wx.removeStorageSync('token');
}

/**
 * 检查是否登录
 * @returns {Boolean}
 */
export function isLogin() {
  return !!getToken();
}

/**
 * 获取当前用户信息
 * @returns {Object} 用户信息
 */
export function getCurrentUser() {
  return wx.getStorageSync('userInfo');
}

/**
 * 保存用户信息
 * @param {Object} userInfo 用户信息
 */
export function setCurrentUser(userInfo) {
  wx.setStorageSync('userInfo', userInfo);
}

/**
 * 清除用户信息
 */
export function clearUserInfo() {
  wx.removeStorageSync('userInfo');
}

/**
 * 退出登录
 */
export function logout() {
  removeToken();
  clearUserInfo();
}