// pages/admin/orders/orders.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    orders: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: '',
    statusFilter: '',
    timeRange: '',
    selectedOrders: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadOrders();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!token || !userInfo || userInfo.role !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  /**
   * 加载订单列表
   */
  async loadOrders() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      // 模拟数据，实际项目中应调用API
      const orders = [
        { id: '1001', user: '张三', merchant: '校园餐厅', amount: 30.00, status: '0', statusText: '待支付', createdAt: '2026-03-20 10:00:00' },
        { id: '1002', user: '李四', merchant: '校园超市', amount: 50.00, status: '1', statusText: '待发货', createdAt: '2026-03-20 09:30:00' },
        { id: '1003', user: '王五', merchant: '奶茶店', amount: 20.00, status: '2', statusText: '已发货', createdAt: '2026-03-19 18:00:00' },
        { id: '1004', user: '赵六', merchant: '文具店', amount: 15.00, status: '3', statusText: '已完成', createdAt: '2026-03-19 16:00:00' },
        { id: '1005', user: '钱七', merchant: '水果店', amount: 40.00, status: '4', statusText: '已取消', createdAt: '2026-03-19 14:00:00' },
        { id: '1006', user: '孙八', merchant: '打印店', amount: 5.00, status: '0', statusText: '待支付', createdAt: '2026-03-19 12:00:00' },
        { id: '1007', user: '周九', merchant: '咖啡店', amount: 30.00, status: '1', statusText: '待发货', createdAt: '2026-03-18 20:00:00' },
        { id: '1008', user: '吴十', merchant: '书店', amount: 100.00, status: '2', statusText: '已发货', createdAt: '2026-03-18 15:00:00' },
        { id: '1009', user: '郑一', merchant: '蛋糕店', amount: 150.00, status: '3', statusText: '已完成', createdAt: '2026-03-18 10:00:00' },
        { id: '1010', user: '王二', merchant: '饰品店', amount: 40.00, status: '4', statusText: '已取消', createdAt: '2026-03-17 19:00:00' }
      ];
      
      const total = 50;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      this.setData({
        orders: this.data.page === 1 ? orders : [...this.data.orders, ...orders],
        total,
        hasMore,
        loading: false
      });
    } catch (error) {
      console.error('加载订单列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 搜索订单
   */
  searchOrders() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
  },

  /**
   * 筛选订单
   */
  filterOrders() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
  },

  /**
   * 选择订单
   */
  selectOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    let selectedOrders = this.data.selectedOrders;
    
    if (selectedOrders.includes(orderId)) {
      selectedOrders = selectedOrders.filter(id => id !== orderId);
    } else {
      selectedOrders.push(orderId);
    }
    
    this.setData({ selectedOrders });
  },

  /**
   * 全选订单
   */
  selectAllOrders(e) {
    const allSelected = e.detail.value[0];
    let selectedOrders = [];
    
    if (allSelected) {
      selectedOrders = this.data.orders.map(order => order.id);
    }
    
    this.setData({ selectedOrders });
  },

  /**
   * 批量取消订单
   */
  batchCancelOrders() {
    if (this.data.selectedOrders.length === 0) {
      wx.showToast({ title: '请选择要取消的订单', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量取消',
      content: `确定要取消选中的 ${this.data.selectedOrders.length} 个订单吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '取消成功' });
          this.setData({ selectedOrders: [] });
          this.loadOrders();
        }
      }
    });
  },

  /**
   * 查看订单详情
   */
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/orders/detail?id=${orderId}`
    });
  },

  /**
   * 处理订单纠纷
   */
  handleDispute(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/orders/dispute?id=${orderId}`
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrders();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders(() => {
      wx.stopPullDownRefresh();
    });
  }
})