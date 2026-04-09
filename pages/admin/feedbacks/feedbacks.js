const {
  getAdminFeedbackList,
  replyFeedback,
  rejectFeedback,
  batchDeleteAdminFeedbacks
} = require('../../../utils/api');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function showErrorToast(err, fallback = '网络错误') {
  const msg = (err && (err.message || err.error)) ? (err.message || err.error) : fallback;
  wx.showToast({ title: msg, icon: 'none', duration: 3000 });
}

function runWithLoading(title, fn) {
  wx.showLoading({ title: title || '加载中...' });
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      wx.hideLoading();
    });
}

const STATUS_NUM_BY_VALUE = {
  pending: 0,
  replied: 1,
  rejected: 2
};

const STATUS_VALUE_BY_NUM = {
  0: 'pending',
  1: 'replied',
  2: 'rejected'
};

const TYPE_VALUE_BY_NUM = {
  1: 'order',
  2: 'merchant',
  3: 'platform'
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

// 小程序/部分 JS 引擎对 `YYYY-MM-DD HH:mm:ss` 解析不稳定；这里做兼容与空值兜底。
function toValidDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;

    // 1) 先尝试原样解析（ISO 等）
    let d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;

    // 2) MySQL DATETIME: 2026-03-30 12:34:56 -> 2026/03/30 12:34:56
    const slash = raw.replace(/-/g, '/');
    d = new Date(slash);
    if (!Number.isNaN(d.getTime())) return d;

    // 3) 再尝试替换成 ISO 形式：2026/03/30T12:34:56
    d = new Date(slash.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

// 格式化时间函数
function formatTime(timeValue) {
  const date = toValidDate(timeValue);
  if (!date) return '-';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // 时间在未来/时钟漂移：直接展示绝对时间
  if (!Number.isFinite(diff) || diff < 0) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  // 格式化日期为 YYYY-MM-DD HH:mm（不使用 toISOString，避免 Invalid time value）
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

Page({
  data: {
    feedbacks: [],
    searchKeyword: '',
    selectedType: 0,
    selectedStatus: 0,
    selectedFeedbacks: [],
    selectedMap: {},
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
    showInput: false,
    currentFeedbackId: null,
    actionContent: '',
    showBatchModal: false,
    selectedBatchAction: 0,
    batchActions: ['标记为已处理', '标记为已回复', '批量删除'],
    feedbackTypes: [
      { value: '', label: '全部类型' },
      { value: 'order', label: '订单' },
      { value: 'merchant', label: '商家' },
      { value: 'platform', label: '平台' }
    ],
    feedbackStatuses: [
      { value: '', label: '全部状态' },
      { value: 'pending', label: '待处理' },
      { value: 'processing', label: '处理中' },
      { value: 'replied', label: '已回复' },
      { value: 'rejected', label: '已驳回' }
    ]
  },

  onPullDownRefresh: function () {
    this.clearSelection();
    this.setData({ currentPage: 1 });
    Promise.resolve(this.loadFeedbacks())
      .finally(() => {
        wx.stopPullDownRefresh();
      });
  },

  onReachBottom: function () {
    const { currentPage, totalPages } = this.data;
    if (currentPage >= totalPages) return;
    this.setData({ currentPage: currentPage + 1 });
    this.loadFeedbacks({ append: true });
  },

  reloadFeedbacks: function () {
    this.clearSelection();
    this.setData({ currentPage: 1 });
    this.loadFeedbacks();
  },

  onLoad: function (options) {
    this.checkLoginStatus();
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '反馈管理' });
    this.loadFeedbacks();
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  checkLoginStatus: function () {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const roleNum = userInfo ? parseInt(String(userInfo.role), 10) : 0;
    
    if (!token || !userInfo || roleNum !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  setFeedbackFieldById: function (id, field, value) {
    const idx = this.data.feedbacks.findIndex(item => item.id === id);
    if (idx < 0) return;
    this.setData({
      [`feedbacks[${idx}].${field}`]: value
    });
  },

  setSelection: function (selectedIds) {
    const map = {};
    (selectedIds || []).forEach((id) => {
      map[id] = true;
    });
    this.setData({
      selectedFeedbacks: selectedIds || [],
      selectedMap: map
    });
  },

  loadFeedbacks: function (options) {
    const append = !!(options && options.append);
    const { currentPage, pageSize, selectedType, selectedStatus, searchKeyword } = this.data;
    const statusValue = (this.data.feedbackStatuses[selectedStatus] || {}).value;
    const statusNum = Object.prototype.hasOwnProperty.call(STATUS_NUM_BY_VALUE, statusValue)
      ? STATUS_NUM_BY_VALUE[statusValue]
      : '';

    return runWithLoading('加载中...', () =>
      getAdminFeedbackList({
        page: currentPage,
        pageSize,
        type: (this.data.feedbackTypes[selectedType] || {}).value,
        status: statusNum,
        keyword: searchKeyword
      })
    )
      .then((res) => {
        if (!res || !res.success) {
          wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
          return;
        }

        const rawList = (res.data && res.data.feedbacks) || [];
        const nextList = rawList.map((item) => {
          const createdAt = item.create_time || item.created_at || item.createdAt || item.createTime;
          const typeNum = toInt(item.type, 0);
          const statusNum2 = toInt(item.status, 0);
          const typeValue = TYPE_VALUE_BY_NUM[typeNum] || 'platform';
          const statusValue2 = STATUS_VALUE_BY_NUM[statusNum2] || 'rejected';
          const id = toInt(item.id, 0);

          return {
            id,
            userId: toInt(item.user_id, 0),
            userName: toStr(item.user_name, '-'),
            type: typeValue,
            content: toStr(item.content, ''),
            rating: toInt(item.rating, 0),
            status: statusValue2,
            actionContent: toStr(item.reply || item.reject_reason || '', ''),
            showFullContent: false,
            currentAction: '',
            createdAt,
            formattedTime: formatTime(createdAt)
          };
        });

        let feedbacks = nextList;
        if (append) {
          const byId = {};
          (this.data.feedbacks || []).forEach((it) => {
            if (it && it.id) byId[it.id] = it;
          });
          nextList.forEach((it) => {
            if (it && it.id) byId[it.id] = it;
          });
          feedbacks = Object.keys(byId)
            .map((k) => byId[k])
            .sort((a, b) => (b.id || 0) - (a.id || 0));
        }

        const pagination = (res.data && res.data.pagination) || {};
        this.setData({
          feedbacks,
          totalPages: toInt(pagination.totalPages, 1),
          totalCount: toInt(pagination.total, feedbacks.length)
        });
      })
      .catch((err) => {
        console.error('加载反馈列表失败:', err);
        showErrorToast(err, '网络错误');
      });
  },

  bindSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  searchFeedbacks: function () {
    this.setData({ currentPage: 1 });
    this.loadFeedbacks();
  },

  bindTypeChange: function (e) {
    this.setData({
      selectedType: e.detail.value
    });
  },

  bindStatusChange: function (e) {
    this.setData({
      selectedStatus: e.detail.value
    });
  },

  toggleFeedbackSelection: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    if (!id) return;

    const nextMap = { ...this.data.selectedMap };
    if (nextMap[id]) {
      delete nextMap[id];
    } else {
      nextMap[id] = true;
    }

    const selectedFeedbacks = Object.keys(nextMap).map(k => toInt(k, 0)).filter(Boolean);
    this.setData({
      selectedMap: nextMap,
      selectedFeedbacks
    });
  },

  clearSelection: function () {
    this.setSelection([]);
  },

  viewFeedbackDetail: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    if (!id) return;
    wx.navigateTo({
      url: `/pages/admin/feedbacks/detail?id=${id}&title=${encodeURIComponent('反馈详情')}`,
      fail: function () {
        wx.showToast({ title: '跳转失败', icon: 'none' });
      }
    });
  },

  // 显示操作输入框
  showActionInput: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    const action = e.currentTarget.dataset.action;

    this.setFeedbackFieldById(id, 'currentAction', action);
    this.setData({
      showInput: true,
      currentFeedbackId: id,
      actionContent: ''
    });
  },

  // 绑定操作内容输入
  bindActionContent: function (e) {
    this.setData({
      actionContent: e.detail.value
    });
  },

  // 取消操作
  cancelActionInput: function () {
    const id = this.data.currentFeedbackId;

    if (id) this.setFeedbackFieldById(id, 'currentAction', '');
    this.setData({
      showInput: false,
      currentFeedbackId: null,
      actionContent: ''
    });
  },

  // 提交操作
  submitActionInput: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    const action = e.currentTarget.dataset.action;
    const content = toStr(this.data.actionContent, '').trim();
    
    if (!content) {
      wx.showToast({ title: action === 'reply' ? '请输入回复内容' : '请输入驳回原因', icon: 'none' });
      return;
    }

    runWithLoading(action === 'reply' ? '回复中...' : '驳回中...', () => {
      return action === 'reply' ? replyFeedback(id, content) : rejectFeedback(id, content);
    })
      .then((res) => {
        if (!res || !res.success) {
          wx.showToast({ title: (res && res.message) || (action === 'reply' ? '回复失败' : '驳回失败'), icon: 'none' });
          return;
        }

        this.setData({
          showInput: false,
          currentFeedbackId: null,
          actionContent: ''
        });

        wx.showToast({ title: action === 'reply' ? '回复成功' : '驳回成功', icon: 'success' });
        this.loadFeedbacks();
      })
      .catch((err) => {
        console.error(action === 'reply' ? '回复反馈失败:' : '驳回反馈失败:', err);
        showErrorToast(err, '网络错误');
      });
  },

  // 切换操作内容展开/收起
  toggleActionContent: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    const idx = this.data.feedbacks.findIndex(item => item.id === id);
    if (idx < 0) return;
    const curr = !!this.data.feedbacks[idx].showFullContent;
    this.setData({
      [`feedbacks[${idx}].showFullContent`]: !curr
    });
  },

  // 批量处理
  batchProcess: function () {
    if (this.data.selectedFeedbacks.length === 0) {
      wx.showToast({ title: '请选择要处理的反馈', icon: 'none' });
      return;
    }
    this.setData({
      showBatchModal: true,
      selectedBatchAction: 0
    });
  },

  // 批量操作选择
  bindBatchActionChange: function (e) {
    this.setData({
      selectedBatchAction: e.detail.value
    });
  },

  // 确认批量处理
  confirmBatchProcess: function () {
    const action = Number(this.data.selectedBatchAction);
    const selectedIds = this.data.selectedFeedbacks;

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      wx.showToast({ title: '请选择要处理的反馈', icon: 'none' });
      return;
    }

    // 目前仅“批量删除”有对应后端接口
    if (action !== 2) {
      wx.showToast({ title: '该批量操作暂未接入接口，请逐条处理', icon: 'none' });
      this.setData({ showBatchModal: false });
      return;
    }

    runWithLoading('删除中...', () => batchDeleteAdminFeedbacks(selectedIds))
      .then((res) => {
        if (!res || !res.success) {
          wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' });
          return;
        }

        wx.showToast({ title: '删除成功', icon: 'success' });
        this.setData({
          showBatchModal: false,
          currentPage: 1
        });
        this.clearSelection();
        this.loadFeedbacks();
      })
      .catch((err) => {
        console.error('批量删除反馈失败:', err);
        showErrorToast(err, '网络错误');
      });
  },

  // 取消批量处理
  cancelBatchProcess: function () {
    this.setData({
      showBatchModal: false
    });
  },

  prevPage: function () {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      });
      this.loadFeedbacks();
    }
  },

  nextPage: function () {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      });
      this.loadFeedbacks();
    }
  },

  getTypeColor: function (type) {
    switch (type) {
      case 'order':
        return '#1890ff';
      case 'merchant':
        return '#fa8c16';
      case 'platform':
        return '#52c41a';
      default:
        return '#999';
    }
  },

  getStatusColor: function (status) {
    switch (status) {
      case 'pending':
        return '#ff4d4f';
      case 'processing':
        return '#fa8c16';
      case 'replied':
        return '#52c41a';
      case 'rejected':
        return '#999';
      default:
        return '#999';
    }
  },

  getStatusText: function (status) {
    switch (status) {
      case 'pending':
        return '待回复';
      case 'processing':
        return '待回复';
      case 'replied':
        return '已回复';
      case 'rejected':
        return '已驳回';
      default:
        return '未知';
    }
  },

  getTypeText: function (type) {
    switch (type) {
      case 'order':
        return '订单';
      case 'merchant':
        return '商家';
      case 'platform':
        return '平台';
      default:
        return '未知';
    }
  }
});