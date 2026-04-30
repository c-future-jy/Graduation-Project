// pages/admin/index.js
const { getAdminDashboardStats } = require('../../utils/api');

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
    badgeMap: {
      merchants: 0,
      feedbacks: 0,
      orders: 0
    },
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
          },
          {
            id: 'logs',
            name: '操作日志',
            icon: '📋',
            url: '/pages/admin/logs/logs'
          }
        ]
      }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    wx.setNavigationBarTitle({ title: '管理后台' });
    this.checkLoginStatus();
    this.updateDateTime();
    this.refreshBadges();
  },

  onShow() {
    this.updateDateTime();
    this.refreshBadges();
  },

  formatBadgeCount(count) {
    const n = Number(count) || 0;
    if (n <= 0) return 0;
    if (n > 99) return '99+';
    return String(n);
  },

  async refreshBadges() {
    try {
      const res = await getAdminDashboardStats();
      const data = (res && res.data) || {};
      this.setData({
        badgeMap: {
          merchants: this.formatBadgeCount(data.pendingMerchants),
          feedbacks: this.formatBadgeCount(data.pendingFeedback),
          orders: this.formatBadgeCount(data.pendingOrders)
        }
      });
    } catch (e) {
      // ignore: badges 不应阻塞主界面
    }
  },

  buildUrlWithTitle(url, title) {
    if (!title) return url;
    const separator = url.includes('?') ? '&' : '?';
    return url + separator + 'title=' + encodeURIComponent(title);
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
    const roleNum = userInfo ? parseInt(String(userInfo.role), 10) : 0;
    
    if (!token || !userInfo || roleNum !== 3) {
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
    const title = e.currentTarget.dataset.title;
    
    this.setData({ activeTab: id });
    wx.navigateTo({
      url: this.buildUrlWithTitle(url, title)
    });
  },

  /**
   * 跳转到指定页面
   */
  goToPage(e) {
    const url = e.currentTarget.dataset.url;
    const title = e.currentTarget.dataset.title;
    wx.navigateTo({
      url: this.buildUrlWithTitle(url, title)
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