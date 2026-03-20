// pages/order-detail/order-detail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    order: {},
    showAllGoods: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const orderId = options.orderId || '1001'; // 默认为1001，实际应该从options中获取
    this.loadOrderDetail(orderId);
  },

  /**
   * 加载订单详情
   */
  loadOrderDetail(orderId) {
    wx.showLoading({ title: '加载中...' });
    
    // 模拟接口请求
    console.log('请求订单详情:', orderId);
    
    // 模拟订单详情数据
    const mockOrder = {
      orderId: orderId,
      merchantId: '2001',
      merchantName: '测试商家',
      merchantLogo: 'https://via.placeholder.com/50x50',
      merchantPhone: '13800138000',
      createTime: '2026-03-20 10:00:00',
      payTime: '2026-03-20 10:05:00',
      status: '1',
      statusText: '待发货',
      statusIcon: '📦',
      statusDesc: '商家正在准备商品',
      totalPrice: 199.99,
      shippingFee: 10,
      discount: 20,
      payPrice: 189.99,
      totalQuantity: 3,
      receiverName: '张三',
      receiverPhone: '139****9000', // 手机号脱敏
      receiverAddress: '北京市朝阳区某某街道某某小区1号楼1单元101室',
      remark: '少糖，不要辣',
      timestamps: {
        paidAt: '2026-03-20 10:05',
        shippedAt: '',
        deliveredAt: '',
        completedAt: ''
      },
      goodsList: [
        { goodsId: '101', name: '商品1', spec: '规格1', price: 69.99, quantity: 1, image: 'https://via.placeholder.com/100' },
        { goodsId: '102', name: '商品2', spec: '规格2', price: 59.99, quantity: 1, image: 'https://via.placeholder.com/100' },
        { goodsId: '103', name: '商品3', spec: '规格3', price: 69.99, quantity: 1, image: 'https://via.placeholder.com/100' }
      ],
      actions: []
    };
    
    // 根据订单状态设置不同的操作按钮
    switch (mockOrder.status) {
      case '0':
        mockOrder.actions = [
          { text: '取消订单', action: 'cancel', type: 'default' },
          { text: '去支付', action: 'pay', type: 'primary' }
        ];
        mockOrder.statusIcon = '💳';
        mockOrder.statusDesc = '请在30分钟内完成支付';
        break;
      case '1':
        mockOrder.actions = [
          { text: '查看物流', action: 'logistics', type: 'default' },
          { text: '取消订单', action: 'cancel', type: 'primary' }
        ];
        mockOrder.statusIcon = '📦';
        mockOrder.statusDesc = '商家正在准备商品';
        break;
      case '2':
        mockOrder.actions = [
          { text: '查看物流', action: 'logistics', type: 'default' },
          { text: '确认收货', action: 'confirm', type: 'primary' }
        ];
        mockOrder.statusIcon = '🚚';
        mockOrder.statusDesc = '商品正在配送中';
        break;
      case '3':
        mockOrder.actions = [
          { text: '评价', action: 'review', type: 'primary' },
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'default' }
        ];
        mockOrder.statusIcon = '✅';
        mockOrder.statusDesc = '订单已完成';
        break;
      case '4':
        mockOrder.actions = [
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'primary' }
        ];
        mockOrder.statusIcon = '❌';
        mockOrder.statusDesc = '订单已取消';
        break;
    }
    
    setTimeout(() => {
      wx.hideLoading();
      this.setData({
        order: mockOrder
      });
    }, 500);
  },

  /**
   * 联系商家
   */
  callShop() {
    const phoneNumber = this.data.order.merchantPhone;
    wx.makePhoneCall({
      phoneNumber: phoneNumber,
      success: function() {
        console.log('拨打电话成功');
      },
      fail: function() {
        console.log('拨打电话失败');
      }
    });
  },

  /**
   * 处理订单操作
   */
  handleAction(e) {
    const action = e.currentTarget.dataset.action;
    console.log('订单操作:', action);
    
    // 根据不同的操作执行不同的逻辑
    switch (action) {
      case 'cancel':
        // 取消订单
        this.cancelOrder();
        break;
      case 'pay':
        // 去支付
        this.goToPay();
        break;
      case 'logistics':
        // 查看物流
        this.viewLogistics();
        break;
      case 'confirm':
        // 确认收货
        this.confirmReceipt();
        break;
      case 'buyAgain':
        // 再次购买
        this.buyAgain();
        break;
      case 'review':
        // 评价
        this.goToReview();
        break;
      case 'delete':
        // 删除订单
        this.deleteOrder();
        break;
    }
  },

  /**
   * 取消订单
   */
  cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用取消订单接口
          console.log('取消订单');
          wx.showToast({ title: '订单已取消' });
          // 刷新订单详情
          this.loadOrderDetail(this.data.order.orderId);
        }
      }
    });
  },

  /**
   * 去支付
   */
  goToPay() {
    wx.navigateTo({ url: `/pages/pay/pay?orderId=${this.data.order.orderId}` });
  },

  /**
   * 查看物流
   */
  viewLogistics() {
    wx.navigateTo({ url: `/pages/logistics/logistics?orderId=${this.data.order.orderId}` });
  },

  /**
   * 确认收货
   */
  confirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用确认收货接口
          console.log('确认收货');
          wx.showToast({ title: '已确认收货' });
          // 刷新订单详情
          this.loadOrderDetail(this.data.order.orderId);
        }
      }
    });
  },

  /**
   * 再次购买
   */
  buyAgain() {
    const goodsList = this.data.order.goodsList;
    // 将商品加入购物车
    console.log('再次购买:', goodsList);
    wx.showToast({ title: '商品已加入购物车' });
    // 跳转到购物车页面
    wx.switchTab({ url: '/pages/cart/cart' });
  },

  /**
   * 去评价
   */
  goToReview() {
    wx.navigateTo({ url: `/pages/review/review?orderId=${this.data.order.orderId}` });
  },

  /**
   * 删除订单
   */
  deleteOrder() {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用删除订单接口
          console.log('删除订单');
          wx.showToast({ title: '订单已删除' });
          // 跳回订单列表页
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        }
      }
    });
  },

  /**
   * 跳转到商家主页
   */
  goToMerchant(e) {
    const merchantId = e.currentTarget.dataset.merchantId;
    wx.navigateTo({ url: `/pages/merchant/merchant?id=${merchantId}` });
  },

  /**
   * 预览商品图片
   */
  previewImage(e) {
    const image = e.currentTarget.dataset.image;
    wx.previewImage({
      urls: [image]
    });
  },

  /**
   * 显示全部商品
   */
  showAllGoods() {
    this.setData({ showAllGoods: true });
  },

  /**
   * 复制订单号
   */
  copyOrderId() {
    const orderId = this.data.order.orderId;
    wx.setClipboardData({
      data: orderId,
      success: function() {
        wx.showToast({ title: '订单号已复制' });
      }
    });
  }
})