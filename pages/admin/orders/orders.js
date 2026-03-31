// pages/admin/orders/orders.js
const { getAdminOrderList, forceCancelAdminOrder } = require('../../../utils/api');

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
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '订单管理' });
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
      // 调用真实API获取数据
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.statusFilter,
        keyword: this.data.searchKeyword
      };
      
      const res = await getAdminOrderList(params);
      
      // 检查响应数据结构
      if (!res || !res.data || !Array.isArray(res.data.orders)) {
        console.error('API返回数据结构异常:', res);
        this.setData({ 
          orders: [],
          total: 0,
          hasMore: false,
          loading: false 
        });
        wx.showToast({ title: '数据加载失败', icon: 'none' });
        return;
      }
      
      const orders = res.data.orders.map(order => ({
        id: order.id,
        user: order.user_name,
        merchant: order.merchant_name,
        amount: order.total_amount,
        status: order.status.toString(),
        statusText: order.status === 0 ? '待支付' : order.status === 1 ? '待发货' : order.status === 2 ? '已发货' : order.status === 3 ? '已完成' : '已取消',
        createdAt: order.created_at
      }));
      
      const total = res.data.pagination?.total || 0;
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
   * 搜索关键词变化
   */
  searchKeyword(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索订单
   */
  searchOrders() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
  },

  /**
   * 状态筛选变化
   */
  statusFilter(e) {
    this.setData({ statusFilter: e.detail.value });
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
  },

  /**
   * 时间范围筛选变化
   */
  timeRange(e) {
    this.setData({ timeRange: e.detail.value });
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
  },

  /**
   * 选择订单
   */
  selectOrder(e) {
    const orderId = e.detail.value[0];
    let selectedOrders = this.data.selectedOrders;
    
    if (orderId) {
      if (!selectedOrders.includes(orderId)) {
        selectedOrders.push(orderId);
      }
    } else {
      // 取消选择，需要找到当前取消的订单ID
      const currentId = e.currentTarget.dataset.id;
      selectedOrders = selectedOrders.filter(id => id !== currentId);
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = this.data.selectedOrders;
          for (const id of ids) {
            await forceCancelAdminOrder(id, '');
          }
          wx.showToast({ title: '取消成功' });
          this.setData({ selectedOrders: [], page: 1, orders: [], hasMore: true });
          this.loadOrders();
        } catch (error) {
          console.error('批量取消失败:', error);
          wx.showToast({ title: error.message || '取消失败', icon: 'none' });
        } finally {
          wx.hideLoading();
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