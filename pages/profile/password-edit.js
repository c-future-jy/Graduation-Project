// pages/profile/password-edit.js
const { updateProfile } = require('../../utils/api');

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
    confirmPasswordError: ''
  },

  /**
   * 旧密码变化
   */
  onOldPasswordChange(e) {
    const value = e.detail.value;
    this.setData({
      oldPassword: value
    });
    
    // 实时验证
    this.validateOldPassword(value);
  },

  /**
   * 新密码变化
   */
  onNewPasswordChange(e) {
    const value = e.detail.value;
    this.setData({
      newPassword: value
    });
    
    // 实时验证
    this.validateNewPassword(value);
    // 验证确认密码
    this.validateConfirmPassword(this.data.confirmPassword, value);
  },

  /**
   * 确认新密码变化
   */
  onConfirmPasswordChange(e) {
    const value = e.detail.value;
    this.setData({
      confirmPassword: value
    });
    
    // 实时验证
    this.validateConfirmPassword(value, this.data.newPassword);
  },

  /**
   * 验证旧密码
   */
  validateOldPassword(value) {
    if (!value) {
      this.setData({ oldPasswordError: '请输入旧密码' });
      return false;
    } else {
      this.setData({ oldPasswordError: '' });
      return true;
    }
  },

  /**
   * 验证新密码
   */
  validateNewPassword(value) {
    if (!value) {
      this.setData({ newPasswordError: '请输入新密码' });
      return false;
    } else if (value.length < 6 || value.length > 18) {
      this.setData({ newPasswordError: '密码长度应在6-18位之间' });
      return false;
    } else if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
      this.setData({ newPasswordError: '密码必须包含字母和数字' });
      return false;
    } else if (value === this.data.oldPassword) {
      this.setData({ newPasswordError: '新密码不能与旧密码相同' });
      return false;
    } else {
      this.setData({ newPasswordError: '' });
      return true;
    }
  },

  /**
   * 验证确认密码
   */
  validateConfirmPassword(value, newPassword) {
    if (!value) {
      this.setData({ confirmPasswordError: '请确认新密码' });
      return false;
    } else if (value !== newPassword) {
      this.setData({ confirmPasswordError: '两次输入的密码不一致' });
      return false;
    } else {
      this.setData({ confirmPasswordError: '' });
      return true;
    }
  },

  /**
   * 保存密码修改
   */
  savePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    
    // 验证数据
    if (!this.validateOldPassword(oldPassword)) {
      return;
    }

    if (!this.validateNewPassword(newPassword)) {
      return;
    }

    if (!this.validateConfirmPassword(confirmPassword, newPassword)) {
      return;
    }

    // 二次确认
    wx.showModal({
      title: '确认修改',
      content: '修改密码后需使用新密码登录，确定要修改吗？',
      success: (res) => {
        if (res.confirm) {
          // 准备更新数据
          const updateData = {
            old_password: oldPassword,
            new_password: newPassword
          };

          // 调用API更新用户信息
          updateProfile(updateData)
            .then(res => {
              wx.showToast({
                title: '修改成功',
                icon: 'success'
              });
              
              // 返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            })
            .catch(err => {
              console.error('更新密码失败:', err);
              wx.showToast({
                title: '修改失败，请重试',
                icon: 'none'
              });
            });
        }
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});