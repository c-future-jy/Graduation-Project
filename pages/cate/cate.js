const { getCategories, getMerchants } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

const DEFAULT_ICON = '../../assets/images/message.jpg';
const DEFAULT_MERCHANT_IMAGE = '../../assets/tabbar/biyetu.jpg';
//分类ID映射表
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
//筛选选项
const FILTERS = [
  { id: 'smart', name: '智能排序' },
  { id: 'distance', name: '距离最近' },
  { id: 'sales', name: '销量最高' },
  { id: 'rating', name: '评分最高' },
  { id: 'price_asc', name: '价格升序' },
  { id: 'price_desc', name: '价格降序' }
];

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}
//获取错误消息
function getErrMsg(err, fallback = '加载失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}
//在网络不稳定的情况下，分类页面仍然能够正常显示和使用
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
//标准化分类键，确保分类ID的格式一致性
function normalizeCategoryKey(value) {
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  const s = String(value).trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) {
    return s;
  }
  return s;
}
//根据初始分类ID选择对应的分类对象
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

function normalizeCategoriesFromApi(res) {
  const list = (res && res.data && Array.isArray(res.data.categories)) ? res.data.categories : [];
  const mapped = list.map((category) => ({
    // 关键：分类 id 使用后端真实 id（数字/字符串），不要再映射到固定 breakfast/lunch
    // 否则当后端分类 id 不是 1~8 时，会导致分类筛选失效。
    id: toStr(category.id),
    name: category.name,
    icon: toNetworkUrl(category.icon) || DEFAULT_ICON
  }));
  // 确保有推荐入口
  return [{ id: 'recommend', name: '推荐', icon: DEFAULT_ICON }].concat(mapped);
}

function normalizeMerchantsFromApi(res) {
  const list = (res && res.data && Array.isArray(res.data.merchants)) ? res.data.merchants : [];
  return list.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    image: toNetworkUrl(merchant.logo) || DEFAULT_MERCHANT_IMAGE,
    address: merchant.address || '',
    phone: merchant.phone || '',
    description: merchant.description || '',
    isClosed: merchant.status !== 1
  }));
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
//页面加载时调用，用于初始化分类和商家数据
  onLoad() {
    this._categoriesPromise = null;
    this._merchantsReqId = 0;

    const selectedCategory = wx.getStorageSync('selectedCategory');
    wx.removeStorageSync('selectedCategory');

    this.bootstrap(selectedCategory);
  },

  async bootstrap(initialCategory) {
    const categories = await this.loadCategories();
    this.initCategoriesAndLoad(categories, initialCategory);
  },
//加载分类数据，支持API请求失败时的降级处理
  async loadCategories() {
    if (this._categoriesPromise) return this._categoriesPromise;

    this._categoriesPromise = (async () => {
      try {
        const res = await getCategories({ type: 1 });
        return normalizeCategoriesFromApi(res);
      } catch (e) {
        return buildDefaultCategories();
      }
    })().finally(() => {
      // 只缓存一次加载过程；后续若需要强刷，可手动置空
      this._categoriesPromise = null;
    });

    return this._categoriesPromise;
  },

  initCategoriesAndLoad(categories, initialCategory) {
    const safeCategories = Array.isArray(categories) ? categories : [];
    this.setData({ categories: safeCategories });
    this.checkTimeSensitiveCategories();

    const picked = pickInitialCategory(safeCategories, initialCategory);
    this.setData({
      currentCategory: picked.id,
      currentCategoryName: picked.name,
      currentFilter: 'smart',
      networkError: false
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
    if (categoryId === 'breakfast') {
      const hour = new Date().getHours();
      const isBreakfastTime = hour < 9;
      if (!isBreakfastTime) {
        wx.showToast({
          title: '当前不在早餐时间（9点前）',
          icon: 'none',
          duration: 2000
        });
      }
    }

    // 先更新时间敏感标记，避免 UI 状态滞后
    this.checkTimeSensitiveCategories();
    
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
  async loadMerchants(categoryId) {
    const cid = normalizeCategoryKey(categoryId) || 'recommend';
    const reqId = (this._merchantsReqId || 0) + 1;
    this._merchantsReqId = reqId;

    this.setData({ loading: true, networkError: false });

    try {
      // 兼容：老后端只认 category=breakfast 等；新后端支持 category_id=数字
      const isNumericId = /^\d+$/.test(String(cid));
      const res = isNumericId
        ? await getMerchants({ category_id: cid })
        : await getMerchants({ category: cid });
      if (reqId !== this._merchantsReqId) return;

      const merchants = normalizeMerchantsFromApi(res);
      this.setData({ merchants });
    } catch (err) {
      if (reqId !== this._merchantsReqId) return;
      console.error('获取商家数据失败:', err);
      this.setData({ networkError: true, merchants: [] });
    } finally {
      if (reqId === this._merchantsReqId) {
        this.setData({ loading: false });
      }
    }
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

  async onPullDownRefresh() {
    try {
      await this.loadMerchants(this.data.currentCategory);
    } catch (e) {
      wx.showToast({ title: getErrMsg(e, '刷新失败'), icon: 'none' });
    } finally {
      wx.stopPullDownRefresh();
    }
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