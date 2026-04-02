// pages/login/login.js
const { login, accountLogin: apiAccountLogin } = require('../../utils/api');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}

function sanitizeDigits(value, maxLen) {
  const s = toStr(value, '').replace(/\D/g, '');
  return maxLen ? s.slice(0, maxLen) : s;
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    account: '',
    password: '',
    loadingCount: 0
  },

  _showLoading(title = '加载中...') {
    const next = (this.data.loadingCount || 0) + 1;
    this.setData({ loadingCount: next });
    if (next === 1) wx.showLoading({ title });
  },

  _hideLoading() {
    const next = Math.max(0, (this.data.loadingCount || 0) - 1);
    this.setData({ loadingCount: next });
    if (next === 0) wx.hideLoading();
  },

  _isLoading() {
    return (this.data.loadingCount || 0) > 0;
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
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      // 已登录，跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    } else if (token && !userInfo) {
      // 防止不完整登录态导致页面“闪一下”
      wx.removeStorageSync('token');
    }
  },

  /**
   * 账号变化
   */
  onAccountChange(e) {
    this.setData({
      account: sanitizeDigits(e && e.detail ? e.detail.value : '', 11)
    });
  },

  /**
   * 密码变化
   */
  onPasswordChange(e) {
    this.setData({
      password: toStr(e && e.detail ? e.detail.value : '', '').slice(0, 18)
    });
  },

  _normalizeStoredUser(user, { nickname, avatarUrl } = {}) {
    const u = user || {};
    const normalizedNickName = u.nickName || u.nickname || u.username || nickname || '';
    const normalizedAvatar = u.avatarUrl || u.avatar_url || avatarUrl || '';
    const merchantId = u.merchantId || u.merchant_id || null;
    return {
      ...u,
      nickName: normalizedNickName,
      avatarUrl: normalizedAvatar,
      merchantId,
      merchant_id: u.merchant_id || merchantId
    };
  },

  _redirectByRole(role) {
    if (role === 3) {
      wx.redirectTo({ url: '/pages/admin/index' });
    } else if (role === 2) {
      wx.redirectTo({ url: '/pages/merchant/index/index' });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  _handleLoginSuccess(res, extras) {
    if (!res || !res.success) {
      wx.showToast({ title: (res && res.message) || '登录失败', icon: 'none', duration: 2000 });
      return false;
    }

    const token = res && res.data && res.data.token;
    const user = res && res.data && res.data.user;
    if (token) wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', this._normalizeStoredUser(user, extras));

    const nextRole = user && user.role ? toInt(user.role, 1) : 1;
    this._redirectByRole(nextRole);
    return true;
  },

  _wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  _wxGetUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善个人资料',
        success: resolve,
        fail: reject
      });
    });
  },

  _wxChooseAvatarFromAlbum() {
    return new Promise((resolve, reject) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: resolve,
        fail: reject
      });
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
            success: (actionRes) => this._wechatLoginFlow(actionRes),
            fail: () => {
              // 用户取消
            }
          });
        }
      }
    });
  },

  async _wechatLoginFlow(actionRes) {
    if (this._isLoading()) return;
    this._showLoading('登录中...');

    try {
      const loginRes = await this._wxLogin();
      const code = loginRes && loginRes.code;
      if (!code) {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
        return;
      }

      const tapIndex = actionRes ? toInt(actionRes.tapIndex, 0) : 0;
      if (tapIndex === 1) {
        // 从相册选择头像
        const avatarRes = await this._wxChooseAvatarFromAlbum();
        const avatarUrl = avatarRes && avatarRes.tempFiles && avatarRes.tempFiles[0] && avatarRes.tempFiles[0].tempFilePath;
        if (!avatarUrl) {
          wx.showToast({ title: '取消选择头像', icon: 'none' });
          return;
        }
        await this.wechatAuth(code, '', avatarUrl);
      } else {
        // 使用微信头像（或用户拒绝授权也继续）
        let nickname = '';
        let avatarUrl = '';
        try {
          const userInfoRes = await this._wxGetUserProfile();
          const info = userInfoRes && userInfoRes.userInfo;
          nickname = (info && info.nickname) || '';
          avatarUrl = (info && info.avatarUrl) || '';
        } catch (_) {
          // ignore
        }
        await this.wechatAuth(code, nickname, avatarUrl);
      }
    } catch (err) {
      console.error('微信登录失败:', err);
      wx.showToast({ title: getErrMsg(err, '登录失败，请重试'), icon: 'none' });
    } finally {
      this._hideLoading();
    }
  },

  /**
   * 微信授权登录
   */
  async wechatAuth(code, nickname, avatarUrl) {
    const res = await login(code, nickname, avatarUrl, 1);
    this._handleLoginSuccess(res, { nickname, avatarUrl });
  },

  /**
   * 账号密码登录
   */
  async accountLogin() {
    if (this._isLoading()) return;

    const account = toStr(this.data.account, '').trim();
    const password = toStr(this.data.password, '');

    if (!account) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this._showLoading('登录中...');
    try {
      const res = await apiAccountLogin({ account, password, role: 1 });
      this._handleLoginSuccess(res);
    } catch (err) {
      wx.showToast({ title: getErrMsg(err, '网络连接失败，请检查网络'), icon: 'none', duration: 3000 });
    } finally {
      this._hideLoading();
    }
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