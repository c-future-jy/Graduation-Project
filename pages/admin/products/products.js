// pages/admin/products/products.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    products: [],
    total: 0,
    page: 1,
    pageSize: 10,
    hasMore: true,
    searchKeyword: '',
    merchantFilter: '',
    categoryFilter: '',
    statusFilter: '',
    selectedProducts: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.loadProducts();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (!token || !userInfo || userInfo.role !== 3) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  /**
   * 加载商品列表
   */
  async loadProducts() {
    if (this.data.loading || !this.data.hasMore) return;
    
    this.setData({ loading: true });
    
    try {
      // 模拟数据，实际项目中应调用API
      const products = [
        { id: 1, name: '校园午餐', merchant: '校园餐厅', category: '餐饮', price: 15.00, stock: 100, status: 1, statusText: '上架', createdAt: '2026-03-01 10:00:00' },
        { id: 2, name: '矿泉水', merchant: '校园超市', category: '饮料', price: 2.00, stock: 500, status: 1, statusText: '上架', createdAt: '2026-03-02 11:00:00' },
        { id: 3, name: '笔记本', merchant: '文具店', category: '文具', price: 5.00, stock: 50, status: 1, statusText: '上架', createdAt: '2026-03-03 12:00:00' },
        { id: 4, name: '珍珠奶茶', merchant: '奶茶店', category: '饮料', price: 10.00, stock: 20, status: 1, statusText: '上架', createdAt: '2026-03-04 13:00:00' },
        { id: 5, name: '苹果', merchant: '水果店', category: '水果', price: 8.00, stock: 8, status: 1, statusText: '上架', createdAt: '2026-03-05 14:00:00' },
        { id: 6, name: '打印服务', merchant: '打印店', category: '服务', price: 1.00, stock: 999, status: 1, statusText: '上架', createdAt: '2026-03-06 15:00:00' },
        { id: 7, name: '咖啡', merchant: '咖啡店', category: '饮料', price: 15.00, stock: 30, status: 1, statusText: '上架', createdAt: '2026-03-07 16:00:00' },
        { id: 8, name: '教材', merchant: '书店', category: '图书', price: 50.00, stock: 10, status: 0, statusText: '下架', createdAt: '2026-03-08 17:00:00' },
        { id: 9, name: '生日蛋糕', merchant: '蛋糕店', category: '食品', price: 100.00, stock: 5, status: 1, statusText: '上架', createdAt: '2026-03-09 18:00:00' },
        { id: 10, name: '耳环', merchant: '饰品店', category: '饰品', price: 20.00, stock: 15, status: 1, statusText: '上架', createdAt: '2026-03-10 19:00:00' }
      ];
      
      const total = 100;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      this.setData({
        products: this.data.page === 1 ? products : [...this.data.products, ...products],
        total,
        hasMore,
        loading: false
      });
    } catch (error) {
      console.error('加载商品列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  /**
   * 搜索商品
   */
  searchProducts() {
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 筛选商品
   */
  filterProducts() {
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 选择商品
   */
  selectProduct(e) {
    const productId = e.currentTarget.dataset.id;
    let selectedProducts = this.data.selectedProducts;
    
    if (selectedProducts.includes(productId)) {
      selectedProducts = selectedProducts.filter(id => id !== productId);
    } else {
      selectedProducts.push(productId);
    }
    
    this.setData({ selectedProducts });
  },

  /**
   * 全选商品
   */
  selectAllProducts(e) {
    const allSelected = e.detail.value[0];
    let selectedProducts = [];
    
    if (allSelected) {
      selectedProducts = this.data.products.map(product => product.id);
    }
    
    this.setData({ selectedProducts });
  },

  /**
   * 批量下架商品
   */
  batchOfflineProducts() {
    if (this.data.selectedProducts.length === 0) {
      wx.showToast({ title: '请选择要下架的商品', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量下架',
      content: `确定要下架选中的 ${this.data.selectedProducts.length} 个商品吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '下架成功' });
          this.setData({ selectedProducts: [] });
          this.loadProducts();
        }
      }
    });
  },

  /**
   * 批量上架商品
   */
  batchOnlineProducts() {
    if (this.data.selectedProducts.length === 0) {
      wx.showToast({ title: '请选择要上架的商品', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '批量上架',
      content: `确定要上架选中的 ${this.data.selectedProducts.length} 个商品吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: '上架成功' });
          this.setData({ selectedProducts: [] });
          this.loadProducts();
        }
      }
    });
  },

  /**
   * 切换商品状态
   */
  toggleProductStatus(e) {
    const productId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const action = status === 1 ? '下架' : '上架';
    
    wx.showModal({
      title: action + '商品',
      content: `确定要${action}该商品吗？`,
      success: (res) => {
        if (res.confirm) {
          // 实际项目中应调用API
          wx.showToast({ title: action + '成功' });
          this.loadProducts();
        }
      }
    });
  },

  /**
   * 查看商品详情
   */
  viewProductDetail(e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/products/detail?id=${productId}`
    });
  },

  /**
   * 编辑商品信息
   */
  editProduct(e) {
    const productId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/products/edit?id=${productId}`
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.loadProducts();
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, products: [] });
    this.loadProducts(() => {
      wx.stopPullDownRefresh();
    });
  }
})