// pages/login/login.js
const { login } = require('../../utils/api');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    account: '',
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
   * 账号变化
   */
  onAccountChange(e) {
    this.setData({
      account: e.detail.value
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
    // 显示确认窗口，说明将获取用户的微信头像和昵称信息
    wx.showModal({
      title: '微信登录',
      content: '登录后将获取您的微信头像和昵称信息，用于完善个人资料',
      success: (res) => {
        if (res.confirm) {
          // 提供头像获取选项
          wx.showActionSheet({
            itemList: ['使用微信头像', '从相册选择头像'],
            success: (res) => {
              wx.showLoading({
                title: '登录中...'
              });

              // 1. 调用微信登录接口获取code
              wx.login({
                success: (res) => {
                  if (res.code) {
                    if (res.tapIndex === 1) {
                      // 从相册选择头像
                      wx.chooseMedia({
                        count: 1,
                        mediaType: ['image'],
                        sizeType: ['compressed'],
                        success: (avatarRes) => {
                          const avatarUrl = avatarRes.tempFiles[0].tempFilePath;
                          // 2. 调用后端API进行登录
                          this.wechatAuth(res.code, '', avatarUrl);
                        },
                        fail: () => {
                          wx.hideLoading();
                          wx.showToast({
                            title: '取消选择头像',
                            icon: 'none'
                          });
                        }
                      });
                    } else {
                      // 使用微信头像
                      // 2. 调用后端API进行登录
                      this.wechatAuth(res.code);
                    }
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
                }
              });
            }
          });
        }
      }
    });
  },

  /**
   * 微信授权登录
   */
  wechatAuth(code, avatarUrl) {
    // 3. 调用后端API进行登录
    login(code, '', avatarUrl, 1) // 默认学生角色
      .then(res => {
        wx.hideLoading();
        if (res.success) {
          // 4. 存储token和用户信息
          wx.setStorageSync('token', res.data.token);
          wx.setStorageSync('userInfo', res.data.user);

          // 5. 根据用户角色跳转到相应页面
          const user = res.data.user;
          if (user.role === 3) {
            // 管理员跳转到管理后台
            wx.redirectTo({
              url: '/pages/admin/index'
            });
          } else if (user.role === 2) {
            //商家跳转到商家中心
            wx.redirectTo({
              url: '/pages/merchant/index/index'
            });
          } else {
            // 学生和商家跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
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
      });
  },

  /**
   * 账号密码登录
   */
  accountLogin() {
    const { account, password } = this.data;

    if (!account) {
      wx.showToast({
        title: '请输入账号',
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
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        phone: account, // 后端API期望的参数是phone
        password,
        role: 1 // 默认学生角色
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          // 存储token和用户信息
          wx.setStorageSync('token', res.data.data.token);
          wx.setStorageSync('userInfo', res.data.data.user);
          
          // 根据用户角色跳转到相应页面
          const user = res.data.data.user;
          if (user.role === 3) {
            // 管理员跳转到管理后台
            wx.redirectTo({
              url: '/pages/admin/index'
            });
          } else {
            // 学生和商家跳转到首页
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        } else {
          // 显示详细的错误信息
          const errorMsg = res.data.message || `登录失败，状态码：${res.statusCode}`;
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '网络连接失败，请检查网络',
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  /**
   * 跳转到忘记密码页面
   */
  goToForgotPassword() {
    wx.showModal({
      title: '忘记密码',
      content: '请联系管理员重置密码：\n电话：13800138000\n或前往学生活动中心一楼服务中心',
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