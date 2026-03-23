const { getMerchants, getCategories } = require('../../utils/api');

Page({
  data: {
    merchants: [],
    categories: [],
    currentCategory: 0
  },

  onLoad(options) {
    this.loadData();
  },

  /**
   * 加载数据
   */
  async loadData() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 加载商家列表
      const merchantsRes = await getMerchants();
      this.setData({
        merchants: merchantsRes.data.merchants || []
      });

      // 加载分类列表
      const categoriesRes = await getCategories({ type: 2 });
      this.setData({
        categories: categoriesRes.data.categories || []
      });
      
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 选择分类
   */
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    this.setData({
      currentCategory: categoryId
    });
  },

  /**
   * 进入商家页面
   */
  goToMerchant(e) {
    const merchantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/merchant/merchant?id=${merchantId}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 跳转到搜索页面
   */
  goToSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    });
  }
});