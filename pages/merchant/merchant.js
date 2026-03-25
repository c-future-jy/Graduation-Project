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
    this.loadMerchantData();
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
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}`
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadMerchantData().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});