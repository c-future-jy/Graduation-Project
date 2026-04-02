const {
  getProductById,
  getMerchantById,
  addToCart,
  getCartList,
  updateCartItem
} = require('../../utils/api');

const { toNetworkUrl } = require('../../utils/url');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function toNum(value, fallback = 0) {
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
    loading: true,
    loadingCount: 0,
    product: {},
    merchant: null,
    reviews: [],
    productId: null
  },

  onLoad(options) {
    const productId = options && options.id ? String(options.id) : '';
    if (!productId) {
      wx.showToast({ title: '缺少商品ID', icon: 'none' });
      this.setData({ loading: false });
      return;
    }

    this.setData({ productId });

    // 支持从跳转参数动态设置导航栏标题：/pages/detail/detail?id=xx&title=xxx
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    if (initialTitle) {
      wx.setNavigationBarTitle({ title: initialTitle });
    }

    this.loadProductDetail(productId);
  },

  _showLoading(title = '加载中...') {
    const next = (this.data.loadingCount || 0) + 1;
    this.setData({ loadingCount: next });
    if (next === 1) wx.showLoading({ title });
  },

  _hideLoading() {
    const next = Math.max(0, (this.data.loadingCount || 0) - 1);
    this.setData({ loadingCount: next });
    if (next === 0) wx.hideLoading();
  },

  _requireLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  _normalizeProduct(raw) {
    const p = raw || {};
    const id = p.id !== undefined && p.id !== null ? p.id : p.product_id;
    const merchantId = p.merchant_id !== undefined && p.merchant_id !== null ? p.merchant_id : p.merchantId;
    return {
      ...p,
      id,
      merchant_id: merchantId,
      name: toStr(p.name, ''),
      price: toNum(p.price, 0),
      stock: toInt(p.stock, 0),
      image: toNetworkUrl(p.image)
    };
  },

  _normalizeMerchant(raw) {
    if (!raw) return null;
    return {
      ...raw,
      logo: toNetworkUrl(raw.logo)
    };
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  async loadProductDetail(productId) {
    this.setData({ loading: true });
    this._showLoading('加载中...');
    try {
      const res = await getProductById(productId);
      const raw = res && res.data && res.data.product ? res.data.product : null;
      if (!raw) throw new Error('商品不存在');

      const product = this._normalizeProduct(raw);

      this.setData({ product });

      if (product.name) {
        wx.setNavigationBarTitle({ title: product.name });
      }

      // 拉取店铺信息（商品详情接口当前不带 merchant 信息）
      if (product.merchant_id) {
        try {
          const mres = await getMerchantById(product.merchant_id);
          const m = mres && mres.data && mres.data.merchant ? mres.data.merchant : null;
          this.setData({ merchant: this._normalizeMerchant(m) });
        } catch (_) {
          this.setData({ merchant: null });
        }
      } else {
        this.setData({ merchant: null });
      }
    } catch (error) {
      console.error('加载商品详情失败', error);
      wx.showToast({ title: getErrMsg(error, '加载失败'), icon: 'none' });
      this.setData({ product: {}, merchant: null });
    } finally {
      this._hideLoading();
      this.setData({ loading: false });
    }
  },

  async addToCart() {
    if (!this._requireLogin()) return;

    const product = this.data.product;
    if (!product || !product.id || !product.merchant_id) {
      wx.showToast({ title: '商品信息不完整', icon: 'none' });
      return;
    }

    if (this.data.loadingCount > 0) return;
    this._showLoading('添加中...');
    try {
      await addToCart({
        product_id: product.id,
        merchant_id: product.merchant_id,
        quantity: 1,
        spec: '',
        selected: true
      });
      wx.showToast({ title: '已加入购物车', icon: 'success' });
    } catch (err) {
      console.error('addToCart failed:', err);
      wx.showToast({ title: getErrMsg(err, '添加失败'), icon: 'none' });
    } finally {
      this._hideLoading();
    }
  },

  async buyNow() {
    if (!this._requireLogin()) return;

    const product = this.data.product;
    if (!product || !product.id || !product.merchant_id) {
      wx.showToast({ title: '商品信息不完整', icon: 'none' });
      return;
    }

    if (this.data.loadingCount > 0) return;
    this._showLoading('跳转中...');
    try {
      // 先加入购物车并选中
      await addToCart({
        product_id: product.id,
        merchant_id: product.merchant_id,
        quantity: 1,
        spec: '',
        selected: true
      });

      // 将其他商品取消选中，确保结算只包含当前商品
      const cart = await getCartList({ page: 1, pageSize: 200 });
      const merchants = (cart && cart.data && cart.data.merchants) || [];

      const updates = [];
      merchants.forEach((m) => {
        (m.goods || []).forEach((g) => {
          const cartId = g && g.cartId;
          if (cartId === undefined || cartId === null || String(cartId).trim() === '') return;
          const shouldSelect = String(g.goodsId) === String(product.id);
          const currentSelected = Boolean(g.selected);
          if (currentSelected !== shouldSelect) {
            updates.push(updateCartItem(cartId, { selected: shouldSelect }));
          }
        });
      });

      // 不强求全成功：失败时仍可进入结算页（最多会带上其它选中项）
      await Promise.allSettled(updates);

      wx.navigateTo({ url: '/pages/order-confirm/order-confirm' });
    } catch (err) {
      console.error('buyNow failed:', err);
      wx.showToast({ title: getErrMsg(err, '操作失败'), icon: 'none' });
    } finally {
      this._hideLoading();
    }
  },

  contactMerchant() {
    // 联系商家/客服模块：按需求暂时移除（WXML 已隐藏入口）。
    wx.showToast({ title: '暂不提供联系商家', icon: 'none' });
  }
});