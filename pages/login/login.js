// pages/login/login.js
import { login } from '../../utils/api';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    phone: '',
    password: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查是否已经登录
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (token) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  /**
   * 手机号变化
   */
  onPhoneChange(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  /**
   * 密码变化
   */
  onPasswordChange(e) {
    this.setData({
      password: e.detail.value
    });
  },

  /**
   * 微信登录
   */
  wechatLogin() {
    // 显示确认窗口
    wx.showModal({
      title: '微信登录',
      content: '是否使用微信账号登录？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '登录中...'
          });

          // 1. 调用微信登录接口获取code
          wx.login({
            success: (res) => {
              if (res.code) {
                // 2. 调用后端API进行登录
                this.wechatAuth(res.code);
              } else {
                wx.hideLoading();
                wx.showToast({
                  title: '登录失败，请重试',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'none'
              });
              console.error('微信登录失败:', err);
            }
          });
        }
      }
    });
  },

  /**
   * 微信授权登录
   */
  wechatAuth(code) {
    // 3. 调用后端API进行登录
    login(code, '', '', 1) // 默认学生角色
      .then(res => {
        wx.hideLoading();
        if (res.success) {
          // 4. 存储token和用户信息
          wx.setStorageSync('token', res.data.token);
          wx.setStorageSync('userInfo', res.data.user);
          
          // 5. 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        } else {
          wx.showToast({
            title: res.message || '登录失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        console.error('登录API调用失败:', err);
      });
  },

  /**
   * 账号密码登录
   */
  accountLogin() {
    const { phone, password } = this.data;

    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...'
    });

    // 调用后端API进行账号密码登录
    wx.request({
      url: 'http://localhost:3000/api/users/login/account',
      method: 'POST',
      data: {
        phone,
        password,
        role: 1 // 默认学生角色
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          // 存储token和用户信息
          wx.setStorageSync('token', res.data.data.token);
          wx.setStorageSync('userInfo', res.data.data.user);
          
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        } else {
          wx.showToast({
            title: res.data.message || '登录失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
        console.error('账号密码登录失败:', err);
      }
    });
  },

  /**
   * 跳转到忘记密码页面
   */
  goToForgotPassword() {
    wx.showModal({
      title: '忘记密码',
      content: '请联系管理员重置密码',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 跳转到注册页面
   */
  goToRegister() {
    wx.navigateTo({
      url: '/pages/login/register'
    });
  }
});