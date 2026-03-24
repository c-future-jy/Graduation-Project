Page({
  data: {
    // 分类数据
    categories: [],
    // 分类ID映射关系
    categoryMap: {
      1: 'breakfast',
      2: 'lunch',
      3: 'noodles',
      4: 'rice',
      5: 'salad',
      6: 'snack',
      7: 'drink',
      8: 'market'
    },
    // 反向分类ID映射关系
    reverseCategoryMap: {
      'breakfast': 1,
      'lunch': 2,
      'noodles': 3,
      'rice': 4,
      'salad': 5,
      'snack': 6,
      'drink': 7,
      'market': 8
    },
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

  onLoad: function (options) {
    // 从本地存储中获取分类参数
    const selectedCategory = wx.getStorageSync('selectedCategory');
    console.log('从本地存储中获取的selectedCategory:', selectedCategory);
    // 清除本地存储中的分类参数
    wx.removeStorageSync('selectedCategory');
    // 初始化加载分类列表
    this.loadCategories(selectedCategory);
  },

  // 加载分类列表
  loadCategories: function (initialCategory) {
    console.log('分类页面接收到的initialCategory:', initialCategory);
    // 导入API模块
    const { getCategories } = require('../../utils/api');

    // 调用API获取分类数据
    getCategories({ type: 1 })
      .then(res => {
        // 处理API返回的数据
        const categories = res.data.categories.map(category => ({
          id: this.data.categoryMap[category.id] || category.id.toString(),
          name: category.name,
          icon: category.icon || '../../assets/images/message.jpg'
        }));

        // 添加推荐分类
        categories.unshift({
          id: 'recommend',
          name: '推荐',
          icon: '../../assets/images/message.jpg'
        });

        this.setData({
          categories: categories
        });

        // 初始化检查时间敏感分类
        this.checkTimeSensitiveCategories();
        
        // 初始化加载分类数据
        let categoryToLoad = initialCategory || 'recommend';
        console.log('处理前的categoryToLoad:', categoryToLoad);
        
        // 处理数字ID，映射到对应的字符串ID
        if (typeof categoryToLoad === 'string' && !isNaN(categoryToLoad)) {
          categoryToLoad = this.data.categoryMap[parseInt(categoryToLoad)] || categoryToLoad;
        } else if (typeof categoryToLoad === 'number') {
          categoryToLoad = this.data.categoryMap[categoryToLoad] || categoryToLoad.toString();
        }
        
        console.log('处理后的categoryToLoad:', categoryToLoad);
        console.log('当前的categories:', categories);
        
        // 查找对应的分类
        let category = categories.find(cat => cat.id === categoryToLoad);
        console.log('根据categoryToLoad找到的category:', category);
        
        // 如果找不到，尝试直接使用initialCategory作为id查找
        if (!category && initialCategory) {
          category = categories.find(cat => cat.id === initialCategory);
          console.log('根据initialCategory找到的category:', category);
        }
        
        // 如果还是找不到，尝试根据分类名称查找
        if (!category && initialCategory) {
          // 尝试从首页传递的分类名称中提取关键词
          const categoryNames = categories.map(cat => cat.name);
          console.log('当前分类名称列表:', categoryNames);
          
          // 简单的关键词匹配
          const keywords = ['奶茶', '便利', '水果', '快餐'];
          const categoryKeywords = {
            '奶茶': 'drink',
            '便利': 'market',
            '水果': 'salad',
            '快餐': 'lunch'
          };
          
          for (const keyword of keywords) {
            if (initialCategory.toString().includes(keyword)) {
              const mappedCategoryId = categoryKeywords[keyword];
              category = categories.find(cat => cat.id === mappedCategoryId);
              if (category) {
                console.log('根据关键词', keyword, '找到的category:', category);
                break;
              }
            }
          }
        }
        
        // 如果还是找不到，使用推荐分类
        if (!category) {
          category = categories[0];
          console.log('使用推荐分类:', category);
        }
        
        this.setData({
          currentCategory: category.id,
          currentCategoryName: category.name
        });
        
        // 加载对应分类的商家数据
        this.loadMerchants(category.id);
      })
      .catch(err => {
        console.error('获取分类数据失败:', err);
        // 错误时使用默认分类
        const defaultCategories = [
          {
            id: 'recommend',
            name: '推荐',
            icon: '../../assets/images/message.jpg'
          },
          {
            id: 'breakfast',
            name: '早餐',
            icon: '../../assets/images/message.jpg'
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
            icon: '../../assets/images/message.jpg'
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
        ];

        this.setData({
          categories: defaultCategories
        });

        // 初始化检查时间敏感分类
        this.checkTimeSensitiveCategories();
        
        // 初始化加载分类数据
        let categoryToLoad = initialCategory || 'recommend';
        // 处理数字ID，映射到对应的字符串ID
        if (typeof categoryToLoad === 'string' && !isNaN(categoryToLoad)) {
          categoryToLoad = this.data.categoryMap[parseInt(categoryToLoad)] || categoryToLoad;
        } else if (typeof categoryToLoad === 'number') {
          categoryToLoad = this.data.categoryMap[categoryToLoad] || categoryToLoad.toString();
        }
        // 查找对应的分类
        let category = defaultCategories.find(cat => cat.id === categoryToLoad);
        // 如果找不到，尝试直接使用initialCategory作为id查找
        if (!category && initialCategory) {
          category = defaultCategories.find(cat => cat.id === initialCategory);
        }
        // 如果还是找不到，使用推荐分类
        if (!category) {
          category = defaultCategories[0];
        }
        
        this.setData({
          currentCategory: category.id,
          currentCategoryName: category.name
        });
        
        // 加载对应分类的商家数据
        this.loadMerchants(category.id);
      });
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