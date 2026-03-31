// pages/admin/products/products.js
const {
  getAdminProductList,
  updateAdminProductStatus,
  batchUpdateAdminProducts
} = require('../../../utils/api');

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
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    wx.setNavigationBarTitle({ title: initialTitle || '商品管理' });
    this.loadProducts();
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
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
      // 调用真实API获取数据
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        merchant_id: this.data.merchantFilter,
        category_id: this.data.categoryFilter,
        status: this.data.statusFilter,
        keyword: this.data.searchKeyword
      };
      
      const res = await getAdminProductList(params);
      
      // 检查响应数据结构
      if (!res || !res.data || !Array.isArray(res.data.products)) {
        console.error('API返回数据结构异常:', res);
        this.setData({ 
          products: [],
          total: 0,
          hasMore: false,
          loading: false 
        });
        wx.showToast({ title: '数据加载失败', icon: 'none' });
        return;
      }
      
      const products = res.data.products.map(product => ({
        id: product.id,
        name: product.name,
        merchant: product.merchant_name,
        category: product.category_name,
        price: product.price,
        stock: product.stock,
        status: product.status,
        statusText: product.status === 1 ? '上架' : '下架',
        createdAt: product.created_at
      }));
      
      const total = res.data.pagination?.total || 0;
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
   * 搜索关键词变化
   */
  searchKeyword(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  /**
   * 搜索商品
   */
  searchProducts() {
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 商家筛选变化
   */
  merchantFilter(e) {
    this.setData({ merchantFilter: e.detail.value });
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 分类筛选变化
   */
  categoryFilter(e) {
    this.setData({ categoryFilter: e.detail.value });
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 状态筛选变化
   */
  statusFilter(e) {
    this.setData({ statusFilter: e.detail.value });
    this.setData({ page: 1, products: [] });
    this.loadProducts();
  },

  /**
   * 选择商品
   */
  selectProduct(e) {
    const productId = e.detail.value[0];
    let selectedProducts = this.data.selectedProducts;
    
    if (productId) {
      if (!selectedProducts.includes(productId)) {
        selectedProducts.push(productId);
      }
    } else {
      // 取消选择，需要找到当前取消的商品ID
      const currentId = e.currentTarget.dataset.id;
      selectedProducts = selectedProducts.filter(id => id !== currentId);
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          await batchUpdateAdminProducts(this.data.selectedProducts, 0, '');
          wx.showToast({ title: '下架成功' });
          this.setData({ selectedProducts: [], page: 1, products: [], hasMore: true });
          this.loadProducts();
        } catch (error) {
          console.error('批量下架失败:', error);
          wx.showToast({ title: error.message || '下架失败', icon: 'none' });
        } finally {
          wx.hideLoading();
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          await batchUpdateAdminProducts(this.data.selectedProducts, 1, '');
          wx.showToast({ title: '上架成功' });
          this.setData({ selectedProducts: [], page: 1, products: [], hasMore: true });
          this.loadProducts();
        } catch (error) {
          console.error('批量上架失败:', error);
          wx.showToast({ title: error.message || '上架失败', icon: 'none' });
        } finally {
          wx.hideLoading();
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
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const targetStatus = status === 1 ? 0 : 1;
          await updateAdminProductStatus(productId, targetStatus, '');
          wx.showToast({ title: action + '成功' });
          this.setData({ page: 1, products: [], hasMore: true });
          this.loadProducts();
        } catch (error) {
          console.error(action + '商品失败:', error);
          wx.showToast({ title: error.message || '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
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