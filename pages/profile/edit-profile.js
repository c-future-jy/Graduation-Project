// pages/profile/edit-profile.js
import { updateProfile, decryptWeixinPhone, uploadAvatar } from '../../utils/api';

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      avatarUrl: '/assets/images/morentouxiang.jpg',
      nickName: '',
      phone: '',
      role: 1
    },
    roleText: '学生',
    nickNameError: '',
    phoneError: '',
    uploadingAvatar: false,
    saving: false,
    focusedField: '',
    lastUploadError: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: {
          avatarUrl: userInfo.avatarUrl || '/assets/images/morentouxiang.jpg',
          nickName: userInfo.nickName || '',
          phone: userInfo.phone || '',
          role: userInfo.role || 1
        },
        roleText: this.getRoleText(userInfo.role || 1)
      });
    }
  },

  /**
   * 获取角色文本
   */
  getRoleText(role) {
    switch (role) {
      case 1:
        return '学生';
      case 2:
        return '商家';
      case 3:
        return '管理员';
      default:
        return '学生';
    }
  },

  /**
   * 选择头像
   */
  chooseAvatar() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        // 预览并标记上传中
        self.setData({
          'userInfo.avatarUrl': tempFilePath,
          uploadingAvatar: true,
          lastUploadError: false
        });

        // 检查文件大小并在必要时压缩再上传
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB

        const getFileSize = (path) => new Promise((resolve, reject) => {
          wx.getFileInfo({
            filePath: path,
            success(info) { resolve(info.size); },
            fail(err) { reject(err); }
          });
        });

        const tryCompress = (srcPath, qualities) => new Promise((resolve, reject) => {
          const attempt = (idx) => {
            if (idx >= qualities.length) return reject(new Error('无法将图片压缩到 2MB 以下'));
            const q = qualities[idx];
            wx.compressImage({ src: srcPath, quality: q, success(cRes) {
              resolve(cRes.tempFilePath);
            }, fail() { attempt(idx + 1); } });
          };
          attempt(0);
        });

        const compressWithCanvas = (srcPath, maxDim = 1024) => new Promise((resolve, reject) => {
          // 使用 canvas 缩放图片以进一步减小体积
          wx.getImageInfo({ src: srcPath, success(info) {
            const { width, height } = info;
            const ratio = Math.min(1, maxDim / Math.max(width, height));
            const destW = Math.floor(width * ratio);
            const destH = Math.floor(height * ratio);

            const ctx = wx.createCanvasContext('avatarCanvas', self);
            ctx.clearRect(0, 0, destW, destH);
            ctx.drawImage(srcPath, 0, 0, destW, destH);
            ctx.draw(false, () => {
              wx.canvasToTempFilePath({
                canvasId: 'avatarCanvas',
                x: 0,
                y: 0,
                width: destW,
                height: destH,
                destWidth: destW,
                destHeight: destH,
                success(res) { resolve(res.tempFilePath); },
                fail(err) { reject(err); }
              }, self);
            });
          }, fail(err) {
            reject(err);
          }});
        });

        (async () => {
          try {
            let size = await getFileSize(tempFilePath);
            // 若已超过限制，尝试压缩
            if (size > MAX_SIZE) {
              wx.showLoading({ title: '图片过大，正在压缩...' });
              try {
                // 先用 compressImage 尝试压缩
                let compressed = null;
                try {
                  compressed = await tryCompress(tempFilePath, [80, 60, 40]);
                } catch (_) {
                  compressed = null;
                }

                let newSize = 0;
                if (compressed) {
                  newSize = await getFileSize(compressed);
                }

                // 如果 compressImage 无法把大小降到要求，再尝试 canvas 缩放压缩
                if (!compressed || newSize > MAX_SIZE) {
                  try {
                    const canvasCompressed = await compressWithCanvas(tempFilePath, 1024);
                    const canvasSize = await getFileSize(canvasCompressed);
                    if (canvasSize <= MAX_SIZE) {
                      compressed = canvasCompressed;
                      newSize = canvasSize;
                    }
                  } catch (canvasErr) {
                    // canvas 压缩失败，继续后续处理
                    console.warn('canvas compress failed', canvasErr);
                  }
                }

                if (!compressed || newSize > MAX_SIZE) {
                  wx.hideLoading();
                  self.setData({ uploadingAvatar: false, lastUploadError: true });
                  wx.showModal({ title: '提示', content: '图片大小超过 2MB，无法上传，请选择更小的图片或裁剪后再试。', showCancel: false });
                  return;
                }
                // 使用压缩后的图片路径
                await uploadAvatar(compressed)
                  .then(resp => {
                    const url = resp.data && resp.data.url ? resp.data.url : (resp.url || compressed);
                    self.setData({ 'userInfo.avatarUrl': url, uploadingAvatar: false, lastUploadError: false });
                    wx.showToast({ title: '头像已上传', icon: 'success' });
                  })
                  .catch(err => {
                    self.setData({ uploadingAvatar: false, lastUploadError: true });
                    let msg = '头像上传失败';
                    if (err) {
                      if (err.data && err.data.message) msg = err.data.message;
                      else if (err.message) msg = err.message;
                      else if (err.errMsg) msg = err.errMsg;
                    }
                    console.error('uploadAvatar error:', err);
                    wx.showToast({ title: msg, icon: 'none' });
                  });
                wx.hideLoading();
              } catch (compressErr) {
                wx.hideLoading();
                self.setData({ uploadingAvatar: false, lastUploadError: true });
                wx.showModal({ title: '提示', content: '图片压缩失败或无法达到大小要求，请选择更小图片。', showCancel: false });
              }
            } else {
              // 大小合规，直接上传
              uploadAvatar(tempFilePath)
                .then(resp => {
                  const url = resp.data && resp.data.url ? resp.data.url : (resp.url || tempFilePath);
                  self.setData({ 'userInfo.avatarUrl': url, uploadingAvatar: false, lastUploadError: false });
                  wx.showToast({ title: '头像已上传', icon: 'success' });
                })
                .catch(err => {
                  self.setData({ uploadingAvatar: false, lastUploadError: true });
                  let msg = '头像上传失败';
                  if (err) {
                    if (err.data && err.data.message) msg = err.data.message;
                    else if (err.message) msg = err.message;
                    else if (err.errMsg) msg = err.errMsg;
                  }
                  console.error('uploadAvatar error:', err);
                  wx.showToast({ title: msg, icon: 'none' });
                });
            }
          } catch (err) {
            console.error('文件信息获取失败:', err);
            self.setData({ uploadingAvatar: false, lastUploadError: true });
            wx.showToast({ title: '无法读取文件信息', icon: 'none' });
          }
        })();
      },
      fail() {
        // 用户取消选择
      }
    });
  },

  /**
   * 重试上传当前预览头像（若为本地临时文件）
   */
  retryUpload() {
    const path = this.data.userInfo.avatarUrl;
    if (!path) {
      return wx.showToast({ title: '无可上传的头像', icon: 'none' });
    }

    // 如果已经是远程 url，则不必重新上传
    if (/^https?:\/\//.test(path)) {
      return wx.showToast({ title: '当前头像已是远程图片，无需上传', icon: 'none' });
    }

    this.setData({ uploadingAvatar: true, lastUploadError: false });
    uploadAvatar(path)
      .then(resp => {
        const url = resp.data && resp.data.url ? resp.data.url : (resp.url || path);
        this.setData({ 'userInfo.avatarUrl': url, uploadingAvatar: false, lastUploadError: false });
        wx.showToast({ title: '头像已上传', icon: 'success' });
      })
      .catch(err => {
        this.setData({ uploadingAvatar: false, lastUploadError: true });
        let msg = '头像上传失败';
        if (err) {
          if (err.data && err.data.message) msg = err.data.message;
          else if (err.message) msg = err.message;
          else if (err.errMsg) msg = err.errMsg;
        }
        console.error('retry uploadAvatar error:', err);
        wx.showToast({ title: msg, icon: 'none' });
      });
  },

  /**
   * 昵称变化
   */
  onNickNameChange(e) {
    const value = e.detail.value;
    this.setData({
      'userInfo.nickName': value
    });
    
    // 实时验证
    this.validateNickName(value);
  },

  /**
   * 手机号变化
   */
  onPhoneChange(e) {
    const value = e.detail.value;
    this.setData({
      'userInfo.phone': value
    });
    
    // 实时验证
    this.validatePhone(value);
  },

  /**
   * 验证昵称
   */
  validateNickName(value) {
    if (!value) {
      this.setData({ nickNameError: '请输入昵称' });
      return false;
    } else if (value.length < 2 || value.length > 20) {
      this.setData({ nickNameError: '昵称长度应在2-20位之间' });
      return false;
    } else {
      this.setData({ nickNameError: '' });
      return true;
    }
  },

  /**
   * 验证手机号
   */
  validatePhone(value) {
    if (!value) {
      this.setData({ phoneError: '' });
      return true;
    } else if (!/^1[3-9]\d{9}$/.test(value)) {
      this.setData({ phoneError: '请输入正确的手机号' });
      return false;
    } else {
      this.setData({ phoneError: '' });
      return true;
    }
  },

  /**
   * 微信一键获取手机号
   */
  onGetPhoneNumber(e) {
    const detail = e.detail || {};
    if (detail.errMsg && detail.errMsg.indexOf('ok') !== -1) {
      // 发送到后端解密
      const payload = {
        encryptedData: detail.encryptedData,
        iv: detail.iv
      };
      wx.showLoading({ title: '获取中...' });
      decryptWeixinPhone(payload)
        .then(res => {
          wx.hideLoading();
          if (res && res.data && res.data.phone) {
            this.setData({ 'userInfo.phone': res.data.phone });
            wx.showToast({ title: '手机号已获取', icon: 'success' });
          } else {
            wx.showToast({ title: '获取失败', icon: 'none' });
          }
        })
        .catch(err => {
          wx.hideLoading();
          console.error('解密手机号失败:', err);
          wx.showToast({ title: '获取失败', icon: 'none' });
        });
    } else {
      wx.showToast({ title: '未授权获取手机号', icon: 'none' });
    }
  },

  onInputFocus(e) {
    const field = e.currentTarget.dataset.field || '';
    this.setData({ focusedField: field });
  },

  onInputBlur() {
    this.setData({ focusedField: '' });
  },

  /**
   * 保存基础信息
   */
  saveBasicInfo() {
    const { userInfo } = this.data;
    if (this.data.saving) return;
    
    // 验证数据
    if (!this.validateNickName(userInfo.nickName)) {
      return;
    }

    if (userInfo.phone && !this.validatePhone(userInfo.phone)) {
      return;
    }

    // 准备更新数据
    const updateData = {
      nickname: userInfo.nickName,
      avatar_url: userInfo.avatarUrl,
      phone: userInfo.phone
    };

    // 调用API更新用户信息
    this.setData({ saving: true });
    updateProfile(updateData)
      .then(res => {
        console.log('API返回的更新结果:', res.data);
        wx.showToast({ title: '保存成功', icon: 'success' });
        // 更新本地存储，确保字段名一致
        const updatedUserInfo = {
          avatarUrl: userInfo.avatarUrl,
          nickName: userInfo.nickName,
          phone: userInfo.phone,
          role: userInfo.role
        };
        wx.setStorageSync('userInfo', updatedUserInfo);
        console.log('更新后的本地存储用户信息:', updatedUserInfo);
        setTimeout(() => {
          wx.navigateBack();
        }, 1200);
      })
      .catch(err => {
        console.error('更新用户信息失败:', err);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },

  /**
   * 跳转到密码修改页面
   */
  goToPasswordEdit() {
    wx.navigateTo({
      url: '/pages/profile/password-edit'
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});