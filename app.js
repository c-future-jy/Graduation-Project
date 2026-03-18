/**
 * 小程序入口文件
 */

import { getUserProfile } from './utils/api';
import { setCurrentUser, getToken } from './utils/auth';

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://localhost:3000/api'
  },

  onLaunch() {
    console.log('小程序启动');
    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    const token = getToken();
    
    if (token) {
      try {
        // 验证 token 是否有效
        const res = await getUserProfile();
        this.globalData.userInfo = res.data.user;
        setCurrentUser(res.data.user);
        console.log('用户已登录:', res.data.user);
      } catch (error) {
        // token 失效，清除本地数据
        console.log('Token 已失效，请重新登录');
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
      }
    } else {
      console.log('用户未登录');
    }
  },

  /**
   * 获取全局用户信息
   */
  getUserInfo() {
    return this.globalData.userInfo;
  },

  /**
   * 设置全局用户信息
   */
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    setCurrentUser(userInfo);
  }
});