// 管理后台首页逻辑
Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      nickName: '管理员'
    },
    currentDate: '',
    currentTime: '',
    unreadNotifications: 3,
    stats: {
      todayOrders: 128,
      totalUsers: 1250,
      totalMerchants: 56,
      totalProducts: 890,
      orderTrend: 12,
      userTrend: 5,
      merchantTrend: 3,
      productTrend: 8
    },
    pendingTasks: {
      pendingMerchants: 8,
      pendingOrders: 15,
      pendingFeedbacks: 6
    },
    chartType: 'orders'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.updateDateTime();
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
    } else {
      this.setData({
        userInfo: {
          nickName: userInfo.nickName || '管理员'
        }
      });
    }
  },

  /**
   * 更新日期和时间
   */
  updateDateTime() {
    const now = new Date();
    this.setData({
      currentDate: now.toLocaleDateString(),
      currentTime: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    });
  },

  /**
   * 加载仪表盘数据
   */
  loadDashboardData() {
    // 这里可以调用后端API获取真实数据
    // 目前使用模拟数据
    wx.showLoading({
      title: '加载数据中...'
    });
    
    setTimeout(() => {
      wx.hideLoading();
      // 模拟数据已在data中设置
    }, 1000);
  },

  /**
   * 跳转到指定页面
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
      case 'products':
        url = '/pages/admin/products/products';
        break;
      case 'orders':
        url = '/pages/admin/orders/orders';
        break;
      case 'feedbacks':
        url = '/pages/admin/feedbacks/feedbacks';
        break;
      default:
        return;
    }
    
    wx.navigateTo({
      url: url
    });
  },

  /**
   * 跳转到通知页面
   */
  goToNotifications() {
    wx.navigateTo({
      url: '/pages/admin/notifications/notifications'
    });
  },

  /**
   * 切换图表类型
   */
  toggleChartType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      chartType: type
    });
    // 这里可以根据类型切换图表数据
  },

  /**
   * 刷新数据
   */
  refreshData() {
    this.loadDashboardData();
    wx.showToast({
      title: '数据已刷新',
      icon: 'success'
    });
  }
})