// pages/search/search.js
const { searchAll } = require('../../utils/api');

const FILTER_TITLE_MAP = {
  delivery: '校园内配送',
  certified: '校内认证商家',
  quick: '课间极速达',
  rated: '师生高口碑'
};

Page({

  /**
   * 页面的初始数据
   */
  data: {
    searchText: '',
    searchHistory: [],
    hotSearches: ['校园食堂', '奶茶店', '水果捞', '炸鸡', '披萨', '寿司', '甜品', '咖啡'],
    merchantResults: [],
    productResults: [],
    showResults: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    const filter = options && options.filter;
    const derivedTitle = FILTER_TITLE_MAP[filter] ? `筛选：${FILTER_TITLE_MAP[filter]}` : '搜索';
    wx.setNavigationBarTitle({ title: initialTitle || derivedTitle });

    this.loadSearchHistory();
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
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.setData({
      showResults: false
    });
  },

  /**
   * 加载搜索历史
   */
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({
      searchHistory: history
    });
  },

  /**
   * 搜索输入变化
   */
  onSearchInput(e) {
    this.setData({
      searchText: e.detail.value
    });
  },

  setEmptyResults() {
    this.setData({
      merchantResults: [],
      productResults: [],
      showResults: true
    });
  },

  applySearchResults(res) {
    const results = (res && res.data && Array.isArray(res.data.results)) ? res.data.results : [];
    const merchantResults = results.filter(item => item && item.type === 'merchant');
    const productResults = results.filter(item => item && item.type === 'product');
    this.setData({ merchantResults, productResults, showResults: true });
  },

  /**
   * 执行搜索
   */
  async search() {
    const rawText = this.data.searchText;
    const keyword = (rawText || '').trim();
    if (!keyword) return;

    this.saveSearchHistory(keyword);

    wx.showLoading({ title: '搜索中...' });
    try {
      const res = await searchAll({ keyword });
      if (res && res.success) {
        this.applySearchResults(res);
      } else {
        this.setEmptyResults();
      }
    } catch (err) {
      console.error('搜索失败:', err);
      this.setEmptyResults();
    } finally {
      wx.hideLoading();
    }
  },

  async runSearch(keyword) {
    this.setData({ searchText: keyword });
    await this.search();
  },

  /**
   * 保存搜索历史
   */
  saveSearchHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    // 移除重复项
    history = history.filter(item => item !== keyword);
    // 添加到开头
    history.unshift(keyword);
    // 限制历史记录数量
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    wx.setStorageSync('searchHistory', history);
    this.setData({
      searchHistory: history
    });
  },

  /**
   * 清除搜索历史
   */
  clearSearchHistory() {
    wx.removeStorageSync('searchHistory');
    this.setData({
      searchHistory: []
    });
  },

  /**
   * 点击历史记录
   */
  clickHistory(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.runSearch(keyword);
  },

  /**
   * 点击热门搜索
   */
  clickHotSearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.runSearch(keyword);
  },

  /**
   * 点击搜索结果
   */
  clickResult(e) {
    const { id, type, title } = e.currentTarget.dataset;
    const safeTitle = title ? `&title=${encodeURIComponent(title)}` : '';

    if (type === 'merchant') {
      wx.navigateTo({
        url: `/pages/merchant/merchant?id=${id}${safeTitle}`
      });
      return;
    }

    if (type === 'product') {
      wx.navigateTo({
        url: `/pages/detail/detail?id=${id}${safeTitle}`
      });
      return;
    }

    wx.showToast({ title: '未知结果类型', icon: 'none' });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadSearchHistory();
    wx.stopPullDownRefresh();
  }
})