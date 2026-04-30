const { getMerchants, getCategories } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');
//处理商家数据，确保数据格式正确
function normalizeMerchants(merchants) {
  return (Array.isArray(merchants) ? merchants : []).map(m => ({
    ...m,
    logo: toNetworkUrl(m.logo)
  }));
}
//处理分类数据，确保数据格式正确
function normalizeCategories(categories) {
  return (Array.isArray(categories) ? categories : []).map(c => ({
    ...c,
    icon: toNetworkUrl(c.icon)
  }));
}
//从错误对象中提取错误信息，支持多种格式
function getErrMsg(err, fallback = '加载失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}

Page({
  data: {
    merchants: [],
    categories: [],
    currentCategory: 0
  },

  onLoad() {
    this._loadingCount = 0;
    this._loadingShown = false;
    this._loadingPromise = null;
    this._loadingShowAt = 0;
    this._hideLoadingTimer = null;
    this.loadData();
  },
//开始加载时调用，用于显示加载动画。
  _incLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;

    if (this._hideLoadingTimer) {
      clearTimeout(this._hideLoadingTimer);
      this._hideLoadingTimer = null;
    }

    this._loadingShowAt = Date.now();
    // 先标记“准备展示”，避免 show/hide 过快导致配对警告
    this._loadingShown = true;
    wx.showLoading({
      title: title || '加载中...',
      success: () => {
        this._loadingShown = true;
      },
      fail: () => {
        this._loadingShown = false;
      }
    });
  },
//加载完成后调用，用于隐藏加载动画。
  _decLoading() {
    const current = this._loadingCount || 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);
    this._loadingCount = next;
    if (next !== 0) return;
    if (!this._loadingShown) return;

    const minDurationMs = 150;
    const elapsed = this._loadingShowAt ? Date.now() - this._loadingShowAt : minDurationMs;
    const delay = Math.max(0, minDurationMs - elapsed);

    const doHide = () => {
      this._hideLoadingTimer = null;
      wx.hideLoading({
        complete: () => {
          this._loadingShown = false;
        }
      });
    };

    if (delay > 0) {
      this._hideLoadingTimer = setTimeout(doHide, delay);
    } else {
      doHide();
    }
  },

  /**
   * 加载数据
   */
  async loadData() {
    if (this._loadingPromise) return this._loadingPromise;

    this._incLoading('加载中...');
    this._loadingPromise = (async () => {
      try {
        const [merchantsRes, categoriesRes] = await Promise.all([
          getMerchants({}),
          getCategories({ type: 2 })
        ]);

        const merchants = normalizeMerchants(merchantsRes && merchantsRes.data && merchantsRes.data.merchants);
        const categories = normalizeCategories(categoriesRes && categoriesRes.data && categoriesRes.data.categories);

        this.setData({ merchants, categories });
      } catch (error) {
        wx.showToast({ title: getErrMsg(error, '加载失败'), icon: 'none' });
      } finally {
        this._decLoading();
        this._loadingPromise = null;
      }
    })();

    return this._loadingPromise;
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
  }
});