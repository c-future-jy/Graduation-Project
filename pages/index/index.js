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
      console.log('首页加载的分类数据:', categoriesRes.data.categories);
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
    
    // 存储分类参数到本地存储
    wx.setStorageSync('selectedCategory', categoryId);
    
    // 跳转到分类页面（tabBar页面）
    wx.switchTab({
      url: '/pages/cate/cate',
      fail: function(err) {
        wx.showToast({
          title: '跳转失败，请稍后重试',
          icon: 'none'
        });
        console.error('分类页面跳转失败:', err);
      }
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
  },

  /**
   * 筛选商家
   */
  filterMerchants(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/search/search?filter=${type}`
    });
  }
});