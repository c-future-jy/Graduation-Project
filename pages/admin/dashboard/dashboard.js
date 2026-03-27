// 管理后台首页逻辑
const { getAdminDashboardStats, getAdminOrderTrend, getAdminMerchantCategories } = require('../../../utils/api');

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
    unreadNotifications: 0,
    stats: {
      todayOrders: 0,
      totalUsers: 0,
      totalMerchants: 0,
      totalProducts: 0,
      orderTrend: 0,
      userTrend: 0,
      merchantTrend: 0,
      productTrend: 0
    },
    pendingTasks: {
      pendingMerchants: 0,
      pendingOrders: 0,
      pendingFeedbacks: 0
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
  async loadDashboardData() {
    wx.showLoading({
      title: '加载数据中...'
    });
    
    try {
      // 调用真实API获取数据
      const statsRes = await getAdminDashboardStats();
      
      if (statsRes && statsRes.data) {
        this.setData({
          stats: {
            todayOrders: statsRes.data.todayOrders || 0,
            totalUsers: statsRes.data.totalUsers || 0,
            totalMerchants: statsRes.data.totalMerchants || 0,
            totalProducts: statsRes.data.totalProducts || 0,
            orderTrend: statsRes.data.orderTrend || 0,
            userTrend: statsRes.data.userTrend || 0,
            merchantTrend: statsRes.data.merchantTrend || 0,
            productTrend: statsRes.data.productTrend || 0
          },
          pendingTasks: {
            pendingMerchants: statsRes.data.pendingMerchants || 0,
            pendingOrders: statsRes.data.pendingOrders || 0,
            pendingFeedbacks: statsRes.data.pendingFeedbacks || 0
          },
          unreadNotifications: statsRes.data.unreadNotifications || 0
        });
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
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