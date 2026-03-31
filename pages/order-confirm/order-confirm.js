// pages/order-confirm/order-confirm.js
const { getSelectedItems, getAddresses, createOrder } = require('../../utils/api');

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
    this.loadSelectedGoods();
    this.loadDefaultAddress();
  },

  /**
   * 加载选中的购物车商品（真实数据）
   */
  async loadSelectedGoods() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await getSelectedItems();
      const merchants = (res && res.data && res.data.merchants) || [];
      const first = merchants[0];
      const items = (first && first.items) || [];

      const goodsList = items.map((x) => ({
        goodsId: x.goodsId,
        name: x.goodsName,
        image: x.goodsImage,
        price: x.price,
        quantity: x.quantity,
        spec: x.spec,
        merchantId: first.merchantId,
        merchantName: first.merchantName,
        merchantLogo: first.merchantLogo
      }));

      this.setData({ goodsList });
      this.groupGoodsByMerchant();
      this.calculatePrice();
    } catch (err) {
      console.error('获取选中商品失败:', err);
      wx.showToast({ title: err.message || '获取选中商品失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 按商家分组商品
   */
  groupGoodsByMerchant() {
    const goodsList = this.data.goodsList;
    const merchantGroups = [];
    const merchantMap = {};
    
    goodsList.forEach(goods => {
      const merchantId = goods.merchantId || 'default';
      if (!merchantMap[merchantId]) {
        merchantMap[merchantId] = {
          merchantId: merchantId,
          merchantName: goods.merchantName || '默认商家',
          merchantLogo: goods.merchantLogo || 'https://via.placeholder.com/50x50',
          goodsList: []
        };
        merchantGroups.push(merchantMap[merchantId]);
      }
      merchantMap[merchantId].goodsList.push(goods);
    });
    
    this.setData({ merchantGroups });
  },

  /**
   * 加载默认地址
   */
  loadDefaultAddress() {
    wx.showLoading({ title: '加载中...' });

    getAddresses()
      .then((res) => {
        const list = (res && res.data) || [];
        const defaultAddr = list.find((x) => String(x.is_default) === '1' || x.is_default === 1) || list[0];
        if (defaultAddr) {
          this.setData({
            address: {
              id: defaultAddr.id,
              name: defaultAddr.receiver_name,
              phone: defaultAddr.phone,
              province: defaultAddr.province,
              city: defaultAddr.city,
              district: defaultAddr.district,
              detail: defaultAddr.detail
            }
          });
        }
      })
      .catch((err) => {
        console.error('获取默认地址失败:', err);
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  /**
   * 计算订单总金额
   */
  calculatePrice() {
    const { goodsList, shippingFee, discount } = this.data;
    let totalPrice = 0;
    let totalQuantity = 0;
    
    goodsList.forEach(goods => {
      totalPrice += goods.price * goods.quantity;
      totalQuantity += goods.quantity;
    });
    
    const payPrice = totalPrice + shippingFee - discount;
    
    this.setData({
      totalPrice,
      totalQuantity,
      payPrice
    });
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
    this.setData({ shippingFee: deliveryOption.price });
    this.calculatePrice();
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

  /**
   * 提交订单
   */
  submitOrder() {
    if (!this.data.address) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' });
      return;
    }
    
    if (this.data.goodsList.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    
    this.setData({ submitting: true });

    const merchantGroup = (this.data.merchantGroups && this.data.merchantGroups[0]) || null;
    const merchantId = merchantGroup && merchantGroup.merchantId;
    if (!merchantId) {
      this.setData({ submitting: false });
      wx.showToast({ title: '订单缺少商家信息', icon: 'none' });
      return;
    }

    const items = this.data.goodsList.map((g) => ({
      product_id: g.goodsId,
      quantity: g.quantity
    }));

    const remarkParts = [];
    if (this.data.remark) remarkParts.push(this.data.remark);
    remarkParts.push(`配送方式:${this.data.deliveryType}`);
    remarkParts.push(`配送时间:${this.data.timeType === 'appointment' ? this.data.appointmentTime : '尽快送达'}`);

    createOrder({
      merchant_id: merchantId,
      items,
      address_id: this.data.address.id,
      remark: remarkParts.join('；'),
      payment_method: 'wechat'
    })
      .then((res) => {
        if (res && res.success) {
          wx.showToast({ title: '订单提交成功' });
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/order-detail/order-detail?orderId=${res.data.orderId}`
            });
          }, 600);
        } else {
          wx.showToast({ title: (res && res.message) || '订单提交失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '网络错误，请重试', icon: 'none' });
        console.error('提交订单失败:', err);
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
})