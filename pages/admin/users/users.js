// pages/admin/users/users.js
const { getAdminUserList } = require('../../../utils/api');

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
    selectedUsers: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadUsers();
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

  /**
   * 加载用户列表
   */
  async loadUsers() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      // 调用真实API获取数据
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        role: this.data.roleFilter,
        keyword: this.data.searchKeyword
      };
      
      const res = await getAdminUserList(params);
      
      const users = res.data.list.map(user => ({
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        role: user.role,
        roleText: user.role === 0 ? '管理员' : user.role === 1 ? '学生' : '商家',
        status: user.status,
        statusText: user.status === 1 ? '正常' : '禁用',
        createdAt: user.created_at
      }));
      
      const total = res.data.total;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      this.setData({
        users: this.data.page === 1 ? users : [...this.data.users, ...users],
        total,
        hasMore,
        loading: false
      });
    } catch (error) {
      console.error('加载用户列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 搜索关键词变化
   */
  searchKeyword(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索用户
   */
  searchUsers() {
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  /**
   * 角色筛选变化
   */
  roleFilter(e) {
    this.setData({ roleFilter: e.detail.value });
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  /**
   * 状态筛选变化
   */
  statusFilter(e) {
    this.setData({ statusFilter: e.detail.value });
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  /**
   * 选择用户
   */
  selectUser(e) {
    const userId = e.detail.value[0];
    let selectedUsers = this.data.selectedUsers;
    
    if (userId) {
      if (!selectedUsers.includes(userId)) {
        selectedUsers.push(userId);
      }
    } else {
      // 取消选择，需要找到当前取消的用户ID
      const currentId = e.currentTarget.dataset.id;
      selectedUsers = selectedUsers.filter(id => id !== currentId);
    }
    
    this.setData({ selectedUsers });
  },

  /**
   * 全选用户
   */
  selectAllUsers(e) {
    const allSelected = e.detail.value[0];
    let selectedUsers = [];
    
    if (allSelected) {
      selectedUsers = this.data.users.map(user => user.id);
    }
    
    this.setData({ selectedUsers });
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
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '禁用成功' });
          this.setData({ selectedUsers: [] });
          this.loadUsers();
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
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '启用成功' });
          this.setData({ selectedUsers: [] });
          this.loadUsers();
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
    
    // 实际项目中应调用API导出用户数据
    wx.showToast({ title: '导出成功' });
  },

  /**
   * 禁用/启用用户
   */
  toggleUserStatus(e) {
    const userId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const action = status === 1 ? '禁用' : '启用';
    
    wx.showModal({
      title: action + '用户',
      content: `确定要${action}该用户吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: action + '成功' });
          this.loadUsers();
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
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          const randomPassword = Math.random().toString(36).substring(2, 10);
          wx.showModal({
            title: '重置成功',
            content: `新密码：${randomPassword}`,
            showCancel: false
          });
        }
      }
    });
  },

  /**
   * 查看用户详情
   */
  viewUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/users/detail?id=${userId}`
    });
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
    this.setData({ page: 1, users: [] });
    this.loadUsers(() => {
      wx.stopPullDownRefresh();
    });
  }
})