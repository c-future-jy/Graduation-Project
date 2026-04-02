// pages/profile/edit-profile.js
const { updateProfile, uploadAvatar } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

const DEFAULT_AVATAR = '/assets/images/morentouxiang.jpg';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function sanitizeDigits(v) {
  return toStr(v).replace(/\D+/g, '');
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return (
    (err.data && (err.data.message || err.data.msg)) ||
    err.message ||
    err.errMsg ||
    err.msg ||
    fallback
  );
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      avatarUrl: DEFAULT_AVATAR,
      nickName: '',
      phone: '',
      role: 1
    },
    roleText: '学生',
    nickNameError: '',
    phoneError: '',
    uploadingAvatar: false,
    saving: false,
    lastUploadError: false,
    loadingCount: 0
  },

  _incLoading(title = '加载中...') {
    const next = (this.data.loadingCount || 0) + 1;
    if (next === 1) wx.showLoading({ title });
    this.setData({ loadingCount: next });
  },

  _decLoading() {
    const next = Math.max(0, (this.data.loadingCount || 0) - 1);
    if (next === 0) wx.hideLoading();
    this.setData({ loadingCount: next });
  },

  _normalizeStoredUser(raw) {
    const u = raw || {};
    const role = toInt(u.role, 1);
    const nickName = toStr(u.nickName || u.nickname || u.username || '');
    const avatarUrl = toStr(u.avatarUrl || u.avatar_url || DEFAULT_AVATAR);
    const phone = toStr(u.phone || '');
    return {
      ...u,
      role,
      nickName,
      avatarUrl,
      phone
    };
  },

  _updateStorageUser(patch) {
    try {
      const cached = wx.getStorageSync('userInfo') || {};
      const merged = { ...cached, ...(patch || {}) };
      wx.setStorageSync('userInfo', this._normalizeStoredUser(merged));
    } catch (_) {
      // ignore
    }
  },

  _isRemoteAvatar(url) {
    const v = toStr(url).trim();
    if (!v) return false;
    if (/^https?:\/\//i.test(v)) return true;
    if (v.startsWith('/uploads/')) return true;
    return false;
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
    const userInfo = this._normalizeStoredUser(wx.getStorageSync('userInfo'));
    const avatar = userInfo.avatarUrl ? toNetworkUrl(userInfo.avatarUrl) : DEFAULT_AVATAR;
    this.setData({
      userInfo: {
        avatarUrl: avatar || DEFAULT_AVATAR,
        nickName: userInfo.nickName || '',
        phone: userInfo.phone || '',
        role: userInfo.role || 1
      },
      roleText: this.getRoleText(userInfo.role || 1)
    });
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

  _wxChooseImage() {
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

  _wxGetFileSize(path) {
    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath: path,
        success: (info) => resolve(info && info.size ? info.size : 0),
        fail: reject
      });
    });
  },

  _wxCompressImage(srcPath, quality) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: srcPath,
        quality,
        success: (res) => resolve(res && res.tempFilePath ? res.tempFilePath : ''),
        fail: reject
      });
    });
  },

  _wxGetImageInfo(srcPath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: srcPath,
        success: resolve,
        fail: reject
      });
    });
  },

  _wxCanvasToTempFilePath({ canvasId, width, height, destWidth, destHeight }) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvasId,
          x: 0,
          y: 0,
          width,
          height,
          destWidth,
          destHeight,
          success: (res) => resolve(res && res.tempFilePath ? res.tempFilePath : ''),
          fail: reject
        },
        this
      );
    });
  },

  async _compressAvatarIfNeeded(filePath) {
    const size = await this._wxGetFileSize(filePath);
    if (size <= MAX_AVATAR_SIZE) return filePath;

    this._incLoading('图片过大，正在压缩...');
    try {
      // 先用 compressImage 尝试
      const qualities = [80, 60, 40];
      for (const q of qualities) {
        try {
          const compressed = await this._wxCompressImage(filePath, q);
          if (!compressed) continue;
          const newSize = await this._wxGetFileSize(compressed);
          if (newSize <= MAX_AVATAR_SIZE) return compressed;
        } catch (_) {
          // ignore and continue
        }
      }

      // 再用 canvas 缩放尝试
      try {
        const info = await this._wxGetImageInfo(filePath);
        const width = toInt(info && info.width, 0);
        const height = toInt(info && info.height, 0);
        if (!width || !height) throw new Error('无法读取图片尺寸');

        const maxDim = 1024;
        const ratio = Math.min(1, maxDim / Math.max(width, height));
        const destW = Math.max(1, Math.floor(width * ratio));
        const destH = Math.max(1, Math.floor(height * ratio));

        const ctx = wx.createCanvasContext('avatarCanvas', this);
        ctx.clearRect(0, 0, destW, destH);
        ctx.drawImage(filePath, 0, 0, destW, destH);
        await new Promise((resolve) => ctx.draw(false, resolve));

        const canvasCompressed = await this._wxCanvasToTempFilePath({
          canvasId: 'avatarCanvas',
          width: destW,
          height: destH,
          destWidth: destW,
          destHeight: destH
        });

        if (canvasCompressed) {
          const canvasSize = await this._wxGetFileSize(canvasCompressed);
          if (canvasSize <= MAX_AVATAR_SIZE) return canvasCompressed;
        }
      } catch (canvasErr) {
        console.warn('canvas compress failed', canvasErr);
      }

      throw new Error('图片大小超过 2MB，无法上传，请选择更小的图片或裁剪后再试。');
    } finally {
      this._decLoading();
    }
  },

  async _uploadAvatarAndApply(filePath) {
    const resp = await uploadAvatar(filePath);
    const serverPath = resp && resp.data ? (resp.data.avatarUrl || resp.data.url) : '';
    const displayUrl = serverPath ? toNetworkUrl(serverPath) : filePath;

    this.setData({
      'userInfo.avatarUrl': displayUrl,
      uploadingAvatar: false,
      lastUploadError: false
    });

    if (serverPath) this._updateStorageUser({ avatarUrl: displayUrl, avatar_url: displayUrl });
    wx.showToast({ title: '头像已上传', icon: 'success' });
    return { serverPath, displayUrl };
  },

  /**
   * 选择头像
   */
  chooseAvatar() {
    (async () => {
      try {
        const res = await this._wxChooseImage();
        const tempFilePath = res && res.tempFiles && res.tempFiles[0] ? res.tempFiles[0].tempFilePath : '';
        if (!tempFilePath) return;

        this.setData({
          'userInfo.avatarUrl': tempFilePath,
          uploadingAvatar: true,
          lastUploadError: false
        });

        const finalPath = await this._compressAvatarIfNeeded(tempFilePath);
        await this._uploadAvatarAndApply(finalPath);
      } catch (err) {
        // 用户取消选择或处理失败
        const msg = getErrMsg(err, '头像处理失败');
        if (msg && !/cancel/i.test(msg)) {
          console.error('chooseAvatar error:', err);
          this.setData({ uploadingAvatar: false, lastUploadError: true });
          wx.showToast({ title: msg, icon: 'none' });
        } else {
          this.setData({ uploadingAvatar: false });
        }
      }
    })();
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

    (async () => {
      this.setData({ uploadingAvatar: true, lastUploadError: false });
      try {
        const finalPath = await this._compressAvatarIfNeeded(path);
        await this._uploadAvatarAndApply(finalPath);
      } catch (err) {
        console.error('retry uploadAvatar error:', err);
        this.setData({ uploadingAvatar: false, lastUploadError: true });
        wx.showToast({ title: getErrMsg(err, '头像上传失败'), icon: 'none' });
      }
    })();
  },

  /**
   * 昵称变化
   */
  onNickNameChange(e) {
    const value = toStr(e && e.detail ? e.detail.value : '').slice(0, 20);
    const nickNameError = this._getNickNameError(value);
    this.setData({
      'userInfo.nickName': value,
      nickNameError
    });
  },

  /**
   * 手机号变化
   */
  onPhoneChange(e) {
    const value = sanitizeDigits(e && e.detail ? e.detail.value : '').slice(0, 11);
    const phoneError = this._getPhoneError(value);
    this.setData({
      'userInfo.phone': value,
      phoneError
    });
  },

  /**
   * 验证昵称
   */
  _getNickNameError(value) {
    const v = toStr(value).trim();
    if (!v) return '请输入昵称';
    if (v.length < 2 || v.length > 20) return '昵称长度应在2-20位之间';
    return '';
  },

  /**
   * 验证手机号
   */
  _getPhoneError(value) {
    const v = toStr(value).trim();
    if (!v) return '';
    if (!/^1[3-9]\d{9}$/.test(v)) return '请输入正确的手机号';
    return '';
  },

  _validateAll({ nickName, phone }) {
    const nickNameError = this._getNickNameError(nickName);
    const phoneError = this._getPhoneError(phone);
    this.setData({ nickNameError, phoneError });
    return !nickNameError && !phoneError;
  },

  /**
   * 保存基础信息
   */
  async saveBasicInfo() {
    if (this.data.saving) return;

    const rawNickName = toStr(this.data.userInfo && this.data.userInfo.nickName).slice(0, 20);
    const nickName = rawNickName.trim();
    const phone = sanitizeDigits(this.data.userInfo && this.data.userInfo.phone).slice(0, 11);
    const avatarUrl = toStr(this.data.userInfo && this.data.userInfo.avatarUrl);

    this.setData({
      'userInfo.nickName': nickName,
      'userInfo.phone': phone
    });

    if (!this._validateAll({ nickName, phone })) return;

    const updateData = {
      nickname: nickName,
      phone
    };

    if (this._isRemoteAvatar(avatarUrl)) {
      updateData.avatar_url = avatarUrl;
    }

    this.setData({ saving: true });
    this._incLoading('保存中...');
    try {
      const res = await updateProfile(updateData);
      if (!res || !res.success) {
        wx.showToast({ title: (res && res.message) || '保存失败，请重试', icon: 'none' });
        return;
      }

      const cached = this._normalizeStoredUser(wx.getStorageSync('userInfo'));
      const nextAvatar = this._isRemoteAvatar(avatarUrl)
        ? avatarUrl
        : toStr(cached.avatarUrl || cached.avatar_url || DEFAULT_AVATAR);

      this._updateStorageUser({
        nickName,
        nickname: nickName,
        phone,
        avatarUrl: nextAvatar,
        avatar_url: nextAvatar
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    } catch (err) {
      console.error('更新用户信息失败:', err);
      wx.showToast({ title: getErrMsg(err, '保存失败，请重试'), icon: 'none' });
    } finally {
      this._decLoading();
      this.setData({ saving: false });
    }
  },

  /**
   * 跳转到密码修改页面
   */
  goToPasswordEdit() {
    wx.navigateTo({
      url: '/pages/profile/password-edit'
    });
  }
});