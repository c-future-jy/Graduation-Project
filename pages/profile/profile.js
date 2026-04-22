// pages/profile/profile.js
const DEFAULT_AVATAR = '/assets/images/morentouxiang.jpg';
const DEFAULT_USER_INFO = {
  avatarUrl: DEFAULT_AVATAR,
  nickName: '未登录',
  phone: '',
  role: 0
};

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v, fallback = '') {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return (
    (err.data && (err.data.message || err.data.msg)) ||
    err.message ||
    err.errMsg ||
    err.msg ||
    fallback
  );
}

const {
  getUserProfile,
  getNotifications,
  getOrderCounts,
  getMerchantDashboardStats,
  applyMerchant: applyMerchantRequest
} = require('../../utils/api');

const { toNetworkUrl } = require('../../utils/url');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false,
    userInfo: { ...DEFAULT_USER_INFO },
    pendingPayCount: 0,           // 待支付订单数量
    pendingDeliverCount: 0,       // 待发货订单数量
    unreadNoticeCount: 0,         // 未读消息数量
    merchantPendingOrders: 0,     // 商家待处理订单数（用于商家后台角标）
    submitting: false,            // 防止重复提交
    loadingCount: 0
  },

  _incLoading(title = '加载中...') {
    const next = (this.data.loadingCount || 0) + 1;
    if (next === 1) wx.showLoading({ title });
    this.setData({ loadingCount: next });
  },

  _decLoading() {
    const next = Math.max(0, (this.data.loadingCount || 0) - 1);
    if (next === 0) wx.hideLoading();
    this.setData({ loadingCount: next });
  },

  _normalizeStoredUser(raw) {
    const u = raw || {};
    const role = toInt(u.role, 0);
    const nickName = toStr(u.nickName || u.nickname || u.username || (role ? '未设置昵称' : DEFAULT_USER_INFO.nickName));
    const avatarRaw = toStr(u.avatarUrl || u.avatar_url || DEFAULT_AVATAR);
    const phone = toStr(u.phone || '');
    const merchantId = u.merchantId || u.merchant_id || null;

    return {
      ...u,
      role,
      nickName,
      avatarUrl: avatarRaw,
      avatar_url: u.avatar_url || avatarRaw,
      phone,
      merchantId,
      merchant_id: u.merchant_id || merchantId
    };
  },

  _updateStorageUser(patch) {
    try {
      const cached = wx.getStorageSync('userInfo') || {};
      wx.setStorageSync('userInfo', this._normalizeStoredUser({ ...cached, ...(patch || {}) }));
    } catch (_) {
      // ignore
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (!this.checkLoginStatus()) return;
    this.loadOrderCounts();
    this.checkUnreadNotice();
    if (this.data.userInfo && this.data.userInfo.role === 2) this.loadMerchantBadges();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = this._normalizeStoredUser(wx.getStorageSync('userInfo'));
    
    if (token && userInfo) {
      this.setData({
        isLogin: true,
        userInfo: {
          ...userInfo,
          avatarUrl: userInfo.avatarUrl ? toNetworkUrl(userInfo.avatarUrl) : DEFAULT_AVATAR
        }
      });
      // 调用API获取最新用户信息
      this.refreshUserInfo();
      return true;
    }

    if (token && !userInfo) {
      // 防止出现“只有 token 没有 userInfo”导致的状态不一致
      wx.removeStorageSync('token');
    }
    this.setLoggedOut();
    return false;
  },

  setLoggedOut() {
    this.setData({
      isLogin: false,
      userInfo: { ...DEFAULT_USER_INFO },
      pendingPayCount: 0,
      pendingDeliverCount: 0,
      unreadNoticeCount: 0,
      merchantPendingOrders: 0
    });
  },

  /**
   * 获取用户信息
   */
  async refreshUserInfo() {
    try {
      const res = await getUserProfile();
      const userInfo = (res && res.data && res.data.user) ? res.data.user : {};
      const cached = this._normalizeStoredUser(wx.getStorageSync('userInfo'));

      // 个人中心展示名应优先使用 nickname（可编辑），username/account 仅作为兜底
      const serverNickname = toStr(userInfo.nickname || userInfo.nickName || '').trim();
      const serverUsername = toStr(userInfo.username || userInfo.account || '').trim();
      let displayName = (serverNickname && serverNickname !== '新用户' ? serverNickname : '')
        || serverUsername
        || cached.nickName
        || '未设置昵称';

      // 如果刚在“个人信息”页保存过昵称，返回后一小段时间内优先用本地缓存，避免被旧接口值覆盖
      try {
        const updatedAt = parseInt(wx.getStorageSync('profileUpdatedAt'), 10);
        const withinWindow = Number.isFinite(updatedAt) && Date.now() - updatedAt >= 0 && Date.now() - updatedAt <= 8000;
        if (withinWindow && cached && cached.nickName) {
          const cachedName = toStr(cached.nickName, '').trim();
          if (cachedName && cachedName !== displayName) {
            displayName = cachedName;
          }
        }

        // 若后端已返回最新昵称或超过窗口，清理标记
        const shouldClear = (!withinWindow) || (serverNickname && cached && toStr(cached.nickName, '').trim() === serverNickname);
        if (shouldClear) wx.removeStorageSync('profileUpdatedAt');
      } catch (_) {
        // ignore
      }
      const rawAvatar = userInfo.avatar_url || userInfo.avatarUrl || '';
      const avatarUrl = rawAvatar ? toNetworkUrl(rawAvatar) : (cached.avatarUrl ? toNetworkUrl(cached.avatarUrl) : DEFAULT_AVATAR);

      const nextUserInfo = {
        avatarUrl,
        nickName: displayName,
        phone: userInfo.phone || '',
        role: toInt(userInfo.role, 1),
        merchantId: userInfo.merchant_id || userInfo.merchantId || cached.merchantId || cached.merchant_id || null,
        merchant_id: userInfo.merchant_id || userInfo.merchantId || cached.merchant_id || cached.merchantId || null
      };

      this.setData({ userInfo: nextUserInfo });
      this._updateStorageUser(nextUserInfo);

      // 如果刚变更为商家（例如管理员刚审核通过），刷新一次商家角标
      if (nextUserInfo.role === 2) {
        this.loadMerchantBadges();
      } else {
        this.setData({ merchantPendingOrders: 0 });
      }
    } catch (_) {
      // ignore
    }
  },

  /**
   * 商家角标：待处理订单数
   */
  async loadMerchantBadges() {
    try {
      const res = await getMerchantDashboardStats();
      this.setData({
        merchantPendingOrders: (res && res.success && res.data && res.data.pendingOrders) ? res.data.pendingOrders : 0
      });
    } catch (_) {
      this.setData({ merchantPendingOrders: 0 });
    }
  },

  /**
   * 加载订单数量
   */
  async loadOrderCounts() {
    try {
      const res = await getOrderCounts();
      if (res && res.success && res.data) {
        this.setData({
          pendingPayCount: res.data.pendingPay || 0,
          pendingDeliverCount: res.data.pendingDeliver || 0
        });
        return;
      }
      this.setData({ pendingPayCount: 0, pendingDeliverCount: 0 });
    } catch (_) {
      this.setData({ pendingPayCount: 0, pendingDeliverCount: 0 });
    }
  },

  /**
   * 检查未读通知
   */
  async checkUnreadNotice() {
    try {
      const res = await getNotifications();
      const notifications = (res && res.data && Array.isArray(res.data.notifications)) ? res.data.notifications : [];
      const unreadCount = notifications.filter(notice => !notice.is_read).length;
      this.setData({ unreadNoticeCount: unreadCount });
    } catch (_) {
      this.setData({ unreadNoticeCount: 0 });
    }
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

  navigateToOrders(status) {
    if (!this.checkAuth()) return;
    const titleMap = {
      all: '全部订单',
      '0': '待支付',
      '1': '待发货',
      '2': '待收货',
      '3': '已完成',
      '4': '已取消'
    };
    const key = String(status);
    const title = titleMap[key] || '我的订单';
    wx.navigateTo({
      url: '/pages/order/order?status=' + key + '&title=' + encodeURIComponent(title)
    });
  },

  /**
   * 跳转订单状态页
   */
  goToOrderStatus(e) {
    this.navigateToOrders(e.currentTarget.dataset.status);
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
      title: '关于多模式履约校园商城',
      content: '版本号：v1.0.0\n\n本平台致力于为校园师生提供便捷的多模式生活服务，整合校园周边商家资源，让校园生活更美好。',
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
          this.setLoggedOut();
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

    const userInfo = this._normalizeStoredUser(wx.getStorageSync('userInfo'));
    const nickname = toStr(userInfo.nickName || (this.data.userInfo && this.data.userInfo.nickName)).trim();
    const phone = toStr(userInfo.phone || (this.data.userInfo && this.data.userInfo.phone) || '').trim();

    if (!nickname) {
      wx.showToast({
        title: '缺少昵称，无法提交申请',
        icon: 'none'
      });
      return;
    }

    this._merchantApplySubmitting = true;
    this.setData({ submitting: true });
    this._incLoading('提交申请中...');

    (async () => {
      try {
        const res = await applyMerchantRequest({ nickname, phone });
        if (res && res.success) {
          wx.showToast({ title: '申请提交成功，等待管理员审核', icon: 'success', duration: 2000 });
        } else {
          wx.showToast({ title: (res && res.message) || '申请提交失败', icon: 'none', duration: 2000 });
        }
      } catch (err) {
        console.error('提交商家申请失败:', err);
        wx.showToast({ title: getErrMsg(err, '网络错误，请重试'), icon: 'none', duration: 2000 });
      } finally {
        this._merchantApplySubmitting = false;
        this.setData({ submitting: false });
        this._decLoading();
      }
    })();
  }
});