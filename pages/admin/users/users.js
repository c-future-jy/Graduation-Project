// pages/admin/users/users.js
const {
  getAdminUserList,
  getAdminUserDetail,
  updateAdminUserStatus,
  resetAdminUserPassword
} = require('../../../utils/api');

const ROLE_OPTIONS = [
  { id: '', label: '全部' },
  { id: '1', label: '学生' },
  { id: '2', label: '商家' },
  { id: '3', label: '管理员' }
];

const STATUS_OPTIONS = [
  { id: '', label: '全部' },
  { id: '1', label: '正常' },
  { id: '0', label: '禁用' }
];

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function toStr(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function toInt(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  return Number.isFinite(n) ? n : 0;
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    users: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: '',
    roleFilter: '',
    statusFilter: '',
    selectedUsers: [],
    selectedMap: {},

    roleOptions: ROLE_OPTIONS,
    statusOptions: STATUS_OPTIONS,
    roleIndex: 0,
    statusIndex: 0,
    roleLabel: '全部',
    statusLabel: '全部',

    // 详情弹窗
    detailVisible: false,
    detailLoading: false,
    detail: null
  },

  formatRole(role) {
    // 后端角色：1 学生、2 商家、3 管理员
    if (role === 3) return '管理员';
    if (role === 2) return '商家';
    return '学生';
  },

  formatStatus(status) {
    return status === 1 ? '正常' : '禁用';
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.reloadUsers();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!token || !userInfo || userInfo.role !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  buildQueryParams() {
    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize
    };
    if (isProvided(this.data.roleFilter)) params.role = this.data.roleFilter;
    if (isProvided(this.data.statusFilter)) params.status = this.data.statusFilter;
    const keyword = String(this.data.searchKeyword || '').trim();
    if (keyword) params.keyword = keyword;
    return params;
  },

  reloadUsers() {
    this.setData({
      page: 1,
      users: [],
      hasMore: true,
      selectedUsers: [],
      selectedMap: {}
    });
    this.loadUsers();
  },

  /**
   * 加载用户列表
   */
  async loadUsers() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      const res = await getAdminUserList(this.buildQueryParams());
      const list = (res && res.data && res.data.users) || [];

      const users = (Array.isArray(list) ? list : []).map(user => ({
        id: toStr(user.id),
        nickname: user.nickname,
        phone: user.phone,
        role: user.role,
        roleText: this.formatRole(user.role),
        status: user.status,
        statusText: user.status === 1 ? '正常' : '禁用',
        createdAt: user.created_at
      }));

      const total = (res && res.data && res.data.pagination && res.data.pagination.total) || 0;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      this.setData({
        users: this.data.page === 1 ? users : this.data.users.concat(users),
        total,
        hasMore
      });
    } catch (error) {
      console.error('加载用户列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 搜索关键词变化
   */
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索用户
   */
  searchUsers() {
    this.reloadUsers();
  },

  /**
   * 角色筛选变化
   */
  onRoleChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.roleOptions[index] || this.data.roleOptions[0];
    this.setData({
      roleIndex: index,
      roleFilter: option.id,
      roleLabel: option.label
    });
    this.reloadUsers();
  },

  /**
   * 状态筛选变化
   */
  onStatusChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.statusOptions[index] || this.data.statusOptions[0];
    this.setData({
      statusIndex: index,
      statusFilter: option.id,
      statusLabel: option.label
    });
    this.reloadUsers();
  },

  /**
   * 选择用户
   */
  selectUser(e) {
    const id = toStr(e.currentTarget.dataset.id);
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;

    const selectedMap = { ...this.data.selectedMap };
    let selectedUsers = Array.isArray(this.data.selectedUsers) ? [...this.data.selectedUsers] : [];

    if (checked) {
      selectedMap[id] = true;
      if (!selectedUsers.includes(id)) selectedUsers.push(id);
    } else {
      delete selectedMap[id];
      selectedUsers = selectedUsers.filter(x => toStr(x) !== id);
    }

    this.setData({ selectedMap, selectedUsers });
  },

  /**
   * 全选用户
   */
  selectAllUsers(e) {
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;
    if (!checked) {
      this.setData({ selectedUsers: [], selectedMap: {} });
      return;
    }

    const selectedUsers = this.data.users.map(u => toStr(u.id));
    const selectedMap = {};
    selectedUsers.forEach(id => {
      selectedMap[id] = true;
    });
    this.setData({ selectedUsers, selectedMap });
  },

  /**
   * 批量禁用用户
   */
  batchDisableUsers() {
    if (this.data.selectedUsers.length === 0) {
      wx.showToast({ title: '请选择要禁用的用户', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量禁用',
      content: `确定要禁用选中的 ${this.data.selectedUsers.length} 个用户吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = this.data.selectedUsers;
          for (const id of ids) {
            await updateAdminUserStatus(id, 0);
          }
          wx.showToast({ title: '禁用成功' });
          this.setData({ selectedUsers: [], selectedMap: {} });
          this.reloadUsers();
        } catch (error) {
          console.error('批量禁用失败:', error);
          wx.showToast({ title: error.message || '禁用失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  /**
   * 批量启用用户
   */
  batchEnableUsers() {
    if (this.data.selectedUsers.length === 0) {
      wx.showToast({ title: '请选择要启用的用户', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量启用',
      content: `确定要启用选中的 ${this.data.selectedUsers.length} 个用户吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = this.data.selectedUsers;
          for (const id of ids) {
            await updateAdminUserStatus(id, 1);
          }
          wx.showToast({ title: '启用成功' });
          this.setData({ selectedUsers: [], selectedMap: {} });
          this.reloadUsers();
        } catch (error) {
          console.error('批量启用失败:', error);
          wx.showToast({ title: error.message || '启用失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  /**
   * 批量导出用户
   */
  batchExportUsers() {
    if (this.data.selectedUsers.length === 0) {
      wx.showToast({ title: '请选择要导出的用户', icon: 'none' });
      return;
    }
    
    wx.showToast({ title: '暂未接入导出接口', icon: 'none' });
  },

  /**
   * 禁用/启用用户
   */
  toggleUserStatus(e) {
    const userId = e.currentTarget.dataset.id;
    const status = toInt(e.currentTarget.dataset.status);
    const action = status === 1 ? '禁用' : '启用';
    
    wx.showModal({
      title: action + '用户',
      content: `确定要${action}该用户吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const targetStatus = status === 1 ? 0 : 1;
          await updateAdminUserStatus(userId, targetStatus);
          wx.showToast({ title: action + '成功' });
          this.setData({ selectedUsers: [], selectedMap: {} });
          this.reloadUsers();
        } catch (error) {
          console.error(action + '用户失败:', error);
          wx.showToast({ title: error.message || (action + '失败'), icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  /**
   * 重置用户密码
   */
  resetPassword(e) {
    const userId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '重置密码',
      content: '确定要重置该用户的密码吗？重置后密码将变为随机密码。',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const result = await resetAdminUserPassword(userId);
          const newPassword = result && result.data ? result.data.newPassword : '';
          wx.showModal({
            title: '重置成功',
            content: newPassword ? `新密码：${newPassword}` : '密码已重置',
            showCancel: false
          });
        } catch (error) {
          console.error('重置密码失败:', error);
          wx.showToast({ title: error.message || '重置失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  /**
   * 查看用户详情
   */
  viewUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    this.openUserDetail(userId);
  },

  closeUserDetail() {
    this.setData({
      detailVisible: false,
      detailLoading: false,
      detail: null
    });
  },

  stopTap() {
    // 阻止蒙层点击穿透
  },

  async openUserDetail(userId) {
    if (!userId) return;
    this.setData({ detailVisible: true, detailLoading: true, detail: null });

    try {
      const res = await getAdminUserDetail(userId);
      const user = res.data && res.data.user ? res.data.user : {};

      const counts = res.data && res.data.counts ? res.data.counts : null;
      const orderCount = counts && typeof counts.orderCount === 'number'
        ? counts.orderCount
        : (res.data && res.data.orderStats ? (res.data.orderStats.order_count || 0) : 0);

      const feedbackCount = counts && typeof counts.feedbackCount === 'number'
        ? counts.feedbackCount
        : (res.data && Array.isArray(res.data.feedbacks) ? res.data.feedbacks.length : 0);

      const favoriteCount = counts && typeof counts.favoriteCount === 'number'
        ? counts.favoriteCount
        : 0;

      const merchant = res.data && res.data.merchant ? res.data.merchant : null;

      this.setData({
        detailLoading: false,
        detail: {
          basic: {
            id: user.id,
            nickname: user.nickname,
            phone: user.phone,
            avatarUrl: user.avatar_url
          },
          account: {
            role: user.role,
            roleText: this.formatRole(user.role),
            status: user.status,
            statusText: this.formatStatus(user.status),
            createdAt: user.created_at
          },
          related: {
            orderCount,
            feedbackCount,
            favoriteCount
          },
          merchant
        }
      });
    } catch (error) {
      console.error('加载用户详情失败:', error);
      this.setData({ detailLoading: false });
      wx.showToast({ title: '加载用户详情失败', icon: 'none' });
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadUsers();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, users: [], hasMore: true, selectedUsers: [], selectedMap: {} });
    Promise.resolve(this.loadUsers()).finally(() => wx.stopPullDownRefresh());
  }
})