// pages/merchant/dashboard/dashboard.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 商家信息
    merchantName: '校园便利店',
    
    // 核心数据统计
    todayOrders: 12,
    todaySales: 899.5,
    todayAvgOrder: 74.96,
    pendingOrders: 3,
    monthOrders: 320,
    monthSales: 25680.75,
    totalProducts: 45,
    lowStockProducts: 5,
    
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
    topProducts: [
      { id: 1, name: '可口可乐', sales: 120 },
      { id: 2, name: '康师傅方便面', sales: 98 },
      { id: 3, name: '农夫山泉', sales: 85 },
      { id: 4, name: '乐事薯片', sales: 76 },
      { id: 5, name: '奥利奥饼干', sales: 65 }
    ],
    
    // 最近订单
    recentOrders: [
      { id: 1, orderNo: 'ORD20260325001', status: 1, amount: 45.5, createdAt: '2026-03-25 14:30:25' },
      { id: 2, orderNo: 'ORD20260325002', status: 2, amount: 68.0, createdAt: '2026-03-25 13:15:42' },
      { id: 3, orderNo: 'ORD20260325003', status: 0, amount: 23.5, createdAt: '2026-03-25 11:20:18' },
      { id: 4, orderNo: 'ORD20260325004', status: 3, amount: 89.0, createdAt: '2026-03-25 10:05:33' },
      { id: 5, orderNo: 'ORD20260325005', status: 1, amount: 56.5, createdAt: '2026-03-25 09:45:12' }
    ],
    
    // 库存预警
    lowStockItems: [
      { id: 1, name: '雪碧', stock: 3 },
      { id: 2, name: '旺仔牛奶', stock: 5 },
      { id: 3, name: '火腿肠', stock: 7 },
      { id: 4, name: '面包', stock: 2 },
      { id: 5, name: '酸奶', stock: 4 }
    ],
    
    // 图表数据
    orderTrendData: [],
    salesTrendData: [],
    orderStatusData: [],
    
    // 加载状态
    loading: false,
    
    // 定时刷新
    refreshInterval: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.initDatePicker();
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
    
    this.setData({
      years,
      months,
      days,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    });
  },

  /**
   * 加载Dashboard数据
   */
  loadDashboardData() {
    this.setData({ loading: true });
    
    // 模拟API请求
    setTimeout(() => {
      // 实际项目中这里会调用聚合API获取所有数据
      this.loadStatisticsData();
      this.loadChartData();
      this.loadRecentOrders();
      this.loadLowStockItems();
      
      this.setData({ loading: false });
    }, 1000);
  },

  /**
   * 加载统计数据
   */
  loadStatisticsData() {
    // 模拟数据
    this.setData({
      todayOrders: 12,
      todaySales: 899.5,
      todayAvgOrder: 74.96,
      pendingOrders: 3,
      monthOrders: 320,
      monthSales: 25680.75,
      totalProducts: 45,
      lowStockProducts: 5
    });
  },

  /**
   * 加载图表数据
   */
  loadChartData() {
    // 模拟订单趋势数据
    const orderTrendData = [];
    const salesTrendData = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.getMonth() + 1 + '/' + date.getDate();
      orderTrendData.push({
        date: dateStr,
        value: Math.floor(Math.random() * 20) + 5
      });
      salesTrendData.push({
        date: dateStr,
        value: Math.floor(Math.random() * 1000) + 500
      });
    }
    
    // 模拟订单状态分布
    const orderStatusData = [
      { status: '待支付', value: 5 },
      { status: '待发货', value: 12 },
      { status: '已发货', value: 8 },
      { status: '已完成', value: 35 },
      { status: '已取消', value: 3 }
    ];
    
    this.setData({
      orderTrendData,
      salesTrendData,
      orderStatusData
    });
    
    // 绘制图表
    this.drawOrderTrendChart();
    this.drawSalesTrendChart();
    this.drawOrderStatusChart();
  },

  /**
   * 加载最近订单
   */
  loadRecentOrders() {
    // 模拟数据
    this.setData({
      recentOrders: [
        { id: 1, orderNo: 'ORD20260325001', status: 1, amount: 45.5, createdAt: '2026-03-25 14:30:25' },
        { id: 2, orderNo: 'ORD20260325002', status: 2, amount: 68.0, createdAt: '2026-03-25 13:15:42' },
        { id: 3, orderNo: 'ORD20260325003', status: 0, amount: 23.5, createdAt: '2026-03-25 11:20:18' },
        { id: 4, orderNo: 'ORD20260325004', status: 3, amount: 89.0, createdAt: '2026-03-25 10:05:33' },
        { id: 5, orderNo: 'ORD20260325005', status: 1, amount: 56.5, createdAt: '2026-03-25 09:45:12' }
      ]
    });
  },

  /**
   * 加载库存预警
   */
  loadLowStockItems() {
    // 模拟数据
    this.setData({
      lowStockItems: [
        { id: 1, name: '雪碧', stock: 3 },
        { id: 2, name: '旺仔牛奶', stock: 5 },
        { id: 3, name: '火腿肠', stock: 7 },
        { id: 4, name: '面包', stock: 2 },
        { id: 5, name: '酸奶', stock: 4 }
      ]
    });
  },

  /**
   * 切换时间范围
   */
  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    // 实际项目中这里会根据时间范围重新加载数据
    this.loadChartData();
    console.log('切换时间范围:', range);
  },

  /**
   * 切换排行数量
   */
  switchRankLimit(e) {
    const limit = e.currentTarget.dataset.limit;
    this.setData({ rankLimit: limit });
    // 实际项目中这里会根据数量重新加载数据
    console.log('切换排行数量:', limit);
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
    
    // 实际项目中这里会根据选择的日期范围重新加载数据
    this.loadChartData();
  },

  /**
   * 手动刷新数据
   */
  refreshData() {
    wx.showToast({ title: '刷新中...', icon: 'loading' });
    this.loadDashboardData();
    setTimeout(() => {
      wx.showToast({ title: '刷新成功', icon: 'success' });
    }, 1000);
  },

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    // 每30秒自动刷新一次数据
    this.data.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 30000);
  },

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.data.refreshInterval) {
      clearInterval(this.data.refreshInterval);
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
      ctx.fillText(item.status + ': ' + item.value, x + 25, y + 12);
    });
    
    ctx.draw();
  },

  /**
   * 获取订单状态文本
   */
  getStatusText(status) {
    const statusMap = {
      0: '待支付',
      1: '待发货',
      2: '已发货',
      3: '已完成',
      4: '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 获取订单状态颜色
   */
  getStatusColor(status) {
    const colorMap = {
      0: '#ff9800', // 待支付 - 橙色
      1: '#2196f3', // 待发货 - 蓝色
      2: '#4caf50', // 已发货 - 绿色
      3: '#9c27b0', // 已完成 - 紫色
      4: '#f44336'  // 已取消 - 红色
    };
    return colorMap[status] || '#999';
  },

  /**
   * 快捷操作 - 发布新商品
   */
  goToAddProduct() {
    wx.navigateTo({ url: '/pages/merchant/products/add' });
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
    wx.navigateTo({ url: `/pages/merchant/orders/detail?id=${orderId}` });
  },

  /**
   * 提醒补货
   */
  remindRestock(e) {
    const productId = e.currentTarget.dataset.id;
    wx.showToast({ title: '已发送补货提醒', icon: 'success' });
    console.log('提醒补货:', productId);
  }
})