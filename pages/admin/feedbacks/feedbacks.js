const { getAdminFeedbackList, replyFeedback, rejectFeedback } = require('../../../utils/api');

// 格式化时间函数
function formatTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  // 格式化日期为 YYYY-MM-DD HH:MM
  return date.toISOString().slice(0, 16).replace('T', ' ');
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

  onLoad: function () {
    this.checkLoginStatus();
    this.loadFeedbacks();
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
    let statusNum = null;
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
        const feedbacks = res.data.feedbacks.map(item => ({
          id: item.id,
          userId: item.user_id,
          userName: item.user_name,
          type: item.type === 1 ? 'order' : item.type === 2 ? 'merchant' : 'platform',
          content: item.content,
          rating: item.rating,
          status: item.status === 0 ? 'pending' : item.status === 1 ? 'replied' : 'rejected',
          actionContent: item.reply || item.reject_reason || '',
          showFullContent: false,
          currentAction: '',
          createdAt: item.created_at,
          formattedTime: formatTime(item.created_at)
        }));
        
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
      url: `/pages/admin/feedbacks/detail?id=${id}`,
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
    const action = this.data.selectedBatchAction;
    const selectedIds = this.data.selectedFeedbacks;
    
    wx.showLoading({ title: '处理中...' });
    
    // 模拟批量处理操作
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '处理成功', icon: 'success' });
      this.setData({
        showBatchModal: false,
        selectedFeedbacks: [],
        selectAll: false
      });
      this.loadFeedbacks();
    }, 1000);
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