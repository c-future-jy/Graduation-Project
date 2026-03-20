// pages/admin/dashboard/dashboard.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    stats: {
      totalUsers: 0,
      totalMerchants: 0,
      todayOrders: 0,
      pendingFeedback: 0
    },
    timeRange: 'today',
    orderTrend: [],
    merchantCategory: [],
    salesData: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadDashboardData();
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
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadDashboardData();
  },

  /**
   * 加载仪表盘数据
   */
  async loadDashboardData() {
    this.setData({ loading: true });
    
    try {
      // 模拟数据，实际项目中应调用API
      const stats = {
        totalUsers: 1234,
        totalMerchants: 56,
        todayOrders: 78,
        pendingFeedback: 12
      };
      
      const orderTrend = [
        { date: '03-14', orders: 65 },
        { date: '03-15', orders: 72 },
        { date: '03-16', orders: 68 },
        { date: '03-17', orders: 81 },
        { date: '03-18', orders: 76 },
        { date: '03-19', orders: 85 },
        { date: '03-20', orders: 78 }
      ];
      
      const merchantCategory = [
        { name: '餐饮', value: 25 },
        { name: '超市', value: 15 },
        { name: '文具', value: 8 },
        { name: '其他', value: 8 }
      ];
      
      const salesData = [
        { date: '03-14', sales: 12000 },
        { date: '03-15', sales: 13500 },
        { date: '03-16', sales: 12800 },
        { date: '03-17', sales: 14200 },
        { date: '03-18', sales: 13800 },
        { date: '03-19', sales: 15000 },
        { date: '03-20', sales: 14500 }
      ];
      
      this.setData({
        stats,
        orderTrend,
        merchantCategory,
        salesData,
        loading: false
      });
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 切换时间范围
   */
  switchTimeRange(e) {
    const timeRange = e.currentTarget.dataset.range;
    this.setData({ timeRange });
    // 实际项目中应根据时间范围重新加载数据
    this.loadDashboardData();
  },

  /**
   * 手动刷新数据
   */
  refreshData() {
    this.loadDashboardData();
  },

  /**
   * 跳转到对应管理页面
   */
  goToPage(e) {
    const page = e.currentTarget.dataset.page;
    let url = '';
    
    switch (page) {
      case 'users':
        url = '/pages/admin/users/users';
        break;
      case 'merchants':
        url = '/pages/admin/merchants/merchants';
        break;
      case 'orders':
        url = '/pages/admin/orders/orders';
        break;
      case 'feedbacks':
        url = '/pages/admin/feedbacks/feedbacks';
        break;
    }
    
    if (url) {
      wx.navigateTo({ url });
    }
  }
})