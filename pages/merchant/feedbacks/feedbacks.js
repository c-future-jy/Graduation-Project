const { getMerchantFeedbacks, replyMerchantFeedback } = require('../../../utils/api');

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toInt(value, fallback = 0) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
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
    allFeedbacks: [],
    selectedFilter: 0,
    filters: [
      { value: 'all', label: '全部' },
      { value: 'unreplied', label: '未回复' },
      { value: 'replied', label: '已回复' }
    ],
    emptyText: '暂无评价',
    loading: true,
    showReplyModal: false,
    currentFeedbackId: null,
    replyText: '',
    submitting: false
  },

  onLoad() {
    this._loadingCount = 0;
    this._loadingShown = false;
    this._reqId = 0;
    this._loadingPromise = null;

    wx.setNavigationBarTitle({ title: '评价管理' });
    const userInfo = wx.getStorageSync('userInfo') || {};
    const role = toInt(userInfo.role, 0);
    if (role !== 2) {
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

  _incLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;
    wx.showLoading({
      title: title || '处理中...',
      success: () => {
        this._loadingShown = true;
      },
      fail: () => {
        this._loadingShown = false;
      }
    });
  },

  _decLoading() {
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

  loadFeedbacks() {
    if (this._loadingPromise) return this._loadingPromise;

    const reqId = (this._reqId || 0) + 1;
    this._reqId = reqId;

    this.setData({ loading: true });
    this._incLoading('加载中...');

    this._loadingPromise = (async () => {
      try {
        const res = await getMerchantFeedbacks();
        if (reqId !== this._reqId) return;

        if (!(res && res.success)) {
          wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
          return;
        }

        const list = (res.data && res.data.feedbacks) || [];
        const mapped = (Array.isArray(list) ? list : []).map((item) => {
          const createdAt = item.create_time || item.created_at || item.createdAt || item.createTime;
          return {
            ...item,
            formattedTime: formatTime(createdAt)
          };
        });
        this.setData({ allFeedbacks: mapped });
        this.applyFilter();
      } catch (err) {
        if (reqId !== this._reqId) return;
        console.error('加载反馈失败:', err);
        wx.showToast({ title: getErrMsg(err, '网络错误'), icon: 'none' });
      } finally {
        if (reqId === this._reqId) {
          this.setData({ loading: false });
        }
        this._decLoading();
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
  },

  applyFilter() {
    const { selectedFilter, filters, allFeedbacks } = this.data;
    const value = (filters[selectedFilter] || {}).value || 'all';
    const list = Array.isArray(allFeedbacks) ? allFeedbacks : [];

    let filtered = list;
    if (value === 'unreplied') {
      filtered = list.filter((item) => !item.reply);
    } else if (value === 'replied') {
      filtered = list.filter((item) => !!item.reply);
    }

    const emptyTextByValue = {
      all: '暂无评价',
      unreplied: '暂无未回复评价',
      replied: '暂无已回复评价'
    };
    const emptyText = emptyTextByValue[value] || '暂无评价';

    this.setData({ feedbacks: filtered, emptyText });
  },

  onFilterTap(e) {
    const idx = toInt(e.currentTarget.dataset.index, 0);
    if (idx === this.data.selectedFilter) return;
    this.setData({ selectedFilter: idx });
    this.applyFilter();
  },

  openReply(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ showReplyModal: true, currentFeedbackId: id, replyText: '' });
  },

  closeReply(force) {
    if (this.data.submitting && !force) return;
    this.setData({ showReplyModal: false, currentFeedbackId: null, replyText: '' });
  },

  noop() {},

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value });
  },

  async submitReply() {
    const id = this.data.currentFeedbackId;
    const reply = String(this.data.replyText || '').trim();
    if (!id) return;
    if (!reply) {
      wx.showToast({ title: '请输入回复内容', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    this._incLoading('提交中...');

    try {
      const res = await replyMerchantFeedback(id, reply);
      if (res && res.success) {
        wx.showToast({ title: '回复成功' });
        // 成功后自动关闭弹窗（避免用户手动关闭造成重复操作）
        this.closeReply(true);
        await this.loadFeedbacks();
        return;
      }
      wx.showToast({ title: (res && res.message) || '回复失败', icon: 'none' });
    } catch (err) {
      console.error('回复失败:', err);
      wx.showToast({ title: getErrMsg(err, '网络错误'), icon: 'none' });
    } finally {
      this._decLoading();
      this.setData({ submitting: false });
    }
  },

  async onPullDownRefresh() {
    try {
      await this.loadFeedbacks();
    } finally {
      wx.stopPullDownRefresh();
    }
  }
});
