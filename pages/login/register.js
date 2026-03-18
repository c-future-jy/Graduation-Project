// pages/login/register.js

Page({
  /**
   * 页面的初始数据
   */
  data: {
    username: '',
    account: '',
    phone: '',
    password: '',
    confirmPassword: '',
    selectedRole: 1, // 默认选择学生角色
    agreed: false,
    passwordStrength: 0,
    strengthText: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 用户名变化
   */
  onUsernameChange(e) {
    this.setData({
      username: e.detail.value
    });
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
    const password = e.detail.value;
    this.setData({
      password: password
    });
    this.checkPasswordStrength(password);
  },

  /**
   * 确认密码变化
   */
  onConfirmPasswordChange(e) {
    this.setData({
      confirmPassword: e.detail.value
    });
  },

  /**
   * 检查密码强度
   */
  checkPasswordStrength(password) {
    let strength = 0;
    let text = '';

    // 长度检查
    if (password.length >= 6) {
      strength++;
    }

    // 包含字母
    if (/[a-zA-Z]/.test(password)) {
      strength++;
    }

    // 包含数字
    if (/\d/.test(password)) {
      strength++;
    }

    // 强度文本
    switch (strength) {
      case 0:
        text = '请设置密码';
        break;
      case 1:
        text = '密码强度：弱';
        break;
      case 2:
        text = '密码强度：中';
        break;
      case 3:
        text = '密码强度：强';
        break;
    }

    this.setData({
      passwordStrength: strength,
      strengthText: text
    });
  },

  /**
   * 选择角色
   */
  selectRole(e) {
    const role = parseInt(e.currentTarget.dataset.role);
    this.setData({
      selectedRole: role
    });
  },

  /**
   * 协议勾选变化
   */
  onAgreementChange(e) {
    this.setData({
      agreed: e.detail.value.length > 0
    });
  },

  /**
   * 注册
   */
  register() {
    const { username, account, phone, password, confirmPassword, selectedRole, agreed } = this.data;

    // 验证数据
    if (!username) {
      wx.showToast({
        title: '请输入用户名',
        icon: 'none'
      });
      return;
    }

    if (!account) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none'
      });
      return;
    }

    // 手机号格式验证（如果填写）
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    if (!password) {
      wx.showToast({
        title: '请设置密码',
        icon: 'none'
      });
      return;
    }

    if (password.length < 6 || password.length > 18) {
      wx.showToast({
        title: '密码长度应在6-18位之间',
        icon: 'none'
      });
      return;
    }

    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      wx.showToast({
        title: '密码必须包含字母和数字',
        icon: 'none'
      });
      return;
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      });
      return;
    }

    if (!agreed) {
      wx.showToast({
        title: '请阅读并同意用户协议和隐私政策',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '注册中...'
    });

    // 调用后端API进行注册
    wx.request({
      url: 'http://localhost:3000/api/users/register',
      method: 'POST',
      data: {
        username,
        account,
        phone,
        password,
        role: selectedRole
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '注册成功',
            icon: 'success'
          });

          // 存储token和用户信息
          wx.setStorageSync('token', res.data.data.token);
          wx.setStorageSync('userInfo', res.data.data.user);

          // 跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '注册失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '注册失败，请重试',
          icon: 'none'
        });
        console.error('注册失败:', err);
      }
    });
  },

  /**
   * 微信一键注册
   */
  wechatRegister() {
    // 显示确认窗口
    wx.showModal({
      title: '微信注册',
      content: '是否使用微信账号注册？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '注册中...'
          });

          // 1. 调用微信登录接口获取code
          wx.login({
            success: (res) => {
              if (res.code) {
                // 2. 调用后端API进行微信注册
                this.wechatAuth(res.code);
              } else {
                wx.hideLoading();
                wx.showToast({
                  title: '注册失败，请重试',
                  icon: 'none'
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              wx.showToast({
                title: '注册失败，请重试',
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
   * 微信授权注册
   */
  wechatAuth(code) {
    // 调用后端API进行微信注册
    wx.request({
      url: 'http://localhost:3000/api/users/register/wechat',
      method: 'POST',
      data: {
        code,
        role: this.data.selectedRole
      },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({
            title: '注册成功',
            icon: 'success'
          });

          // 存储token和用户信息
          wx.setStorageSync('token', res.data.data.token);
          wx.setStorageSync('userInfo', res.data.data.user);

          // 跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '注册失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        wx.showToast({
          title: '注册失败，请重试',
          icon: 'none'
        });
        console.error('微信注册失败:', err);
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },

  /**
   * 跳转到用户协议
   */
  goToAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '用户协议内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 跳转到隐私政策
   */
  goToPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '隐私政策内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  }
});