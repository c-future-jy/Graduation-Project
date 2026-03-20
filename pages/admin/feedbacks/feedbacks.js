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
    showReplyModal: false,
    currentFeedback: null,
    replyContent: '',
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
      { value: 'replied', label: '已回复' }
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
    // 模拟API调用
    const mockFeedbacks = [
      {
        id: 1,
        userId: 101,
        userName: '张三',
        type: 'order',
        content: '订单配送太慢了，等了两个小时才送到',
        rating: 2,
        status: 'pending',
        createdAt: '2024-01-15 10:30:00'
      },
      {
        id: 2,
        userId: 102,
        userName: '李四',
        type: 'merchant',
        content: '商家服务态度很好，食物也很美味',
        rating: 5,
        status: 'replied',
        createdAt: '2024-01-15 09:15:00'
      },
      {
        id: 3,
        userId: 103,
        userName: '王五',
        type: 'platform',
        content: '希望平台能增加更多的商家选择',
        rating: 3,
        status: 'processing',
        createdAt: '2024-01-14 16:45:00'
      },
      {
        id: 4,
        userId: 104,
        userName: '赵六',
        type: 'order',
        content: '订单商品与描述不符，失望',
        rating: 1,
        status: 'pending',
        createdAt: '2024-01-14 14:20:00'
      },
      {
        id: 5,
        userId: 105,
        userName: '孙七',
        type: 'merchant',
        content: '商家环境干净整洁，服务周到',
        rating: 4,
        status: 'replied',
        createdAt: '2024-01-13 11:10:00'
      }
    ];

    this.setData({
      feedbacks: mockFeedbacks,
      totalPages: 1
    });
  },

  bindSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  searchFeedbacks: function () {
    // 模拟搜索功能
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
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/feedbacks/detail?id=${id}`
    });
  },

  replyFeedback: function (e) {
    const id = e.currentTarget.dataset.id;
    const feedback = this.data.feedbacks.find(item => item.id === id);
    this.setData({
      currentFeedback: feedback,
      showReplyModal: true,
      replyContent: ''
    });
  },

  bindReplyContent: function (e) {
    this.setData({
      replyContent: e.detail.value
    });
  },

  confirmReply: function () {
    if (!this.data.replyContent.trim()) {
      wx.showToast({
        title: '请输入回复内容',
        icon: 'none'
      });
      return;
    }

    // 模拟回复操作
    const updatedFeedbacks = this.data.feedbacks.map(item => {
      if (item.id === this.data.currentFeedback.id) {
        return { ...item, status: 'replied' };
      }
      return item;
    });

    this.setData({
      feedbacks: updatedFeedbacks,
      showReplyModal: false,
      currentFeedback: null,
      replyContent: ''
    });

    wx.showToast({
      title: '回复成功',
      icon: 'success'
    });
  },

  cancelReply: function () {
    this.setData({
      showReplyModal: false,
      currentFeedback: null,
      replyContent: ''
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
      default:
        return '#999';
    }
  },

  getStatusText: function (status) {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'processing':
        return '处理中';
      case 'replied':
        return '已回复';
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