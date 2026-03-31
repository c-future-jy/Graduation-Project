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
    this._skipOnShowOnce = true;
    this.loadNotifications();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this._skipOnShowOnce) {
      this._skipOnShowOnce = false;
      return;
    }
    this.loadNotifications();
  },

  /**
   * 加载通知列表
   */
  loadNotifications() {
    if (this._loadingPromise) return this._loadingPromise;

    wx.showLoading({ title: '加载中...' });
    this.setData({ loading: true });

    this._loadingPromise = getNotifications()
      .then(res => {
        if (res.success) {
          this.setData({
            notifications: res.data.notifications || []
          });
        } else {
          wx.showToast({ title: '加载通知失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ loading: false });
        this._loadingPromise = null;
      });

    return this._loadingPromise;
  },

  /**
   * 点击查看通知详情
   */
  viewNotification(e) {
    const index = e.currentTarget.dataset.index;
    const notice = this.data.notifications && this.data.notifications[index];
    if (!notice) return;

    const title = notice.title || '通知';
    const timeText = notice.created_at ? `\n\n时间：${notice.created_at}` : '';
    const content = (notice.content || '') + timeText;

    wx.showModal({
      title,
      content: content || '暂无内容',
      showCancel: false,
      confirmText: '我知道了'
    });

    // 只有在用户点开时才标记已读
    if (!notice.is_read && notice.id) {
      markNotificationAsRead(notice.id)
        .then(() => {
          const notifications = [...this.data.notifications];
          notifications[index] = {
            ...notifications[index],
            is_read: 1
          };
          this.setData({ notifications });
        })
        .catch(err => {
          console.error('标记通知已读失败:', err);
        });
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadNotifications().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
})