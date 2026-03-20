// pages/admin/users/users.js
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
      // 模拟数据，实际项目中应调用API
      const users = [
        { id: 1, nickname: '张三', phone: '13800138000', role: 1, roleText: '学生', status: 1, statusText: '正常', createdAt: '2026-03-01 10:00:00' },
        { id: 2, nickname: '李四', phone: '13900139000', role: 2, roleText: '商家', status: 1, statusText: '正常', createdAt: '2026-03-02 11:00:00' },
        { id: 3, nickname: '王五', phone: '13700137000', role: 1, roleText: '学生', status: 0, statusText: '禁用', createdAt: '2026-03-03 12:00:00' },
        { id: 4, nickname: '赵六', phone: '13600136000', role: 0, roleText: '管理员', status: 1, statusText: '正常', createdAt: '2026-03-04 13:00:00' },
        { id: 5, nickname: '钱七', phone: '13500135000', role: 1, roleText: '学生', status: 1, statusText: '正常', createdAt: '2026-03-05 14:00:00' },
        { id: 6, nickname: '孙八', phone: '13400134000', role: 2, roleText: '商家', status: 1, statusText: '正常', createdAt: '2026-03-06 15:00:00' },
        { id: 7, nickname: '周九', phone: '13300133000', role: 1, roleText: '学生', status: 1, statusText: '正常', createdAt: '2026-03-07 16:00:00' },
        { id: 8, nickname: '吴十', phone: '13200132000', role: 1, roleText: '学生', status: 0, statusText: '禁用', createdAt: '2026-03-08 17:00:00' },
        { id: 9, nickname: '郑一', phone: '13100131000', role: 2, roleText: '商家', status: 1, statusText: '正常', createdAt: '2026-03-09 18:00:00' },
        { id: 10, nickname: '王二', phone: '13000130000', role: 1, roleText: '学生', status: 1, statusText: '正常', createdAt: '2026-03-10 19:00:00' }
      ];
      
      const total = 100;
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
   * 搜索用户
   */
  searchUsers() {
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  /**
   * 筛选用户
   */
  filterUsers() {
    this.setData({ page: 1, users: [] });
    this.loadUsers();
  },

  /**
   * 选择用户
   */
  selectUser(e) {
    const userId = e.currentTarget.dataset.id;
    let selectedUsers = this.data.selectedUsers;
    
    if (selectedUsers.includes(userId)) {
      selectedUsers = selectedUsers.filter(id => id !== userId);
    } else {
      selectedUsers.push(userId);
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