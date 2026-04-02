// pages/merchant/orders/orders.js
const { request, getUserProfile } = require('../../../utils/api');
const { getStatusText, getStatusClass } = require('../../../utils/orderUtils');
const { showError, showSuccess, debounce } = require('../../../utils/pageUtils');

Page({
  data: {
    orders: [],
    activeTab: 'all',
    searchKeyword: '',
    loading: false,
    hasMore: true,
    pageNum: 1,
    pageSize: 10,
    shippingOrderId: null
  },

  onLoad: async function (options) {
    this._loadingCount = 0;
    this._loadingShown = false;

    const opt = options || {};
    let nextTab = this.data.activeTab;
    if (opt.tab) {
      const t = String(opt.tab);
      if (t === 'all' || t === 'pending' || t === 'shipped' || t === 'completed') nextTab = t;
    } else if (opt.status !== undefined) {
      const s = parseInt(opt.status, 10);
      if (s === 1) nextTab = 'pending';
      else if (s === 2) nextTab = 'shipped';
      else if (s === 3) nextTab = 'completed';
      else nextTab = 'all';
    }
    if (nextTab !== this.data.activeTab) {
      this.setData({ activeTab: nextTab });
    }

    // 先拉取用户资料：若管理员刚审核通过，会下发新 token（utils/api.js 自动更新本地 token）
    try {
      await getUserProfile();
    } catch (_) {
      // ignore
    }
    this.loadOrders(false);
  },

  onShow() {
    try {
      const need = wx.getStorageSync('merchantOrdersNeedRefresh');
      if (need) {
        wx.removeStorageSync('merchantOrdersNeedRefresh');
        this.refreshOrders();
      }
    } catch (_) {
      // ignore
    }
  },

  getErrMsg(err, fallback = '操作失败') {
    if (!err) return fallback;
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.data && err.data.message) return err.data.message;
    return fallback;
  },

  toMoney(value) {
    if (value === null || value === undefined || value === '') return '0.00';
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    return n.toFixed(2);
  },

  _toValidDate(input) {
    if (!input) return null;
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

    const raw = String(input).trim();
    if (!raw) return null;

    // iOS/部分引擎对 `YYYY-MM-DD HH:mm:ss` 解析不稳定
    const normalized = raw
      .replace(/-/g, '/')
      .replace('T', ' ')
      .replace(/\.(\d+)Z$/, '');

    const d = new Date(normalized);
    if (!Number.isNaN(d.getTime())) return d;

    // 兜底：纯数字时间戳（秒/毫秒）
    const n = Number(raw);
    if (Number.isFinite(n)) {
      const ms = n < 1e12 ? n * 1000 : n;
      const d2 = new Date(ms);
      return Number.isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  },

  _formatRelativeTime(input) {
    const d = this._toValidDate(input);
    if (!d) return String(input || '').trim();

    const now = Date.now();
    const diffMs = now - d.getTime();
    if (!Number.isFinite(diffMs)) return String(input || '').trim();

    if (diffMs < 60 * 1000) return '刚刚';
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}分钟前`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}小时前`;
    return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}天前`;
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

  _resetListState() {
    this.setData({ pageNum: 1, orders: [], hasMore: true });
  },

  async _reloadList() {
    this._resetListState();
    await this.loadOrders(false);
  },

  // 加载订单数据
  async loadOrders(isLoadMore = false) {
    const { activeTab, searchKeyword, pageNum, pageSize, loading } = this.data;

    if (loading) return;

    this.setData({ loading: true });
    this._showLoading('加载中...');

    // 构建请求参数
    const params = {
      page: isLoadMore ? pageNum + 1 : 1,
      limit: pageSize
    };

    // 根据标签筛选状态
    if (activeTab !== 'all') {
      switch (activeTab) {
        case 'pending':
          params.status = 1; // 待发货
          break;
        case 'shipped':
          params.status = 2; // 已发货
          break;
        case 'completed':
          params.status = 3; // 已完成
          break;
      }
    }

    // 添加搜索关键词
    if (searchKeyword) {
      params.keyword = searchKeyword;
    }

    try {
      const res = await request({
        url: '/orders/merchant/orders',
        method: 'GET',
        data: params
      });
      if (res.success) {
        const orders = (res.data && res.data.orders) ? res.data.orders : [];
        const normalizedOrders = orders.map((o) => {
          const totalAmount = (o && (o.total_amount ?? o.totalAmount ?? o.pay_amount ?? o.amount)) ?? 0;
          const products = (o && (o.products || o.items || o.order_items)) || [];
          const safeProducts = Array.isArray(products) ? products : [];
          const productCount = safeProducts.length;
          return {
            ...o,
            id: o.id ?? o.order_id ?? o.orderId,
            order_no: o.order_no ?? o.orderNo ?? o.no,
            created_at: o.created_at ?? o.createdAt ?? o.create_time,
            displayTime: this._formatRelativeTime(o.created_at ?? o.createdAt ?? o.create_time),
            products: safeProducts,
            displayProducts: productCount > 2 ? safeProducts.slice(0, 2) : safeProducts,
            productCount,
            displayAmount: this.toMoney(totalAmount)
          };
        });
        const newPageNum = isLoadMore ? pageNum + 1 : 1;
        const newOrders = isLoadMore ? [...this.data.orders, ...normalizedOrders] : normalizedOrders;

        this.setData({
          orders: newOrders,
          pageNum: newPageNum,
          hasMore: normalizedOrders.length >= pageSize
        });
      } else {
        showError(res.message || '加载失败');
      }
    } catch (err) {
      const msg = (err && err.message) || '网络错误';
      showError(msg);
      console.error('加载订单失败:', err);
    } finally {
      this._hideLoading();
      this.setData({ loading: false });
    }
  },

  // 切换标签
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      pageNum: 1,
      orders: [],
      hasMore: true
    });
    this.loadOrders(false);
  },

  // 搜索输入
  onSearchInput: debounce(function (e) {
    this.setData({ searchKeyword: e.detail.value });
    this.loadOrders(false);
  }, 500),

  // 搜索确认
  onSearchConfirm: function () {
    this._reloadList();
  },

  // 清除搜索
  clearSearch: function () {
    this.setData({ searchKeyword: '' });
    this._reloadList();
  },

  // 跳转到订单详情
  goToOrderDetail: function (e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/merchant/order-detail/order-detail?id=${orderId}`
    });
  },

  // 处理发货
  handleShip: function (e) {
    const orderId = e.currentTarget.dataset.id;
    this.setData({ shippingOrderId: orderId });
    this.confirmShip();
  },

  // 确认发货
  confirmShip: function () {
    const { shippingOrderId } = this.data;
    
    wx.showModal({
      title: '确认发货',
      content: '确定要发货吗？',
      success: (res) => {
        if (res.confirm) {
          this.shipOrder(shippingOrderId);
        }
      }
    });
  },

  // 执行发货
  async shipOrder(orderId) {
    this._showLoading('发货中...');
    try {
      const res = await request({
        url: `/orders/merchant/orders/${orderId}/ship`,
        method: 'POST',
        silent: true
      });
      if (res.success) {
        showSuccess('发货成功');

        // 立即更新本地状态，避免按钮残留
        const nextOrders = (this.data.orders || []).map((o) => (
          String(o.id) === String(orderId) ? { ...o, status: 2 } : o
        ));
        this.setData({ orders: nextOrders });

        // 刷新订单列表
        this.loadOrders(false);
      } else {
        showError(res.message || '发货失败');
      }
    } catch (err) {
      // 400/403 等业务错误也会走到这里（request 会 reject）
      showError(this.getErrMsg(err, '发货失败'));
      console.error('发货失败:', err);
    } finally {
      this._hideLoading();
    }
  },

  // 刷新订单
  refreshOrders: function () {
    this._reloadList();
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders(true);
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    try {
      await this._reloadList();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 获取订单状态文本
  getStatusText: function (status) {
    return getStatusText(status);
  },

  // 获取订单状态样式
  getStatusClass: function (status) {
    return getStatusClass(status);
  }
});