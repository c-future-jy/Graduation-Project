// pages/profile/profile.js
const app = getApp();
const { getUserProfile, getNotifications } = require('../../utils/api');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    userInfo: {
      avatarUrl: '/assets/images/morentouxiang.jpg',
      nickName: '未登录',
      phone: '',
      role: 0
    },
    pendingPayCount: 0,           // 待支付订单数量
    pendingDeliverCount: 0,       // 待发货订单数量
    unreadNoticeCount: 0          // 未读消息数量
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.checkLoginStatus();
    if (this.data.isLogin) {
      this.loadOrderCounts();
      this.checkUnreadNotice();
    }
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.setData({
        isLogin: true,
        userInfo: userInfo
      });
      // 调用API获取最新用户信息
      this.getUserInfo();
    } else {
      this.setData({
        isLogin: false,
        userInfo: {
          avatarUrl: '/assets/images/morentouxiang.jpg',
          nickName: '未登录',
          phone: '',
          role: 0
        }
      });
    }
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    getUserProfile()
      .then(res => {
        console.log('API返回的用户信息:', res.data.user);
        const userInfo = res.data.user;
        this.setData({
          userInfo: {
            avatarUrl: userInfo.avatar_url || userInfo.avatarUrl || '/assets/images/morentouxiang.jpg',
            nickName: userInfo.nickname || userInfo.nickName || '未设置昵称',
            phone: userInfo.phone || '',
            role: userInfo.role || 1
          }
        });
        // 更新本地存储
        wx.setStorageSync('userInfo', this.data.userInfo);
        console.log('更新后的用户信息:', this.data.userInfo);
      })
      .catch(err => {
        console.error('获取用户信息失败:', err);
      });
  },

  /**
   * 加载订单数量
   */
  loadOrderCounts() {
    // 模拟数据
    this.setData({
      pendingPayCount: 2,
      pendingDeliverCount: 1
    });
    
    // 实际开发时调用API
    /*
    const token = wx.getStorageSync('token');
    wx.request({
      url: 'http://localhost:3000/api/orders/counts',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        if (res.statusCode === 200 && res.data.success) {
          this.setData({
            pendingPayCount: res.data.data.pendingPay || 0,
            pendingDeliverCount: res.data.data.pendingDeliver || 0
          });
        }
      }
    });
    */
  },

  /**
   * 检查未读通知
   */
  checkUnreadNotice() {
    // 调用API获取未读消息数量
    getNotifications()
      .then(res => {
        const notifications = res.data.notifications || [];
        const unreadCount = notifications.filter(notice => !notice.is_read).length;
        this.setData({
          unreadNoticeCount: unreadCount
        });
      })
      .catch(err => {
        console.error('获取通知失败:', err);
        // 模拟数据
        this.setData({
          unreadNoticeCount: 3
        });
      });
  },

  /**
   * 跳转登录
   */
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login',
    });
  },

  /**
   * 跳转编辑个人信息
   */
  goToEditProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit-profile',
    });
  },

  /**
   * 跳转订单列表
   */
  goToOrderList() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/order/order?status=all',
    });
  },

  /**
   * 跳转订单状态页
   */
  goToOrderStatus(e) {
    if (!this.checkAuth()) return;
    const status = e.currentTarget.dataset.status;
    wx.navigateTo({
      url: '/pages/order/order?status=' + status,
    });
  },

  /**
   * 跳转地址管理
   */
  goToAddress() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/address/address',
    });
  },

  /**
   * 跳转意见反馈
   */
  goToFeedback() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/feedback/feedback',
    });
  },

  /**
   * 跳转消息通知
   */
  goToNotice() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/notice/notice',
      success: () => {
        // 跳转成功后，重置未读消息数量
        this.setData({
          unreadNoticeCount: 0
        });
      }
    });
  },

  /**
   * 跳转关于我们
   */
  goToAbout() {
    wx.showModal({
      title: '关于校园一站式服务平台',
      content: '版本号：v1.0.0\n\n本平台致力于为校园师生提供便捷的一站式生活服务，整合校园周边商家资源，让校园生活更美好。',
      showCancel: false,
      confirmText: '我知道了'
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
          // 清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          // 重置页面状态
          this.setData({
            isLogin: false,
            userInfo: {
              avatarUrl: '/assets/images/morentouxiang.jpg',
              nickName: '未登录',
              phone: '',
              role: 0
            },
            pendingPayCount: 0,
            pendingDeliverCount: 0,
            unreadNoticeCount: 0
          });
          // 显示退出成功提示
          wx.showToast({
            title: '退出登录成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 检查登录权限
   */
  checkAuth() {
    if (!this.data.isLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/login/login',
        });
      }, 1500);
      return false;
    }
    return true;
  }
});