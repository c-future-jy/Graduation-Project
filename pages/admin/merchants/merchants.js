// pages/admin/merchants/merchants.js
const {
  getAdminMerchantList,
  getAdminMerchantDetail,
  updateAdminMerchantStatus,
  auditAdminMerchant
} = require('../../../utils/api');

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '营业中', value: '1' },
  { label: '休息中', value: '0' }
];

const AUDIT_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待审核', value: '1' },
  { label: '已通过', value: '2' },
  { label: '已拒绝', value: '3' }
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

function getMerchantStatusText(status) {
  return toInt(status) === 1 ? '营业中' : '休息中';
}

function getAuditStatusText(auditStatus) {
  const a = toInt(auditStatus);
  if (a === 1) return '待审核';
  if (a === 2) return '已通过';
  if (a === 3) return '已拒绝';
  return '-';
}

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
    selectedMap: {},

    statusOptions: STATUS_OPTIONS,
    auditOptions: AUDIT_OPTIONS,
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
    this.reloadMerchants();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const roleNum = userInfo ? parseInt(String(userInfo.role), 10) : 0;
    
    if (!token || !userInfo || roleNum !== 3) {
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

    if (isProvided(this.data.statusFilter)) params.status = this.data.statusFilter;
    if (isProvided(this.data.auditFilter)) params.audit_status = this.data.auditFilter;
    const keyword = String(this.data.searchKeyword || '').trim();
    if (keyword) params.keyword = keyword;
    return params;
  },

  reloadMerchants() {
    this.setData({
      page: 1,
      merchants: [],
      hasMore: true,
      selectedMerchants: [],
      selectedMap: {}
    });
    this.loadMerchants();
  },

  /**
   * 加载商家列表
   */
  async loadMerchants() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    try {
      const res = await getAdminMerchantList(this.buildQueryParams());
      const list = (res && res.data && res.data.merchants) || [];

      const merchants = (Array.isArray(list) ? list : []).map(merchant => {
        const status = toInt(merchant.status);
        const auditStatus = toInt(merchant.audit_status);
        return {
          id: toStr(merchant.id),
          name: merchant.name,
          owner: merchant.owner_name,
          phone: merchant.phone,
          address: merchant.address,
          status,
          statusText: getMerchantStatusText(status),
          auditStatus,
          auditStatusText: getAuditStatusText(auditStatus),
          createdAt: merchant.created_at
        };
      });

      const total = (res && res.data && res.data.pagination && res.data.pagination.total) || 0;
      const hasMore = this.data.page * this.data.pageSize < total;

      this.setData({
        merchants: this.data.page === 1 ? merchants : this.data.merchants.concat(merchants),
        total,
        hasMore
      });
    } catch (error) {
      console.error('加载商家列表失败:', error);
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
   * 搜索商家
   */
  searchMerchants() {
    this.reloadMerchants();
  },

  /**
   * 状态筛选变化
   */
  onStatusPickerChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.statusOptions[index] || this.data.statusOptions[0];
    this.setData({ statusPickerIndex: index, statusFilter: option.value });
    this.reloadMerchants();
  },

  /**
   * 审核状态筛选变化
   */
  onAuditPickerChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.auditOptions[index] || this.data.auditOptions[0];
    this.setData({ auditPickerIndex: index, auditFilter: option.value });
    this.reloadMerchants();
  },

  /**
   * 选择商家
   */
  selectMerchant(e) {
    const id = toStr(e.currentTarget.dataset.id);
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;

    const selectedMap = { ...this.data.selectedMap };
    let selectedMerchants = Array.isArray(this.data.selectedMerchants) ? [...this.data.selectedMerchants] : [];

    if (checked) {
      selectedMap[id] = true;
      if (!selectedMerchants.includes(id)) selectedMerchants.push(id);
    } else {
      delete selectedMap[id];
      selectedMerchants = selectedMerchants.filter(x => toStr(x) !== id);
    }

    this.setData({ selectedMap, selectedMerchants });
  },

  /**
   * 全选商家
   */
  selectAllMerchants(e) {
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;
    if (!checked) {
      this.setData({ selectedMerchants: [], selectedMap: {} });
      return;
    }

    const selectedMerchants = this.data.merchants.map(m => toStr(m.id));
    const selectedMap = {};
    selectedMerchants.forEach(id => {
      selectedMap[id] = true;
    });
    this.setData({ selectedMerchants, selectedMap });
  },

  batchUpdateMerchantStatus(targetStatus) {
    const ids = this.data.selectedMerchants;
    if (!Array.isArray(ids) || ids.length === 0) {
      wx.showToast({ title: '请选择商家', icon: 'none' });
      return;
    }

    const isEnable = targetStatus === 1;
    const actionText = isEnable ? '启用' : '禁用';
    wx.showModal({
      title: `批量${actionText}`,
      content: `确定要${actionText}选中的 ${ids.length} 个商家吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          for (const id of ids) {
            await updateAdminMerchantStatus(id, targetStatus);
          }
          wx.showToast({ title: `${actionText}成功` });
          this.setData({ selectedMerchants: [], selectedMap: {} });
          this.reloadMerchants();
        } catch (error) {
          console.error(`批量${actionText}失败:`, error);
          wx.showToast({ title: error.message || `${actionText}失败`, icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  batchDisableMerchants() {
    this.batchUpdateMerchantStatus(0);
  },

  batchEnableMerchants() {
    this.batchUpdateMerchantStatus(1);
  },

  /**
   * 切换商家状态
   */
  toggleMerchantStatus(e) {
    const merchantId = e.currentTarget.dataset.id;
    const status = toInt(e.currentTarget.dataset.status);
    const action = status === 1 ? '禁用' : '启用';
    
    wx.showModal({
      title: action + '商家',
      content: `确定要${action}该商家吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          await updateAdminMerchantStatus(merchantId, status === 1 ? 0 : 1);
          wx.showToast({ title: action + '成功' });
          this.setData({ selectedMerchants: [], selectedMap: {} });
          this.reloadMerchants();
        } catch (err) {
          console.error(action + '商家失败:', err);
          wx.showToast({ title: err.message || '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
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
        this.setData({ selectedMerchants: [], selectedMap: {} });
        this.reloadMerchants();
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
  async viewMerchantDetail(e) {
    const merchantId = e.currentTarget.dataset.id;
    this.setData({ detailVisible: true, detailLoading: true, detail: null });

    try {
      const res = await getAdminMerchantDetail(merchantId);
      const data = (res && res.data) || {};
      const merchant = data.merchant || {};
      const owner = data.owner || null;
      const products = Array.isArray(data.products) ? data.products : [];
      const orderStats = data.orderStats || {};
      const feedbackStats = data.feedbackStats || {};
      const revenueStats = data.revenueStats || {};
      const feedbacks = Array.isArray(data.feedbacks) ? data.feedbacks : [];

      const status = toInt(merchant.status);
      const auditStatus = toInt(merchant.audit_status);

      this.setData({
        detail: {
          basic: {
            id: merchant.id,
            name: merchant.name,
            address: merchant.address,
            phone: merchant.phone,
            logo: merchant.logo
          },
          owner,
          status,
          statusText: status === 1 ? '营业中' : '休息中/禁用',
          auditStatus,
          auditStatusText: getAuditStatusText(auditStatus),
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            stock: p.stock,
            status: p.status,
            statusText: toInt(p.status) === 1 ? '上架' : '下架'
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
    } catch (err) {
      console.error('加载商家详情失败:', err);
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    } finally {
      this.setData({ detailLoading: false });
    }
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
    this.setData({ page: 1, merchants: [], hasMore: true, selectedMerchants: [], selectedMap: {} });
    Promise.resolve(this.loadMerchants()).finally(() => wx.stopPullDownRefresh());
  }
})