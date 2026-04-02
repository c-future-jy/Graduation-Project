// pages/merchant/merchant.js
const { request } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

function toInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : fallback;
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

Page({
  data: {
    shopInfo: null,
    products: [],
    loading: true,
    merchantId: null
  },

  onLoad: function (options) {
    this._loadingCount = 0;
    this._loadingShown = false;

    // 从URL参数获取商家ID
    this.setData({
      merchantId: options && options.id ? String(options.id) : null
    });

    // 支持从跳转参数动态设置导航栏标题：/pages/merchant/merchant?id=xx&title=xxx
    const initialTitle = this.safeDecodeURIComponent(options.title);
    if (initialTitle) {
      wx.setNavigationBarTitle({ title: initialTitle });
    }
    this.loadMerchantData();
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  _showLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;
    wx.showLoading({
      title: title || '处理中...',
      success: () => {
        this._loadingShown = true;
      },
      fail: () => {
        this._loadingShown = false;
      }
    });
  },

  _hideLoading() {
    const current = this._loadingCount || 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);
    this._loadingCount = next;
    if (next !== 0) return;
    if (!this._loadingShown) return;
    wx.hideLoading({
      complete: () => {
        this._loadingShown = false;
      }
    });
  },

  // 加载商家数据
  loadMerchantData: async function () {
    const merchantId = this.data.merchantId;

    if (!merchantId) {
      wx.showToast({ title: '商家ID错误', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    this._showLoading('加载中...');

    try {
      await Promise.all([
        this.getMerchantInfo(merchantId),
        this.getMerchantProducts(merchantId)
      ]);
    } catch (err) {
      console.error('加载商家数据失败:', err);
      wx.showToast({ title: getErrMsg(err, '加载失败'), icon: 'none' });
    } finally {
      this._hideLoading();
      this.setData({ loading: false });
    }
  },

  // 获取商家信息
  getMerchantInfo: async function (merchantId) {
    const res = await request({
      url: `/merchants/${merchantId}`,
      method: 'GET'
    });

    if (!(res && res.success)) {
      throw new Error((res && res.message) || '获取店铺信息失败');
    }

    const merchant = res.data && res.data.merchant ? res.data.merchant : null;
    if (!merchant) {
      this.setData({ shopInfo: null });
      return;
    }

    const normalized = {
      id: merchant.id,
      name: toStr(merchant.name, ''),
      status: (toInt(merchant.status, 1) === 1 ? 1 : 0),
      address: toStr(merchant.address, ''),
      phone: toStr(merchant.phone, ''),
      description: toStr(merchant.description, ''),
      logo: toNetworkUrl(merchant.logo)
    };

    this.setData({ shopInfo: normalized });

    // 用真实商家名刷新标题（优先级高于跳转参数，避免参数缺失/过期）
    if (normalized.name) {
      wx.setNavigationBarTitle({ title: normalized.name });
    }
  },

  // 获取商家商品列表
  getMerchantProducts: async function (merchantId) {
    const res = await request({
      url: '/products',
      method: 'GET',
      data: { merchant_id: merchantId, status: 1 }
    });

    if (!(res && res.success)) {
      throw new Error((res && res.message) || '加载商品失败');
    }

    const list = (res.data && res.data.products) || [];
    const mapped = (Array.isArray(list) ? list : []).map((p) => ({
      ...p,
      id: p.id,
      name: toStr(p.name || p.product_name, ''),
      stock: toInt(p.stock, 0) ?? 0,
      image: toNetworkUrl(p.image)
    }));
    this.setData({ products: mapped });
  },

  // 跳转到商品详情
  goToProductDetail: function (e) {
    const productId = e.currentTarget.dataset.id;
    const productName = e.currentTarget.dataset.name;
    const titleParam = productName ? `&title=${encodeURIComponent(productName)}` : '';
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}${titleParam}`
    });
  },

  // 下拉刷新
  onPullDownRefresh: async function () {
    try {
      await this.loadMerchantData();
    } finally {
      wx.stopPullDownRefresh();
    }
  }
});