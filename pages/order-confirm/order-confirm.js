// pages/order-confirm/order-confirm.js
const { getSelectedItems, getAddresses, createOrder } = require('../../utils/api');
const { toNetworkUrl } = require('../../utils/url');

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

  /**
   * 页面的初始数据
   */
  data: {
    address: null,
    goodsList: [],
    merchantGroups: [],
    totalPrice: 0,
    totalQuantity: 0,
    shippingFee: 10,
    discount: 0,
    payPrice: 0,
    remark: '',
    deliveryOptions: [
      { id: 'self', name: '到店自取', desc: '到商家门店自取', price: 0 },
      { id: 'delivery', name: '配送上门', desc: '商家配送上门', price: 10 }
    ],
    deliveryType: 'delivery',
    timeOptions: [
      { id: 'asap', name: '尽快送达' },
      { id: 'appointment', name: '预约时间' }
    ],
    timeType: 'asap',
    appointmentTime: '12:00',
    remarkTags: ['少糖', '不要辣', '放门口', '尽快送达', '需要餐具'],
    submitting: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this._loadingCount = 0;
    this._loadingShown = false;
    this.loadSelectedGoods();
    this.loadDefaultAddress();
  },

  /**
   * 生命周期函数--监听页面显示
   * 从地址选择页返回时会触发，用于读取选中的地址
   */
  onShow() {
    this.applySelectedAddressFromStorage();
  },

  _showLoading(title) {
    const next = (this._loadingCount || 0) + 1;
    this._loadingCount = next;
    if (next !== 1) return;
    wx.showLoading({
      title: title || '加载中...',
      success: () => {
        this._loadingShown = true;
      },
      fail: () => {
        this._loadingShown = false;
      }
    });
  },

  _hideLoading() {
    const current = this._loadingCount || 0;
    if (current <= 0) return;
    const next = Math.max(0, current - 1);
    this._loadingCount = next;
    if (next !== 0) return;
    if (!this._loadingShown) return;
    wx.hideLoading({
      complete: () => {
        this._loadingShown = false;
      }
    });
  },

  normalizeAddress(raw) {
    if (!raw) return null;
    return {
      id: raw.id,
      name: raw.receiver_name || raw.name || '',
      phone: raw.phone || '',
      province: raw.province || '',
      city: raw.city || '',
      district: raw.district || '',
      detail: raw.detail || ''
    };
  },

  _normalizeSelectedMerchants(merchants) {
    const list = Array.isArray(merchants) ? merchants : [];
    return list.map((m) => {
      const items = Array.isArray(m.items) ? m.items : [];
      const goodsList = items.map((x) => ({
        goodsId: x.goodsId,
        name: x.goodsName,
        image: toNetworkUrl(x.goodsImage) || '/assets/images/kong.jpg',
        price: toNum(x.price, 0),
        quantity: toInt(x.quantity, 0),
        spec: x.spec,
        merchantId: m.merchantId,
        merchantName: m.merchantName,
        merchantLogo: toNetworkUrl(m.merchantLogo) || '/assets/images/kong.jpg'
      }));
      return {
        merchantId: m.merchantId,
        merchantName: m.merchantName || '默认商家',
        merchantLogo: toNetworkUrl(m.merchantLogo) || '/assets/images/kong.jpg',
        goodsList
      };
    });
  },

  _recalcTotals(merchantGroups) {
    const groups = Array.isArray(merchantGroups) ? merchantGroups : [];
    let totalPrice = 0;
    let totalQuantity = 0;
    groups.forEach((g) => {
      const goods = (g && g.goodsList) || [];
      goods.forEach((x) => {
        totalPrice += toNum(x.price, 0) * toInt(x.quantity, 0);
        totalQuantity += toInt(x.quantity, 0);
      });
    });

    const shippingFee = toNum(this.data.shippingFee, 0);
    const discount = toNum(this.data.discount, 0);
    const payPrice = totalPrice + shippingFee - discount;
    this.setData({
      totalPrice,
      totalQuantity,
      payPrice
    });
  },

  applySelectedAddressFromStorage() {
    try {
      const raw = wx.getStorageSync('selectedAddress');
      if (raw && raw.id) {
        this.setData({ address: this.normalizeAddress(raw) });
      }
      // 用完即清，避免下次进入结算页误用旧选择
      if (raw) wx.removeStorageSync('selectedAddress');
    } catch (e) {
      // ignore
    }
  },

  /**
   * 加载选中的购物车商品（真实数据）
   */
  async loadSelectedGoods() {
    this._showLoading('加载中...');
    try {
      const res = await getSelectedItems();
      if (!res || !res.success) {
        wx.showToast({ title: (res && res.message) || '获取选中商品失败', icon: 'none' });
        this.setData({ goodsList: [], merchantGroups: [] });
        this._recalcTotals([]);
        return;
      }

      const merchants = (res.data && res.data.merchants) || [];
      const merchantGroups = this._normalizeSelectedMerchants(merchants);

      // goodsList 保留为扁平列表（便于提交时构建 items）
      const goodsList = merchantGroups.flatMap((g) => g.goodsList || []);
      this.setData({ merchantGroups, goodsList });
      this._recalcTotals(merchantGroups);
    } catch (err) {
      console.error('获取选中商品失败:', err);
      wx.showToast({ title: getErrMsg(err, '获取选中商品失败'), icon: 'none' });
    } finally {
      this._hideLoading();
    }
  },

  /**
   * 加载默认地址
   */
  async loadDefaultAddress() {
    this._showLoading('加载中...');
    try {
      const res = await getAddresses();
      if (!res || !res.success) return;
      const list = (res && res.data) || [];
      const defaultAddr = list.find((x) => String(x.is_default) === '1' || x.is_default === 1) || list[0];
      if (defaultAddr) {
        this.setData({ address: this.normalizeAddress(defaultAddr) });
      }
    } catch (err) {
      console.error('获取默认地址失败:', err);
    } finally {
      this._hideLoading();
    }
  },

  /**
   * 选择地址
   */
  selectAddress() {
    // 跳转到地址选择页面
    wx.navigateTo({
      url: '/pages/address/address?selectMode=1&title=' + encodeURIComponent('选择收货地址')
    });
  },

  /**
   * 选择配送方式
   */
  selectDelivery(e) {
    const deliveryType = e.currentTarget.dataset.id;
    this.setData({ deliveryType });
    
    // 根据配送方式更新配送费
    const deliveryOption = this.data.deliveryOptions.find(option => option.id === deliveryType);
    this.setData({ shippingFee: deliveryOption ? deliveryOption.price : 0 });
    this._recalcTotals(this.data.merchantGroups);
  },

  /**
   * 选择配送时间
   */
  selectTime(e) {
    const timeType = e.currentTarget.dataset.id;
    this.setData({ timeType });
  },

  /**
   * 绑定时间选择
   */
  bindTimeChange(e) {
    this.setData({ appointmentTime: e.detail.value });
  },

  /**
   * 输入订单备注
   */
  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  /**
   * 添加备注标签
   */
  addRemarkTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const remark = this.data.remark;
    const newRemark = remark ? `${remark}，${tag}` : tag;
    this.setData({ remark: newRemark });
  },

  _buildOrderRemark() {
    const parts = [];
    const remark = toStr(this.data.remark, '').trim();
    if (remark) parts.push(remark);
    parts.push(`配送方式:${this.data.deliveryType}`);
    parts.push(
      `配送时间:${this.data.timeType === 'appointment' ? this.data.appointmentTime : '尽快送达'}`
    );
    return parts.join('；');
  },

  /**
   * 提交订单
   */
  async submitOrder() {
    if (this.data.submitting) return;

    if (!this.data.address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }
    
    if (this.data.goodsList.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    
    const merchantGroup = (this.data.merchantGroups && this.data.merchantGroups[0]) || null;
    const merchantId = merchantGroup && merchantGroup.merchantId;
    if (!merchantId) {
      wx.showToast({ title: '订单缺少商家信息', icon: 'none' });
      return;
    }

    const items = (this.data.goodsList || [])
      .map((g) => ({
        product_id: g.goodsId,
        quantity: toInt(g.quantity, 0)
      }))
      .filter((x) => x.product_id && x.quantity > 0);

    if (items.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    this._showLoading('提交中...');
    try {
      const res = await createOrder({
        merchant_id: merchantId,
        items,
        address_id: this.data.address.id,
        remark: this._buildOrderRemark(),
        // 支付走模拟支付，正式部署时替换为真实微信支付
        payment_method: 'mock'
      });

      if (res && res.success) {
        wx.showToast({ title: '模拟支付成功' });
        setTimeout(() => {
          wx.navigateTo({
            url: `/pages/order-detail/order-detail?orderId=${res.data.orderId}`
          });
        }, 600);
      } else {
        wx.showToast({ title: (res && res.message) || '订单提交失败', icon: 'none' });
      }
    } catch (err) {
      wx.showToast({ title: getErrMsg(err, '网络错误，请重试'), icon: 'none' });
      console.error('提交订单失败:', err);
    } finally {
      this._hideLoading();
      this.setData({ submitting: false });
    }
  }
})