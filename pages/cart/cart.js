// pages/cart/cart.js
const { getCartList, updateCartItem, deleteCartItem, deleteInvalidItems } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMerchants(rawMerchants) {
  const merchants = (rawMerchants || []).map((m) => {
    const goods = (m.goods || []).map((g) => {
      const checked = g.checked !== undefined ? Boolean(g.checked) : (g.selected !== undefined ? Boolean(g.selected) : false);
      return {
        ...g,
        checked,
        cartId: g.cartId !== undefined ? g.cartId : g.cart_id,
        goodsId: g.goodsId !== undefined ? g.goodsId : g.product_id,
        merchantId: g.merchantId !== undefined ? g.merchantId : m.merchantId,
        goodsImage: toNetworkUrl(g.goodsImage),
        price: toNum(g.price, 0),
        quantity: toInt(g.quantity, 1),
        stock: toInt(g.stock, 0)
      };
    });

    const merchantChecked = goods.length > 0 && goods.every((x) => x.checked);
    return {
      ...m,
      merchantLogo: toNetworkUrl(m.merchantLogo),
      checked: merchantChecked,
      goods
    };
  });

  const allChecked = merchants.length > 0 && merchants.every((m) => m.checked);
  return { merchants, allChecked };
}

function normalizeInvalidGoods(rawInvalidGoods) {
  return (rawInvalidGoods || []).map((g) => ({
    ...g,
    cartId: g.cartId !== undefined ? g.cartId : g.cart_id,
    goodsId: g.goodsId !== undefined ? g.goodsId : g.product_id,
    goodsImage: toNetworkUrl(g.goodsImage)
  }));
}

function extractAllCartItems(merchants) {
  const items = [];
  (merchants || []).forEach((m) => {
    (m.goods || []).forEach((g) => {
      const cartId = g && g.cartId;
      if (cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
        items.push(g);
      }
    });
  });
  return items;
}

async function persistSelectedForItems(items, checked) {
  const tasks = (items || [])
    .map((g) => g && g.cartId)
    .filter((id) => id !== undefined && id !== null && String(id).trim() !== '')
    .map((id) => updateCartItem(id, { selected: checked }));

  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
}

Page({

  /**
   * 页面的初始数据
   */
  data: {
    loading: false,
    error: false,
    hasGoods: false,
    allChecked: false,
    hasCheckedGoods: false,
    checkedCount: 0,
    totalPrice: 0,
    defaultMerchantLogo: '/assets/images/morentouxiang.jpg',
    defaultGoodsImage: '/assets/images/chatu-2.jpg',
    merchants: [],
    invalidGoods: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this._didInitialShow = false;
    this.loadCartData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 避免首次 onLoad + onShow 重复加载
    if (!this._didInitialShow) {
      this._didInitialShow = true;
      return;
    }
    this.loadCartData();
  },

  onMerchantLogoError(e) {
    const merchantId = String(e.currentTarget.dataset.merchantId);
    const merchants = (this.data.merchants || []).map((m) => {
      if (String(m.merchantId) !== merchantId) return m;
      return { ...m, merchantLogo: this.data.defaultMerchantLogo };
    });
    this.setData({ merchants });
  },

  onGoodsImageError(e) {
    const cartId = String(e.currentTarget.dataset.cartId);
    const merchants = (this.data.merchants || []).map((m) => ({
      ...m,
      goods: (m.goods || []).map((g) => {
        if (String(g.cartId) !== cartId) return g;
        return { ...g, goodsImage: this.data.defaultGoodsImage };
      })
    }));
    this.setData({ merchants });
  },

  onInvalidGoodsImageError(e) {
    const cartId = String(e.currentTarget.dataset.cartId);
    const invalidGoods = (this.data.invalidGoods || []).map((g) => {
      if (String(g.cartId) !== cartId) return g;
      return { ...g, goodsImage: this.data.defaultGoodsImage };
    });
    this.setData({ invalidGoods });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadCartData(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 阻止事件冒泡
   */
  preventTap(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
  },

  /**
   * 加载购物车数据
   */
  async loadCartData(callback) {
    // 检查登录状态
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    this.setData({ loading: true, error: false });
    
    try {
      const res = await getCartList();

      const normalized = normalizeMerchants((res && res.data && res.data.merchants) || []);
      const invalidGoods = normalizeInvalidGoods((res && res.data && res.data.invalidGoods) || []);
      const hasGoods = normalized.merchants.length > 0;

      this.setData({
        merchants: normalized.merchants,
        invalidGoods,
        hasGoods,
        allChecked: normalized.allChecked,
        loading: false
      }, () => {
        this.updateCheckoutInfo();
        if (callback) callback();
      });
      
    } catch (error) {
      // 检查是否是未登录导致的错误
      if (error.message === '请先登录') {
        wx.redirectTo({
          url: '/pages/login/login'
        });
        return;
      }
      this.setData({ 
        error: true, 
        loading: false,
        merchants: [],
        invalidGoods: []
      });
      
      if (callback) callback();
    }
  },

  /**
   * 去逛逛
   */
  goShopping() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /**
   * 点击商品跳转详情
   */
  goGoodsDetail(e) {
    const goodsId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.goodsId : undefined;
    const id = goodsId !== undefined && goodsId !== null ? String(goodsId).trim() : '';
    if (!id) return;

    wx.navigateTo({
      url: `/pages/detail/detail?id=${encodeURIComponent(id)}`
    });
  },

  /**
   * 切换全选状态
   */
  toggleAllCheck(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    // 单个 checkbox 的 change 事件在不同基础库版本里 detail 形态不稳定
    // 这里直接基于当前全选状态取反，保证“全选”一定可用
    const nextAllChecked = !this.data.allChecked;
    let merchants = this.data.merchants;

    merchants = (merchants || []).map((merchant) => {
      const goods = (merchant.goods || []).map((goods) => ({
        ...goods,
        checked: nextAllChecked
      }));
      return {
        ...merchant,
        checked: goods.length > 0 && goods.every((x) => x.checked),
        goods
      };
    });

    this.setData({ merchants, allChecked: nextAllChecked });
    this.updateCheckoutInfo();

    // 同步到后端 selected（结算页依赖 /cart/selected）
    persistSelectedForItems(extractAllCartItems(merchants), nextAllChecked).catch((err) => {
      console.error('同步选中状态失败:', err);
      this.loadCartData();
    });
  },

  /**
   * 切换商品选中状态
   */
  toggleGoodsCheck(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const cartId = String(e.currentTarget.dataset.cartId);
    const merchantId = String(e.currentTarget.dataset.merchantId);
    let nextChecked = false;
    let found = false;
    
    let merchants = this.data.merchants;
    merchants = merchants.map(merchant => {
      if (String(merchant.merchantId) === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (String(goods.cartId) === String(cartId)) {
            nextChecked = !Boolean(goods.checked);
            found = true;
            return { ...goods, checked: nextChecked };
          }
          return goods;
        });

        // 检查商家是否所有商品都被选中
        const merchantChecked = goods.length > 0 && goods.every(item => item.checked);

        return {
          ...merchant,
          checked: merchantChecked,
          goods
        };
      }

      return merchant;
    });
    
    this.setData({ merchants });
    this.updateAllCheckedStatus();
    this.updateCheckoutInfo();

    if (found && cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
      updateCartItem(cartId, { selected: nextChecked }).catch((err) => {
        console.error('同步商品选中状态失败:', err);
        this.loadCartData();
      });
    }
  },

  /**
   * 更新全选状态
   */
  updateAllCheckedStatus() {
    const allItems = extractAllCartItems(this.data.merchants);
    const allChecked = allItems.length > 0 && allItems.every((g) => Boolean(g.checked));
    this.setData({ allChecked });
  },

  /**
   * 更新结算信息
   */
  updateCheckoutInfo() {
    const merchants = this.data.merchants;
    let totalPrice = 0;
    let checkedCount = 0;
    let hasCheckedGoods = false;
    
    for (const merchant of merchants) {
      for (const goods of merchant.goods) {
        if (goods.checked) {
          const price = toNum(goods.price, 0);
          const qty = toInt(goods.quantity, 0);
          totalPrice += price * qty;
          checkedCount += qty;
          hasCheckedGoods = true;
        }
      }
    }
    
    this.setData({
      totalPrice: Number(totalPrice.toFixed(2)),
      checkedCount,
      hasCheckedGoods
    });
  },

  /**
   * 减少商品数量
   */
  async decreaseQuantity(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const cartId = String(e.currentTarget.dataset.cartId);
    const merchantId = String(e.currentTarget.dataset.merchantId);
    
    // 找到当前商品
    const merchantsNow = this.data.merchants || [];
    let currentQty = 1;
    for (const m of merchantsNow) {
      if (String(m.merchantId) !== merchantId) continue;
      for (const g of m.goods || []) {
        if (String(g.cartId) === String(cartId)) {
          currentQty = toInt(g.quantity, 1);
        }
      }
    }

    // qty=1 时再次点击减号：确认删除
    if (currentQty <= 1) {
      wx.showModal({
        title: '确认删除',
        content: '数量已为 1，是否删除该商品？',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await deleteCartItem(cartId);
            this.loadCartData();
            wx.showToast({ title: '删除成功' });
          } catch (error) {
            console.error('删除商品失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
            this.loadCartData();
          }
        }
      });
      return;
    }

    // qty>1：正常减一（先更新本地，后同步后端）
    let merchants = this.data.merchants;
    let updatedGoods = null;

    merchants = merchants.map(merchant => {
      if (String(merchant.merchantId) === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (String(goods.cartId) === String(cartId) && toInt(goods.quantity, 1) > 1) {
            updatedGoods = { ...goods, quantity: toInt(goods.quantity, 1) - 1 };
            return updatedGoods;
          }
          return goods;
        });
        return { ...merchant, goods };
      }
      return merchant;
    });

    this.setData({ merchants });
    this.updateCheckoutInfo();

    if (updatedGoods && cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
      try {
        await updateCartItem(cartId, { quantity: updatedGoods.quantity });
      } catch (error) {
        console.error('更新商品数量失败:', error);
        this.loadCartData();
      }
    }
  },

  /**
   * 增加商品数量
   */
  async increaseQuantity(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const cartId = String(e.currentTarget.dataset.cartId);
    const merchantId = String(e.currentTarget.dataset.merchantId);
    
    // 先更新本地数据，提供即时反馈
    let merchants = this.data.merchants;
    let updatedGoods = null;
    
    merchants = merchants.map(merchant => {
      if (String(merchant.merchantId) === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (String(goods.cartId) === String(cartId) && goods.quantity < goods.stock) {
            updatedGoods = { ...goods, quantity: goods.quantity + 1 };
            return updatedGoods;
          } else if (String(goods.cartId) === String(cartId) && goods.quantity >= goods.stock) {
            wx.showToast({ title: '已达到库存上限', icon: 'none' });
          }
          return goods;
        });
        return { ...merchant, goods };
      }
      return merchant;
    });
    
    this.setData({ merchants });
    this.updateCheckoutInfo();
    
    // 调用API更新服务器数据
    if (updatedGoods && cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
      try {
        await updateCartItem(cartId, { quantity: updatedGoods.quantity });
      } catch (error) {
        console.error('更新商品数量失败:', error);
        // 恢复原数据
        this.loadCartData();
      }
    }
  },

  /**
   * 手动修改商品数量
   */
  async changeQuantity(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const cartId = String(e.currentTarget.dataset.cartId);
    const merchantId = String(e.currentTarget.dataset.merchantId);
    let quantity = parseInt(e.detail.value) || 1;
    
    // 先更新本地数据，提供即时反馈
    let merchants = this.data.merchants;
    let updatedGoods = null;
    
    merchants = merchants.map(merchant => {
      if (String(merchant.merchantId) === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (String(goods.cartId) === String(cartId)) {
            // 确保数量在有效范围内
            if (quantity < 1) quantity = 1;
            if (quantity > goods.stock) {
              quantity = goods.stock;
              wx.showToast({ title: '已达到库存上限', icon: 'none' });
            }
            updatedGoods = { ...goods, quantity };
            return updatedGoods;
          }
          return goods;
        });
        return { ...merchant, goods };
      }
      return merchant;
    });
    
    this.setData({ merchants });
    this.updateCheckoutInfo();
    
    // 调用API更新服务器数据
    if (updatedGoods && cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
      try {
        await updateCartItem(cartId, { quantity: updatedGoods.quantity });
      } catch (error) {
        console.error('更新商品数量失败:', error);
        // 恢复原数据
        this.loadCartData();
      }
    }
  },

  /**
   * 删除失效商品
   */
  async deleteInvalidGoods(e) {
    if (e && e.stopPropagation) e.stopPropagation();

    const cartId = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.cartId : undefined;

    try {
      // 单条删除：按 cartId 删除
      if (cartId !== undefined && cartId !== null && String(cartId).trim() !== '') {
        await deleteCartItem(cartId);
      } else {
        // 兜底：没有 cartId 时按“一键清理”
        await deleteInvalidItems();
      }

      this.loadCartData();
      wx.showToast({ title: '删除成功' });
    } catch (error) {
      console.error('删除失效商品失败:', error);
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  /**
   * 一键清理失效商品
   */
  async cleanInvalidGoods(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    wx.showModal({
      title: '确认清理',
      content: '确定要清理所有失效商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用API删除失效商品
            await deleteInvalidItems();
            
            // 重新加载购物车数据
            this.loadCartData();
            wx.showToast({ title: '清理成功' });
          } catch (error) {
            console.error('清理失效商品失败:', error);
            wx.showToast({ title: '清理失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 去结算
   */
  goCheckout(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // 检查是否有选中商品
    if (!this.data.hasCheckedGoods) {
      wx.showToast({ title: '请选择要结算的商品', icon: 'none' });
      return;
    }
    
    // 检查选中商品是否来自同一商家
    const selectedMerchants = new Set();
    const merchants = this.data.merchants;
    
    for (const merchant of merchants) {
      for (const goods of merchant.goods) {
        if (goods.checked) {
          selectedMerchants.add(merchant.merchantId);
        }
      }
    }
    
    if (selectedMerchants.size > 1) {
      wx.showToast({ title: '仅支持同一商家下单', icon: 'none' });
      return;
    }
    
    // 检查选中商品库存
    let hasStockIssue = false;
    for (const merchant of merchants) {
      for (const goods of merchant.goods) {
        if (goods.checked && goods.stock === 0) {
          hasStockIssue = true;
          break;
        }
      }
      if (hasStockIssue) break;
    }
    
    if (hasStockIssue) {
      wx.showToast({ title: '部分商品库存不足', icon: 'none' });
      return;
    }
    
    // 跳转到结算页面
    wx.navigateTo({ url: '/pages/order-confirm/order-confirm' });
  }
})