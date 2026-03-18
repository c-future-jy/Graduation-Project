// pages/search/search.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    searchText: '',
    searchHistory: [],
    hotSearches: ['早餐', '午餐', '奶茶', '水果', '零食', '外卖'],
    searchResults: [],
    showResults: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadSearchHistory();
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

  /**
   * 执行搜索
   */
  search() {
    const { searchText } = this.data;
    if (!searchText.trim()) return;

    // 保存搜索历史
    this.saveSearchHistory(searchText);

    // 模拟搜索结果
    this.setData({
      searchResults: [
        { id: 1, title: `搜索结果：${searchText} 相关内容1`, desc: '这是搜索结果的描述信息', meta: '2026-03-18' },
        { id: 2, title: `搜索结果：${searchText} 相关内容2`, desc: '这是搜索结果的描述信息', meta: '2026-03-18' },
        { id: 3, title: `搜索结果：${searchText} 相关内容3`, desc: '这是搜索结果的描述信息', meta: '2026-03-18' }
      ],
      showResults: true
    });
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
    this.setData({
      searchText: keyword
    });
    this.search();
  },

  /**
   * 点击热门搜索
   */
  clickHotSearch(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      searchText: keyword
    });
    this.search();
  },

  /**
   * 点击搜索结果
   */
  clickResult(e) {
    const resultId = e.currentTarget.dataset.id;
    wx.showToast({
      title: `点击了结果 ${resultId}`,
      icon: 'none'
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadSearchHistory();
    wx.stopPullDownRefresh();
  }
})