Page({
  data: {
    // 分类数据
    categories: [
      {
        id: 'recommend',
        name: '推荐',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'breakfast',
        name: '早餐',
        icon: '../../assets/images/message.jpg',
        isDisabled: false
      },
      {
        id: 'lunch',
        name: '午餐套餐',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'noodles',
        name: '面食粉类',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'rice',
        name: '米饭快餐',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'salad',
        name: '轻食沙拉',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'snack',
        name: '小吃夜宵',
        icon: '../../assets/images/message.jpg',
        isNightHighlight: false
      },
      {
        id: 'drink',
        name: '饮品甜点',
        icon: '../../assets/images/message.jpg'
      },
      {
        id: 'market',
        name: '超市便利',
        icon: '../../assets/images/message.jpg'
      }
    ],
    // 筛选标签
    filters: [
      { id: 'smart', name: '智能排序' },
      { id: 'distance', name: '距离最近' },
      { id: 'sales', name: '销量最高' },
      { id: 'rating', name: '评分最高' },
      { id: 'price_asc', name: '价格升序' },
      { id: 'price_desc', name: '价格降序' }
    ],
    // 当前选中的分类
    currentCategory: 'recommend',
    currentCategoryName: '推荐',
    // 当前选中的筛选标签
    currentFilter: 'smart',
    // 商家数据
    merchants: [],
    // 加载状态
    loading: false,
    // 网络异常
    networkError: false,
    // 拼单引导
    showGroupBuy: true
  },

  onLoad: function () {
    // 初始化检查时间敏感分类
    this.checkTimeSensitiveCategories();
    // 初始化加载推荐分类的商家数据
    this.loadMerchants('recommend');
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

    // 早餐分类：9点后禁用
    const breakfastIndex = updatedCategories.findIndex(cat => cat.id === 'breakfast');
    if (breakfastIndex !== -1) {
      updatedCategories[breakfastIndex].isDisabled = hour >= 9;
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
    const categoryName = this.data.categories.find(cat => cat.id === categoryId).name;
    
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

    // 导入API模块
    const { getMerchants } = require('../../utils/api');

    // 调用API获取商家数据
    getMerchants({ category: categoryId })
      .then(res => {
        // 处理API返回的数据
        const merchants = res.data.merchants.map(merchant => ({
          id: merchant.id,
          name: merchant.name,
          image: merchant.logo || '../../assets/tabbar/biyetu.jpg',
          distance: '100m', // 实际项目中可以根据地理位置计算
          deliveryTime: '30分钟', // 实际项目中可以根据商家设置
          minPrice: '¥15起送', // 实际项目中可以从商家数据中获取
          tags: ['校园认证', '满减优惠'], // 实际项目中可以从商家数据中获取
          hotDish: '热销商品', // 实际项目中可以从商家数据中获取
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
    wx.navigateTo({
      url: `/pages/merchant/merchant?id=${merchantId}`
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