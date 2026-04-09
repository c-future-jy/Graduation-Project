// pages/admin/orders/orders.js
const {
  getAdminOrderList,
  forceCancelAdminOrder,
  getAdminOrderDetail,
  updateAdminOrderStatus
} = require('../../../utils/api');

const NEXT_STATUS_MAP = { 0: 1, 1: 2, 2: 3 };

const STATUS_OPTIONS = [
  { id: '', label: '全部' },
  { id: '0', label: '待支付' },
  { id: '1', label: '待发货' },
  { id: '2', label: '已发货' },
  { id: '3', label: '已完成' },
  { id: '4', label: '已取消' }
];

const TIME_RANGE_OPTIONS = [
  { id: '', label: '全部' },
  { id: '7', label: '近7天' },
  { id: '30', label: '近30天' },
  { id: '90', label: '近90天' }
];

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function toStr(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function toInt(value) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

function showConfirm({ title, content }) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false)
    });
  });
}

async function runWithLoading(title, fn) {
  wx.showLoading({ title: title || '处理中...' });
  try {
    return await fn();
  } finally {
    wx.hideLoading();
  }
}

function showErrorToast(error, fallback) {
  const msg = (error && error.message) || fallback || '操作失败';
  wx.showToast({ title: msg, icon: 'none' });
}

function pad2(num) {
  return String(num).padStart(2, '0');
}

function formatDateTime(date) {
  if (!(date instanceof Date)) return '';
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function getStatusText(status) {
  const s = toInt(status);
  const map = {
    0: '待支付',
    1: '待发货',
    2: '已发货',
    3: '已完成',
    4: '已取消'
  };
  return map[s] || '未知状态';
}

function getStatusClass(status) {
  const s = toInt(status);
  if (s === 0) return 'pending';
  if (s === 1) return 'processing';
  if (s === 2) return 'shipped';
  if (s === 3) return 'completed';
  return 'cancelled';
}

function computeAnomaly(order) {
  const s = toInt(order && order.status);
  const paymentTime = order && order.payment_time;
  const deliveryTime = order && order.delivery_time;
  const completeTime = order && order.complete_time;
  const cancelReason = order && order.cancel_reason;

  if (s >= 1 && !paymentTime) return '状态≥待发货但缺少支付时间';
  if (s >= 2 && !deliveryTime) return '状态≥已发货但缺少发货时间';
  if (s >= 3 && !completeTime) return '状态≥已完成但缺少完成时间';
  if (s === 4 && !cancelReason) return '已取消但缺少取消原因';
  return '';
}

function computeTimeRange(rangeId) {
  const days = parseInt(rangeId, 10);
  if (!days) return { startTime: '', endTime: '' };
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    startTime: formatDateTime(start),
    endTime: formatDateTime(end)
  };
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    orders: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: '',
    statusFilter: '',
    startTime: '',
    endTime: '',

    statusOptions: STATUS_OPTIONS,
    timeRangeOptions: TIME_RANGE_OPTIONS,
    statusIndex: 0,
    timeRangeIndex: 0,
    statusLabel: '全部',
    timeRangeLabel: '全部',

    statusCounts: {},
    anomalyCount: 0,

    selectedOrders: [],
    selectedMap: {},

    detailVisible: false,
    detailLoading: false,
    detailOrder: null,
    detailItems: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    const initialTitle = options && options.title ? this.safeDecodeURIComponent(options.title) : '';
    wx.setNavigationBarTitle({ title: initialTitle || '订单管理' });
    this.reloadOrders();
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
    const roleNum = userInfo ? parseInt(String(userInfo.role), 10) : 0;
    
    if (!token || !userInfo || roleNum !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  /**
   * 加载订单列表
   */
  buildQueryParams() {
    const params = {
      page: this.data.page,
      pageSize: this.data.pageSize
    };

    if (isProvided(this.data.statusFilter)) params.status = this.data.statusFilter;
    const keyword = String(this.data.searchKeyword || '').trim();
    if (keyword) params.keyword = keyword;
    if (isProvided(this.data.startTime)) params.startTime = this.data.startTime;
    if (isProvided(this.data.endTime)) params.endTime = this.data.endTime;
    return params;
  },

  async loadOrders() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ loading: true });

    try {
      const res = await getAdminOrderList(this.buildQueryParams());

      if (!res || !res.data || !Array.isArray(res.data.orders)) {
        this.setData({ orders: [], total: 0, hasMore: false });
        wx.showToast({ title: '数据加载失败', icon: 'none' });
        return;
      }

      const mapped = res.data.orders.map(order => {
        const id = toStr(order.id);
        const anomalyReason = computeAnomaly(order);
        const statusText = getStatusText(order.status);
        const amount = Number(order.total_amount) || 0;
        const canAdvance = ['0', '1', '2'].includes(toStr(order.status));

        return {
          id,
          orderNo: order.order_no || id,
          user: order.user_name || '',
          merchant: order.merchant_name || '',
          amount,
          amountText: amount.toFixed(2),
          status: toStr(order.status),
          statusText,
          statusClass: getStatusClass(order.status),
          createdAt: order.created_at,
          isAnomaly: !!anomalyReason,
          anomalyReason,
          canAdvance
        };
      });

      const total = (res.data.pagination && res.data.pagination.total) || 0;
      const hasMore = this.data.page * this.data.pageSize < total;
      const nextOrders = this.data.page === 1 ? mapped : this.data.orders.concat(mapped);
      const anomalyCount = nextOrders.reduce((sum, o) => sum + (o.isAnomaly ? 1 : 0), 0);
      const statusCounts = (res.data && res.data.statusCounts) || {};

      this.setData({
        orders: nextOrders,
        total,
        hasMore,
        anomalyCount,
        statusCounts
      });
    } catch (error) {
      console.error('加载订单列表失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  reloadOrders() {
    this.setData({ page: 1, orders: [], hasMore: true });
    this.clearSelection();
    this.loadOrders();
  },

  clearSelection() {
    this.setData({ selectedOrders: [], selectedMap: {} });
  },

  updateSelection(id, checked) {
    const orderId = toStr(id);
    const selectedMap = { ...this.data.selectedMap };
    let selectedOrders = Array.isArray(this.data.selectedOrders) ? [...this.data.selectedOrders] : [];

    if (checked) {
      selectedMap[orderId] = true;
      if (!selectedOrders.includes(orderId)) selectedOrders.push(orderId);
    } else {
      delete selectedMap[orderId];
      selectedOrders = selectedOrders.filter(x => toStr(x) !== orderId);
    }
    this.setData({ selectedMap, selectedOrders });
  },

  /**
   * 搜索关键词变化
   */
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索订单
   */
  searchOrders() {
    this.reloadOrders();
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
    this.reloadOrders();
  },

  /**
   * 时间范围筛选变化
   */
  onTimeRangeChange(e) {
    const index = parseInt(e.detail.value, 10) || 0;
    const option = this.data.timeRangeOptions[index] || this.data.timeRangeOptions[0];
    const { startTime, endTime } = computeTimeRange(option.id);
    this.setData({
      timeRangeIndex: index,
      timeRangeLabel: option.label,
      startTime,
      endTime
    });
    this.reloadOrders();
  },

  /**
   * 选择订单
   */
  selectOrder(e) {
    const id = toStr(e.currentTarget.dataset.id);
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;
    this.updateSelection(id, checked);
  },

  /**
   * 全选订单
   */
  selectAllOrders(e) {
    const checked = Array.isArray(e.detail.value) && e.detail.value.length > 0;
    if (!checked) {
      this.clearSelection();
      return;
    }

    const selectedOrders = this.data.orders.map(order => toStr(order.id));
    const selectedMap = {};
    selectedOrders.forEach(id => {
      selectedMap[id] = true;
    });
    this.setData({ selectedOrders, selectedMap });
  },

  /**
   * 批量取消订单
   */
  batchCancelOrders() {
    if (this.data.selectedOrders.length === 0) {
      wx.showToast({ title: '请选择要取消的订单', icon: 'none' });
      return;
    }

    showConfirm({
      title: '批量取消',
      content: `确定要取消选中的 ${this.data.selectedOrders.length} 个订单吗？`
    }).then((ok) => {
      if (!ok) return;
      return runWithLoading('处理中...', async () => {
        const ids = this.data.selectedOrders;
        for (const id of ids) {
          await forceCancelAdminOrder(id, '');
        }
        wx.showToast({ title: '取消成功' });
        this.clearSelection();
        this.reloadOrders();
      }).catch((error) => {
        console.error('批量取消失败:', error);
        showErrorToast(error, '取消失败');
      });
    });
  },

  /**
   * 查看订单详情
   */
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    this.openDetail(orderId);
  },

  async openDetail(orderId) {
    const id = toStr(orderId);
    this.setData({
      detailVisible: true,
      detailLoading: true,
      detailOrder: null,
      detailItems: []
    });

    try {
      const res = await getAdminOrderDetail(id);
      const rawOrder = res && res.data && res.data.order;
      const items = (res && res.data && res.data.items) || [];
      this.setData({
        detailOrder: rawOrder ? { ...rawOrder, statusText: getStatusText(rawOrder.status) } : null,
        detailItems: Array.isArray(items) ? items : []
      });
    } catch (err) {
      console.error('加载订单详情失败:', err);
      wx.showToast({ title: '详情加载失败', icon: 'none' });
    } finally {
      this.setData({ detailLoading: false });
    }
  },

  closeDetail() {
    this.setData({ detailVisible: false });
  },

  noop() {},

  async forceCancelOne(e) {
    const orderId = e.currentTarget.dataset.id;

    const ok = await showConfirm({ title: '强制取消', content: '确定要强制取消该订单吗？' });
    if (!ok) return;
    try {
      await runWithLoading('处理中...', async () => {
        await forceCancelAdminOrder(orderId, '');
      });
      wx.showToast({ title: '取消成功' });
      this.reloadOrders();
    } catch (error) {
      console.error('强制取消失败:', error);
      showErrorToast(error, '取消失败');
    }
  },

  async advanceOrderStatus(e) {
    const orderId = e.currentTarget.dataset.id;
    const currentStatus = toInt(e.currentTarget.dataset.status);
    const nextStatus = NEXT_STATUS_MAP[currentStatus];
    if (nextStatus === undefined) return;

    const ok = await showConfirm({
      title: '推进状态',
      content: `确定将订单推进为「${getStatusText(nextStatus)}」吗？`
    });
    if (!ok) return;

    try {
      await runWithLoading('处理中...', async () => {
        await updateAdminOrderStatus(orderId, nextStatus);
      });
      wx.showToast({ title: '更新成功' });
      this.reloadOrders();
    } catch (error) {
      console.error('推进状态失败:', error);
      showErrorToast(error, '更新失败');
    }
  },

  loadMoreOrders() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.loadMoreOrders();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, orders: [], hasMore: true });
    this.clearSelection();
    Promise.resolve(this.loadOrders()).finally(() => wx.stopPullDownRefresh());
  }
})