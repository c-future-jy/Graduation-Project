// pages/admin/index.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'dashboard',
    userInfo: {
      avatarUrl: '/assets/images/morentouxiang.jpg',
      nickName: '管理员'
    },
    today: '',
    menuList: [
      {
        id: 'dashboard',
        name: '数据统计',
        icon: '📊',
        url: '/pages/admin/dashboard/dashboard'
      },
      {
        id: 'users',
        name: '用户管理',
        icon: '👥',
        url: '/pages/admin/users/users'
      },
      {
        id: 'merchants',
        name: '商家管理',
        icon: '🏪',
        url: '/pages/admin/merchants/merchants'
      },
      {
        id: 'products',
        name: '商品管理',
        icon: '📦',
        url: '/pages/admin/products/products'
      },
      {
        id: 'orders',
        name: '订单管理',
        icon: '📋',
        url: '/pages/admin/orders/orders'
      },
      {
        id: 'feedbacks',
        name: '反馈管理',
        icon: '💬',
        url: '/pages/admin/feedbacks/feedbacks'
      },
      {
        id: 'notifications',
        name: '通知管理',
        icon: '📢',
        url: '/pages/admin/notifications/notifications'
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.setData({
      today: new Date().toLocaleDateString()
    });
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
          avatarUrl: userInfo.avatarUrl || '/assets/images/morentouxiang.jpg',
          nickName: userInfo.nickName || '管理员'
        }
      });
    }
  },

  /**
   * 切换菜单
   */
  switchMenu(e) {
    const id = e.currentTarget.dataset.id;
    const url = e.currentTarget.dataset.url;
    
    this.setData({ activeTab: id });
    wx.navigateTo({
      url: url
    });
  },

  /**
   * 退出登录
   */
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
})