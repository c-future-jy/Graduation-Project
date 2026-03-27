// pages/merchant/orders/orders.js
const { request } = require('../../../utils/api');
const { getStatusText, getStatusClass } = require('../../../utils/orderUtils');
const { showLoading, hideLoading, showError, showSuccess, debounce, handlePullDownRefresh, handleReachBottom } = require('../../../utils/pageUtils');

Page({
  data: {
    orders: [],
    activeTab: 'all',
    searchKeyword: '',
    loading: false,
    hasMore: true,
    pageNum: 1,
    pageSize: 10,
    merchantId: null
  },

  onLoad: function (options) {
    // 从本地存储获取商家ID
    const merchantId = wx.getStorageSync('merchantId') || 1;
    this.setData({
      merchantId: merchantId
    });
    this.loadOrders();
  },

  // 加载订单数据
  async loadOrders(isLoadMore = false) {
    const { activeTab, searchKeyword, pageNum, pageSize, merchantId, loading } = this.data;

    if (loading) return;

    showLoading('加载中...');

    // 构建请求参数
    const params = {
      merchant_id: merchantId,
      pageNum: isLoadMore ? pageNum + 1 : 1,
      pageSize: pageSize
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
        const orders = res.data.orders || [];
        const newPageNum = isLoadMore ? pageNum + 1 : 1;
        const newOrders = isLoadMore ? [...this.data.orders, ...orders] : orders;

        this.setData({
          orders: newOrders,
          pageNum: newPageNum,
          hasMore: orders.length >= pageSize,
          loading: false
        });
      } else {
        hideLoading();
        showError(res.message || '加载失败');
      }
    } catch (err) {
      hideLoading();
      showError('网络错误');
      console.error('加载订单失败:', err);
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
    this.loadOrders();
  },

  // 搜索输入
  onSearchInput: debounce(function (e) {
    this.setData({ searchKeyword: e.detail.value });
    this.loadOrders();
  }, 500),

  // 搜索确认
  onSearchConfirm: function () {
    this.setData({ pageNum: 1, orders: [], hasMore: true });
    this.loadOrders();
  },

  // 清除搜索
  clearSearch: function () {
    this.setData({ searchKeyword: '', pageNum: 1, orders: [], hasMore: true });
    this.loadOrders();
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
    showLoading('发货中...');

    try {
      const res = await request({
        url: `/orders/merchant/orders/${orderId}/ship`,
        method: 'POST'
      });
      hideLoading();
      if (res.success) {
        showSuccess('发货成功');
        // 刷新订单列表
        this.loadOrders();
      } else {
        showError(res.message || '发货失败');
      }
    } catch (err) {
      hideLoading();
      showError('网络错误');
      console.error('发货失败:', err);
    }
  },

  // 刷新订单
  refreshOrders: function () {
    this.setData({ pageNum: 1, orders: [], hasMore: true });
    this.loadOrders();
  },

  // 上拉加载更多
  onReachBottom: function () {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders(true);
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    await handlePullDownRefresh(this, async () => {
      this.setData({ pageNum: 1, orders: [], hasMore: true });
      await this.loadOrders();
    });
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