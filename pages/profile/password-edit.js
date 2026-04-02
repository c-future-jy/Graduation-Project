// pages/profile/password-edit.js
const { updateProfile } = require('../../utils/api');

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

Page({
  /**
   * 页面的初始数据
   */
  data: {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    oldPasswordError: '',
    newPasswordError: '',
    confirmPasswordError: '',
    saving: false,
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

  /**
   * 旧密码变化
   */
  onOldPasswordChange(e) {
    const value = toStr(e && e.detail ? e.detail.value : '', '').slice(0, 18);
    const oldPasswordError = this._getOldPasswordError(value);
    this.setData({ oldPassword: value, oldPasswordError });
  },

  /**
   * 新密码变化
   */
  onNewPasswordChange(e) {
    const value = toStr(e && e.detail ? e.detail.value : '', '').slice(0, 18);
    const newPasswordError = this._getNewPasswordError(value, this.data.oldPassword);
    const confirmPasswordError = this._getConfirmPasswordError(this.data.confirmPassword, value);
    this.setData({ newPassword: value, newPasswordError, confirmPasswordError });
  },

  /**
   * 确认新密码变化
   */
  onConfirmPasswordChange(e) {
    const value = toStr(e && e.detail ? e.detail.value : '', '').slice(0, 18);
    const confirmPasswordError = this._getConfirmPasswordError(value, this.data.newPassword);
    this.setData({ confirmPassword: value, confirmPasswordError });
  },

  _getOldPasswordError(value) {
    return value ? '' : '请输入旧密码';
  },

  _getNewPasswordError(value, oldPassword) {
    if (!value) return '请输入新密码';
    if (value.length < 6 || value.length > 18) return '密码长度应在6-18位之间';
    if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) return '密码必须包含字母和数字';
    if (value && oldPassword && value === oldPassword) return '新密码不能与旧密码相同';
    return '';
  },

  _getConfirmPasswordError(value, newPassword) {
    if (!value) return '请确认新密码';
    if (value !== newPassword) return '两次输入的密码不一致';
    return '';
  },

  _validateAll() {
    const oldPassword = toStr(this.data.oldPassword, '');
    const newPassword = toStr(this.data.newPassword, '');
    const confirmPassword = toStr(this.data.confirmPassword, '');

    const oldPasswordError = this._getOldPasswordError(oldPassword);
    const newPasswordError = this._getNewPasswordError(newPassword, oldPassword);
    const confirmPasswordError = this._getConfirmPasswordError(confirmPassword, newPassword);

    this.setData({ oldPasswordError, newPasswordError, confirmPasswordError });
    return !oldPasswordError && !newPasswordError && !confirmPasswordError;
  },

  /**
   * 保存密码修改
   */
  async savePassword() {
    if (this.data.saving) return;
    if (!this._validateAll()) return;

    const modalRes = await new Promise((resolve) => {
      wx.showModal({
        title: '确认修改',
        content: '修改密码后需使用新密码登录，确定要修改吗？',
        success: resolve,
        fail: () => resolve({ confirm: false })
      });
    });

    if (!modalRes || !modalRes.confirm) return;

    const oldPassword = toStr(this.data.oldPassword, '');
    const newPassword = toStr(this.data.newPassword, '');
    const updateData = {
      old_password: oldPassword,
      new_password: newPassword
    };

    this.setData({ saving: true });
    this._showLoading('提交中...');
    try {
      const res = await updateProfile(updateData);
      if (res && res.success === false) {
        wx.showToast({ title: (res && res.message) || '修改失败，请重试', icon: 'none' });
        return;
      }

      wx.showToast({ title: '修改成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      console.error('更新密码失败:', err);
      wx.showToast({ title: getErrMsg(err, '修改失败，请重试'), icon: 'none' });
    } finally {
      this._hideLoading();
      this.setData({ saving: false });
    }
  }
});