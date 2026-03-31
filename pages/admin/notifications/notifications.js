const {
  getAdminNotificationList,
  createAdminNotification,
  markAdminNotificationAsRead,
  deleteAdminNotification,
  batchDeleteAdminNotifications,
  batchMarkAdminNotificationsAsRead
} = require('../../../utils/api');

const DEBUG = false;

Page({
  data: {
    notifications: [],
    searchKeyword: '',
    selectedType: 0,
    selectedReadStatus: 0,
    startDate: '',
    endDate: '',
    dateRangeText: '',
    selectedNotifications: [],
    selectAll: false,
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    showPublishModal: false,
    showDatePickerModal: false,
    loading: false,
    progressAngle: 0,
    readStats: {
      total: 0,
      readCount: 0,
      unreadCount: 0,
      readRate: '0%'
    },
    hasActiveFilters: false,
    publishForm: {
      title: '',
      content: '',
      type: 'system',
      typeText: '系统公告',
      receiveScope: 'all',
      receiveScopeText: '全体用户'
    },
    notificationTypes: [
      { value: '', label: '全部类型' },
      { value: 'system', label: '系统公告' },
      { value: 'order', label: '订单' },
      { value: 'merchant', label: '商家' },
      { value: 'platform', label: '平台' },
      { value: 'activity', label: '活动提醒' },
      { value: 'feedback', label: '反馈' }
    ],
    readStatuses: [
      { value: '', label: '全部状态' },
      { value: '1', label: '已读' },
      { value: '0', label: '未读' }
    ],
    receiveScopes: [
      { value: 'all', label: '全体用户' },
      { value: 'student', label: '学生' },
      { value: 'merchant', label: '商家' }
    ]
  },

  _showLoading: function (title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next === 1) {
      wx.showLoading({
        title: title || '处理中...',
        success: () => {
          this._loadingShown = true;
        },
        fail: () => {
          // showLoading 可能因环境/调用时机失败；不应在未展示时强行 hide
          this._loadingShown = false;
        }
      });
    }
  },

  _hideLoading: function () {
    const current = this._loadingCount || 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);
    this._loadingCount = next;
    if (next === 0) {
      if (!this._loadingShown) return;
      wx.hideLoading({
        complete: () => {
          this._loadingShown = false;
        }
      });
    }
  },

  onLoad: function (options) {
    this._loadingCount = 0;
    this._loadingShown = false;
    this.checkLoginStatus();
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '通知管理' });
    // 从本地存储恢复筛选条件
    this.restoreFilterConditions();
    // 计算活跃筛选条件和日期范围文本
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.loadNotifications();
  },

  onUnload: function () {
    // 页面卸载时重置，避免计数残留导致后续 hide 触发警告
    this._loadingCount = 0;
    this._loadingShown = false;
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },
  
  // 保存筛选条件到本地存储
  saveFilterConditions: function () {
    const filterConditions = {
      searchKeyword: this.data.searchKeyword,
      selectedType: this.data.selectedType,
      selectedReadStatus: this.data.selectedReadStatus,
      startDate: this.data.startDate,
      endDate: this.data.endDate
    };
    wx.setStorageSync('notificationFilterConditions', filterConditions);
  },
  
  // 从本地存储恢复筛选条件
  restoreFilterConditions: function () {
    const savedConditions = wx.getStorageSync('notificationFilterConditions');
    if (savedConditions) {
      this.setData({
        searchKeyword: savedConditions.searchKeyword || '',
        selectedType: savedConditions.selectedType || 0,
        selectedReadStatus: savedConditions.selectedReadStatus || 0,
        startDate: savedConditions.startDate || '',
        endDate: savedConditions.endDate || ''
      });
      this.updateActiveFilters();
    }
  },
  
  // 更新活跃筛选条件状态
  updateActiveFilters: function () {
    const { searchKeyword, selectedType, selectedReadStatus, startDate, endDate } = this.data;
    const hasActiveFilters = searchKeyword !== '' || 
                           selectedType !== 0 || 
                           selectedReadStatus !== 0 || 
                           startDate !== '' || 
                           endDate !== '';
    this.setData({ hasActiveFilters });
  },
  
  // 更新日期范围文本
  updateDateRangeText: function () {
    const { startDate, endDate } = this.data;
    let dateRangeText = '';
    
    if (startDate && endDate) {
      dateRangeText = `${startDate} ~ ${endDate}`;
    } else if (startDate) {
      dateRangeText = `${startDate} ~ 至今`;
    } else if (endDate) {
      dateRangeText = `开始 ~ ${endDate}`;
    } else {
      dateRangeText = '';
    }
    
    this.setData({ dateRangeText });
  },

  checkLoginStatus: function () {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    // Role 3 represents admin role
    if (!token || !userInfo || userInfo.role !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  loadNotifications: async function () {
    this.setData({ loading: true });
    
    try {
      // 调用真实API获取数据
      const params = {
        page: this.data.currentPage,
        pageSize: this.data.pageSize,
        type: this.data.notificationTypes[this.data.selectedType].value,
        keyword: this.data.searchKeyword,
        is_read: this.data.readStatuses[this.data.selectedReadStatus].value,
        startTime: this.data.startDate,
        endTime: this.data.endDate
      };
      
      if (DEBUG) console.log('Loading notifications with params:', params);
      const res = await getAdminNotificationList(params);
      
      if (res && res.data) {
        // 打印完整 API 响应
        if (DEBUG) console.log('Full API response:', res);
        
        // 打印通知数据以验证字段
        if (DEBUG) console.log('Notification data from API:', res.data.notifications);
        
        let notifications = [];
        if (res.data.notifications && Array.isArray(res.data.notifications)) {
          notifications = res.data.notifications.map((notification, index) => {
            if (DEBUG) console.log(`Notification ${index} raw data:`, notification);
            // 检查所有可能的字段名
            const type =
              (notification.type ??
                notification.notification_type ??
                notification.type_id ??
                notification.Type ??
                notification.TYPE) ??
              '';
            const sendTime = notification.created_at || notification.send_time || notification.time || notification.createdAt || notification.SendTime || notification.sent_time || '';
            // 计算未读数量（后端 read_count/total_count 可能缺失或不可靠，这里做兜底）
            const isReadRaw = notification.is_read ?? notification.isRead;
            const isRead = String(isReadRaw) === '1' || isReadRaw === 1 || isReadRaw === true;
            const readCount = (notification.read_count ?? notification.readCount);
            const totalCount = (notification.total_count ?? notification.totalCount);
            const normalizedReadCount = readCount !== undefined && readCount !== null
              ? Number(readCount)
              : (isRead ? 1 : 0);
            const normalizedTotalCount = totalCount !== undefined && totalCount !== null
              ? Number(totalCount)
              : 1;
            const unreadCount = Math.max(0, normalizedTotalCount - normalizedReadCount);
            if (DEBUG) {
              console.log(
                `Extracted type: ${type}, sendTime: ${sendTime}, readCount: ${readCount}, unreadCount: ${unreadCount}`
              );
            }
            return {
              id: notification.id,
              title: notification.title || '无标题',
              type: type,
              isRead,
              receiveScope: 'all', // 默认为全体成员
              sendTime: sendTime,
              readCount: normalizedReadCount,
              unreadCount: unreadCount,
              formattedType: notification.formattedType
            };
          });
        } else {
          console.log('No notifications data found or not an array');
          notifications = [];
        }
        
        // Preprocess notifications to include formatted type and time
        notifications = notifications.map((item, index) => {
          if (DEBUG) console.log(`Notification ${index} before fix:`, item);
          const fixedItem = {
            ...item,
            type: item.type || '',
            sendTime: item.sendTime || '',
            formattedType: item.formattedType || this.getTypeText(item.type || ''),
            formattedTime: this.formatDateTime(item.sendTime || '')
          };
          if (DEBUG) {
            console.log(`Notification ${index} after fix:`, fixedItem);
            console.log(
              `Formatted type: ${fixedItem.formattedType}, Formatted time: ${fixedItem.formattedTime}`
            );
          }
          return fixedItem;
        });
        
        // 打印处理后的数据
        if (DEBUG) console.log('Processed notifications:', notifications);
        
        // 测试格式化函数
        if (DEBUG && notifications.length > 0) {
          console.log('Testing formatDateTime with:', notifications[0].sendTime);
          console.log('Formatted result:', this.formatDateTime(notifications[0].sendTime));
          console.log('Testing getTypeText with:', notifications[0].type);
          console.log('Type text result:', this.getTypeText(notifications[0].type));
        }
        
        const readStats = res.data.readStats || {
          total: 0,
          readCount: 0,
          unreadCount: 0,
          readRate: '0%'
        };
        
        // 计算已读率的旋转角度
        const readRateValue = readStats.readRate ? parseFloat(readStats.readRate) : 0;
        const progressAngle = (readRateValue / 100) * 360;
        
        // 确保分页数据有兜底值
        const total = res.data.pagination?.total || 0;
        const totalPages = Math.ceil(total / this.data.pageSize);
        
        // 打印即将设置的数据结构
        console.log('Data to be set:', {
          notifications: notifications,
          totalPages: totalPages,
          readStats: readStats,
          progressAngle: progressAngle
        });
        
        this.setData({
          notifications: notifications,
          totalPages: totalPages,
          readStats: readStats,
          progressAngle: progressAngle
        });
        
        // 操作结果提示
        if (notifications.length > 0) {
          wx.showToast({
            title: `已筛选出 ${notifications.length} 条通知`,
            icon: 'success',
            duration: 2000
          });
        } else {
          wx.showToast({
            title: '未找到匹配的通知',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        if (DEBUG) console.log('Invalid API response:', res);
        wx.showToast({ title: '加载失败：无效的响应', icon: 'none' });
      }
    } catch (error) {
      console.error('加载通知列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({
        notifications: [],
        totalPages: 1,
        readStats: {
          total: 0,
          readCount: 0,
          unreadCount: 0,
          readRate: '0%'
        },
        progressAngle: 0
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 搜索输入防抖计时器
  searchTimeout: null,

  bindSearchInput: function (e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
    
    // 清除之前的计时器
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // 设置新的计时器，300ms后更新状态和保存
    this.searchTimeout = setTimeout(() => {
      this.updateActiveFilters();
      this.saveFilterConditions();
    }, 300);
  },

  searchNotifications: function () {
    this.setData({ currentPage: 1 });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  bindTypeChange: function (e) {
    this.setData({
      selectedType: e.detail.value,
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  bindReadStatusChange: function (e) {
    this.setData({
      selectedReadStatus: e.detail.value,
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  bindStartDateChange: function (e) {
    const startDate = e.detail.value;
    let endDate = this.data.endDate;
    
    // 智能默认值设置：仅选择开始日期时，结束日期自动设为今天
    if (!endDate) {
      endDate = new Date().toISOString().split('T')[0];
    }
    
    // 日期有效性校验：确保开始日期不晚于结束日期
    if (startDate > endDate) {
      wx.showToast({
        title: '开始日期不能晚于结束日期',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({
      startDate: startDate,
      endDate: endDate
    });
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
  },

  bindEndDateChange: function (e) {
    const endDate = e.detail.value;
    let startDate = this.data.startDate;
    
    // 智能默认值设置：仅选择结束日期时，开始日期自动设为最早可选择时间
    if (!startDate) {
      startDate = '2020-01-01'; // Default earliest date
    }
    
    // 日期有效性校验：确保结束日期不早于开始日期
    if (endDate < startDate) {
      wx.showToast({
        title: '结束日期不能早于开始日期',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    this.setData({
      startDate: startDate,
      endDate: endDate
    });
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
  },



  resetFilters: function () {
    this.setData({
      searchKeyword: '',
      selectedType: 0,
      selectedReadStatus: 0,
      startDate: '',
      endDate: '',
      currentPage: 1
    });
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  filterByType: function () {
    this.setData({
      selectedType: 0,
      selectedReadStatus: 0,
      startDate: '',
      endDate: '',
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  filterByUnread: function () {
    // Find the index of unread status dynamically instead of hardcoding
    const unreadIndex = this.data.readStatuses.findIndex(item => item.value === '0');
    this.setData({
      selectedReadStatus: unreadIndex > -1 ? unreadIndex : 0,
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  // 添加已读通知的筛选功能
  filterByRead: function () {
    // Find the index of read status dynamically instead of hardcoding
    const readIndex = this.data.readStatuses.findIndex(item => item.value === '1');
    this.setData({
      selectedReadStatus: readIndex > -1 ? readIndex : 0,
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
  },

  // 打开日期选择弹窗
  openDatePickerModal: function () {
    this.setData({ showDatePickerModal: true });
  },

  // 关闭日期选择弹窗
  closeDatePickerModal: function () {
    this.setData({ showDatePickerModal: false });
  },

  // 确认日期范围选择
  confirmDateRange: function () {
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.setData({ showDatePickerModal: false });
    this.loadNotifications();
  },

  // 获取当前日期（时区无关）
  getCurrentDate: function () {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 设置日期范围
  setDateRange: function (days) {
    const endDate = this.getCurrentDate();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const startDateStr = `${year}-${month}-${day}`;

    this.setData({
      startDate: startDateStr,
      endDate: endDate
    });
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.setData({ showDatePickerModal: false });
    this.loadNotifications();
  },

  // 清除日期范围
  clearDateRange: function () {
    this.setData({
      startDate: '',
      endDate: ''
    });
    this.updateDateRangeText();
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.setData({ showDatePickerModal: false });
    this.loadNotifications();
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

  batchDelete: function () {
    const { selectedNotifications } = this.data;
    if (selectedNotifications.length === 0) {
      wx.showToast({ title: '请选择要删除的通知', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedNotifications.length} 条通知吗？此操作不可恢复。`,
      success: (res) => {
        if (res.confirm) {
          this._showLoading('删除中...');
          batchDeleteAdminNotifications(selectedNotifications)
            .then(() => {
              this.setData({
                selectedNotifications: [],
                selectAll: false,
                currentPage: 1
              });
              return this.loadNotifications();
            })
            .then(() => {
              wx.showToast({ title: '删除成功', icon: 'success' });
            })
            .catch((err) => {
              console.error('批量删除失败:', err);
              wx.showToast({ title: err?.message || '删除失败', icon: 'none' });
            })
            .finally(() => {
              this._hideLoading();
            });
        }
      }
    });
  },

  batchMarkAsRead: function () {
    const { selectedNotifications } = this.data;
    if (selectedNotifications.length === 0) {
      wx.showToast({ title: '请选择要标记已读的通知', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '批量标记已读',
      content: `确定要将选中的 ${selectedNotifications.length} 条通知标记为已读吗？`,
      success: (res) => {
        if (res.confirm) {
          this._showLoading('处理中...');
          batchMarkAdminNotificationsAsRead(selectedNotifications)
            .then((resp) => {
              wx.showToast({ title: resp?.message || '标记成功', icon: 'success' });
              this.setData({
                selectedNotifications: [],
                selectAll: false
              });
              return this.loadNotifications();
            })
            .catch((err) => {
              console.error('批量标记已读失败:', err);
              wx.showToast({ title: err?.message || '标记失败', icon: 'none' });
            })
            .finally(() => {
              this._hideLoading();
            });
        }
      }
    });
  },

  markAsRead: function (e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    wx.showModal({
      title: '标记已读',
      content: '确定将该通知标记为已读吗？',
      success: (res) => {
        if (!res.confirm) return;
        this._showLoading('处理中...');
        markAdminNotificationAsRead(id)
          .then((resp) => {
            wx.showToast({ title: resp?.message || '已标记', icon: 'success' });
            return this.loadNotifications();
          })
          .catch((err) => {
            console.error('标记已读失败:', err);
            wx.showToast({ title: err?.message || '标记失败', icon: 'none' });
          })
          .finally(() => {
            this._hideLoading();
          });
      }
    });
  },



  deleteNotification: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条通知吗？',
      success: (res) => {
        if (res.confirm) {
          this._showLoading('删除中...');
          deleteAdminNotification(id)
            .then(() => this.loadNotifications())
            .then(() => {
              wx.showToast({ title: '删除成功', icon: 'success' });
            })
            .catch((err) => {
              console.error('删除通知失败:', err);
              wx.showToast({ title: err?.message || '删除失败', icon: 'none' });
            })
            .finally(() => {
              this._hideLoading();
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
        typeText: '系统公告',
        receiveScope: 'all',
        receiveScopeText: '全体用户'
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
    const selectedIndex = e.detail.value;
    this.setData({
      'publishForm.type': this.data.notificationTypes[selectedIndex].value,
      'publishForm.typeText': this.data.notificationTypes[selectedIndex].label
    });
  },

  bindScopeChange: function (e) {
    const selectedIndex = e.detail.value;
    this.setData({
      'publishForm.receiveScope': this.data.receiveScopes[selectedIndex].value,
      'publishForm.receiveScopeText': this.data.receiveScopes[selectedIndex].label
    });
  },



  publishNotification: function () {
    const { title, content, type, receiveScope } = this.data.publishForm;
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

    if (!type) {
      wx.showToast({ title: '请选择通知类型', icon: 'none' });
      return;
    }

    // 兼容后端的 receive_scope/role_ids 设计
    let receive_scope = 'all_users';
    let role_ids = undefined;
    if (receiveScope === 'student') {
      receive_scope = 'specific_roles';
      role_ids = [1];
    } else if (receiveScope === 'merchant') {
      receive_scope = 'specific_roles';
      role_ids = [2];
    }

    this._showLoading('发布中...');
    createAdminNotification({
      title: title.trim(),
      content: content.trim(),
      type,
      receive_scope,
      role_ids
    })
      .then((res) => {
        this.setData({
          showPublishModal: false,
          currentPage: 1
        });
        wx.showToast({
          title: res?.message || '发布成功',
          icon: 'success'
        });
        return this.loadNotifications();
      })
      .catch((err) => {
        console.error('发布通知失败:', err);
        wx.showToast({ title: err?.message || '发布失败', icon: 'none' });
      })
      .finally(() => {
        this._hideLoading();
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
    // 同时兼容后端返回数字 type（tinyint）与历史字符串 type
    const typeStr = type === undefined || type === null ? '' : String(type).trim();
    const code = /^\d+$/.test(typeStr) ? Number(typeStr) : null;

    // 后端约定：1反馈 2系统 3订单 4商家 5平台 6活动
    switch (code) {
      case 3:
        return '#1890ff';
      case 2:
        return '#52c41a';
      case 6:
        return '#fa8c16';
      case 1:
        return '#722ed1';
      case 4:
        return '#13c2c2';
      case 5:
        return '#2f54eb';
      default:
        break;
    }

    switch (typeStr.toLowerCase()) {
      case 'order':
        return '#1890ff';
      case 'system':
        return '#52c41a';
      case 'activity':
        return '#fa8c16';
      case 'feedback':
        return '#722ed1';
      case 'merchant':
        return '#13c2c2';
      case 'platform':
        return '#2f54eb';
      default:
        return '#999';
    }
  },

  getTypeText: function (type) {
    if (type === '' || type === null || type === undefined) return '未知类型';

    const typeStr = String(type).trim();

    // 数字优先（后端 tinyint）
    if (/^\d+$/.test(typeStr)) {
      switch (Number(typeStr)) {
        case 1:
          return '反馈';
        case 2:
          return '系统公告';
        case 3:
          return '订单';
        case 4:
          return '商家';
        case 5:
          return '平台';
        case 6:
          return '活动提醒';
        default:
          return '未知类型';
      }
    }

    // 字符串兼容
    switch (typeStr.toLowerCase()) {
      case 'feedback':
        return '反馈';
      case 'system':
        return '系统公告';
      case 'order':
        return '订单';
      case 'merchant':
        return '商家';
      case 'platform':
        return '平台';
      case 'activity':
        return '活动提醒';
      default:
        return '未知类型';
    }
  },

  getScopeText: function (scope) {
    // 确保scope是字符串
    const scopeStr = String(scope || 'all');
    switch (scopeStr) {
      case 'all':
      case 'all_users':
        return '全体成员';
      case 'student':
        return '学生';
      case 'merchant':
        return '商家';
      case 'admin':
        return '管理员';
      default:
        return '全体成员';
    }
  },

  // 格式化日期为 YYYY-MM-DD 格式
  formatDate: function (dateString) {
    if (!dateString) return '';
    // 确保日期字符串是正确的格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '无效日期';
    // 格式化为 YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 格式化日期时间为 YYYY-MM-DD HH:MM 格式
  formatDateTime: function (dateString) {
    if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
      return '未设置';
    }
    // 确保日期字符串是正确的格式
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '无效日期';
    // 格式化为 YYYY-MM-DD HH:MM
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  
});