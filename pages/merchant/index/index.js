// pages/merchant/index/index.js
const { request } = require('../../../utils/api');

Page({
  data: {
    shopInfo: {
      name: '',
      status: 1,
      address: '',
      phone: '',
      description: ''
    },
    stats: {
      productCount: 0,
      orderCount: 0,
      todayOrderCount: 0
    },
    loading: true
  },

  onLoad: function () {
    this.loadData();
  },

  // 加载数据
  loadData: function () {
    wx.showLoading({ title: '加载中...' });
    
    Promise.all([
      this.getShopInfo(),
      this.getStats()
    ]).then(() => {
      this.setData({ loading: false });
      wx.hideLoading();
    }).catch(err => {
      console.error('加载数据失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  // 获取店铺信息
  getShopInfo: function () {
    return new Promise((resolve, reject) => {
      // 假设从本地存储获取商家ID
      const merchantId = wx.getStorageSync('merchantId') || 1;
      
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

  // 获取数据统计
  getStats: function () {
    return new Promise((resolve, reject) => {
      // 假设从本地存储获取商家ID
      const merchantId = wx.getStorageSync('merchantId') || 1;
      
      // 获取商品数量
      request({
        url: '/products',
        method: 'GET',
        data: { merchant_id: merchantId }
      }).then(res => {
        if (res.success) {
          this.setData({
            'stats.productCount': res.data.products.length
          });
        }
        
        // 获取订单数量
        return request({
          url: '/orders',
          method: 'GET',
          data: { merchant_id: merchantId }
        });
      }).then(res => {
        if (res.success) {
          this.setData({
            'stats.orderCount': res.data.orders ? res.data.orders.length : 0
          });
        }
        
        // 获取今日订单数量
        const today = new Date().toISOString().split('T')[0];
        return request({
          url: '/orders',
          method: 'GET',
          data: { 
            merchant_id: merchantId,
            start_date: today,
            end_date: today
          }
        });
      }).then(res => {
        if (res.success) {
          this.setData({
            'stats.todayOrderCount': res.data.orders ? res.data.orders.length : 0
          });
        }
        resolve();
      }).catch(reject);
    });
  },

  // 跳转到商品管理
  goToProducts: function () {
    wx.navigateTo({
      url: '../products/products'
    });
  },

  // 跳转到订单管理
  goToOrders: function () {
    wx.navigateTo({
      url: '../orders/orders'
    });
  },

  // 跳转到店铺信息
  goToProfile: function () {
    wx.navigateTo({
      url: '../profile/profile'
    });
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});