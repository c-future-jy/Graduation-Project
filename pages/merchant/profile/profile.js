// pages/merchant/profile/profile.js
const { getUserProfile, getMyMerchant, updateMerchant, uploadImage } = require('../../../utils/api');

Page({
  data: {
    loading: true,
    saving: false,
    uploadingLogo: false,
    merchantId: null,
    logoPreview: '',
    form: {
      name: '',
      logo: '',
      description: '',
      address: '',
      phone: '',
      status: 1
    }
  },

  _draftKey: 'merchantProfileDraft',

  onLoad() {
    this.loadMerchant();
  },

  onShow() {
    // 从系统相册/相机返回时，可能触发页面重建或节点重绘；这里尝试恢复草稿
    this.restoreDraft();
  },

  persistDraft() {
    try {
      const payload = {
        ts: Date.now(),
        merchantId: this.data.merchantId || null,
        form: this.data.form || {}
      };
      wx.setStorageSync(this._draftKey, payload);
    } catch (_) {
      // ignore
    }
  },

  restoreDraft() {
    try {
      const draft = wx.getStorageSync(this._draftKey);
      if (!draft || !draft.form) return;

      // 草稿有效期：30分钟
      if (draft.ts && Date.now() - draft.ts > 30 * 60 * 1000) {
        wx.removeStorageSync(this._draftKey);
        return;
      }

      // merchantId 未加载出来前也允许先恢复（避免重建后先看到空白）
      const draftMerchantId = draft.merchantId;
      const currentMerchantId = this.data.merchantId;
      if (draftMerchantId && currentMerchantId && parseInt(draftMerchantId, 10) !== parseInt(currentMerchantId, 10)) {
        return;
      }

      // 合并草稿（草稿优先）
      const merged = Object.assign({}, this.data.form || {}, draft.form || {});
      this.setData({ form: merged, logoPreview: this.toPreviewUrl(merged.logo) });
    } catch (_) {
      // ignore
    }
  },

  clearDraft() {
    try {
      wx.removeStorageSync(this._draftKey);
    } catch (_) {
      // ignore
    }
  },

  toPreviewUrl(maybeUrl) {
    const url = String(maybeUrl || '').trim();
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (!url.startsWith('/')) return url;

    // 后端 baseUrl 通常是 http://host:port/api，这里取 origin
    let baseUrl = '';
    try {
      const app = typeof getApp === 'function' ? getApp() : null;
      baseUrl = app && app.globalData && app.globalData.baseUrl ? String(app.globalData.baseUrl) : '';
    } catch (_) {
      baseUrl = '';
    }
    baseUrl = baseUrl || 'http://localhost:3000/api';
    const origin = baseUrl.replace(/\/api\/?$/, '');
    return origin + url;
  },

  loadMerchant() {
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });

    // 先拉取用户资料，触发 token 自动刷新（若管理员刚审核通过）
    getUserProfile()
      .catch(() => {})
      .finally(() => {
        getMyMerchant()
          .then((res) => {
            if (res && res.success && res.data && res.data.merchant) {
              const m = res.data.merchant;
              const nextForm = {
                name: m.name || '',
                logo: m.logo || '',
                description: m.description || '',
                address: m.address || '',
                phone: m.phone || '',
                status: typeof m.status === 'number' ? m.status : parseInt(m.status, 10) || 1
              };
              this.setData({
                merchantId: m.id,
                form: nextForm,
                logoPreview: this.toPreviewUrl(nextForm.logo)
              });
              if (m && m.id) wx.setStorageSync('merchantId', m.id);

              // 若存在草稿，恢复覆盖（避免选择图片等场景把输入覆盖回服务端旧值）
              this.restoreDraft();
            } else {
              wx.showToast({ title: (res && res.message) || '未找到商家信息', icon: 'none' });
            }
          })
          .catch((err) => {
            console.error('getMyMerchant failed:', err);
            wx.showToast({ title: (err && err.message) || '加载失败', icon: 'none' });
          })
          .finally(() => {
            wx.hideLoading();
            this.setData({ loading: false });
          });
      });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail.value });
    this.persistDraft();
  },

  onStatusChange(e) {
    this.setData({ 'form.status': e.detail.value ? 1 : 0 });
    this.persistDraft();
  },

  chooseLogo() {
    if (this.data.uploadingLogo) return;
    // 先落盘草稿，避免选择图片返回时页面重建导致输入丢失
    this.persistDraft();
    this.setData({ uploadingLogo: true });

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempFilePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
        if (!tempFilePath) {
          this.setData({ uploadingLogo: false });
          return;
        }

        wx.showLoading({ title: '上传中...' });
        uploadImage(tempFilePath)
          .then((resp) => {
            const url = (resp && resp.data && resp.data.url) ? resp.data.url : (resp && resp.url) || '';
            if (url) {
              // form.logo 保存相对路径，避免把 localhost 写进数据库
              this.setData({ 'form.logo': url, logoPreview: this.toPreviewUrl(url) });
              this.persistDraft();
              wx.showToast({ title: '上传成功', icon: 'success' });
            } else {
              wx.showToast({ title: '上传失败', icon: 'none' });
            }
          })
          .catch((err) => {
            console.error('upload logo failed:', err);
            wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
          })
          .finally(() => {
            wx.hideLoading();
            this.setData({ uploadingLogo: false });
          });
      },
      fail: () => {
        this.setData({ uploadingLogo: false });
      }
    });
  },

  save() {
    if (this.data.saving) return;
    const merchantId = this.data.merchantId;
    if (!merchantId) {
      return wx.showToast({ title: '缺少商家ID，请重试', icon: 'none' });
    }

    const form = this.data.form || {};
    if (!String(form.name || '').trim()) {
      return wx.showToast({ title: '请填写店铺名称', icon: 'none' });
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中...' });

    const getErrMsg = (err) => {
      if (!err) return '保存失败';
      if (typeof err === 'string') return err;
      if (err.message) return err.message;
      if (err.data && err.data.message) return err.data.message;
      if (err.errMsg) return err.errMsg;
      return '保存失败';
    };

    updateMerchant(merchantId, {
      name: form.name,
      logo: form.logo,
      description: form.description,
      address: form.address,
      phone: form.phone,
      status: form.status
    })
      .then((res) => {
        // 正常情况下：request 封装只会在 success=true 时进入 then
        if (res && res.success) {
          this.clearDraft();
          wx.showToast({ title: '保存成功', icon: 'success', duration: 1200 });

          // 返回商家中心首页；若不是从商家中心进入，则直接重定向
          setTimeout(() => {
            wx.navigateBack({
              delta: 1,
              fail: () => {
                wx.redirectTo({ url: '/pages/merchant/index/index' });
              }
            });
          }, 800);
          return;
        }

        // 兜底：若后端返回 success=false 但没被 request 拦截
        const msg = (res && res.message) || '保存失败';
        wx.showModal({ title: '保存失败', content: msg, showCancel: false });
      })
      .catch((err) => {
        console.error('updateMerchant failed:', err);
        const msg = getErrMsg(err);
        // 失败提示尽量显眼
        wx.showModal({ title: '保存失败', content: msg, showCancel: false });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ saving: false });
      });
  }
});