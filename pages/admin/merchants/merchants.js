// pages/admin/merchants/merchants.js
const {
  getAdminMerchantList,
  getAdminMerchantDetail,
  updateAdminMerchantStatus,
  auditAdminMerchant
} = require('../../../utils/api');

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
    selectedMerchants: [],

    statusOptions: [
      { label: '全部', value: '' },
      { label: '营业中', value: '1' },
      { label: '休息中', value: '0' }
    ],
    auditOptions: [
      { label: '全部', value: '' },
      { label: '待审核', value: '1' },
      { label: '已通过', value: '2' },
      { label: '已拒绝', value: '3' }
    ],
    statusPickerIndex: 0,
    auditPickerIndex: 0,

    // 详情弹窗
    detailVisible: false,
    detailLoading: false,
    detail: null,

    // 审核弹窗
    auditVisible: false,
    auditSubmitting: false,
    auditTarget: null,
    auditRemark: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '商家管理' });
    this.loadMerchants();
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
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
      
      const merchants = (res.data.merchants || []).map(merchant => ({
        id: merchant.id,
        name: merchant.name,
        owner: merchant.owner_name,
        phone: merchant.phone,
        address: merchant.address,
        status: (typeof merchant.status === 'string' ? parseInt(merchant.status, 10) : merchant.status),
        statusText: (typeof merchant.status === 'string' ? parseInt(merchant.status, 10) : merchant.status) === 1 ? '营业中' : '休息中',
        auditStatus: (typeof merchant.audit_status === 'string' ? parseInt(merchant.audit_status, 10) : merchant.audit_status),
        auditStatusText: (() => {
          const a = typeof merchant.audit_status === 'string' ? parseInt(merchant.audit_status, 10) : merchant.audit_status;
          if (a === 1) return '待审核';
          if (a === 2) return '已通过';
          if (a === 3) return '已拒绝';
          return '-';
        })(),
        createdAt: merchant.created_at
      }));
      
      const total = (res.data.pagination && res.data.pagination.total) || 0;
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
  onStatusPickerChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.statusOptions[index] || this.data.statusOptions[0];
    this.setData({ statusPickerIndex: index, statusFilter: option.value, page: 1, merchants: [] });
    this.loadMerchants();
  },

  /**
   * 审核状态筛选变化
   */
  onAuditPickerChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.auditOptions[index] || this.data.auditOptions[0];
    this.setData({ auditPickerIndex: index, auditFilter: option.value, page: 1, merchants: [] });
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = this.data.selectedMerchants;
          for (const id of ids) {
            await updateAdminMerchantStatus(id, 0);
          }
          wx.showToast({ title: '禁用成功' });
          this.setData({ selectedMerchants: [], page: 1, merchants: [], hasMore: true });
          this.loadMerchants();
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = this.data.selectedMerchants;
          for (const id of ids) {
            await updateAdminMerchantStatus(id, 1);
          }
          wx.showToast({ title: '启用成功' });
          this.setData({ selectedMerchants: [], page: 1, merchants: [], hasMore: true });
          this.loadMerchants();
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
          wx.showLoading({ title: '处理中...' });
          updateAdminMerchantStatus(merchantId, status === 1 ? 0 : 1)
            .then(() => {
              wx.hideLoading();
              wx.showToast({ title: action + '成功' });
              this.setData({ page: 1, merchants: [], selectedMerchants: [] });
              this.loadMerchants();
            })
            .catch((err) => {
              wx.hideLoading();
              console.error(action + '商家失败:', err);
              wx.showToast({ title: err.message || '操作失败', icon: 'none' });
            });
        }
      }
    });
  },

  /**
   * 审核商家
   */
  auditMerchant(e) {
    const merchantId = e.currentTarget.dataset.id;
    const target = this.data.merchants.find(m => m.id === merchantId) || { id: merchantId };
    this.setData({
      auditVisible: true,
      auditSubmitting: false,
      auditTarget: target,
      auditRemark: ''
    });
  },

  closeAudit() {
    this.setData({ auditVisible: false, auditSubmitting: false, auditTarget: null, auditRemark: '' });
  },

  stopTap() {},

  onAuditRemarkInput(e) {
    this.setData({ auditRemark: e.detail.value });
  },

  submitAuditApprove() {
    this.submitAudit(2);
  },

  submitAuditReject() {
    this.submitAudit(3);
  },

  submitAudit(auditStatus) {
    const target = this.data.auditTarget;
    if (!target || !target.id) return;

    const remark = (this.data.auditRemark || '').trim();
    if (auditStatus === 3 && !remark) {
      wx.showToast({ title: '请输入驳回原因', icon: 'none' });
      return;
    }

    if (this.data.auditSubmitting) return;
    this.setData({ auditSubmitting: true });
    wx.showLoading({ title: '提交中...' });

    auditAdminMerchant(target.id, {
      audit_status: auditStatus,
      audit_remark: remark
    })
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: auditStatus === 2 ? '已通过' : '已驳回' });
        this.closeAudit();
        this.setData({ page: 1, merchants: [], selectedMerchants: [] });
        this.loadMerchants();
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('审核商家失败:', err);
        this.setData({ auditSubmitting: false });
        wx.showToast({ title: err.message || '审核失败', icon: 'none' });
      });
  },

  /**
   * 查看商家详情
   */
  viewMerchantDetail(e) {
    const merchantId = e.currentTarget.dataset.id;
    this.setData({ detailVisible: true, detailLoading: true, detail: null });

    getAdminMerchantDetail(merchantId)
      .then((res) => {
        const data = res.data || {};
        const merchant = data.merchant || {};
        const owner = data.owner || null;
        const products = data.products || [];
        const orderStats = data.orderStats || {};
        const feedbackStats = data.feedbackStats || {};
        const revenueStats = data.revenueStats || {};
        const feedbacks = data.feedbacks || [];

        this.setData({
          detailLoading: false,
          detail: {
            basic: {
              id: merchant.id,
              name: merchant.name,
              address: merchant.address,
              phone: merchant.phone,
              logo: merchant.logo
            },
            owner,
            status: merchant.status,
            statusText: merchant.status === 1 ? '营业中' : '休息中/禁用',
            auditStatus: typeof merchant.audit_status === 'string' ? parseInt(merchant.audit_status, 10) : merchant.audit_status,
            auditStatusText: (() => {
              const a = typeof merchant.audit_status === 'string' ? parseInt(merchant.audit_status, 10) : merchant.audit_status;
              if (a === 1) return '待审核';
              if (a === 2) return '已通过';
              if (a === 3) return '已拒绝';
              return '-';
            })(),
            products: products.map(p => ({
              id: p.id,
              name: p.name,
              stock: p.stock,
              status: p.status,
              statusText: p.status === 1 ? '上架' : '下架'
            })),
            stats: {
              orderCount: orderStats.order_count || 0,
              processingCount: orderStats.processing_count || 0,
              finishedCount: orderStats.finished_count || 0,
              totalRevenue: revenueStats.total_revenue || 0
            },
            feedback: {
              avgRating: feedbackStats.avg_rating || 0,
              count: feedbackStats.feedback_count || 0,
              list: feedbacks
            }
          }
        });
      })
      .catch((err) => {
        console.error('加载商家详情失败:', err);
        this.setData({ detailLoading: false });
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  closeMerchantDetail() {
    this.setData({ detailVisible: false, detailLoading: false, detail: null });
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
    Promise.resolve(this.loadMerchants()).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
})