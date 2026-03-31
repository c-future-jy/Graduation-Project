// pages/merchant/merchant.js
const { request } = require('../../utils/api');

Page({
  data: {
    shopInfo: null,
    products: [],
    loading: true,
    merchantId: null
  },

  onLoad: function (options) {
    // 从URL参数获取商家ID
    this.setData({
      merchantId: options.id
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

  // 加载商家数据
  loadMerchantData: function () {
    const { merchantId } = this.data;
    
    if (!merchantId) {
      wx.showToast({ title: '商家ID错误', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    wx.showLoading({ title: '加载中...' });
    
    Promise.all([
      this.getMerchantInfo(merchantId),
      this.getMerchantProducts(merchantId)
    ]).then(() => {
      this.setData({ loading: false });
      wx.hideLoading();
    }).catch(err => {
      console.error('加载商家数据失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // 获取商家信息
  getMerchantInfo: function (merchantId) {
    return new Promise((resolve, reject) => {
      request({
        url: `/merchants/${merchantId}`,
        method: 'GET'
      }).then(res => {
        if (res.success) {
          this.setData({
            shopInfo: res.data.merchant
          });

          // 用真实商家名刷新标题（优先级高于跳转参数，避免参数缺失/过期）
          if (res.data && res.data.merchant && res.data.merchant.name) {
            wx.setNavigationBarTitle({ title: res.data.merchant.name });
          }
          resolve();
        } else {
          reject(res.message);
        }
      }).catch(reject);
    });
  },

  // 获取商家商品列表
  getMerchantProducts: function (merchantId) {
    return new Promise((resolve, reject) => {
      request({
        url: '/products',
        method: 'GET',
        data: { merchant_id: merchantId, status: 1 }
      }).then(res => {
        if (res.success) {
          this.setData({
            products: res.data.products || []
          });
        }
        resolve();
      }).catch(reject);
    });
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
  onPullDownRefresh: function () {
    this.loadMerchantData().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});