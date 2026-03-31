// pages/order/order.js
const { getOrders, cancelOrder, completeOrder, buyAgain: apiBuyAgain, deleteOrder: apiDeleteOrder } = require('../../utils/api');
const { handleOrderAction, getStatusText, getStatusClass } = require('../../utils/orderUtils');
const { showLoading, hideLoading, showError, showSuccess, handlePullDownRefresh, handleReachBottom, handlePagination } = require('../../utils/pageUtils');

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

    this.loadOrders();
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
    if (this.data.activeTab === '') {
      this.loadOrders();
    }
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    if (this.data.loading) return;
    
    showLoading('加载中...');
    
    // 构建请求参数
    const params = {
      status: this.data.activeTab,
      page: this.data.page,
      pageSize: this.data.pageSize
    };
    
    try {
      const res = await getOrders(params);
      const orders = res.data.orders || [];
      // 按时间倒序排列
      const sortedOrders = orders.sort((a, b) => {
        return new Date(b.createTime) - new Date(a.createTime);
      });
      handlePagination(this, sortedOrders, false, 'orders', this.data.pageSize);
    } catch (error) {
      hideLoading();
      showError('加载失败');
      console.error('加载订单失败:', error);
    }
  },

  /**
   * 切换Tab
   */
  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      activeTab: status,
      page: 1,
      orders: []
    });

    wx.setNavigationBarTitle({ title: this.getOrderNavTitle(status === '' ? 'all' : status) });
    this.loadOrders();
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
      onLogistics: (id) => this.viewLogistics(id),
      onConfirm: (id) => this.confirmReceipt(id),
      onBuyAgain: (id) => this.buyAgain(id),
      onReview: (id) => this.goToReview(id),
      onDelete: (id) => this.deleteOrder(id)
    });
  },

  /**
   * 取消订单
   */
  async cancelOrder(orderId) {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('处理中...');
          try {
            await cancelOrder(orderId);
            hideLoading();
            showSuccess('订单已取消');
            // 刷新订单列表
            this.loadOrders();
          } catch (error) {
            hideLoading();
            showError('取消订单失败');
            console.error('取消订单失败:', error);
          }
        }
      }
    });
  },

  /**
   * 去支付
   */
  goToPay(orderId) {
    wx.navigateTo({ url: `/pages/pay/pay?orderId=${orderId}` });
  },

  /**
   * 查看物流
   */
  viewLogistics(orderId) {
    wx.navigateTo({ url: `/pages/logistics/logistics?orderId=${orderId}` });
  },

  /**
   * 确认收货
   */
  async confirmReceipt(orderId) {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('处理中...');
          try {
            await completeOrder(orderId);
            hideLoading();
            showSuccess('已确认收货');
            // 刷新订单列表
            this.loadOrders();
          } catch (error) {
            hideLoading();
            showError('确认收货失败');
            console.error('确认收货失败:', error);
          }
        }
      }
    });
  },

  /**
   * 再次购买
   */
  async buyAgain(orderId) {
    showLoading('处理中...');
    try {
      const res = await apiBuyAgain(orderId);
      if (res && res.success) {
        hideLoading();
        showSuccess('商品已加入购物车');
        wx.switchTab({ url: '/pages/cart/cart' });
      } else {
        hideLoading();
        showError((res && res.message) || '操作失败');
      }
    } catch (error) {
      hideLoading();
      showError('网络错误，请重试');
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
   * 删除订单
   */
  async deleteOrder(orderId) {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('处理中...');
          try {
            const apiRes = await apiDeleteOrder(orderId);
            if (apiRes && apiRes.success) {
              hideLoading();
              showSuccess('订单已删除');
              // 刷新订单列表
              this.loadOrders();
            } else {
              hideLoading();
              showError((apiRes && apiRes.message) || '删除订单失败');
            }
          } catch (error) {
            hideLoading();
            showError('网络错误，请重试');
            console.error('删除订单失败:', error);
          }
        }
      }
    });
  },

  /**
   * 跳转到订单详情页
   */
  goToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.orderId;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${orderId}` });
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
    await handlePullDownRefresh(this, () => {
      this.setData({ orders: [] });
      return this.loadOrders();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    handleReachBottom(this, () => this.loadOrders());
  }
})