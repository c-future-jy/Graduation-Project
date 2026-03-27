// pages/order/order.js
const { getOrders, cancelOrder, completeOrder } = require('../../utils/api');
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
    this.loadOrders();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
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
      const res = await wx.request({
        url: `http://localhost:3000/api/orders/${orderId}/buy-again`,
        method: 'POST',
        header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') }
      });
      if (res.statusCode === 200 && res.data.success) {
        hideLoading();
        showSuccess('商品已加入购物车');
        wx.switchTab({ url: '/pages/cart/cart' });
      } else {
        hideLoading();
        showError(res.data.message || '操作失败');
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
            const res = await wx.request({
              url: `http://localhost:3000/api/orders/${orderId}`,
              method: 'DELETE',
              header: { 'Authorization': 'Bearer ' + wx.getStorageSync('token') }
            });
            if (res.statusCode === 200 && res.data.success) {
              hideLoading();
              showSuccess('订单已删除');
              // 刷新订单列表
              this.loadOrders();
            } else {
              hideLoading();
              showError(res.data.message || '删除订单失败');
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
    wx.navigateTo({ url: `/pages/merchant/merchant?id=${merchantId}` });
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