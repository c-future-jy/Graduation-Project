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
    menuSections: [
      {
        title: '数据分析',
        items: [
          {
            id: 'dashboard',
            name: '数据统计',
            icon: '📊',
            url: '/pages/admin/dashboard/dashboard'
          }
        ]
      },
      {
        title: '用户与商家',
        items: [
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
          }
        ]
      },
      {
        title: '业务管理',
        items: [
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
          }
        ]
      },
      {
        title: '运营管理',
        items: [
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
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.updateDateTime();
  },

  /**
   * 更新日期和时间
   */
  updateDateTime() {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[now.getDay()];
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    this.setData({
      today: `${year}年${month}月${day}日`,
      currentTime: `${hours}:${minutes}`,
      weekday: weekday
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
   * 跳转到指定页面
   */
  goToPage(e) {
    const url = e.currentTarget.dataset.url;
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