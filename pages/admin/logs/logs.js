// pages/admin/logs/logs.js
const { getAdminLogs } = require('../../../utils/api');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    logs: [],
    loading: false,
    error: false,
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
    filters: {
      admin_id: '',
      operation: '',
      startTime: '',
      endTime: ''
    },
    showFilters: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadLogs();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时可以刷新数据
  },

  /**
   * 加载日志数据
   */
  async loadLogs(refresh = false) {
    if (this.data.loading) return;

    const page = refresh ? 1 : this.data.page;
    const pageSize = this.data.pageSize;
    const filters = this.data.filters;

    this.setData({ loading: true, error: false });

    try {
      const res = await getAdminLogs({
        page,
        pageSize,
        ...filters
      });

      if (res.success) {
        const logs = refresh ? res.data.logs : [...this.data.logs, ...res.data.logs];
        this.setData({
          logs,
          total: res.data.pagination.total,
          totalPages: res.data.pagination.totalPages,
          page,
          loading: false
        });
      } else {
        this.setData({ error: true, loading: false });
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
      }
    } catch (error) {
      console.error('加载日志失败:', error);
      this.setData({ error: true, loading: false });
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    try {
      await this.loadLogs(true);
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 上拉加载更多
   */
  onReachBottom() {
    if (this.data.loading) return;
    if (this.data.page < this.data.totalPages) {
      this.setData({ page: this.data.page + 1 });
      this.loadLogs();
    }
  },

  /**
   * 切换筛选面板
   */
  toggleFilters() {
    this.setData({ showFilters: !this.data.showFilters });
  },

  /**
   * 输入筛选条件
   */
  onFilterInput(e) {
    const { key } = e.currentTarget.dataset;
    const { value } = e.detail;
    this.setData({
      [`filters.${key}`]: value
    });
  },

  /**
   * 重置筛选条件
   */
  resetFilters() {
    this.setData({
      filters: {
        admin_id: '',
        operation: '',
        startTime: '',
        endTime: ''
      }
    });
  },

  /**
   * 应用筛选条件
   */
  applyFilters() {
    this.setData({ showFilters: false });
    this.loadLogs(true);
  },

  /**
   * 重试加载
   */
  retry() {
    this.loadLogs(true);
  },

  /**
   * 格式化时间
   */
  formatTime(time) {
    if (!time) return '';
    const date = new Date(time);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
});
