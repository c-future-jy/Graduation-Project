// pages/order/order.js
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
  loadOrders() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    // 构建请求参数
    const params = {
      status: this.data.activeTab,
      page: this.data.page,
      pageSize: this.data.pageSize
    };
    
    const token = wx.getStorageSync('token');
    wx.request({
      url: 'http://localhost:3000/api/orders',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      data: params,
      success: (res) => {
        this.setData({ loading: false });
        if (res.statusCode === 200 && res.data.success) {
          const orders = res.data.data.orders || [];
          // 按时间倒序排列
          const sortedOrders = orders.sort((a, b) => {
            return new Date(b.createTime) - new Date(a.createTime);
          });
          this.setData({
            orders: this.data.page === 1 ? sortedOrders : [...this.data.orders, ...sortedOrders],
            hasMore: sortedOrders.length === this.data.pageSize
          });
        }
      },
      fail: (err) => {
        this.setData({ loading: false });
      }
    });
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
    
    // 根据不同的操作执行不同的逻辑
    switch (action) {
      case 'cancel':
        // 取消订单
        this.cancelOrder(orderId);
        break;
      case 'pay':
        // 去支付
        this.goToPay(orderId);
        break;
      case 'logistics':
        // 查看物流
        this.viewLogistics(orderId);
        break;
      case 'confirm':
        // 确认收货
        this.confirmReceipt(orderId);
        break;
      case 'buyAgain':
        // 再次购买
        this.buyAgain(orderId);
        break;
      case 'review':
        // 评价
        this.goToReview(orderId);
        break;
      case 'delete':
        // 删除订单
        this.deleteOrder(orderId);
        break;
    }
  },

  /**
   * 取消订单
   */
  cancelOrder(orderId) {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          wx.request({
            url: `http://localhost:3000/api/orders/${orderId}/cancel`,
            method: 'PUT',
            header: { 'Authorization': 'Bearer ' + token },
            success: (res) => {
              if (res.statusCode === 200 && res.data.success) {
                wx.showToast({ title: '订单已取消' });
                // 刷新订单列表
                this.loadOrders();
              } else {
                wx.showToast({ title: res.data.message || '取消订单失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.showToast({ title: '网络错误，请重试', icon: 'none' });
              console.error('取消订单失败:', err);
            }
          });
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
  confirmReceipt(orderId) {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          wx.request({
            url: `http://localhost:3000/api/orders/${orderId}/complete`,
            method: 'PUT',
            header: { 'Authorization': 'Bearer ' + token },
            success: (res) => {
              if (res.statusCode === 200 && res.data.success) {
                wx.showToast({ title: '已确认收货' });
                // 刷新订单列表
                this.loadOrders();
              } else {
                wx.showToast({ title: res.data.message || '确认收货失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.showToast({ title: '网络错误，请重试', icon: 'none' });
              console.error('确认收货失败:', err);
            }
          });
        }
      }
    });
  },

  /**
   * 再次购买
   */
  buyAgain(orderId) {
    const token = wx.getStorageSync('token');
    wx.request({
      url: `http://localhost:3000/api/orders/${orderId}/buy-again`,
      method: 'POST',
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          wx.showToast({ title: '商品已加入购物车' });
          wx.switchTab({ url: '/pages/cart/cart' });
        } else {
          wx.showToast({ title: res.data.message || '操作失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        console.error('再次购买失败:', err);
      }
    });
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
  deleteOrder(orderId) {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: (res) => {
        if (res.confirm) {
          const token = wx.getStorageSync('token');
          wx.request({
            url: `http://localhost:3000/api/orders/${orderId}`,
            method: 'DELETE',
            header: { 'Authorization': 'Bearer ' + token },
            success: (res) => {
              if (res.statusCode === 200 && res.data.success) {
                wx.showToast({ title: '订单已删除' });
                // 刷新订单列表
                this.loadOrders();
              } else {
                wx.showToast({ title: res.data.message || '删除订单失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.showToast({ title: '网络错误，请重试', icon: 'none' });
              console.error('删除订单失败:', err);
            }
          });
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
    wx.switchTab({ url: '/pages/home/home' });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders();
  }
})