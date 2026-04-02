// pages/notice/notice.js
const { getNotifications, markNotificationAsRead } = require('../../utils/api');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}

function toValidDate(input) {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  const raw = String(input).trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/-/g, '/')
    .replace('T', ' ')
    .replace(/\.(\d+)Z$/, '');

  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d;

  const n = Number(raw);
  if (Number.isFinite(n)) {
    const ms = n < 1e12 ? n * 1000 : n;
    const d2 = new Date(ms);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  return null;
}

function formatRelativeTime(input) {
  const d = toValidDate(input);
  if (!d) return toStr(input, '');

  const now = Date.now();
  const diffMs = now - d.getTime();
  if (!Number.isFinite(diffMs)) return toStr(input, '');

  if (diffMs < 60 * 1000) return '刚刚';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}分钟前`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}小时前`;
  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}天前`;
}

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
    this._loadingCount = 0;
    this._loadingShown = false;
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

  _showLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;
    wx.showLoading({
      title: title || '加载中...',
      success: () => {
        this._loadingShown = true;
      },
      fail: () => {
        this._loadingShown = false;
      }
    });
  },

  _hideLoading() {
    const current = this._loadingCount || 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);
    this._loadingCount = next;
    if (next !== 0) return;
    if (!this._loadingShown) return;
    wx.hideLoading({
      complete: () => {
        this._loadingShown = false;
      }
    });
  },

  _normalizeNotifications(list) {
    const arr = Array.isArray(list) ? list : [];
    return arr.map((n) => {
      const createdAt = n.created_at ?? n.createdAt ?? n.created_time ?? n.createdTime;
      const isRead = n.is_read === 1 || n.is_read === true || n.isRead === 1 || n.isRead === true;
      return {
        ...n,
        id: n.id,
        title: toStr(n.title, '通知'),
        content: toStr(n.content, ''),
        created_at: toStr(createdAt, ''),
        displayTime: formatRelativeTime(createdAt),
        is_read: isRead ? 1 : 0
      };
    });
  },

  /**
   * 加载通知列表
   */
  loadNotifications() {
    if (this._loadingPromise) return this._loadingPromise;

    this._showLoading('加载中...');
    this.setData({ loading: true });

    this._loadingPromise = getNotifications()
      .then(res => {
        if (res.success) {
          this.setData({
            notifications: this._normalizeNotifications(res.data && res.data.notifications)
          });
        } else {
          wx.showToast({ title: (res && res.message) || '加载通知失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.showToast({ title: getErrMsg(err, '网络错误'), icon: 'none' });
      })
      .finally(() => {
        this._hideLoading();
        this.setData({ loading: false });
        this._loadingPromise = null;
      });

    return this._loadingPromise;
  },

  /**
   * 点击查看通知详情
   */
  viewNotification(e) {
    const id = e.currentTarget.dataset.id;
    const fallbackIndex = toInt(e.currentTarget.dataset.index, -1);
    const list = this.data.notifications || [];
    const index = id !== undefined && id !== null && id !== ''
      ? list.findIndex((x) => String(x.id) === String(id))
      : fallbackIndex;
    const notice = index >= 0 ? list[index] : null;
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
          const notifications = [...(this.data.notifications || [])];
          if (index >= 0) {
            notifications[index] = {
              ...notifications[index],
              is_read: 1
            };
            this.setData({ notifications });
          }
        })
        .catch(err => {
          console.error('标记通知已读失败:', err);
        });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    try {
      await this.loadNotifications();
    } finally {
      wx.stopPullDownRefresh();
    }
  }
})