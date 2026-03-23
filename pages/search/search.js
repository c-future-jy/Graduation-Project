// pages/search/search.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    searchText: '',
    searchHistory: [],
    hotSearches: ['校园食堂', '奶茶店', '水果捞', '炸鸡', '披萨', '寿司', '甜品', '咖啡'],
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
   * 搜索框聚焦
   */
  onSearchFocus(e) {
    console.log('搜索框聚焦:', e);
  },

  /**
   * 搜索框点击
   */
  onSearchTap(e) {
    console.log('搜索框点击:', e);
  },

  /**
   * 执行搜索
   */
  search() {
    console.log('执行搜索:', this.data.searchText);
    const { searchText } = this.data;
    if (!searchText.trim()) return;

    // 保存搜索历史
    this.saveSearchHistory(searchText);

    // 调用搜索API
    wx.showLoading({ title: '搜索中...' });
    wx.request({
      url: 'http://localhost:3000/api/search',
      method: 'GET',
      data: { keyword: searchText },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          this.setData({
            searchResults: res.data.data.results || [],
            showResults: true
          });
        } else {
          this.setData({
            searchResults: [],
            showResults: true
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('搜索失败:', err);
        this.setData({
          searchResults: [],
          showResults: true
        });
      }
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