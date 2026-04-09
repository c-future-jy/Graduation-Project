// pages/admin/products/products.js
const {
  getAdminProductList,
  getAdminMerchantList,
  getCategories,
  updateAdminProductStatus,
  batchUpdateAdminProducts
} = require('../../../utils/api');

const STATUS_OPTIONS = [
  { id: '', label: '全部' },
  { id: '1', label: '上架' },
  { id: '0', label: '下架' }
];

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function toIdString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function buildMerchantOptions(merchants) {
  const list = Array.isArray(merchants) ? merchants : [];
  return [{ id: '', label: '全部' }].concat(
    list.map(m => ({
      id: toIdString(m.id),
      label: `${m.name || '未命名商家'}（${m.product_count || 0}）`
    }))
  );
}

function buildCategoryOptions(categories) {
  const list = Array.isArray(categories) ? categories : [];
  return [{ id: '', label: '全部' }].concat(
    list.map(c => ({
      id: toIdString(c.id),
      label: c.name || `分类${c.id}`
    }))
  );
}

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

    merchantOptions: [{ id: '', label: '全部' }],
    categoryOptions: [{ id: '', label: '全部' }],
    statusOptions: STATUS_OPTIONS,
    merchantIndex: 0,
    categoryIndex: 0,
    statusIndex: 0,
    merchantFilterLabel: '全部',
    categoryFilterLabel: '全部',
    statusFilterLabel: '全部',

    anomalyCount: 0,
    selectedProducts: [],
    selectedMap: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.checkLoginStatus();
    this.initFilterOptions();
    this.reloadProducts();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const roleNum = userInfo ? parseInt(String(userInfo.role), 10) : 0;
    
    if (!token || !userInfo || roleNum !== 3) {
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
        pageSize: this.data.pageSize
      };

      if (isProvided(this.data.merchantFilter)) params.merchant_id = this.data.merchantFilter;
      if (isProvided(this.data.categoryFilter)) params.category_id = this.data.categoryFilter;
      if (isProvided(this.data.statusFilter)) params.status = this.data.statusFilter;
      if (String(this.data.searchKeyword || '').trim()) params.keyword = String(this.data.searchKeyword || '').trim();
      
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
      
      const products = res.data.products.map(product => {
        const price = Number(product.price);
        const stock = Number(product.stock);
        const status = Number(product.status);
        const isPriceAnomaly = !Number.isFinite(price) || price <= 0;
        const isStockAnomaly = !Number.isFinite(stock) || stock < 0;

        const priceText = Number.isFinite(price) ? price.toFixed(2) : '-';
        const priceDisplay = Number.isFinite(price) ? `¥${price.toFixed(2)}` : '-';
        return {
          id: toIdString(product.id),
          name: product.name,
          merchant: product.merchant_name,
          category: product.category_name,
          price,
          priceText,
          priceDisplay,
          stock,
          status,
          statusText: status === 1 ? '上架' : '下架',
          createdAt: product.created_at,
          isPriceAnomaly,
          isStockAnomaly
        };
      });
      
      const total = res.data.pagination?.total || 0;
      const hasMore = this.data.page * this.data.pageSize < total;
      
      const mergedProducts = this.data.page === 1 ? products : [...this.data.products, ...products];
      const anomalyCount = mergedProducts.reduce((acc, p) => acc + ((p.isPriceAnomaly || p.isStockAnomaly) ? 1 : 0), 0);

      this.setData({
        products: mergedProducts,
        total,
        hasMore,
        anomalyCount,
        loading: false
      });
    } catch (error) {
      console.error('加载商品列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async initFilterOptions() {
    await Promise.all([
      this.loadMerchantOptions(),
      this.loadCategoryOptions()
    ]);
  },

  async loadMerchantOptions() {
    try {
      const res = await getAdminMerchantList({ page: 1, pageSize: 200 });
      const list = res && res.data && Array.isArray(res.data.merchants) ? res.data.merchants : [];
      const options = buildMerchantOptions(list);
      this.setData({ merchantOptions: options });
    } catch (_) {
      // ignore
    }
  },

  async loadCategoryOptions() {
    try {
      const res = await getCategories({ type: 1, include_merchant: 1 });
      const list = res && res.data && Array.isArray(res.data.categories) ? res.data.categories : [];
      const options = buildCategoryOptions(list);
      this.setData({ categoryOptions: options });
    } catch (_) {
      // ignore
    }
  },

  reloadProducts() {
    this.setData({
      page: 1,
      products: [],
      total: 0,
      hasMore: true,
      loading: false,
      anomalyCount: 0,
      selectedProducts: [],
      selectedMap: {}
    });
    this.loadProducts();
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
    this.reloadProducts();
  },

  /**
   * 商家筛选变化
   */
  merchantFilter(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const opt = (this.data.merchantOptions && this.data.merchantOptions[idx]) || { id: '', label: '全部' };
    this.setData({
      merchantIndex: idx,
      merchantFilter: opt.id,
      merchantFilterLabel: opt.label || '全部'
    });
    this.reloadProducts();
  },

  /**
   * 分类筛选变化
   */
  categoryFilter(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const opt = (this.data.categoryOptions && this.data.categoryOptions[idx]) || { id: '', label: '全部' };
    this.setData({
      categoryIndex: idx,
      categoryFilter: opt.id,
      categoryFilterLabel: opt.label || '全部'
    });
    this.reloadProducts();
  },

  /**
   * 状态筛选变化
   */
  statusFilter(e) {
    const idx = parseInt(e.detail.value, 10) || 0;
    const opt = (this.data.statusOptions && this.data.statusOptions[idx]) || { id: '', label: '全部' };
    this.setData({
      statusIndex: idx,
      statusFilter: opt.id,
      statusFilterLabel: opt.label || '全部'
    });
    this.reloadProducts();
  },

  /**
   * 选择商品
   */
  selectProduct(e) {
    const checked = Array.isArray(e.detail.value) ? e.detail.value : [];
    const currentId = toIdString(e.currentTarget.dataset.id);
    let selectedProducts = Array.isArray(this.data.selectedProducts) ? this.data.selectedProducts.slice() : [];
    const selectedMap = { ...(this.data.selectedMap || {}) };

    if (checked.length > 0) {
      const id = toIdString(checked[0]);
      if (id && !selectedProducts.includes(id)) selectedProducts.push(id);
      if (id) selectedMap[id] = true;
    } else {
      selectedProducts = selectedProducts.filter(id => id !== currentId);
      if (currentId) selectedMap[currentId] = false;
    }

    this.setData({ selectedProducts, selectedMap });
  },

  /**
   * 全选商品
   */
  selectAllProducts(e) {
    const checked = Array.isArray(e.detail.value) ? e.detail.value : [];
    const allSelected = checked.includes('all');
    const selectedProducts = allSelected ? this.data.products.map(product => product.id) : [];
    const selectedMap = {};
    if (allSelected) {
      selectedProducts.forEach((id) => {
        if (id) selectedMap[id] = true;
      });
    }
    this.setData({ selectedProducts, selectedMap });
  },

  async fetchAllOnlineProductIdsByMerchant(merchantId) {
    const ids = [];
    const pageSize = 100;
    let page = 1;
    let total = 0;

    do {
      const res = await getAdminProductList({
        page,
        pageSize,
        merchant_id: merchantId,
        status: '1'
      });

      const list = res && res.data && Array.isArray(res.data.products) ? res.data.products : [];
      const pagination = res && res.data && res.data.pagination ? res.data.pagination : null;
      total = pagination && pagination.total ? Number(pagination.total) : 0;

      list.forEach(p => {
        const id = toIdString(p && p.id);
        if (id) ids.push(id);
      });

      page += 1;
      if (list.length === 0) break;
    } while ((page - 1) * pageSize < total);

    return ids;
  },

  offlineAllByMerchant() {
    const merchantId = this.data.merchantFilter;
    if (!merchantId) {
      wx.showToast({ title: '请先选择商家', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '一键下架',
      content: '确定要下架该商家所有已上架商品吗？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...' });
        try {
          const ids = await this.fetchAllOnlineProductIdsByMerchant(merchantId);
          if (ids.length === 0) {
            wx.showToast({ title: '该商家暂无已上架商品', icon: 'none' });
            return;
          }
          await batchUpdateAdminProducts(ids, 0, '');
          wx.showToast({ title: '已下架' });
          this.reloadProducts();
        } catch (error) {
          console.error('一键下架失败:', error);
          wx.showToast({ title: error.message || '下架失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
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
          this.reloadProducts();
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
          this.reloadProducts();
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
          this.reloadProducts();
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
    const name = e.currentTarget.dataset.name;
    const titleParam = name ? `&title=${encodeURIComponent(name)}` : '';
    wx.navigateTo({
      url: `/pages/detail/detail?id=${productId}${titleParam}`
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
   * 点击“加载更多”
   */
  loadMoreProducts() {
    if (!this.data.hasMore || this.data.loading) return;
    this.setData({ page: this.data.page + 1 });
    this.loadProducts();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    (async () => {
      try {
        this.reloadProducts();
      } finally {
        wx.stopPullDownRefresh();
      }
    })();
  }
})