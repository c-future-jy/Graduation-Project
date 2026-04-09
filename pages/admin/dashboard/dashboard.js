// 管理后台首页逻辑
const { getAdminDashboardStats, getAdminOrderTrend, getAdminUserTrend } = require('../../../utils/api');

const PAGE_ROUTE_MAP = {
  users: '/pages/admin/users/users',
  merchants: '/pages/admin/merchants/merchants',
  products: '/pages/admin/products/products',
  orders: '/pages/admin/orders/orders',
  feedbacks: '/pages/admin/feedbacks/feedbacks'
};

const DEFAULT_STATS = {
  todayOrders: 0,
  totalUsers: 0,
  totalMerchants: 0,
  totalProducts: 0,
  orderTrend: 0,
  userTrend: 0,
  merchantTrend: 0,
  productTrend: 0
};

const DEFAULT_PENDING_TASKS = {
  pendingMerchants: 0,
  pendingOrders: 0,
  pendingFeedbacks: 0
};

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildTrendMeta(value) {
  const n = toNum(value);
  return {
    dir: n > 0 ? 1 : n < 0 ? -1 : 0,
    abs: Math.abs(n)
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatYmd(dateObj) {
  return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
}

function toMd(ymd) {
  const s = String(ymd || '');
  // YYYY-MM-DD -> MM-DD
  if (s.length >= 10) return s.slice(5, 10);
  return s;
}

function getLastNDaysRange(days) {
  const n = Number(days) || 7;
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - (n - 1));

  const startYmd = formatYmd(start);
  const endYmd = formatYmd(end);

  return {
    startTime: `${startYmd} 00:00:00`,
    endTime: `${endYmd} 23:59:59`,
    days: n,
    startYmd,
    endYmd
  };
}

function buildLastNDaysAxis(days) {
  const n = Number(days) || 7;
  const end = new Date();
  const axis = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    axis.push(formatYmd(d));
  }
  return axis;
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      nickName: '管理员'
    },
    currentDate: '',
    currentTime: '',
    unreadNotifications: 0,
    stats: {
      todayOrders: 0,
      totalUsers: 0,
      totalMerchants: 0,
      totalProducts: 0,
      orderTrend: 0,
      userTrend: 0,
      merchantTrend: 0,
      productTrend: 0
    },
    pendingTasks: {
      pendingMerchants: 0,
      pendingOrders: 0,
      pendingFeedbacks: 0
    },
    chartType: 'orders',
    trendLoading: false,
    trendData: [],
    canvasWidth: 300,
    canvasHeight: 150
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.checkLoginStatus();
    this.initCanvasSize();
    this.updateDateTime();
    this.loadDashboardData();
    this.loadTrendData();
  },

  initCanvasSize() {
    try {
      const info = wx.getSystemInfoSync();
      const w = Number(info && info.windowWidth) || 300;
      const h = Math.max(140, Math.min(220, Math.round(w * 0.45)));
      this.setData({ canvasWidth: w, canvasHeight: h });
    } catch (_) {
      // keep defaults
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
    } else {
      this.setData({
        userInfo: {
          nickName: userInfo.nickName || '管理员'
        }
      });
    }
  },

  /**
   * 更新日期和时间
   */
  updateDateTime() {
    const now = new Date();
    this.setData({
      currentDate: now.toLocaleDateString(),
      currentTime: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    });
  },

  /**
   * 加载仪表盘数据
   */
  async loadDashboardData() {
    wx.showLoading({
      title: '加载数据中...'
    });
    
    try {
      // 调用真实API获取数据
      const statsRes = await getAdminDashboardStats();
      
      const payload = (statsRes && statsRes.data) ? statsRes.data : null;
      if (!payload) return;

      this.setData({
        stats: {
          ...DEFAULT_STATS,
          todayOrders: payload.todayOrders || 0,
          totalUsers: payload.totalUsers || 0,
          totalMerchants: payload.totalMerchants || 0,
          totalProducts: payload.totalProducts || 0,
          orderTrend: toNum(payload.orderTrend),
          userTrend: toNum(payload.userTrend),
          merchantTrend: toNum(payload.merchantTrend),
          productTrend: toNum(payload.productTrend),

          orderTrendDir: buildTrendMeta(payload.orderTrend).dir,
          orderTrendAbs: buildTrendMeta(payload.orderTrend).abs,
          userTrendDir: buildTrendMeta(payload.userTrend).dir,
          userTrendAbs: buildTrendMeta(payload.userTrend).abs,
          merchantTrendDir: buildTrendMeta(payload.merchantTrend).dir,
          merchantTrendAbs: buildTrendMeta(payload.merchantTrend).abs,
          productTrendDir: buildTrendMeta(payload.productTrend).dir,
          productTrendAbs: buildTrendMeta(payload.productTrend).abs
        },
        pendingTasks: {
          ...DEFAULT_PENDING_TASKS,
          pendingMerchants: payload.pendingMerchants || 0,
          pendingOrders: payload.pendingOrders || 0,
          pendingFeedbacks: payload.pendingFeedbacks || 0
        },
        unreadNotifications: payload.unreadNotifications || 0
      });
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async loadTrendData() {
    if (this.data.trendLoading) return;
    this.setData({ trendLoading: true, trendData: [] });

    const { startTime, endTime, days } = getLastNDaysRange(7);

    try {
      if (this.data.chartType === 'users') {
        const res = await getAdminUserTrend({ startTime, endTime, granularity: 'day' });
        const list = (res && res.data) ? res.data : [];
        const byDate = {};
        (Array.isArray(list) ? list : []).forEach((row) => {
          if (!row || !row.date) return;
          byDate[String(row.date)] = Number(row.userCount) || 0;
        });
        const axis = buildLastNDaysAxis(days);
        const trendData = axis.map((ymd) => ({ date: toMd(ymd), value: byDate[ymd] || 0 }));
        this.setData({ trendData, trendLoading: false }, () => this.drawTrendChart());
        return;
      }

      const res = await getAdminOrderTrend({ startTime, endTime, granularity: 'day' });
      const list = (res && res.data) ? res.data : [];
      const byDate = {};
      (Array.isArray(list) ? list : []).forEach((row) => {
        if (!row || !row.date) return;
        let total = 0;
        Object.keys(row).forEach((k) => {
          if (k === 'date') return;
          total += Number(row[k]) || 0;
        });
        byDate[String(row.date)] = total;
      });
      const axis = buildLastNDaysAxis(days);
      const trendData = axis.map((ymd) => ({ date: toMd(ymd), value: byDate[ymd] || 0 }));
      this.setData({ trendData, trendLoading: false }, () => this.drawTrendChart());
    } catch (error) {
      console.error('加载趋势数据失败:', error);
      this.setData({ trendData: [], trendLoading: false });
    }
  },

  drawTrendChart() {
    const data = this.data.trendData;
    if (!Array.isArray(data) || data.length === 0) return;

    const ctx = wx.createCanvasContext('trendChart');

    const width = Number(this.data.canvasWidth) || 300;
    const height = Number(this.data.canvasHeight) || 150;

    // 背景
    ctx.setFillStyle('#f9f9f9');
    ctx.fillRect(0, 0, width, height);

    const left = 34;
    const right = 18;
    const top = 18;
    const bottom = 26;
    const innerWidth = Math.max(10, width - left - right);
    const innerHeight = Math.max(10, height - top - bottom);

    const maxValue = Math.max(...data.map(item => Number(item.value) || 0));
    const minValue = Math.min(...data.map(item => Number(item.value) || 0));
    const valueRange = maxValue - minValue || 1;

    // Y 轴最大/最小值标注
    ctx.setFillStyle('#999');
    ctx.setFontSize(11);
    ctx.fillText(String(maxValue), 6, top + 10);
    ctx.fillText(String(minValue), 6, top + innerHeight);

    // 折线
    ctx.setStrokeStyle('#1890ff');
    ctx.setLineWidth(2);
    ctx.beginPath();

    data.forEach((item, index) => {
      const x = left + (innerWidth / (data.length - 1)) * index;
      const y = top + innerHeight - ((Number(item.value) - minValue) / valueRange) * innerHeight;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // 点
    data.forEach((item, index) => {
      const x = left + (innerWidth / (data.length - 1)) * index;
      const y = top + innerHeight - ((Number(item.value) - minValue) / valueRange) * innerHeight;
      ctx.setFillStyle('#1890ff');
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 数值标注（每个点的 value）
    ctx.setFillStyle('#333');
    ctx.setFontSize(10);
    data.forEach((item, index) => {
      const x = left + (innerWidth / (data.length - 1)) * index;
      const y = top + innerHeight - ((Number(item.value) - minValue) / valueRange) * innerHeight;
      const text = String(Number(item.value) || 0);
      const textWidth = text.length * 6; // 粗略估算，避免复杂测量

      const drawX = Math.max(0, Math.min(width - textWidth - 2, x - textWidth / 2));
      const drawY = y <= top + 14 ? y + 14 : y - 8;
      ctx.fillText(text, drawX, drawY);
    });

    // 日期
    ctx.setFillStyle('#666');
    ctx.setFontSize(12);
    data.forEach((item, index) => {
      const x = left + (innerWidth / (data.length - 1)) * index;
      ctx.fillText(String(item.date || ''), x - 15, height - 8);
    });

    ctx.draw();
  },

  /**
   * 跳转到指定页面
   */
  goToPage(e) {
    const page = e.currentTarget.dataset.page;
    const url = PAGE_ROUTE_MAP[page];
    if (!url) return;
    wx.navigateTo({ url });
  },

  /**
   * 跳转到通知页面
   */
  goToNotifications() {
    wx.navigateTo({
      url: '/pages/admin/notifications/notifications'
    });
  },

  /**
   * 切换图表类型
   */
  toggleChartType(e) {
    const type = e.currentTarget.dataset.type;
    if (!type || type === this.data.chartType) return;
    this.setData({ chartType: type }, () => {
      this.loadTrendData();
    });
  },

  /**
   * 刷新数据
   */
  refreshData() {
    this.loadDashboardData();
    wx.showToast({
      title: '数据已刷新',
      icon: 'success'
    });
  }
})