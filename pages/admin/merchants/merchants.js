// pages/admin/merchants/merchants.js
const { getAdminMerchantList } = require('../../../utils/api');

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
      // 调用真实API获取数据
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: this.data.statusFilter,
        audit_status: this.data.auditFilter,
        keyword: this.data.searchKeyword
      };
      
      const res = await getAdminMerchantList(params);
      
      const merchants = res.data.list.map(merchant => ({
        id: merchant.id,
        name: merchant.name,
        owner: merchant.owner,
        phone: merchant.phone,
        address: merchant.address,
        status: merchant.status,
        statusText: merchant.status === 1 ? '营业中' : '休息中',
        auditStatus: merchant.audit_status,
        auditStatusText: merchant.audit_status === 1 ? '待审核' : merchant.audit_status === 2 ? '已通过' : '已拒绝',
        createdAt: merchant.created_at
      }));
      
      const total = res.data.total;
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
   * 搜索关键词变化
   */
  searchKeyword(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索商家
   */
  searchMerchants() {
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 状态筛选变化
   */
  statusFilter(e) {
    this.setData({ statusFilter: e.detail.value });
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 审核状态筛选变化
   */
  auditFilter(e) {
    this.setData({ auditFilter: e.detail.value });
    this.setData({ page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 选择商家
   */
  selectMerchant(e) {
    const merchantId = e.detail.value[0];
    let selectedMerchants = this.data.selectedMerchants;
    
    if (merchantId) {
      if (!selectedMerchants.includes(merchantId)) {
        selectedMerchants.push(merchantId);
      }
    } else {
      // 取消选择，需要找到当前取消的商家ID
      const currentId = e.currentTarget.dataset.id;
      selectedMerchants = selectedMerchants.filter(id => id !== currentId);
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