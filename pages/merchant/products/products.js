// pages/merchant/products/products.js
const {
  getUserProfile,
  getMyMerchant,
  getCategories,
  getMyProducts,
  createCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage
} = require('../../../utils/api');

const { showLoading, hideLoading, debounce } = require('../../../utils/pageUtils');

const DRAFT_KEY = 'merchantProductsFormDraft';

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function getErrMsg(err, fallback = '操作失败') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.data && err.data.message) return err.data.message;
  if (err.errMsg) return err.errMsg;
  return fallback;
}

Page({
  data: {
    loading: false,
    products: [],
    pageNum: 1,
    pageSize: 10,
    hasMore: true,

    keyword: '',
    categories: [],
    categoryOptions: [{ id: '', name: '全部分类' }],
    categoryIndex: 0,

    showForm: false,
    editingId: null,
    form: {
      name: '',
      price: '',
      stock: '',
      category_id: '',
      image: '',
      imagePreview: '',
      description: ''
    },
    formCategoryOptions: [{ id: '', name: '请选择分类' }],
    formCategoryIndex: 0,

    showCreateCategory: false,
    newCategoryName: '',
    creatingCategory: false,

    editingStockId: null,
    stockDraft: ''
  },

  _draftKey: DRAFT_KEY,

  async onLoad(options) {
    // 兜底：确保草稿 key 永远是字符串
    this._draftKey = this._draftKey || DRAFT_KEY;

    // 若上次因选图/上传等导致页面重建，优先恢复草稿
    this.restoreDraft();

    // 先拉取用户资料：必要时触发 token/merchant_id 自动刷新
    try {
      await getUserProfile();
    } catch (_) {
      // ignore
    }
    await this.bootstrap();

    if (options && String(options.openForm || '') === '1' && !this.data.showForm) {
      this.openCreate();
    }
  },

  onShow() {
    // 从系统相册/相机返回时，可能触发页面重建/重绘；尝试恢复草稿
    this.restoreDraft();
  },

  onHide() {
    // 页面被系统挂起/切后台时，兜底保存一次
    this.persistDraft();
  },

  persistDraft() {
    try {
      if (!this.data.showForm) return;
      const key = this._draftKey || DRAFT_KEY;
      const payload = {
        ts: Date.now(),
        showForm: !!this.data.showForm,
        editingId: this.data.editingId || null,
        form: this.data.form || {},
        formCategoryIndex: this.data.formCategoryIndex || 0
      };
      wx.setStorageSync(key, payload);
    } catch (_) {
      // ignore
    }
  },

  restoreDraft() {
    try {
      const key = this._draftKey || DRAFT_KEY;
      const draft = wx.getStorageSync(key);
      if (!draft || !draft.form) return;

      // 草稿有效期：30分钟
      if (draft.ts && Date.now() - draft.ts > 30 * 60 * 1000) {
        wx.removeStorageSync(key);
        return;
      }

      const nextForm = Object.assign({}, this.data.form || {}, draft.form || {});

      // 规范化图片预览字段：避免把 /uploads/... 当成本地资源导致渲染层加载失败
      const hasLocal = !!(nextForm.imageLocal && String(nextForm.imageLocal).trim());
      if (!hasLocal) {
        if (nextForm.image) {
          nextForm.imagePreview = this.toPreviewUrl(nextForm.image);
        } else if (nextForm.imagePreview && String(nextForm.imagePreview).trim().startsWith('/uploads/')) {
          nextForm.imagePreview = this.toPreviewUrl(nextForm.imagePreview);
        }
      }
      const nextIndex = typeof draft.formCategoryIndex === 'number' ? draft.formCategoryIndex : 0;
      this.setData({
        // 关键：发现草稿就强制打开表单，避免“以为数据丢了其实是没展示”
        showForm: true,
        editingId: draft.editingId || null,
        form: nextForm,
        formCategoryIndex: nextIndex
      });
    } catch (_) {
      // ignore
    }
  },

  clearDraft() {
    try {
      const key = this._draftKey || DRAFT_KEY;
      wx.removeStorageSync(key);
    } catch (_) {
      // ignore
    }
  },

  async bootstrap() {
    await this.loadCategories();
    await this.loadProducts(false);
  },

  async _runWithLoading(title, fn) {
    showLoading(title);
    try {
      return await fn();
    } finally {
      hideLoading();
    }
  },

  _toastError(err, fallback) {
    wx.showToast({ title: getErrMsg(err, fallback || '操作失败'), icon: 'none' });
  },

  _resetListState() {
    this.setData({ pageNum: 1, products: [], hasMore: true });
  },

  async _reloadList() {
    this._resetListState();
    await this.loadProducts(false);
  },

  _buildUpdatePayloadFromItem(item, overrides) {
    if (!item) return null;
    const base = {
      name: item.name,
      description: item.description || '',
      price: item.price,
      stock: item.stock,
      image: item.image || '',
      status: item.status
    };
    return Object.assign(base, overrides || {});
  },

  async resolveMerchantId() {
    // 优先从缓存取（登录时 userInfo 会写 merchant_id；商家中心也会缓存 merchantId）
    const userInfo = wx.getStorageSync('userInfo') || {};
    const cached = userInfo.merchant_id || userInfo.merchantId || wx.getStorageSync('merchantId');
    if (cached !== undefined && cached !== null && cached !== '') {
      const cachedNum = parseInt(cached, 10);
      if (Number.isFinite(cachedNum) && cachedNum > 0) return cachedNum;
    }

    // 兜底：主动请求 /merchants/me 获取商家ID
    try {
      const res = await getMyMerchant();
      const merchant = res && res.data && res.data.merchant;
      if (merchant && merchant.id) {
        wx.setStorageSync('merchantId', merchant.id);
        return parseInt(merchant.id, 10);
      }
    } catch (err) {
      console.error('resolveMerchantId failed:', err);
    }
    return null;
  },

  // 分类
  async loadCategories() {
    try {
      const merchantId = await this.resolveMerchantId();
      if (!merchantId) {
        this.setData({
          categories: [],
          categoryOptions: [{ id: '', name: '全部分类' }],
          formCategoryOptions: [{ id: '', name: '请选择分类' }],
          categoryIndex: 0,
          formCategoryIndex: 0
        });
        wx.showToast({ title: '未获取到商家信息', icon: 'none' });
        return;
      }

      // 注意：后端在传 merchant_id 时会返回“当前商家分类 + 公共分类(merchant_id IS NULL)”
      // 这里按需求只展示“当前商家自己创建”的分类：type=1 且 merchant_id=当前商家ID
      const res = await getCategories({ type: 1, merchant_id: merchantId });
      const categories = (res && res.data && res.data.categories) || [];
      const normalized = categories
        .filter((c) => parseInt(c.merchant_id, 10) === parseInt(merchantId, 10) && parseInt(c.type, 10) === 1)
        .map((c) => ({ id: c.id, name: c.name }));

      this.setData({
        categories: normalized,
        categoryOptions: [{ id: '', name: '全部分类' }, ...normalized],
        formCategoryOptions: [{ id: '', name: '请选择分类' }, ...normalized]
      });

      if (normalized.length === 0) {
        wx.showToast({ title: '暂无商品分类，请先创建分类', icon: 'none' });
      }

      // 若已恢复草稿且草稿内有 category_id，则尽量把 picker 定位到对应分类
      const draftCategoryId = this.data.form && this.data.form.category_id;
      if (draftCategoryId) {
        const idx = [{ id: '', name: '请选择分类' }, ...normalized].findIndex((c) => String(c.id) === String(draftCategoryId));
        if (idx >= 0 && idx !== this.data.formCategoryIndex) {
          this.setData({ formCategoryIndex: idx });
        }
      }
    } catch (err) {
      console.error('loadCategories failed:', err);
      this._toastError(err, '加载分类失败');
    }
  },

  onCategoryChange(e) {
    const nextIndex = parseInt(e.detail.value, 10) || 0;
    this.setData({ categoryIndex: nextIndex });
    this._reloadList();
  },

  // 搜索
  onKeywordInput: debounce(function (e) {
    this.setData({ keyword: e.detail.value || '' });
  }, 200),

  onSearchConfirm() {
    this._reloadList();
  },

  // 列表
  async loadProducts(isLoadMore) {
    const { loading, hasMore, pageNum, pageSize, keyword, categoryOptions, categoryIndex } = this.data;
    if (loading) return;
    if (isLoadMore && !hasMore) return;

    const nextPage = isLoadMore ? pageNum + 1 : 1;
    const selectedCategory = categoryOptions[categoryIndex] || { id: '' };

    try {
      this.setData({ loading: true });
      await this._runWithLoading('加载中...', async () => {
        const params = {
          page: nextPage,
          limit: pageSize
        };
        if (keyword) params.keyword = keyword;
        if (selectedCategory && selectedCategory.id) params.category_id = selectedCategory.id;

        const res = await getMyProducts(params);
        const list = (res && res.data && res.data.products) || [];

        const mapped = list.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          status: (typeof p.status === 'number' ? p.status : toInt(p.status, 0)) === 1 ? 1 : 0,
          category_id: p.category_id,
          category_name: p.category_name,
          description: p.description,
          image: p.image,
          imagePreview: this.toPreviewUrl(p.image)
        }));

        const newList = isLoadMore ? [...this.data.products, ...mapped] : mapped;
        const more = mapped.length >= pageSize;
        this.setData({
          products: newList,
          pageNum: nextPage,
          hasMore: more
        });
      });
    } catch (err) {
      console.error('loadProducts failed:', err);
      this._toastError(err, '加载失败');
    } finally {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadProducts(true);
    }
  },

  async onPullDownRefresh() {
    try {
      await this._reloadList();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  // 表单
  openCreate() {
    this.setData({
      showForm: true,
      editingId: null,
      form: {
        name: '',
        price: '',
        stock: '',
        category_id: '',
        image: '',
        imageLocal: '',
        imagePreview: '',
        description: ''
      },
      formCategoryIndex: 0
    });
    this.persistDraft();
  },

  openEdit(e) {
    const id = e.currentTarget.dataset.id;
    const item = (this.data.products || []).find((x) => String(x.id) === String(id));
    if (!item) return;

    const idx = this.data.formCategoryOptions.findIndex((c) => String(c.id) === String(item.category_id));
    this.setData({
      showForm: true,
      editingId: item.id,
      form: {
        name: item.name || '',
        price: String(item.price ?? ''),
        stock: String(item.stock ?? ''),
        category_id: item.category_id || '',
        image: item.image || '',
        imageLocal: '',
        imagePreview: item.imagePreview || '',
        description: item.description || ''
      },
      formCategoryIndex: idx > 0 ? idx : 0
    });
    this.persistDraft();
  },

  closeForm() {
    this.setData({ showForm: false });
    this.clearDraft();
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail.value });
    this.persistDraft();
  },

  onFormCategoryChange(e) {
    const nextIndex = parseInt(e.detail.value, 10) || 0;
    const picked = this.data.formCategoryOptions[nextIndex] || { id: '' };
    this.setData({
      formCategoryIndex: nextIndex,
      'form.category_id': picked.id || ''
    });
    this.persistDraft();
  },

  // 新建分类（商家端）
  openCreateCategory() {
    this.setData({ showCreateCategory: true, newCategoryName: '' });
  },

  cancelCreateCategory() {
    this.setData({ showCreateCategory: false, newCategoryName: '', creatingCategory: false });
  },

  onNewCategoryNameInput(e) {
    this.setData({ newCategoryName: e.detail.value || '' });
  },

  async submitNewCategory() {
    if (this.data.creatingCategory) return;
    const name = toStr(this.data.newCategoryName, '').trim();
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' });
      return;
    }

    this.setData({ creatingCategory: true });
    try {
      await this._runWithLoading('创建中...', async () => {
        const res = await createCategory({ name, type: 1, sort_order: 0 });
        const createdId = res && res.data && (res.data.categoryId || (res.data.category && res.data.category.id));

        wx.showToast({ title: '创建成功', icon: 'success' });
        this.setData({ showCreateCategory: false, newCategoryName: '' });

        await this.loadCategories();

        if (createdId) {
          const idx = (this.data.formCategoryOptions || []).findIndex((c) => String(c.id) === String(createdId));
          if (idx > 0) {
            this.setData({ formCategoryIndex: idx, 'form.category_id': createdId });
            this.persistDraft();
          }
        }
      });
    } catch (err) {
      console.error('submitNewCategory failed:', err);
      this._toastError(err, '创建失败');
    } finally {
      this.setData({ creatingCategory: false });
    }
  },

  // ✅ 第一步：点击按钮瞬间先同步存草稿（最关键）
  onChooseImageClick() {
    this.persistDraft();
    this.chooseProductImage();
  },

  // ✅ 第五步（建议）：选图只预览，不立刻上传；保存时再上传
  async chooseProductImage() {
    try {
      const filePath = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (r) => {
            const p = r && r.tempFilePaths && r.tempFilePaths[0];
            resolve(p || '');
          },
          fail: reject
        });
      });
      if (!filePath) return;

      // 本地预览 + 标记有新图片待上传
      this.setData({
        'form.imageLocal': filePath,
        'form.imagePreview': filePath
      });
      this.persistDraft();
    } catch (err) {
      if (err && (err.errMsg || '').includes('cancel')) return;
      console.error('chooseProductImage failed:', err);
      this._toastError(err, '选择图片失败');
    }
  },

  clearProductImage() {
    this.setData({ 'form.image': '', 'form.imageLocal': '', 'form.imagePreview': '' });
    this.persistDraft();
  },

  async ensureImageUploadedIfNeeded() {
    const localPath = this.data.form && this.data.form.imageLocal;
    if (!localPath) return this.data.form && this.data.form.image ? this.data.form.image : '';
    return await this._runWithLoading('上传中...', async () => {
      const up = await uploadImage(localPath);
      const url = up && up.data && up.data.url ? up.data.url : '';
      if (!url) throw new Error('上传失败');

      this.setData({
        'form.image': url,
        'form.imageLocal': '',
        'form.imagePreview': this.toPreviewUrl(url)
      });
      this.persistDraft();
      return url;
    });
  },

  validateForm() {
    const f = this.data.form || {};
    const name = toStr(f.name, '').trim();
    const price = parseFloat(f.price);
    const stock = parseInt(f.stock, 10);
    const categoryId = f.category_id;

    if (!name) return '请填写商品名称';
    if (name.length > 50) return '商品名称过长';
    if (!Number.isFinite(price) || price <= 0) return '请填写正确的价格';
    if (!Number.isFinite(stock) || stock < 0) return '请填写正确的库存';
    if (!categoryId) return '请选择分类';
    return '';
  },

  async submitForm() {
    const msg = this.validateForm();
    if (msg) {
      wx.showToast({ title: msg, icon: 'none' });
      return;
    }

    const { editingId, form } = this.data;

    // 保存前：如果选了本地新图，先上传拿到 url
    let finalImageUrl = form.image || '';
    try {
      finalImageUrl = await this.ensureImageUploadedIfNeeded();
    } catch (err) {
      console.error('ensureImageUploadedIfNeeded failed:', err);
      this._toastError(err, '图片上传失败');
      return;
    }

    const payload = {
      category_id: form.category_id,
      name: String(form.name || '').trim(),
      description: String(form.description || '').trim(),
      price: parseFloat(form.price),
      stock: parseInt(form.stock, 10),
      image: finalImageUrl
    };
    try {
      await this._runWithLoading('保存中...', async () => {
        if (editingId) {
          // 编辑：保留原状态（不在表单里单独改）
          const current = (this.data.products || []).find((x) => String(x.id) === String(editingId));
          payload.status = current ? current.status : 1;
          await updateProduct(editingId, payload);
        } else {
          // 新增：默认上架
          payload.status = 1;
          // 商家端 merchant_id 可不传（后端会从 token 强制取）
          await createProduct(payload);
        }
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
      this.clearDraft();
      this.setData({ showForm: false });
      await this._reloadList();
    } catch (err) {
      console.error('submitForm failed:', err);
      this._toastError(err, '保存失败');
    }
  },

  // 上/下架
  toggleStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = parseInt(e.currentTarget.dataset.status, 10) || 0;
    const nextStatus = status === 1 ? 0 : 1;
    const title = nextStatus === 1 ? '确认上架' : '确认下架';
    const content = nextStatus === 1 ? '确定要上架该商品吗？' : '确定要下架该商品吗？';

    wx.showModal({
      title,
      content,
      success: async (res) => {
        if (!res.confirm) return;
        await this.doToggleStatus(id, nextStatus);
      }
    });
  },

  async doToggleStatus(id, nextStatus) {
    const item = (this.data.products || []).find((x) => String(x.id) === String(id));
    if (!item) return;
    try {
      await this._runWithLoading('处理中...', async () => {
        const payload = this._buildUpdatePayloadFromItem(item, { status: nextStatus });
        await updateProduct(id, payload);
      });
      wx.showToast({ title: '操作成功', icon: 'success' });
      await this._reloadList();
    } catch (err) {
      console.error('doToggleStatus failed:', err);
      this._toastError(err, '操作失败');
    }
  },

  // 库存
  editStock(e) {
    const id = e.currentTarget.dataset.id;
    const stock = e.currentTarget.dataset.stock;
    this.setData({ editingStockId: id, stockDraft: String(stock ?? '') });
  },

  onStockDraftInput(e) {
    this.setData({ stockDraft: e.detail.value });
  },

  cancelStockEdit() {
    this.setData({ editingStockId: null, stockDraft: '' });
  },

  async saveStock(e) {
    const id = e.currentTarget.dataset.id;
    const nextStock = parseInt(this.data.stockDraft, 10);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      wx.showToast({ title: '请输入正确的库存', icon: 'none' });
      return;
    }

    const item = (this.data.products || []).find((x) => String(x.id) === String(id));
    if (!item) return;
    try {
      await this._runWithLoading('保存中...', async () => {
        const payload = this._buildUpdatePayloadFromItem(item, { stock: nextStock });
        await updateProduct(id, payload);
      });

      wx.showToast({ title: '已更新', icon: 'success' });
      this.setData({ editingStockId: null, stockDraft: '' });
      await this._reloadList();
    } catch (err) {
      console.error('saveStock failed:', err);
      this._toastError(err, '更新失败');
    }
  },

  // 删除
  deleteOne(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除商品',
      content: '确定要删除该商品吗？删除后不可恢复。',
      success: async (res) => {
        if (!res.confirm) return;
        await this.doDelete(id);
      }
    });
  },

  async doDelete(id) {
    try {
      await this._runWithLoading('删除中...', async () => {
        await deleteProduct(id);
      });
      wx.showToast({ title: '删除成功', icon: 'success' });
      await this._reloadList();
    } catch (err) {
      console.error('doDelete failed:', err);
      this._toastError(err, '删除失败');
    }
  },

  // 工具：将 /uploads/... 转成可预览 URL
  toPreviewUrl(maybeUrl) {
    const url = toStr(maybeUrl, '').trim();
    if (!url) return '/assets/images/kong.jpg';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (!url.startsWith('/')) return url;

    let baseUrl = '';
    try {
      const app = typeof getApp === 'function' ? getApp() : null;
      baseUrl = app && app.globalData && app.globalData.baseUrl ? String(app.globalData.baseUrl) : '';
    } catch (_) {
      baseUrl = '';
    }
    baseUrl = baseUrl || 'http://localhost:3000/api';
    const origin = baseUrl.replace(/\/api\/?$/, '');
    return origin + url;
  }
});