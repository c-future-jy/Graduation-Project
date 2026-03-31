const {
  getAdminFeedbackList,
  replyFeedback,
  rejectFeedback,
  batchDeleteAdminFeedbacks
} = require('../../../utils/api');

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
    selectAll: false,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
    showInput: false,
    currentFeedbackId: null,
    currentAction: '',
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
    
    if (!token || !userInfo || userInfo.role !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  loadFeedbacks: function () {
    const { currentPage, pageSize, selectedType, selectedStatus, searchKeyword } = this.data;
    
    wx.showLoading({ title: '加载中...' });
    
    // 将前端状态值转换为后端数值
    const statusValue = this.data.feedbackStatuses[selectedStatus].value;
    let statusNum = '';
    if (statusValue === 'pending') {
      statusNum = 0;
    } else if (statusValue === 'replied') {
      statusNum = 1;
    } else if (statusValue === 'rejected') {
      statusNum = 2;
    }
    
    getAdminFeedbackList({
      page: currentPage,
      pageSize: pageSize,
      type: this.data.feedbackTypes[selectedType].value,
      status: statusNum,
      keyword: searchKeyword
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        // 转换数据格式，适配前端显示
        const feedbacks = res.data.feedbacks.map(item => {
          const createdAt = item.create_time || item.created_at || item.createdAt || item.createTime;
          const typeNum = typeof item.type === 'string' ? parseInt(item.type, 10) : item.type;
          const statusNum = typeof item.status === 'string' ? parseInt(item.status, 10) : item.status;
          return {
          id: item.id,
          userId: item.user_id,
          userName: item.user_name,
          type: typeNum === 1 ? 'order' : typeNum === 2 ? 'merchant' : 'platform',
          content: item.content,
          rating: item.rating,
          status: statusNum === 0 ? 'pending' : statusNum === 1 ? 'replied' : 'rejected',
          actionContent: item.reply || item.reject_reason || '',
          showFullContent: false,
          currentAction: '',
          createdAt,
          formattedTime: formatTime(createdAt)
          };
        });
        
        this.setData({
          feedbacks: feedbacks,
          totalPages: res.data.pagination.totalPages,
          totalCount: res.data.pagination.total
        });
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载反馈列表失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
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

  toggleSelectAll: function (e) {
    const selectAll = e.detail.value.length > 0;
    const selectedFeedbacks = selectAll ? this.data.feedbacks.map(item => item.id) : [];
    this.setData({
      selectAll,
      selectedFeedbacks
    });
  },

  toggleFeedbackSelection: function (e) {
    const id = e.currentTarget.dataset.id;
    const selectedFeedbacks = [...this.data.selectedFeedbacks];
    const index = selectedFeedbacks.indexOf(id);
    if (index > -1) {
      selectedFeedbacks.splice(index, 1);
    } else {
      selectedFeedbacks.push(id);
    }
    this.setData({
      selectedFeedbacks,
      selectAll: selectedFeedbacks.length === this.data.feedbacks.length
    });
  },

  clearSelection: function () {
    this.setData({
      selectedFeedbacks: [],
      selectAll: false
    });
  },

  viewFeedbackDetail: function (e) {
    console.log('查看详情按钮被点击', e);
    const id = e.currentTarget.dataset.id;
    console.log('获取到的反馈ID:', id);
    wx.navigateTo({
      url: `/pages/admin/feedbacks/detail?id=${id}&title=${encodeURIComponent('反馈详情')}`,
      success: function(res) {
        console.log('跳转成功', res);
      },
      fail: function(res) {
        console.log('跳转失败', res);
      }
    });
  },

  // 显示操作输入框
  showActionInput: function (e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    
    // 更新对应卡片的currentAction字段
    const feedbacks = [...this.data.feedbacks];
    const index = feedbacks.findIndex(item => item.id === id);
    if (index > -1) {
      feedbacks[index].currentAction = action;
    }
    
    this.setData({
      feedbacks: feedbacks,
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
    
    // 清除对应卡片的currentAction字段
    if (id) {
      const feedbacks = [...this.data.feedbacks];
      const index = feedbacks.findIndex(item => item.id === id);
      if (index > -1) {
        feedbacks[index].currentAction = '';
      }
      
      this.setData({
        feedbacks: feedbacks
      });
    }
    
    this.setData({
      showInput: false,
      currentFeedbackId: null,
      actionContent: ''
    });
  },

  // 提交操作
  submitActionInput: function (e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    const content = this.data.actionContent;
    
    console.log('Submit action:', { id, action, content });
    
    if (!content || !content.trim()) {
      wx.showToast({ title: action === 'reply' ? '请输入回复内容' : '请输入驳回原因', icon: 'none' });
      return;
    }

    wx.showLoading({ title: action === 'reply' ? '回复中...' : '驳回中...' });

    // 调用实际API
    const apiPromise = action === 'reply' ? replyFeedback(id, content) : rejectFeedback(id, content);
    
    console.log('API promise created:', apiPromise);
    
    apiPromise.then(res => {
      wx.hideLoading();
      if (res.success) {
        // 重新加载反馈列表，确保数据与后端同步
        this.loadFeedbacks();
        
        this.setData({
          showInput: false,
          currentFeedbackId: null,
          actionContent: ''
        });
        
        wx.showToast({ title: action === 'reply' ? '回复成功' : '驳回成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || (action === 'reply' ? '回复失败' : '驳回失败'), icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(action === 'reply' ? '回复反馈失败:' : '驳回反馈失败:', err);
      const errorMsg = err.message || err.error || '网络错误';
      wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
    });
  },

  // 切换操作内容展开/收起
  toggleActionContent: function (e) {
    const id = e.currentTarget.dataset.id;
    const feedbacks = [...this.data.feedbacks];
    const index = feedbacks.findIndex(item => item.id === id);
    if (index > -1) {
      feedbacks[index].showFullContent = !feedbacks[index].showFullContent;
      this.setData({ feedbacks: feedbacks });
    }
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

    wx.showLoading({ title: '删除中...' });

    batchDeleteAdminFeedbacks(selectedIds)
      .then((res) => {
        wx.hideLoading();
        if (res && res.success) {
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.setData({
            showBatchModal: false,
            selectedFeedbacks: [],
            selectAll: false,
            currentPage: 1
          });
          this.loadFeedbacks();
        } else {
          wx.showToast({ title: (res && res.message) || '删除失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('批量删除反馈失败:', err);
        wx.showToast({ title: err.message || '网络错误', icon: 'none' });
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