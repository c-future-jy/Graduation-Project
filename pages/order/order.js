// pages/order/order.js
const { getOrders, cancelOrder, completeOrder, buyAgain: apiBuyAgain } = require('../../utils/api');
const { handleOrderAction, getStatusText, getOrderActions } = require('../../utils/orderUtils');
const { showError, showSuccess } = require('../../utils/pageUtils');
const { toNetworkUrl } = require('../../utils/url');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toNum(value, fallback = 0) {
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

  /**
   * 页面的初始数据
   */
  data: {
    tabs: [
      { name: '全部', status: '' },
      { name: '待支付', status: '0' },
      { name: '待发货', status: '1' },
      { name: '已完成', status: '3' },
      { name: '已取消', status: '4' }
    ],
    activeTab: '',
    orders: [],
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this._loadingCount = 0;
    this._loadingShown = false;
    this._ordersLoadingPromise = null;

    // 避免首次进入时 onShow 再触发一次重复加载
    this._skipOnShowOnce = true;

    const status = options && options.status != null ? String(options.status) : 'all';
    const normalizedStatus = status === 'all' ? '' : status;

    this.setData({
      activeTab: normalizedStatus,
      page: 1,
      orders: []
    });

    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    const derivedTitle = this.getOrderNavTitle(status);
    wx.setNavigationBarTitle({ title: initialTitle || derivedTitle });

    this.loadOrders({ reset: true, showLoading: true });
  },

  _showLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;
    wx.showLoading({
      title: title || '加载中...',
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

  _normalizeOrders(rawOrders) {
    const list = Array.isArray(rawOrders) ? rawOrders : [];
    return list.map((o) => {
      const orderId = o.orderId != null ? o.orderId : o.id;
      const merchantId = o.merchantId != null ? o.merchantId : o.merchant_id;
      const status = o.status != null ? String(o.status) : '';

      const goodsList = Array.isArray(o.goodsList) ? o.goodsList : [];
      const normalizedGoodsList = goodsList.map((g) => ({
        goodsId: g.goodsId != null ? g.goodsId : g.product_id,
        name: g.name != null ? g.name : g.product_name,
        image: toNetworkUrl(g.image != null ? g.image : g.product_image) || '/assets/images/kong.jpg',
        spec: g.spec || '',
        price: toNum(g.price, 0),
        quantity: toInt(g.quantity, 0)
      }));

      const totalQuantity = o.totalQuantity != null
        ? toInt(o.totalQuantity, 0)
        : normalizedGoodsList.reduce((sum, g) => sum + toInt(g.quantity, 0), 0);

      const totalPrice = o.totalPrice != null
        ? o.totalPrice
        : (o.total_amount != null ? o.total_amount : o.totalAmount);

      return {
        ...o,
        orderId,
        merchantId,
        merchantName: o.merchantName || o.merchant_name || '',
        merchantLogo: toNetworkUrl(o.merchantLogo || o.merchant_logo) || '/assets/images/morentouxiang.jpg',
        createTime: o.createTime || o.created_at || o.createdAt || '',
        totalPrice: toNum(totalPrice, 0),
        originalPrice: toNum(o.originalPrice, 0) || o.originalPrice,
        status,
        statusText: o.statusText || getStatusText(status),
        actions: Array.isArray(o.actions) ? o.actions : getOrderActions(status),
        goodsList: normalizedGoodsList,
        totalQuantity
      };
    });
  },

  _mergeOrdersPage(newOrders, isLoadMore) {
    const current = this.data.orders || [];
    const merged = isLoadMore ? [...current, ...newOrders] : newOrders;
    const hasMore = newOrders.length === this.data.pageSize;
    this.setData({
      orders: merged,
      hasMore
    });
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  getOrderNavTitle(status) {
    const s = String(status);
    const map = {
      all: '全部订单',
      '': '全部订单',
      '0': '待支付',
      '1': '待发货',
      '2': '待收货',
      '3': '已完成',
      '4': '已取消'
    };
    return map[s] || '我的订单';
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this._skipOnShowOnce) {
      this._skipOnShowOnce = false;
      return;
    }

    // 从详情页返回后刷新列表（不弹出全屏 loading，避免闪烁）
    this.loadOrders({ reset: true, showLoading: false });
  },

  /**
   * 加载订单列表
   */
  async loadOrders(options = {}) {
    const { reset = false, showLoading: shouldShowLoading = true } = options;
    if (this.data.loading) return;
    if (this._ordersLoadingPromise) return this._ordersLoadingPromise;

    if (reset) {
      this.setData({
        page: 1,
        hasMore: true,
        orders: []
      });
    }

    this.setData({ loading: true });
    if (shouldShowLoading) this._showLoading('加载中...');

    const params = {
      status: this.data.activeTab,
      page: this.data.page,
      limit: this.data.pageSize
    };

    this._ordersLoadingPromise = (async () => {
      try {
        const res = await getOrders(params);
        if (!res || !res.success) {
          showError((res && res.message) || '加载失败');
          return;
        }
        const rawOrders = (res.data && res.data.orders) ? res.data.orders : [];
        const normalizedOrders = this._normalizeOrders(rawOrders);
        const isLoadMore = this.data.page > 1;
        this._mergeOrdersPage(normalizedOrders, isLoadMore);
      } catch (error) {
        showError(getErrMsg(error, '加载失败'));
        console.error('加载订单失败:', error);
      } finally {
        if (shouldShowLoading) this._hideLoading();
        this.setData({ loading: false });
        this._ordersLoadingPromise = null;
      }
    })();

    return this._ordersLoadingPromise;
  },

  /**
   * 切换Tab
   */
  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      activeTab: status,
      page: 1,
      orders: [],
      hasMore: true
    });

    wx.setNavigationBarTitle({ title: this.getOrderNavTitle(status === '' ? 'all' : status) });
    this.loadOrders({ reset: true, showLoading: true });
  },

  /**
   * 处理订单操作
   */
  handleAction(e) {
    const { orderId, action } = e.currentTarget.dataset;
    
    handleOrderAction({
      action,
      orderId,
      onCancel: (id) => this.cancelOrder(id),
      onPay: (id) => this.goToPay(id),
      onConfirm: (id) => this.confirmReceipt(id),
      onBuyAgain: (id) => this.buyAgain(id),
      onReview: (id) => this.goToReview(id)
    });
  },

  _confirmAndRun({ title, content, run, successMsg, after }) {
    wx.showModal({
      title,
      content,
      success: async (res) => {
        if (!res.confirm) return;
        this._showLoading('处理中...');
        try {
          const result = await run();
          // 兼容返回 {success:false,message} 的接口
          if (result && result.success === false) {
            throw new Error(result.message || '操作失败');
          }
          showSuccess(successMsg);
          if (after) after(result);
        } catch (error) {
          showError(getErrMsg(error, '操作失败'));
          console.error(`${title}失败:`, error);
        } finally {
          this._hideLoading();
        }
      }
    });
  },

  async _runWithLoading(title, fn) {
    this._showLoading(title || '处理中...');
    try {
      return await fn();
    } finally {
      this._hideLoading();
    }
  },

  /**
   * 取消订单
   */
  cancelOrder(orderId) {
    this._confirmAndRun({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      run: () => cancelOrder(orderId),
      successMsg: '订单已取消',
      after: () => this.loadOrders({ reset: true, showLoading: false })
    });
  },

  /**
   * 去支付
   */
  goToPay(orderId) {
    wx.navigateTo({ url: `/pages/pay/pay?orderId=${orderId}` });
  },

  /**
   * 确认收货
   */
  confirmReceipt(orderId) {
    this._confirmAndRun({
      title: '确认收货',
      content: '确定已收到商品吗？',
      run: () => completeOrder(orderId),
      successMsg: '已确认收货',
      after: () => this.loadOrders({ reset: true, showLoading: false })
    });
  },

  /**
   * 再次购买
   */
  async buyAgain(orderId) {
    try {
      const res = await this._runWithLoading('处理中...', () => apiBuyAgain(orderId));
      if (res && res.success) {
        showSuccess('商品已加入购物车');
        wx.switchTab({ url: '/pages/cart/cart' });
      } else {
        showError((res && res.message) || '操作失败');
      }
    } catch (error) {
      showError(getErrMsg(error, '网络错误，请重试'));
      console.error('再次购买失败:', error);
    }
  },

  /**
   * 去评价
   */
  goToReview(orderId) {
    wx.navigateTo({
      url: `/pages/feedback/feedback?order_id=${orderId}`
    });
  },

  /**
   * 跳转到订单详情页
   */
  goToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.orderId;
    const normalizedId = String(orderId == null ? '' : orderId).trim();
    if (!normalizedId || normalizedId === 'undefined' || normalizedId === 'null') {
      showError('订单ID缺失');
      return;
    }
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${encodeURIComponent(normalizedId)}` });
  },

  /**
   * 跳转到商家主页
   */
  goToMerchant(e) {
    const merchantId = e.currentTarget.dataset.merchantId;
    const merchantName = e.currentTarget.dataset.name;
    const titleParam = merchantName ? `&title=${encodeURIComponent(merchantName)}` : '';
    wx.navigateTo({ url: `/pages/merchant/merchant?id=${merchantId}${titleParam}` });
  },

  /**
   * 去逛逛
   */
  goShopping() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  async onPullDownRefresh() {
    try {
      await this.loadOrders({ reset: true, showLoading: false });
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders({ reset: false, showLoading: false });
  },

  // 空函数：用于 catchtap 阻止事件冒泡
  noop() {}
})