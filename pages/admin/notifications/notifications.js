const {
  getAdminNotificationList,
  createAdminNotification,
  markAdminNotificationAsRead,
  deleteAdminNotification,
  batchDeleteAdminNotifications,
  batchMarkAdminNotificationsAsRead
} = require('../../../utils/api');

const DEBUG = false;

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
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

const PROGRESS_RADIUS = 36;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

function normalizeIsRead(value) {
  return String(value) === '1' || value === 1 || value === true;
}

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
    selectedMap: {},
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    showPublishModal: false,
    showDatePickerModal: false,
    loading: false,
    progressCircumference: PROGRESS_CIRCUMFERENCE,
    progressDashOffset: PROGRESS_CIRCUMFERENCE,
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
        const rawList = Array.isArray(res.data.notifications) ? res.data.notifications : [];
        const notifications = rawList.map((notification) => {
          const type =
            (notification.type ??
              notification.notification_type ??
              notification.type_id ??
              notification.Type ??
              notification.TYPE) ??
            '';
          const sendTime =
            notification.created_at ||
            notification.send_time ||
            notification.time ||
            notification.createdAt ||
            notification.SendTime ||
            notification.sent_time ||
            '';

          const isReadRaw = notification.is_read ?? notification.isRead;
          const isRead = normalizeIsRead(isReadRaw);
          const readCount = (notification.read_count ?? notification.readCount);
          const totalCount = (notification.total_count ?? notification.totalCount);
          const normalizedReadCount = readCount !== undefined && readCount !== null
            ? Number(readCount)
            : (isRead ? 1 : 0);
          const normalizedTotalCount = totalCount !== undefined && totalCount !== null
            ? Number(totalCount)
            : 1;
          const unreadCount = Math.max(0, normalizedTotalCount - normalizedReadCount);

          const typeStr = toStr(type, '');
          return {
            id: toInt(notification.id, 0),
            title: toStr(notification.title, '无标题'),
            type: typeStr,
            isRead,
            receiveScope: toStr(notification.receive_scope || notification.receiveScope, 'all'),
            sendTime: toStr(sendTime, ''),
            readCount: Number.isFinite(normalizedReadCount) ? normalizedReadCount : 0,
            unreadCount,
            formattedType: notification.formattedType || this.getTypeText(typeStr),
            formattedTime: this.formatDateTime(sendTime)
          };
        });
        
        const readStats = res.data.readStats || {
          total: 0,
          readCount: 0,
          unreadCount: 0,
          readRate: '0%'
        };
        
        const readRateValue = readStats.readRate ? parseFloat(readStats.readRate) : 0;
        const normalizedReadRate = Number.isFinite(readRateValue) ? readRateValue : 0;
        const progressDashOffset = PROGRESS_CIRCUMFERENCE * (1 - normalizedReadRate / 100);
        
        // 确保分页数据有兜底值
        const total = res.data.pagination?.total || 0;
        const totalPages = Math.ceil(total / this.data.pageSize);

        // 同步选择状态（仅保留当前页仍存在的 id）
        const exist = {};
        notifications.forEach((it) => {
          if (it && it.id) exist[it.id] = true;
        });
        const nextMap = {};
        (this.data.selectedNotifications || []).forEach((id) => {
          const key = toInt(id, 0);
          if (key && exist[key]) nextMap[key] = true;
        });
        const selectedNotifications = Object.keys(nextMap).map(k => toInt(k, 0)).filter(Boolean);
        const selectAll = notifications.length > 0 && selectedNotifications.length === notifications.length;

        this.setData({
          notifications: notifications,
          totalPages: totalPages,
          readStats: readStats,
          progressDashOffset,
          selectedMap: nextMap,
          selectedNotifications,
          selectAll
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
        progressDashOffset: PROGRESS_CIRCUMFERENCE,
        selectedMap: {},
        selectedNotifications: [],
        selectAll: false
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

  clearSearch: function () {
    this.setData({
      searchKeyword: '',
      currentPage: 1
    });
    this.updateActiveFilters();
    this.saveFilterConditions();
    this.loadNotifications();
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
    const ids = selectAll ? (this.data.notifications || []).map(item => item.id).filter(Boolean) : [];
    const map = {};
    ids.forEach((id) => {
      map[id] = true;
    });
    this.setData({
      selectAll,
      selectedNotifications: ids,
      selectedMap: map
    });
  },

  toggleNotificationSelection: function (e) {
    const id = toInt(e.currentTarget.dataset.id, 0);
    if (!id) return;

    const nextMap = { ...this.data.selectedMap };
    if (nextMap[id]) {
      delete nextMap[id];
    } else {
      nextMap[id] = true;
    }

    const selectedNotifications = Object.keys(nextMap).map(k => toInt(k, 0)).filter(Boolean);
    const selectAll = (this.data.notifications || []).length > 0 && selectedNotifications.length === (this.data.notifications || []).length;
    this.setData({
      selectedMap: nextMap,
      selectedNotifications,
      selectAll
    });
  },

  clearSelection: function () {
    this.setData({
      selectedNotifications: [],
      selectAll: false,
      selectedMap: {}
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

  // 格式化日期时间为 YYYY-MM-DD HH:MM 格式
  formatDateTime: function (dateString) {
    if (!dateString || dateString === '' || dateString === null || dateString === undefined) {
      return '未设置';
    }
    const date = toValidDate(dateString);
    if (!date) return '无效日期';
    // 格式化为 YYYY-MM-DD HH:MM
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    const hours = pad2(date.getHours());
    const minutes = pad2(date.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  
});