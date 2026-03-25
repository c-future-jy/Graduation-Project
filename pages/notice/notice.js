// pages/notice/notice.js
const { getNotifications, markNotificationAsRead } = require('../../utils/api');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    notifications: [],
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadNotifications();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadNotifications();
  },

  /**
   * 加载通知列表
   */
  loadNotifications() {
    wx.showLoading({ title: '加载中...' });
    this.setData({ loading: true });
    
    getNotifications()
      .then(res => {
        wx.hideLoading();
        if (res.success) {
          this.setData({
            notifications: res.data.notifications || []
          });
          // 标记所有通知为已读
          this.markAllAsRead();
        } else {
          wx.showToast({ title: '加载通知失败', icon: 'none' });
        }
        this.setData({ loading: false });
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.setData({ loading: false });
      });
  },

  /**
   * 标记所有通知为已读
   */
  markAllAsRead() {
    const unreadNotifications = this.data.notifications.filter(notice => !notice.is_read);
    unreadNotifications.forEach(notice => {
      markNotificationAsRead(notice.id)
        .catch(err => {
          console.error('标记通知已读失败:', err);
        });
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadNotifications().then(() => {
      wx.stopPullDownRefresh();
    });
  }
})