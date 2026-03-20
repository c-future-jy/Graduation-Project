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
    // 模拟接口请求获取默认地址
    wx.showLoading({ title: '加载中...' });
    
    // 模拟默认地址数据
    setTimeout(() => {
      wx.hideLoading();
      const defaultAddress = {
        id: '1',
        name: '张三',
        phone: '13900139000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '某某街道某某小区1号楼1单元101室',
        isDefault: true
      };
      this.setData({ address: defaultAddress });
    }, 500);
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
    
    // 生成唯一订单号
    const orderId = this.generateOrderId();
    
    // 构建订单数据
    const orderData = {
      orderId: orderId,
      createTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      status: '0',
      statusText: '待付款',
      totalPrice: this.data.totalPrice,
      shippingFee: this.data.shippingFee,
      discount: this.data.discount,
      payPrice: this.data.payPrice,
      remark: this.data.remark,
      addressId: this.data.address.id,
      address: this.data.address,
      deliveryType: this.data.deliveryType,
      timeType: this.data.timeType,
      appointmentTime: this.data.appointmentTime,
      goodsList: this.data.goodsList
    };
    
    // 模拟数据库事务
    this.createOrderWithTransaction(orderData);
  },

  /**
   * 生成唯一订单号
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ORD${timestamp}${random.toString().padStart(4, '0')}`;
  },

  /**
   * 开启数据库事务创建订单
   */
  createOrderWithTransaction(orderData) {
    wx.showLoading({ title: '提交订单中...' });
    
    // 模拟数据库事务
    setTimeout(() => {
      // 模拟订单创建成功
      wx.hideLoading();
      wx.showToast({ title: '订单提交成功' });
      
      // 清空购物车中已选中的商品
      wx.removeStorageSync('selectedGoods');
      
      // 跳转到订单详情页
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/order-detail/order-detail?orderId=${orderData.orderId}`
        });
      }, 1000);
    }, 1000);
  }
})