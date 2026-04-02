const { getMerchants, getCategories } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

const FILTER_TITLE_MAP = {
  delivery: '校园内配送',
  certified: '校内认证商家',
  quick: '课间极速达',
  rated: '师生高口碑'
};

function normalizeMerchants(merchants) {
  return (Array.isArray(merchants) ? merchants : []).map(m => ({
    ...m,
    logo: toNetworkUrl(m.logo)
  }));
}

function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : []).map(c => ({
    ...c,
    icon: toNetworkUrl(c.icon)
  }));
}

Page({
  data: {
    merchants: [],
    categories: [],
    currentCategory: 0
  },

  onLoad() {
    this.loadData();
  },

  /**
   * 加载数据
   */
  async loadData() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const [merchantsRes, categoriesRes] = await Promise.all([
        getMerchants({}),
        getCategories({ type: 2 })
      ]);

      const merchants = normalizeMerchants(merchantsRes && merchantsRes.data && merchantsRes.data.merchants);
      const categories = normalizeCategories(categoriesRes && categoriesRes.data && categoriesRes.data.categories);

      this.setData({ merchants, categories });
      
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
    if (categoryId == null) return;
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
    const merchantName = e.currentTarget.dataset.name;
    const titleParam = merchantName ? `&title=${encodeURIComponent(merchantName)}` : '';
    wx.navigateTo({
      url: `/pages/merchant/merchant?id=${merchantId}${titleParam}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    (async () => {
      try {
        await this.loadData();
      } finally {
        wx.stopPullDownRefresh();
      }
    })();
  },

  /**
   * 跳转到搜索页面
   */
  goToSearch() {
    wx.navigateTo({
      url: `/pages/search/search?title=${encodeURIComponent('搜索')}`
    });
  },

  /**
   * 筛选商家
   */
  filterMerchants(e) {
    const type = e.currentTarget.dataset.type;
    const title = FILTER_TITLE_MAP[type] ? `筛选：${FILTER_TITLE_MAP[type]}` : '搜索';
    wx.navigateTo({
      url: `/pages/search/search?filter=${type}&title=${encodeURIComponent(title)}`
    });
  }
});