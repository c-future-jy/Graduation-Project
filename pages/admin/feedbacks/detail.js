const { getAdminFeedbackDetail, replyFeedback, rejectFeedback } = require('../../../utils/api');

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
  if (!date) return '-';

  const now = new Date();
  const diff = now.getTime() - date.getTime();

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

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

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

Page({
  data: {
    feedback: null,
    loading: true,
    showInput: false,
    currentAction: '',
    actionContent: ''
  },

  onLoad: function (options) {
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '反馈详情' });

    const id = toInt(options && options.id, 0);
    if (id) {
      this.loadFeedbackDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  loadFeedbackDetail: function (id) {
    this.setData({ loading: true });

    return runWithLoading('加载中...', () => getAdminFeedbackDetail(id))
      .then((res) => {
        if (!res || !res.success) {
          wx.showToast({ title: (res && res.message) || '加载失败', icon: 'none' });
          wx.navigateBack();
          return;
        }

        const raw = (res.data && res.data.feedback) || {};
        const createdAt = raw.create_time || raw.created_at || raw.createdAt || raw.createTime;
        const typeNum = toInt(raw.type, 0);
        const statusNum = toInt(raw.status, 0);

        const feedback = {
          id: toInt(raw.id, 0),
          userId: toInt(raw.user_id, 0),
          userName: toStr(raw.user_name, '-'),
          type: TYPE_VALUE_BY_NUM[typeNum] || 'platform',
          content: toStr(raw.content, ''),
          rating: toInt(raw.rating, 0),
          status: STATUS_VALUE_BY_NUM[statusNum] || 'rejected',
          actionContent: toStr(raw.reply || raw.reject_reason || '', ''),
          showFullContent: false,
          currentAction: '',
          createdAt,
          formattedTime: formatTime(createdAt)
        };

        this.setData({ feedback, loading: false });
      })
      .catch((err) => {
        console.error('加载反馈详情失败:', err);
        showErrorToast(err, '网络错误');
        wx.navigateBack();
      });
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
  },

  // 显示操作输入框
  showActionInput: function (e) {
    const action = e.currentTarget.dataset.action;
    
    this.setData({
      showInput: true,
      currentAction: action,
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
    this.setData({
      showInput: false,
      currentAction: '',
      actionContent: ''
    });
  },

  // 提交操作
  submitActionInput: function () {
    const action = this.data.currentAction;
    const feedback = this.data.feedback;

    const content = toStr(this.data.actionContent, '').trim();
    
    if (!content) {
      wx.showToast({ title: action === 'reply' ? '请输入回复内容' : '请输入驳回原因', icon: 'none' });
      return;
    }

    runWithLoading(action === 'reply' ? '回复中...' : '驳回中...', () => {
      return action === 'reply' ? replyFeedback(feedback.id, content) : rejectFeedback(feedback.id, content);
    })
      .then((res) => {
        if (!res || !res.success) {
          wx.showToast({ title: (res && res.message) || (action === 'reply' ? '回复失败' : '驳回失败'), icon: 'none' });
          return;
        }

        this.setData({
          showInput: false,
          currentAction: '',
          actionContent: ''
        });

        wx.showToast({ title: action === 'reply' ? '回复成功' : '驳回成功', icon: 'success' });
        this.loadFeedbackDetail(feedback.id);
      })
      .catch((err) => {
        console.error(action === 'reply' ? '回复反馈失败:' : '驳回反馈失败:', err);
        showErrorToast(err, '网络错误');
      });
  },

  // 切换操作内容展开/收起
  toggleActionContent: function () {
    const feedback = this.data.feedback;
    if (!feedback) return;
    this.setData({
      'feedback.showFullContent': !feedback.showFullContent
    });
  }
});
