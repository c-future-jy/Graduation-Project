// pages/profile/profile.js
const app = getApp();
const {
  getUserProfile,
  getNotifications,
  getOrderCounts,
  getMerchantDashboardStats,
  applyMerchant: applyMerchantRequest
} = require('../../utils/api');

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
    unreadNoticeCount: 0,         // 未读消息数量
    merchantPendingOrders: 0,     // 商家待处理订单数（用于商家后台角标）
    submitting: false             // 防止重复提交
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
      if (this.data.userInfo && this.data.userInfo.role === 2) {
        this.loadMerchantBadges();
      }
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
        const userInfo = res.data.user;
        this.setData({
          userInfo: {
            avatarUrl: userInfo.avatar_url || userInfo.avatarUrl || '/assets/images/morentouxiang.jpg',
            nickName: userInfo.nickname || userInfo.nickName || '未设置昵称',
            phone: userInfo.phone || '',
            role: userInfo.role || 1,
            merchantId: userInfo.merchant_id || userInfo.merchantId || null
          }
        });
        // 更新本地存储
        wx.setStorageSync('userInfo', this.data.userInfo);

        // 如果刚变更为商家（例如管理员刚审核通过），刷新一次商家角标
        if (this.data.userInfo && this.data.userInfo.role === 2) {
          this.loadMerchantBadges();
        } else {
          this.setData({ merchantPendingOrders: 0 });
        }
      })
      .catch(err => {
      });
  },

  /**
   * 商家角标：待处理订单数
   */
  loadMerchantBadges() {
    getMerchantDashboardStats()
      .then((res) => {
        if (res && res.success && res.data) {
          this.setData({
            merchantPendingOrders: res.data.pendingOrders || 0
          });
        } else {
          this.setData({ merchantPendingOrders: 0 });
        }
      })
      .catch(() => {
        this.setData({ merchantPendingOrders: 0 });
      });
  },

  /**
   * 加载订单数量
   */
  loadOrderCounts() {
    getOrderCounts().then(res => {
      if (res.success) {
        this.setData({
          pendingPayCount: res.data.pendingPay || 0,
          pendingDeliverCount: res.data.pendingDeliver || 0
        });
      }
    }).catch(err => {
      this.setData({
        pendingPayCount: 0,
        pendingDeliverCount: 0
      });
    });
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
        this.setData({
          unreadNoticeCount: 0
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
      url: '/pages/order/order?status=all&title=' + encodeURIComponent('全部订单'),
    });
  },

  /**
   * 跳转订单状态页
   */
  goToOrderStatus(e) {
    if (!this.checkAuth()) return;
    const status = e.currentTarget.dataset.status;
    const titleMap = {
      all: '全部订单',
      '0': '待支付',
      '1': '待发货',
      '2': '待收货',
      '3': '已完成',
      '4': '已取消'
    };
    const title = titleMap[String(status)] || '我的订单';
    wx.navigateTo({
      url: '/pages/order/order?status=' + status + '&title=' + encodeURIComponent(title),
    });
  },

  /**
   * 跳转地址管理
   */
  goToAddress() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/address/address?title=' + encodeURIComponent('地址管理'),
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
   * 跳转到管理后台
   */
  goToAdmin() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/admin/index',
    });
  },

  /**
   * 跳转到商家后台
   */
  goToMerchantCenter() {
    if (!this.checkAuth()) return;
    wx.navigateTo({
      url: '/pages/merchant/index/index'
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
  },

  /**
   * 申请成为商家
   */
  applyMerchant() {
    if (!this.checkAuth()) return;
    
    // 弹出确认弹窗
    wx.showModal({
      title: '申请成为商家',
      content: '是否确定申请成为商家？',
      success: (res) => {
        if (res.confirm) {
          // 用户点击确认，提交申请
          this.submitMerchantApplication();
        }
      }
    });
  },

  /**
   * 提交商家申请
   */
  submitMerchantApplication() {
    // 防止重复提交（data 标记 + 实例级锁，避免 setData 还没刷新的连点）
    if (this._merchantApplySubmitting || this.data.submitting) return;

    const userInfo = wx.getStorageSync('userInfo') || {};
    const nickname = userInfo.nickname || userInfo.nickName || (this.data.userInfo && this.data.userInfo.nickName);
    const phone = userInfo.phone || (this.data.userInfo && this.data.userInfo.phone) || '';

    if (!nickname) {
      wx.showToast({
        title: '缺少昵称，无法提交申请',
        icon: 'none'
      });
      return;
    }

    this._merchantApplySubmitting = true;
    this.setData({ submitting: true });

    this._merchantApplyLoadingCount = (this._merchantApplyLoadingCount || 0) + 1;
    if (this._merchantApplyLoadingCount === 1) {
      wx.showLoading({ title: '提交申请中...' });
    }

    let toastOptions = null;
    applyMerchantRequest({ nickname, phone })
      .then((res) => {
        if (res && res.success) {
          toastOptions = {
            title: '申请提交成功，等待管理员审核',
            icon: 'success',
            duration: 2000
          };
        } else {
          toastOptions = {
            title: (res && res.message) || '申请提交失败',
            icon: 'none',
            duration: 2000
          };
        }
      })
      .catch((err) => {
        toastOptions = {
          title: (err && err.message) || '网络错误，请重试',
          icon: 'none',
          duration: 2000
        };
        console.error('提交商家申请失败:', err);
      })
      .finally(() => {
        this._merchantApplySubmitting = false;
        this.setData({ submitting: false });

        this._merchantApplyLoadingCount = Math.max((this._merchantApplyLoadingCount || 1) - 1, 0);
        if (this._merchantApplyLoadingCount === 0) {
          wx.hideLoading();
        }

        if (toastOptions) {
          wx.showToast(toastOptions);
        }
      });
  }
});