// pages/admin/merchants/merchants.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    merchants: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: '',
    statusFilter: '',
    auditFilter: '',
    selectedMerchants: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadMerchants();
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
   * 加载商家列表
   */
  async loadMerchants() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      // 模拟数据，实际项目中应调用API
      const merchants = [
        { id: 1, name: '校园餐厅', owner: '张三', phone: '13800138000', address: '校园内1号楼', status: 1, statusText: '营业中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-01 10:00:00' },
        { id: 2, name: '校园超市', owner: '李四', phone: '13900139000', address: '校园内2号楼', status: 0, statusText: '休息中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-02 11:00:00' },
        { id: 3, name: '文具店', owner: '王五', phone: '13700137000', address: '校园内3号楼', status: 1, statusText: '营业中', auditStatus: 1, auditStatusText: '待审核', createdAt: '2026-03-03 12:00:00' },
        { id: 4, name: '奶茶店', owner: '赵六', phone: '13600136000', address: '校园内4号楼', status: 1, statusText: '营业中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-04 13:00:00' },
        { id: 5, name: '水果店', owner: '钱七', phone: '13500135000', address: '校园内5号楼', status: 1, statusText: '营业中', auditStatus: 3, auditStatusText: '已拒绝', createdAt: '2026-03-05 14:00:00' },
        { id: 6, name: '打印店', owner: '孙八', phone: '13400134000', address: '校园内6号楼', status: 1, statusText: '营业中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-06 15:00:00' },
        { id: 7, name: '咖啡店', owner: '周九', phone: '13300133000', address: '校园内7号楼', status: 1, statusText: '营业中', auditStatus: 1, auditStatusText: '待审核', createdAt: '2026-03-07 16:00:00' },
        { id: 8, name: '书店', owner: '吴十', phone: '13200132000', address: '校园内8号楼', status: 0, statusText: '休息中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-08 17:00:00' },
        { id: 9, name: '蛋糕店', owner: '郑一', phone: '13100131000', address: '校园内9号楼', status: 1, statusText: '营业中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-09 18:00:00' },
        { id: 10, name: '饰品店', owner: '王二', phone: '13000130000', address: '校园内10号楼', status: 1, statusText: '营业中', auditStatus: 2, auditStatusText: '已通过', createdAt: '2026-03-10 19:00:00' }
      ];
      
      const total = 50;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      this.setData({
        merchants: this.data.page === 1 ? merchants : [...this.data.merchants, ...merchants],
        total,
        hasMore,
        loading: false
      });
    } catch (error) {
      console.error('加载商家列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 搜索商家
   */
  searchMerchants() {
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 筛选商家
   */
  filterMerchants() {
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 选择商家
   */
  selectMerchant(e) {
    const merchantId = e.currentTarget.dataset.id;
    let selectedMerchants = this.data.selectedMerchants;
    
    if (selectedMerchants.includes(merchantId)) {
      selectedMerchants = selectedMerchants.filter(id => id !== merchantId);
    } else {
      selectedMerchants.push(merchantId);
    }
    
    this.setData({ selectedMerchants });
  },

  /**
   * 全选商家
   */
  selectAllMerchants(e) {
    const allSelected = e.detail.value[0];
    let selectedMerchants = [];
    
    if (allSelected) {
      selectedMerchants = this.data.merchants.map(merchant => merchant.id);
    }
    
    this.setData({ selectedMerchants });
  },

  /**
   * 批量禁用商家
   */
  batchDisableMerchants() {
    if (this.data.selectedMerchants.length === 0) {
      wx.showToast({ title: '请选择要禁用的商家', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量禁用',
      content: `确定要禁用选中的 ${this.data.selectedMerchants.length} 个商家吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '禁用成功' });
          this.setData({ selectedMerchants: [] });
          this.loadMerchants();
        }
      }
    });
  },

  /**
   * 批量启用商家
   */
  batchEnableMerchants() {
    if (this.data.selectedMerchants.length === 0) {
      wx.showToast({ title: '请选择要启用的商家', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量启用',
      content: `确定要启用选中的 ${this.data.selectedMerchants.length} 个商家吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '启用成功' });
          this.setData({ selectedMerchants: [] });
          this.loadMerchants();
        }
      }
    });
  },

  /**
   * 切换商家状态
   */
  toggleMerchantStatus(e) {
    const merchantId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const action = status === 1 ? '禁用' : '启用';
    
    wx.showModal({
      title: action + '商家',
      content: `确定要${action}该商家吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: action + '成功' });
          this.loadMerchants();
        }
      }
    });
  },

  /**
   * 审核商家
   */
  auditMerchant(e) {
    const merchantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/merchants/audit?id=${merchantId}`
    });
  },

  /**
   * 查看商家详情
   */
  viewMerchantDetail(e) {
    const merchantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/merchants/detail?id=${merchantId}`
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadMerchants();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants(() => {
      wx.stopPullDownRefresh();
    });
  }
})