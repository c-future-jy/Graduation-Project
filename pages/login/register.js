// pages/login/register.js
const { register } = require('../../utils/api');

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

function maskTrim(value) {
  return toStr(value, '').trim();
}

function sanitizeDigits(value, maxLen) {
  const s = maskTrim(value).replace(/\D/g, '');
  return maxLen ? s.slice(0, maxLen) : s;
}

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
    passwordStrength: 0,
    strengthText: '',
    usernameError: '',
    accountError: '',
    passwordError: '',
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
   * 用户名变化
   */
  onUsernameChange(e) {
    const value = maskTrim(e && e.detail ? e.detail.value : '').slice(0, 6);
    const usernameError = this.validateUsername(value);
    this.setData({
      username: value,
      usernameError
    });
  },

  /**
   * 账号变化
   */
  onAccountChange(e) {
    const value = sanitizeDigits(e && e.detail ? e.detail.value : '', 11);
    const accountError = this.validateAccount(value);
    this.setData({
      account: value,
      accountError
    });
  },

  /**
   * 手机号变化
   */
  onPhoneChange(e) {
    this.setData({
      phone: sanitizeDigits(e && e.detail ? e.detail.value : '', 11)
    });
  },

  /**
   * 密码变化
   */
  onPasswordChange(e) {
    const password = toStr(e && e.detail ? e.detail.value : '', '').slice(0, 8);
    const passwordError = this.validatePassword(password);
    const strength = this.checkPasswordStrength(password);
    this.setData({
      password,
      passwordError,
      passwordStrength: strength.strength,
      strengthText: strength.text
    });
  },

  /**
   * 验证用户名
   */
  validateUsername(value) {
    if (value.length > 6) {
      return '用户名长度不能超过6个字符';
    }
    return '';
  },

  /**
   * 验证账号
   */
  validateAccount(value) {
    if (value.length < 6) {
      return '账号长度不能少于6位';
    } else if (value.length > 11) {
      return '账号长度不能超过11位';
    } else if (!/^\d+$/.test(value)) {
      return '账号只能包含数字';
    }
    return '';
  },

  /**
   * 验证密码
   */
  validatePassword(value) {
    if (value.length < 6) {
      return '密码长度不能少于6位';
    } else if (value.length > 8) {
      return '密码长度不能超过8位';
    } else if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
      return '密码必须包含字母和数字';
    }
    return '';
  },

  /**
   * 确认密码变化
   */
  onConfirmPasswordChange(e) {
    const value = toStr(e && e.detail ? e.detail.value : '', '').slice(0, 8);
    this.setData({
      confirmPassword: value
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

    return { strength, text };
  },

  /**
   * 选择角色
   */
  selectRole(e) {
    const role = toInt(e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.role : 1, 1);
    this.setData({
      selectedRole: role
    });
  },

  _getFormError() {
    const username = maskTrim(this.data.username);
    const account = maskTrim(this.data.account);
    const phone = maskTrim(this.data.phone);
    const password = toStr(this.data.password, '');
    const confirmPassword = toStr(this.data.confirmPassword, '');

    if (!username) return '请输入用户名';
    const usernameError = this.validateUsername(username);
    if (usernameError) return usernameError;

    if (!account) return '请输入账号';
    const accountError = this.validateAccount(account);
    if (accountError) return accountError;

    if (phone) {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) return '请输入正确的手机号（11位）';
    }

    if (!password) return '请设置密码';
    const passwordError = this.validatePassword(password);
    if (passwordError) return passwordError;

    if (password !== confirmPassword) return '两次输入的密码不一致';
    return '';
  },

  _handleRegisterSuccess(res, { fallbackNickName, fallbackAccount, fallbackPhone, fallbackRole } = {}) {
    try {
      const token = res && res.data && res.data.token;
      const user = res && res.data && res.data.user;
      if (token) wx.setStorageSync('token', token);

      const storedUserInfo = {
        avatarUrl: (user && (user.avatarUrl || user.avatar_url)) || '/assets/images/morentouxiang.jpg',
        nickName: (user && (user.nickname || user.nickName)) || fallbackNickName || '新用户',
        phone: (user && user.phone) || fallbackPhone || '',
        role: (user && user.role) || fallbackRole || 1,
        merchantId: (user && (user.merchant_id || user.merchantId)) || null,
        account: (user && user.account) || fallbackAccount || null
      };
      wx.setStorageSync('userInfo', storedUserInfo);
    } catch (_) {
      // ignore
    }

    wx.showToast({ title: '注册成功', icon: 'success' });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/profile/profile' });
    }, 1500);
  },

  /**
   * 注册
   */
  async register() {
    if (this._isLoading()) return;

    const errMsg = this._getFormError();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }

    const username = maskTrim(this.data.username);
    const accountValue = maskTrim(this.data.account);
    const phoneValue = maskTrim(this.data.phone);
    const password = toStr(this.data.password, '');
    const selectedRole = this.data.selectedRole;

    this._showLoading('注册中...');
    try {
      const res = await register({
        username,
        account: accountValue,
        phone: phoneValue || null,
        password,
        role: selectedRole
      });
      this._hideLoading();
      this._handleRegisterSuccess(res, {
        fallbackNickName: username,
        fallbackAccount: accountValue,
        fallbackPhone: phoneValue,
        fallbackRole: selectedRole
      });
    } catch (err) {
      this._hideLoading();
      wx.showToast({ title: getErrMsg(err, '注册失败'), icon: 'none' });
      console.error('注册失败:', err);
    }
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
          this._wechatRegisterFlow();
        }
      }
    });
  },

  _wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: resolve,
        fail: reject
      });
    });
  },

  async _wechatRegisterFlow() {
    if (this._isLoading()) return;
    this._showLoading('注册中...');
    try {
      const loginRes = await this._wxLogin();
      const code = loginRes && loginRes.code;
      if (!code) {
        wx.showToast({ title: '注册失败，请重试', icon: 'none' });
        return;
      }
      await this.wechatAuth(code);
    } catch (err) {
      console.error('微信登录失败:', err);
      wx.showToast({ title: getErrMsg(err, '注册失败，请重试'), icon: 'none' });
    } finally {
      this._hideLoading();
    }
  },

  /**
   * 微信授权注册
   */
  async wechatAuth(code) {
    const selectedRole = this.data.selectedRole;
    try {
      const res = await register({ code, role: selectedRole });
      this._handleRegisterSuccess(res, { fallbackRole: selectedRole });
    } catch (err) {
      wx.showToast({ title: getErrMsg(err, '注册失败'), icon: 'none' });
      console.error('微信注册失败:', err);
      throw err;
    }
  },

  // 毕设简化：不展示/不校验协议
});