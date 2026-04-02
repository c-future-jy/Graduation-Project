const { getCategories, getMerchants } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

const DEFAULT_ICON = '../../assets/images/message.jpg';
const DEFAULT_MERCHANT_IMAGE = '../../assets/tabbar/biyetu.jpg';

const CATEGORY_ID_MAP = {
  1: 'breakfast',
  2: 'lunch',
  3: 'noodles',
  4: 'rice',
  5: 'salad',
  6: 'snack',
  7: 'drink',
  8: 'market'
};

const FILTERS = [
  { id: 'smart', name: '智能排序' },
  { id: 'distance', name: '距离最近' },
  { id: 'sales', name: '销量最高' },
  { id: 'rating', name: '评分最高' },
  { id: 'price_asc', name: '价格升序' },
  { id: 'price_desc', name: '价格降序' }
];

function buildDefaultCategories() {
  return [
    { id: 'recommend', name: '推荐', icon: DEFAULT_ICON },
    { id: 'breakfast', name: '早餐', icon: DEFAULT_ICON },
    { id: 'lunch', name: '午餐套餐', icon: DEFAULT_ICON },
    { id: 'noodles', name: '面食粉类', icon: DEFAULT_ICON },
    { id: 'rice', name: '米饭快餐', icon: DEFAULT_ICON },
    { id: 'salad', name: '轻食沙拉', icon: DEFAULT_ICON },
    { id: 'snack', name: '小吃夜宵', icon: DEFAULT_ICON },
    { id: 'drink', name: '饮品甜点', icon: DEFAULT_ICON },
    { id: 'market', name: '超市便利', icon: DEFAULT_ICON }
  ];
}

function normalizeCategoryKey(value) {
  if (value == null) return '';
  if (typeof value === 'number') return CATEGORY_ID_MAP[value] || String(value);
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    return CATEGORY_ID_MAP[parseInt(s, 10)] || s;
  }
  return s;
}

function pickInitialCategory(categories, initialCategory) {
  const desiredId = normalizeCategoryKey(initialCategory) || 'recommend';
  let category = categories.find(cat => cat.id === desiredId);
  if (category) return category;

  // 兼容：首页可能传了更宽松的文本（如“奶茶”/“便利”）
  const text = String(initialCategory || '');
  const keywordMap = [
    { keyword: '奶茶', id: 'drink' },
    { keyword: '饮品', id: 'drink' },
    { keyword: '便利', id: 'market' },
    { keyword: '超市', id: 'market' },
    { keyword: '水果', id: 'salad' },
    { keyword: '轻食', id: 'salad' },
    { keyword: '快餐', id: 'lunch' }
  ];
  const matched = keywordMap.find(k => text.includes(k.keyword));
  if (matched) {
    category = categories.find(cat => cat.id === matched.id);
    if (category) return category;
  }

  return categories[0] || { id: 'recommend', name: '推荐' };
}

Page({
  data: {
    categories: [],
    filters: FILTERS,
    currentCategory: 'recommend',
    currentCategoryName: '推荐',
    currentFilter: 'smart',
    merchants: [],
    loading: false,
    networkError: false
  },

  onLoad: function (options) {
    // 从本地存储中获取分类参数
    const selectedCategory = wx.getStorageSync('selectedCategory');
    // 清除本地存储中的分类参数
    wx.removeStorageSync('selectedCategory');
    // 初始化加载分类列表
    this.loadCategories(selectedCategory);
  },

  // 加载分类列表
  loadCategories: function (initialCategory) {
    getCategories({ type: 1 })
      .then(res => {
        const list = (res && res.data && Array.isArray(res.data.categories)) ? res.data.categories : [];
        const categories = list.map(category => ({
          id: CATEGORY_ID_MAP[category.id] || String(category.id),
          name: category.name,
          icon: category.icon || DEFAULT_ICON
        }));
        categories.unshift({ id: 'recommend', name: '推荐', icon: DEFAULT_ICON });
        this.initCategoriesAndLoad(categories, initialCategory);
      })
      .catch(() => {
        this.initCategoriesAndLoad(buildDefaultCategories(), initialCategory);
      });
  },

  initCategoriesAndLoad(categories, initialCategory) {
    this.setData({ categories });
    this.checkTimeSensitiveCategories();

    const picked = pickInitialCategory(categories, initialCategory);
    this.setData({
      currentCategory: picked.id,
      currentCategoryName: picked.name
    });

    this.loadMerchants(picked.id);
  },

  onShow: function () {
    // 每次页面显示时检查时间敏感分类
    this.checkTimeSensitiveCategories();
  },

  // 检查时间敏感分类
  checkTimeSensitiveCategories: function () {
    const now = new Date();
    const hour = now.getHours();
    const updatedCategories = [...this.data.categories];

    // 早餐分类：9点后标记为非早餐时间（但不禁用点击）
    const breakfastIndex = updatedCategories.findIndex(cat => cat.id === 'breakfast');
    if (breakfastIndex !== -1) {
      updatedCategories[breakfastIndex].isBreakfastTime = hour < 9;
    }

    // 夜宵分类：20点后高亮
    const snackIndex = updatedCategories.findIndex(cat => cat.id === 'snack');
    if (snackIndex !== -1) {
      updatedCategories[snackIndex].isNightHighlight = hour >= 20;
    }

    this.setData({
      categories: updatedCategories
    });
  },

  // 切换分类
  switchCategory: function (e) {
    const categoryId = e.currentTarget.dataset.id;
    const category = this.data.categories.find(cat => cat.id === categoryId);
    if (!category) return;
    const categoryName = category.name;
    
    // 检查是否是早餐分类且不在早餐时间
    if (categoryId === 'breakfast' && !category.isBreakfastTime) {
      wx.showToast({
        title: '当前不在早餐时间（9点前）',
        icon: 'none',
        duration: 2000
      });
    }
    
    this.setData({
      currentCategory: categoryId,
      currentCategoryName: categoryName,
      currentFilter: 'smart'
    });
    
    // 加载对应分类的商家数据
    this.loadMerchants(categoryId);
  },

  // 切换筛选标签
  switchFilter: function (e) {
    const filterId = e.currentTarget.dataset.id;
    
    this.setData({
      currentFilter: filterId
    });
    
    // 根据筛选条件重新加载商家数据
    this.loadMerchants(this.data.currentCategory);
  },

  // 加载商家数据
  loadMerchants: function (categoryId) {
    this.setData({
      loading: true,
      networkError: false
    });

    // 调用API获取商家数据
    getMerchants({ category: categoryId })
      .then(res => {
        // 处理API返回的数据
        const list = (res && res.data && Array.isArray(res.data.merchants)) ? res.data.merchants : [];
        const merchants = list.map(merchant => ({
          id: merchant.id,
          name: merchant.name,
          image: toNetworkUrl(merchant.logo) || DEFAULT_MERCHANT_IMAGE,
          address: merchant.address || '',
          phone: merchant.phone || '',
          description: merchant.description || '',
          isClosed: merchant.status !== 1
        }));

        this.setData({
          loading: false,
          merchants: merchants
        });
      })
      .catch(err => {
        console.error('获取商家数据失败:', err);
        this.setData({
          loading: false,
          networkError: true,
          merchants: []
        });
      });
  },

  // 重试加载
  retry: function () {
    this.loadMerchants(this.data.currentCategory);
  },

  // 跳转到商家详情
  goToMerchant: function (e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    const titleParam = merchantName ? `&title=${encodeURIComponent(merchantName)}` : '';
    wx.navigateTo({
      url: `/pages/merchant/merchant?id=${merchantId}${titleParam}`
    });
  },

  // 跳转到推荐分类
  goToRecommend: function () {
    this.setData({
      currentCategory: 'recommend',
      currentCategoryName: '推荐',
      currentFilter: 'smart'
    });
    this.loadMerchants('recommend');
  },

  // 跳转到拼单详情
  goToGroupBuy: function () {
    // 这里可以跳转到拼单详情页面
    wx.showToast({
      title: '跳转到拼单详情',
      icon: 'none'
    });
  }
});