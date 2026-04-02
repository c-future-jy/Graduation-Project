const { getMerchantFeedbacks, replyMerchantFeedback } = require('../../../utils/api');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toValidDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
    const slash = raw.replace(/-/g, '/');
    d = new Date(slash);
    if (!Number.isNaN(d.getTime())) return d;
    d = new Date(slash.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatTime(timeValue) {
  const date = toValidDate(timeValue);
  if (!date) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

Page({
  data: {
    feedbacks: [],
    loading: true,
    showReplyModal: false,
    currentFeedbackId: null,
    replyText: '',
    submitting: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '评价管理' });
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo || userInfo.role !== 2) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    this.loadFeedbacks();
  },

  onShow() {
    if (!this.data.loading && !this.data.showReplyModal) {
      this.loadFeedbacks();
    }
  },

  loadFeedbacks() {
    if (this._loadingPromise) return this._loadingPromise;

    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });

    this._loadingPromise = getMerchantFeedbacks()
      .then((res) => {
        if (res && res.success) {
          const list = (res.data && res.data.feedbacks) || [];
          const mapped = list.map((item) => {
            const createdAt = item.create_time || item.created_at || item.createdAt || item.createTime;
            return {
              ...item,
              formattedTime: formatTime(createdAt)
            };
          });
          this.setData({ feedbacks: mapped });
        } else {
          wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
        }
      })
      .catch((err) => {
        console.error('加载反馈失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ loading: false });
        this._loadingPromise = null;
      });

    return this._loadingPromise;
  },

  openReply(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showReplyModal: true, currentFeedbackId: id, replyText: '' });
  },

  closeReply() {
    if (this.data.submitting) return;
    this.setData({ showReplyModal: false, currentFeedbackId: null, replyText: '' });
  },

  noop() {},

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  submitReply() {
    const id = this.data.currentFeedbackId;
    const reply = String(this.data.replyText || '').trim();
    if (!id) return;
    if (!reply) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    replyMerchantFeedback(id, reply)
      .then((res) => {
        if (res && res.success) {
          wx.showToast({ title: '回复成功' });
          this.closeReply();
          return this.loadFeedbacks();
        }
        wx.showToast({ title: (res && res.message) || '回复失败', icon: 'none' });
      })
      .catch((err) => {
        console.error('回复失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      })
      .finally(() => {
        wx.hideLoading();
        this.setData({ submitting: false });
      });
  }
});
