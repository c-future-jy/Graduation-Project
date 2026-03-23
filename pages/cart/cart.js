// pages/cart/cart.js
const { getCartList, updateCartItem, deleteCartItem, deleteSelectedItems, deleteInvalidItems } = require('../../utils/api');
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
    editMode: false,
    merchants: [],
    invalidGoods: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadCartData();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时重新加载购物车数据
    this.loadCartData();
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
      console.log('购物车数据:', res);
      
      this.setData({
        merchants: res.data.merchants || [],
        invalidGoods: res.data.invalidGoods || [],
        hasGoods: (res.data.merchants && res.data.merchants.length > 0),
        loading: false
      });
      
      if (callback) callback();
    } catch (error) {
      console.error('加载购物车数据失败:', error);
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
   * 切换全选状态
   */
  toggleAllCheck(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const allChecked = e.detail.value[0];
    let merchants = this.data.merchants;
    
    merchants = merchants.map(merchant => {
      const goods = merchant.goods.map(goods => ({
        ...goods,
        checked: allChecked
      }));
      return {
        ...merchant,
        checked: allChecked,
        goods
      };
    });
    
    this.setData({ merchants, allChecked });
    this.updateCheckoutInfo();
  },

  /**
   * 切换商家选中状态
   */
  toggleMerchantCheck(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const merchantId = e.currentTarget.dataset.merchantId;
    const checked = e.detail.value[0];
    
    let merchants = this.data.merchants;
    merchants = merchants.map(merchant => {
      if (merchant.merchantId === merchantId) {
        const goods = merchant.goods.map(goods => ({
          ...goods,
          checked
        }));
        return {
          ...merchant,
          checked,
          goods
        };
      }
      return merchant;
    });
    
    this.setData({ merchants });
    this.updateAllCheckedStatus();
    this.updateCheckoutInfo();
  },

  /**
   * 切换商品选中状态
   */
  toggleGoodsCheck(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const goodsId = e.currentTarget.dataset.goodsId;
    const merchantId = e.currentTarget.dataset.merchantId;
    const checked = e.detail.value[0];
    
    let merchants = this.data.merchants;
    merchants = merchants.map(merchant => {
      if (merchant.merchantId === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (goods.goodsId === goodsId) {
            return { ...goods, checked };
          }
          return goods;
        });
        
        // 检查商家是否所有商品都被选中
        const merchantChecked = goods.every(item => item.checked);
        
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
  },

  /**
   * 更新全选状态
   */
  updateAllCheckedStatus() {
    const merchants = this.data.merchants;
    let allChecked = true;
    
    for (const merchant of merchants) {
      if (!merchant.checked) {
        allChecked = false;
        break;
      }
    }
    
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
          totalPrice += goods.price * goods.quantity;
          checkedCount += goods.quantity;
          hasCheckedGoods = true;
        }
      }
    }
    
    this.setData({
      totalPrice,
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
    
    const goodsId = e.currentTarget.dataset.goodsId;
    const merchantId = e.currentTarget.dataset.merchantId;
    
    // 先更新本地数据，提供即时反馈
    let merchants = this.data.merchants;
    let updatedGoods = null;
    
    merchants = merchants.map(merchant => {
      if (merchant.merchantId === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (goods.goodsId === goodsId && goods.quantity > 1) {
            updatedGoods = { ...goods, quantity: goods.quantity - 1 };
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
    if (updatedGoods) {
      try {
        await updateCartItem(goodsId, { quantity: updatedGoods.quantity });
      } catch (error) {
        console.error('更新商品数量失败:', error);
        // 恢复原数据
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
    
    const goodsId = e.currentTarget.dataset.goodsId;
    const merchantId = e.currentTarget.dataset.merchantId;
    
    // 先更新本地数据，提供即时反馈
    let merchants = this.data.merchants;
    let updatedGoods = null;
    
    merchants = merchants.map(merchant => {
      if (merchant.merchantId === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (goods.goodsId === goodsId && goods.quantity < goods.stock) {
            updatedGoods = { ...goods, quantity: goods.quantity + 1 };
            return updatedGoods;
          } else if (goods.goodsId === goodsId && goods.quantity >= goods.stock) {
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
    if (updatedGoods) {
      try {
        await updateCartItem(goodsId, { quantity: updatedGoods.quantity });
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
    
    const goodsId = e.currentTarget.dataset.goodsId;
    const merchantId = e.currentTarget.dataset.merchantId;
    let quantity = parseInt(e.detail.value) || 1;
    
    // 先更新本地数据，提供即时反馈
    let merchants = this.data.merchants;
    let updatedGoods = null;
    
    merchants = merchants.map(merchant => {
      if (merchant.merchantId === merchantId) {
        const goods = merchant.goods.map(goods => {
          if (goods.goodsId === goodsId) {
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
    if (updatedGoods) {
      try {
        await updateCartItem(goodsId, { quantity: updatedGoods.quantity });
      } catch (error) {
        console.error('更新商品数量失败:', error);
        // 恢复原数据
        this.loadCartData();
      }
    }
  },

  /**
   * 删除商品
   */
  async deleteGoods(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    const goodsId = e.currentTarget.dataset.goodsId;
    const merchantId = e.currentTarget.dataset.merchantId;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用API删除商品
            await deleteCartItem(goodsId);
            
            // 重新加载购物车数据
            this.loadCartData();
            wx.showToast({ title: '删除成功' });
          } catch (error) {
            console.error('删除商品失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 删除选中商品
   */
  async deleteSelectedGoods(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除选中的商品吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 调用API删除选中商品
            await deleteSelectedItems();
            
            // 重新加载购物车数据
            this.loadCartData();
            this.setData({ editMode: false });
            wx.showToast({ title: '删除成功' });
          } catch (error) {
            console.error('删除选中商品失败:', error);
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  /**
   * 删除失效商品
   */
  async deleteInvalidGoods(e) {
    // 阻止事件冒泡
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    try {
      // 调用API删除失效商品
      await deleteInvalidItems();
      
      // 重新加载购物车数据
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
   * 进入编辑模式
   */
  enterEditMode(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    this.setData({ editMode: true });
  },

  /**
   * 退出编辑模式
   */
  exitEditMode(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    this.setData({ editMode: false });
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
    wx.navigateTo({ url: '/pages/confirm-order/confirm-order' });
  }
})