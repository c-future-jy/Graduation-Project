// pages/merchant/dashboard/dashboard.js
const {
  getMerchantDashboardStats,
  getMerchantDashboardTrend,
  getMerchantDashboardTopProducts,
  getMerchantDashboardRecentOrders,
  getMerchantDashboardLowStock,
  getMerchantDashboardOrderStatus
} = require('../../../utils/api');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}

const STATUS_TEXT_MAP = {
  0: '待支付',
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已取消'
};

const STATUS_COLOR_MAP = {
  0: '#ff9800',
  1: '#2196f3',
  2: '#4caf50',
  3: '#9c27b0',
  4: '#f44336'
};

function toYmd(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toMd(ymd) {
  const str = String(ymd || '');
  const parts = str.split('-');
  if (parts.length !== 3) return str;
  const mm = parseInt(parts[1], 10);
  const dd = parseInt(parts[2], 10);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) return str;
  return `${mm}/${dd}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const s = String(value);
  // 兼容 ISO 字符串
  if (s.includes('T')) {
    return s.replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '');
  }
  return s;
}

function toMoney(value) {
  if (value === null || value === undefined || value === '') return '0.00';
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 商家信息
    merchantName: '',
    
    // 核心数据统计
    todayOrders: 0,
    todaySales: 0,
    todayAvgOrder: 0,
    pendingOrders: 0,
    monthOrders: 0,
    monthSales: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    
    // 时间范围
    timeRange: 'today',
    rankLimit: '5',
    startDate: '',
    endDate: '',
    showDatePicker: false,
    
    // 日期选择器数据
    years: [],
    months: [],
    days: [],
    
    // 商品销量排行
    topProducts: [],
    
    // 最近订单
    recentOrders: [],
    
    // 库存预警
    lowStockItems: [],
    
    // 图表数据
    orderTrendData: [],
    salesTrendData: [],
    orderStatusData: [],
    
    // 加载状态
    loading: false,

    // 定时刷新（timer id）
    refreshInterval: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initDatePicker();
    const userInfo = wx.getStorageSync('userInfo') || {};
    const merchantName = userInfo.merchant_name || userInfo.merchantName || userInfo.nickname || userInfo.username || '';
    if (merchantName) {
      this.setData({ merchantName });
    }
    this.loadDashboardData();
    this.startAutoRefresh();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadDashboardData();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.stopAutoRefresh();
  },

  _normalizeTrend(trendRes) {
    const trend = ((trendRes && trendRes.data && trendRes.data.trend) || []).map((x) => ({
      date: toStr(x.date, ''),
      orderCount: toInt(x.orderCount, 0),
      sales: Number(x.sales) || 0
    }));
    return {
      orderTrendData: trend.map((x) => ({ date: toMd(x.date), value: x.orderCount })),
      salesTrendData: trend.map((x) => ({ date: toMd(x.date), value: Math.round(Number(x.sales) || 0) }))
    };
  },

  _normalizeOrderStatus(statusRes) {
    return ((statusRes && statusRes.data && statusRes.data.items) || []).map((x) => {
      const status = toInt(x.status, 0);
      return {
        status,
        label: STATUS_TEXT_MAP[status] || '未知状态',
        value: toInt(x.value, 0)
      };
    });
  },

  _normalizeTopProducts(topRes) {
    return ((topRes && topRes.data && topRes.data.items) || []).map((x) => ({
      id: x.id,
      name: toStr(x.name, ''),
      sales: toInt(x.sales, 0)
    }));
  },

  _normalizeRecentOrders(recentRes) {
    return ((recentRes && recentRes.data && recentRes.data.orders) || []).map((o) => {
      const amount = (o && (o.total_amount ?? o.totalAmount ?? o.pay_amount ?? o.amount)) ?? 0;
      const status = toInt(o.status, 0);
      const createdAt = o.createdAt ?? o.created_at ?? o.createdAtText ?? o.created_at_text;
      return {
        ...o,
        id: o.id ?? o.order_id ?? o.orderId,
        orderNo: o.orderNo ?? o.order_no ?? o.no,
        amount: toMoney(amount),
        status,
        createdAt: formatDateTime(createdAt)
      };
    });
  },

  _normalizeLowStock(lowStockRes) {
    return ((lowStockRes && lowStockRes.data && lowStockRes.data.items) || []).map((x) => ({
      id: x.id,
      name: toStr(x.name, ''),
      stock: toInt(x.stock, 0)
    }));
  },

  /**
   * 初始化日期选择器
   */
  initDatePicker() {
    const years = [];
    const months = [];
    const days = [];
    
    // 生成年份
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 1; i <= currentYear; i++) {
      years.push(i);
    }
    
    // 生成月份
    for (let i = 1; i <= 12; i++) {
      months.push(i);
    }
    
    // 生成日期
    for (let i = 1; i <= 31; i++) {
      days.push(i);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ymd = toYmd(today);
    this.setData({ years, months, days, startDate: ymd, endDate: ymd });
  },

  /**
   * 加载Dashboard数据
   */
  async loadDashboardData() {
    if (this._loadingPromise) return this._loadingPromise;

    this.setData({ loading: true });

    this._loadingPromise = (async () => {
      const rangeParams = this.getRangeParams();

      const [statsRes, trendRes, statusRes, topRes, recentRes, lowStockRes] = await Promise.all([
        getMerchantDashboardStats(),
        getMerchantDashboardTrend(rangeParams),
        getMerchantDashboardOrderStatus(rangeParams),
        getMerchantDashboardTopProducts({ limit: parseInt(this.data.rankLimit, 10) || 5 }),
        getMerchantDashboardRecentOrders({ limit: 5 }),
        getMerchantDashboardLowStock({ threshold: 10, limit: 5 })
      ]);

      const stats = (statsRes && statsRes.data) || {};

      const { orderTrendData, salesTrendData } = this._normalizeTrend(trendRes);
      const orderStatusData = this._normalizeOrderStatus(statusRes);
      const topProducts = this._normalizeTopProducts(topRes);
      const recentOrders = this._normalizeRecentOrders(recentRes);
      const lowStockItems = this._normalizeLowStock(lowStockRes);

      this.setData(
        {
          todayOrders: toInt(stats.todayOrders, 0),
          todaySales: Number(stats.todaySales) || 0,
          todayAvgOrder: Number(stats.todayAvgOrder) || 0,
          pendingOrders: toInt(stats.pendingOrders, 0),
          monthOrders: toInt(stats.monthOrders, 0),
          monthSales: Number(stats.monthSales) || 0,
          totalProducts: toInt(stats.totalProducts, 0),
          lowStockProducts: toInt(stats.lowStockProducts, 0),
          orderTrendData,
          salesTrendData,
          orderStatusData,
          topProducts,
          recentOrders,
          lowStockItems
        },
        () => {
          this.drawOrderTrendChart();
          this.drawSalesTrendChart();
          this.drawOrderStatusChart();
        }
      );
    })()
      .catch((e) => {
        console.error('加载商家仪表盘失败:', e);
        throw e;
      })
      .finally(() => {
        this.setData({ loading: false });
        this._loadingPromise = null;
      });

    return this._loadingPromise;
  },

  getRangeParams() {
    const range = this.data.timeRange;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (range === 'today') {
      const d = toYmd(today);
      return { startDate: d, endDate: d };
    }

    if (range === 'yesterday') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = toYmd(y);
      return { startDate: d, endDate: d };
    }

    if (range === 'custom') {
      if (this.data.startDate && this.data.endDate) {
        return { startDate: this.data.startDate, endDate: this.data.endDate };
      }
      return { days: 7 };
    }

    const days = parseInt(range, 10);
    if (Number.isFinite(days) && days > 0) {
      return { days };
    }

    return { days: 7 };
  },

  async loadTrendAndStatus() {
    const rangeParams = this.getRangeParams();
    try {
      const [trendRes, statusRes] = await Promise.all([
        getMerchantDashboardTrend(rangeParams),
        getMerchantDashboardOrderStatus(rangeParams)
      ]);

      const { orderTrendData, salesTrendData } = this._normalizeTrend(trendRes);
      const orderStatusData = this._normalizeOrderStatus(statusRes);

      this.setData({ orderTrendData, salesTrendData, orderStatusData }, () => {
        this.drawOrderTrendChart();
        this.drawSalesTrendChart();
        this.drawOrderStatusChart();
      });
    } catch (e) {
      console.error('加载趋势/分布失败:', e);
    }
  },

  async loadTopProducts() {
    try {
      const res = await getMerchantDashboardTopProducts({ limit: parseInt(this.data.rankLimit, 10) || 5 });
      this.setData({ topProducts: this._normalizeTopProducts(res) });
    } catch (e) {
      console.error('加载销量排行失败:', e);
    }
  },

  /**
   * 切换时间范围
   */
  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.loadTrendAndStatus();
  },

  /**
   * 切换排行数量
   */
  switchRankLimit(e) {
    const limit = e.currentTarget.dataset.limit;
    this.setData({ rankLimit: limit });
    this.loadTopProducts();
  },

  /**
   * 显示日期选择器
   */
  showDatePicker() {
    this.setData({ showDatePicker: true });
  },

  /**
   * 隐藏日期选择器
   */
  hideDatePicker() {
    this.setData({ showDatePicker: false });
  },

  /**
   * 日期选择变化
   */
  bindDateChange(e) {
    const value = e.detail.value;
    const years = this.data.years;
    const months = this.data.months;
    const days = this.data.days;
    
    const selectedYear = years[value[0]];
    const selectedMonth = months[value[1]];
    const selectedDay = days[value[2]];
    
    const selectedDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
    
    this.setData({
      startDate: selectedDate,
      endDate: selectedDate,
      timeRange: 'custom',
      showDatePicker: false
    });

    this.loadTrendAndStatus();
  },

  /**
   * 手动刷新数据
   */
  refreshData() {
    wx.showToast({ title: '刷新中...', icon: 'loading', duration: 10000 });
    this.loadDashboardData()
      .then(() => {
        wx.showToast({ title: '刷新成功', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: getErrMsg(err, '刷新失败'), icon: 'none' });
      });
  },

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    // 每30秒自动刷新一次数据
    this._refreshTimer = setInterval(() => {
      this.loadDashboardData().catch(() => {});
    }, 30000);
  },

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  /**
   * 绘制订单趋势图表
   */
  drawOrderTrendChart() {
    const ctx = wx.createCanvasContext('orderTrendChart');
    const data = this.data.orderTrendData;
    if (data.length === 0) return;
    
    // 绘制背景
    ctx.setFillStyle('#f0f0f0');
    ctx.fillRect(0, 0, 375, 200);
    
    // 绘制折线
    ctx.setStrokeStyle('#f3514f');
    ctx.setLineWidth(2);
    ctx.beginPath();
    
    const width = 375;
    const height = 180;
    const padding = 30;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    
    const maxValue = Math.max(...data.map(item => item.value));
    const minValue = Math.min(...data.map(item => item.value));
    const valueRange = maxValue - minValue || 1;
    
    data.forEach((item, index) => {
      const x = padding + (innerWidth / (data.length - 1)) * index;
      const y = padding + innerHeight - ((item.value - minValue) / valueRange) * innerHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // 绘制数据点
    data.forEach((item, index) => {
      const x = padding + (innerWidth / (data.length - 1)) * index;
      const y = padding + innerHeight - ((item.value - minValue) / valueRange) * innerHeight;
      
      ctx.setFillStyle('#f3514f');
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    // 绘制日期标签
    ctx.setFillStyle('#666');
    ctx.setFontSize(12);
    data.forEach((item, index) => {
      const x = padding + (innerWidth / (data.length - 1)) * index;
      ctx.fillText(item.date, x - 15, height + 10);
    });
    
    ctx.draw();
  },

  /**
   * 绘制营业额趋势图表
   */
  drawSalesTrendChart() {
    const ctx = wx.createCanvasContext('salesTrendChart');
    const data = this.data.salesTrendData;
    if (data.length === 0) return;
    
    // 绘制背景
    ctx.setFillStyle('#f0f0f0');
    ctx.fillRect(0, 0, 375, 200);
    
    const width = 375;
    const height = 180;
    const padding = 30;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const barWidth = innerWidth / data.length * 0.6;
    
    const maxValue = Math.max(...data.map(item => item.value));
    
    // 绘制柱状图
    data.forEach((item, index) => {
      const x = padding + (innerWidth / data.length) * index + (innerWidth / data.length - barWidth) / 2;
      const barHeight = (item.value / maxValue) * innerHeight;
      const y = padding + innerHeight - barHeight;
      
      ctx.setFillStyle('#2196f3');
      ctx.fillRect(x, y, barWidth, barHeight);
    });
    
    // 绘制日期标签
    ctx.setFillStyle('#666');
    ctx.setFontSize(12);
    data.forEach((item, index) => {
      const x = padding + (innerWidth / data.length) * index;
      ctx.fillText(item.date, x - 15, height + 10);
    });
    
    ctx.draw();
  },

  /**
   * 绘制订单状态分布图表
   */
  drawOrderStatusChart() {
    const ctx = wx.createCanvasContext('orderStatusChart');
    const data = this.data.orderStatusData;
    if (data.length === 0) return;
    
    // 绘制背景
    ctx.setFillStyle('#f0f0f0');
    ctx.fillRect(0, 0, 375, 200);
    
    const centerX = 187.5;
    const centerY = 100;
    const radius = 60;
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (!total) return;
    let startAngle = 0;
    const colors = ['#ff9800', '#2196f3', '#4caf50', '#9c27b0', '#f44336'];
    
    // 绘制饼图
    data.forEach((item, index) => {
      const angle = (item.value / total) * Math.PI * 2;
      ctx.setFillStyle(colors[index % colors.length]);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fill();
      startAngle += angle;
    });
    
    // 绘制图例
    data.forEach((item, index) => {
      const x = 40;
      const y = 30 + index * 25;
      
      ctx.setFillStyle(colors[index % colors.length]);
      ctx.fillRect(x, y, 15, 15);
      
      ctx.setFillStyle('#333');
      ctx.setFontSize(14);
      ctx.fillText((item.label || item.status) + ': ' + item.value, x + 25, y + 12);
    });
    
    ctx.draw();
  },

  /**
   * 获取订单状态文本
   */
  getStatusText(status) {
    return STATUS_TEXT_MAP[toInt(status, -1)] || '未知状态';
  },

  /**
   * 获取订单状态颜色
   */
  getStatusColor(status) {
    return STATUS_COLOR_MAP[toInt(status, -1)] || '#999';
  },

  /**
   * 快捷操作 - 发布新商品
   */
  goToAddProduct() {
    wx.navigateTo({ url: '/pages/merchant/products/products?openForm=1' });
  },

  /**
   * 快捷操作 - 处理订单
   */
  goToProcessOrders() {
    wx.navigateTo({ url: '/pages/merchant/orders/orders?status=1' });
  },

  /**
   * 快捷操作 - 库存管理
   */
  goToInventory() {
    wx.navigateTo({ url: '/pages/merchant/products/products?filter=low_stock' });
  },

  /**
   * 快捷操作 - 查看评价
   */
  goToFeedbacks() {
    wx.navigateTo({ url: '/pages/merchant/feedbacks/feedbacks' });
  },

  /**
   * 查看全部订单
   */
  goToOrders() {
    wx.navigateTo({ url: '/pages/merchant/orders/orders' });
  },

  /**
   * 查看订单详情
   */
  goToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/merchant/order-detail/order-detail?id=${orderId}` });
  },

  /**
   * 提醒补货
   */
  remindRestock(e) {
    const productId = e.currentTarget.dataset.id;
    wx.showToast({ title: '已发送补货提醒', icon: 'success' });
  }
})