// pages/order-confirm/order-confirm.js
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
    // 从购物车传递选中的商品
    const goodsList = wx.getStorageSync('selectedGoods') || [];
    this.setData({ goodsList });
    this.groupGoodsByMerchant();
    this.calculatePrice();
    this.loadDefaultAddress();
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
    
    const token = wx.getStorageSync('token');
    wx.request({
      url: 'http://localhost:3000/api/addresses/default',
      method: 'GET',
      header: { 'Authorization': 'Bearer ' + token },
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data.success) {
          this.setData({ address: res.data.data });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取默认地址失败:', err);
      }
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
    wx.navigateTo({ url: '/pages/address/address' });
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
    
    // 构建订单数据
    const orderData = {
      addressId: this.data.address.id,
      goodsList: this.data.goodsList,
      totalPrice: this.data.totalPrice,
      shippingFee: this.data.shippingFee,
      discount: this.data.discount,
      payPrice: this.data.payPrice,
      remark: this.data.remark,
      deliveryType: this.data.deliveryType,
      timeType: this.data.timeType,
      appointmentTime: this.data.appointmentTime
    };
    
    const token = wx.getStorageSync('token');
    wx.request({
      url: 'http://localhost:3000/api/orders',
      method: 'POST',
      header: { 
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      data: orderData,
      success: (res) => {
        this.setData({ submitting: false });
        if (res.statusCode === 201 && res.data.success) {
          wx.showToast({ title: '订单提交成功' });
          // 清空购物车中已选中的商品
          wx.removeStorageSync('selectedGoods');
          // 跳转到订单详情页
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/order-detail/order-detail?orderId=${res.data.data.orderId}`
            });
          }, 1000);
        } else {
          wx.showToast({ title: res.data.message || '订单提交失败', icon: 'none' });
        }
      },
      fail: (err) => {
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        console.error('提交订单失败:', err);
      }
    });
  }
})