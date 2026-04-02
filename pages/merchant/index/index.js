// pages/merchant/index/index.js
const { getUserProfile, getMyMerchant, getMerchantDashboardStats } = require('../../../utils/api');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    this._loadingCount = 0;
    this._loadingShown = false;
    this.loadData();
  },

  onShow: function () {
    // 返回该页时刷新一次店铺信息
    if (!this.data.loading) {
      this.getShopInfo().catch(() => {});
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

  // 加载数据
  loadData: async function () {
    this.setData({ loading: true });
    this._showLoading('加载中...');

    try {
      // 先拉取一次用户资料：若管理员刚审核通过，会下发新 token（utils/api.js 会自动更新本地 token）
      try {
        await getUserProfile();
      } catch (_) {
        // ignore
      }

      await Promise.all([
        this.getShopInfo(),
        this.getStats()
      ]);
    } catch (err) {
      console.error('加载数据失败:', err);
      wx.showToast({ title: getErrMsg(err, '加载失败'), icon: 'none' });
    } finally {
      this._hideLoading();
      this.setData({ loading: false });
    }
  },

  // 获取店铺信息
  getShopInfo: async function () {
    const res = await getMyMerchant();
    if (!(res && res.success && res.data && res.data.merchant)) {
      throw new Error((res && res.message) || '获取店铺信息失败');
    }

    const m = res.data.merchant;
    if (m && m.id) {
      wx.setStorageSync('merchantId', m.id);
    }

    const normalized = {
      name: toStr(m.name, ''),
      status: (typeof m.status === 'number' ? m.status : toInt(m.status, 1)) === 1 ? 1 : 0,
      address: toStr(m.address, ''),
      phone: toStr(m.phone, ''),
      description: toStr(m.description, '')
    };
    this.setData({ shopInfo: normalized });
  },

  // 获取数据统计
  getStats: async function () {
    try {
      const res = await getMerchantDashboardStats();
      if (res && res.success && res.data) {
        this.setData({
          stats: {
            productCount: toInt(res.data.totalProducts, 0),
            // 后端未提供“总订单数”，这里用“本月订单数”近似展示
            orderCount: toInt(res.data.monthOrders, 0),
            todayOrderCount: toInt(res.data.todayOrders, 0)
          }
        });
      }
    } catch (err) {
      // 统计不影响主流程
      console.warn('merchant dashboard stats failed:', err);
    }
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
  onPullDownRefresh: async function () {
    try {
      await this.loadData();
    } finally {
      wx.stopPullDownRefresh();
    }
  }
});