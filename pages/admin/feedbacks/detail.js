const { getAdminFeedbackDetail, replyFeedback, rejectFeedback } = require('../../../utils/api');

Page({
  data: {
    feedback: null,
    loading: true,
    showInput: false,
    currentAction: '',
    actionContent: ''
  },

  onLoad: function (options) {
    const id = options.id;
    if (id) {
      this.loadFeedbackDetail(id);
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack();
    }
  },

  loadFeedbackDetail: function (id) {
    wx.showLoading({ title: '加载中...' });
    
    getAdminFeedbackDetail(id).then(res => {
      wx.hideLoading();
      if (res.success) {
        // 转换数据格式，适配前端显示
        const feedback = {
          id: res.data.feedback.id,
          userId: res.data.feedback.user_id,
          userName: res.data.feedback.user_name,
          type: res.data.feedback.type === 1 ? 'order' : res.data.feedback.type === 2 ? 'merchant' : 'platform',
          content: res.data.feedback.content,
          rating: res.data.feedback.rating,
          status: res.data.feedback.status === 0 ? 'pending' : res.data.feedback.status === 1 ? 'replied' : 'rejected',
          actionContent: res.data.feedback.reply || res.data.feedback.reject_reason || '',
          showFullContent: false,
          replyTime: res.data.feedback.reply_time,
          createdAt: res.data.feedback.created_at
        };
        
        this.setData({
          feedback: feedback,
          loading: false
        });
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
        wx.navigateBack();
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('加载反馈详情失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
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

  goBack: function () {
    wx.navigateBack();
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
    const content = this.data.actionContent;
    const feedback = this.data.feedback;
    
    if (!content.trim()) {
      wx.showToast({ title: action === 'reply' ? '请输入回复内容' : '请输入驳回原因', icon: 'none' });
      return;
    }

    wx.showLoading({ title: action === 'reply' ? '回复中...' : '驳回中...' });

    // 调用实际API
    const apiPromise = action === 'reply' ? replyFeedback(feedback.id, content) : rejectFeedback(feedback.id, content);
    
    apiPromise.then(res => {
      wx.hideLoading();
      if (res.success) {
        // 重新加载反馈详情，确保数据与后端同步
        this.loadFeedbackDetail(feedback.id);
        
        this.setData({
          showInput: false,
          currentAction: '',
          actionContent: ''
        });
        
        wx.showToast({ title: action === 'reply' ? '回复成功' : '驳回成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || (action === 'reply' ? '回复失败' : '驳回失败'), icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error(action === 'reply' ? '回复反馈失败:' : '驳回反馈失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 切换操作内容展开/收起
  toggleActionContent: function () {
    const feedback = this.data.feedback;
    const updatedFeedback = {
      ...feedback,
      showFullContent: !feedback.showFullContent
    };
    
    this.setData({ feedback: updatedFeedback });
  }
});
