// pages/merchant/index/index.js
const { request, getUserProfile, getMyMerchant, getMerchantDashboardStats } = require('../../../utils/api');

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

  onShow: function () {
    // 返回该页时刷新一次店铺信息
    if (!this.data.loading) {
      this.getShopInfo().catch(() => {});
    }
  },

  // 加载数据
  loadData: function () {
    wx.showLoading({ title: '加载中...' });

    // 先拉取一次用户资料：若管理员刚审核通过，会下发新 token（utils/api.js 会自动更新本地 token）
    getUserProfile()
      .catch(() => {})
      .finally(() => {
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
      });
  },

  // 获取店铺信息
  getShopInfo: function () {
    return new Promise((resolve, reject) => {
      getMyMerchant()
        .then(res => {
          if (res.success && res.data && res.data.merchant) {
            const merchant = res.data.merchant;
            // 缓存 merchantId 供其它页面使用（如有需要）
            if (merchant && merchant.id) {
              wx.setStorageSync('merchantId', merchant.id);
            }
            this.setData({ shopInfo: merchant });
            resolve();
          } else {
            reject((res && res.message) || '获取店铺信息失败');
          }
        })
        .catch(reject);
    });
  },

  // 获取数据统计
  getStats: function () {
    return new Promise((resolve, reject) => {
      getMerchantDashboardStats()
        .then((res) => {
          if (res && res.success && res.data) {
            this.setData({
              'stats.productCount': res.data.totalProducts || 0,
              // 后端未提供“总订单数”，这里用“本月订单数”近似展示
              'stats.orderCount': res.data.monthOrders || 0,
              'stats.todayOrderCount': res.data.todayOrders || 0
            });
          }
          resolve();
        })
        .catch((err) => {
          // 统计不影响主流程
          console.warn('merchant dashboard stats failed:', err);
          resolve();
        });
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