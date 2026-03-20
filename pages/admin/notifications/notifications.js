Page({
  data: {
    notifications: [],
    searchKeyword: '',
    selectedType: 0,
    selectedNotifications: [],
    selectAll: false,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    showPublishModal: false,
    publishForm: {
      title: '',
      content: '',
      type: 'system',
      receiveScope: 'all',
      scheduledTime: ''
    },
    notificationTypes: [
      { value: '', label: '全部类型' },
      { value: 'order', label: '订单通知' },
      { value: 'system', label: '系统公告' },
      { value: 'activity', label: '活动提醒' }
    ],
    receiveScopes: [
      { value: 'all', label: '全体用户' },
      { value: 'student', label: '学生' },
      { value: 'merchant', label: '商家' },
      { value: 'admin', label: '管理员' }
    ]
  },

  onLoad: function () {
    this.checkLoginStatus();
    this.loadNotifications();
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

  loadNotifications: function () {
    // 模拟API调用
    const mockNotifications = [
      {
        id: 1,
        title: '系统维护通知',
        type: 'system',
        receiveScope: 'all',
        sendTime: '2024-01-15 08:00:00',
        readCount: 120,
        unreadCount: 30
      },
      {
        id: 2,
        title: '新年活动公告',
        type: 'activity',
        receiveScope: 'all',
        sendTime: '2024-01-14 10:30:00',
        readCount: 250,
        unreadCount: 15
      },
      {
        id: 3,
        title: '订单状态更新通知',
        type: 'order',
        receiveScope: 'student',
        sendTime: '2024-01-14 09:15:00',
        readCount: 80,
        unreadCount: 10
      },
      {
        id: 4,
        title: '商家入驻指南',
        type: 'system',
        receiveScope: 'merchant',
        sendTime: '2024-01-13 14:45:00',
        readCount: 45,
        unreadCount: 5
      },
      {
        id: 5,
        title: '平台功能更新',
        type: 'system',
        receiveScope: 'all',
        sendTime: '2024-01-12 16:20:00',
        readCount: 300,
        unreadCount: 5
      }
    ];

    this.setData({
      notifications: mockNotifications,
      totalPages: 1
    });
  },

  bindSearchInput: function (e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  searchNotifications: function () {
    // 模拟搜索功能
    this.loadNotifications();
  },

  bindTypeChange: function (e) {
    this.setData({
      selectedType: e.detail.value
    });
  },

  toggleSelectAll: function (e) {
    const selectAll = e.detail.value.length > 0;
    const selectedNotifications = selectAll ? this.data.notifications.map(item => item.id) : [];
    this.setData({
      selectAll,
      selectedNotifications
    });
  },

  toggleNotificationSelection: function (e) {
    const id = e.currentTarget.dataset.id;
    const selectedNotifications = [...this.data.selectedNotifications];
    const index = selectedNotifications.indexOf(id);
    if (index > -1) {
      selectedNotifications.splice(index, 1);
    } else {
      selectedNotifications.push(id);
    }
    this.setData({
      selectedNotifications,
      selectAll: selectedNotifications.length === this.data.notifications.length
    });
  },

  clearSelection: function () {
    this.setData({
      selectedNotifications: [],
      selectAll: false
    });
  },

  viewNotificationDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/notifications/detail?id=${id}`
    });
  },

  deleteNotification: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条通知吗？',
      success: (res) => {
        if (res.confirm) {
          // 模拟删除操作
          const updatedNotifications = this.data.notifications.filter(item => item.id !== id);
          this.setData({
            notifications: updatedNotifications
          });
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  showPublishModal: function () {
    this.setData({
      showPublishModal: true,
      publishForm: {
        title: '',
        content: '',
        type: 'system',
        receiveScope: 'all',
        scheduledTime: ''
      }
    });
  },

  bindPublishFormInput: function (e) {
    const { field } = e.currentTarget.dataset;
    this.setData({
      [`publishForm.${field}`]: e.detail.value
    });
  },

  bindTypeChangePublish: function (e) {
    this.setData({
      'publishForm.type': this.data.notificationTypes[e.detail.value].value
    });
  },

  bindScopeChange: function (e) {
    this.setData({
      'publishForm.receiveScope': this.data.receiveScopes[e.detail.value].value
    });
  },

  bindScheduledTimeChange: function (e) {
    this.setData({
      'publishForm.scheduledTime': e.detail.value
    });
  },

  publishNotification: function () {
    const { title, content } = this.data.publishForm;
    if (!title.trim()) {
      wx.showToast({
        title: '请输入通知标题',
        icon: 'none'
      });
      return;
    }
    if (!content.trim()) {
      wx.showToast({
        title: '请输入通知内容',
        icon: 'none'
      });
      return;
    }

    // 模拟发布操作
    const newNotification = {
      id: this.data.notifications.length + 1,
      title: title,
      type: this.data.publishForm.type,
      receiveScope: this.data.publishForm.receiveScope,
      sendTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
      readCount: 0,
      unreadCount: 0
    };

    this.setData({
      notifications: [newNotification, ...this.data.notifications],
      showPublishModal: false
    });

    wx.showToast({
      title: '发布成功',
      icon: 'success'
    });
  },

  cancelPublish: function () {
    this.setData({
      showPublishModal: false
    });
  },

  prevPage: function () {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      });
      this.loadNotifications();
    }
  },

  nextPage: function () {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      });
      this.loadNotifications();
    }
  },

  getTypeColor: function (type) {
    switch (type) {
      case 'order':
        return '#1890ff';
      case 'system':
        return '#52c41a';
      case 'activity':
        return '#fa8c16';
      default:
        return '#999';
    }
  },

  getTypeText: function (type) {
    switch (type) {
      case 'order':
        return '订单通知';
      case 'system':
        return '系统公告';
      case 'activity':
        return '活动提醒';
      default:
        return '未知';
    }
  },

  getScopeText: function (scope) {
    switch (scope) {
      case 'all':
        return '全体用户';
      case 'student':
        return '学生';
      case 'merchant':
        return '商家';
      case 'admin':
        return '管理员';
      default:
        return '未知';
    }
  }
});