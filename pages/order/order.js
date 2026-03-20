// pages/order/order.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    tabs: [
      { name: '全部', status: '' },
      { name: '待支付', status: '0' },
      { name: '待发货', status: '1' },
      { name: '已完成', status: '3' },
      { name: '已取消', status: '4' }
    ],
    activeTab: '',
    orders: [],
    page: 1,
    pageSize: 10,
    loading: false,
    hasMore: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadOrders();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    if (this.data.activeTab === '') {
      this.loadOrders();
    }
  },

  /**
   * 加载订单列表
   */
  loadOrders() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    // 构建请求参数
    const params = {
      status: this.data.activeTab,
      page: this.data.page,
      pageSize: this.data.pageSize
    };
    
    // 模拟接口请求
    console.log('请求订单列表:', params);
    
    // 模拟订单数据
    const mockOrders = [
      {
        orderId: '1001',
        merchantId: '2001',
        merchantName: '测试商家',
        merchantLogo: 'https://via.placeholder.com/50x50',
        createTime: '2026-03-20 10:00:00',
        status: '0',
        statusText: '待支付',
        totalPrice: 199.99,
        originalPrice: 219.99,
        totalQuantity: 3,
        goodsList: [
          { goodsId: '101', name: '商品1', spec: '规格1', price: 69.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '102', name: '商品2', spec: '规格2', price: 59.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '103', name: '商品3', spec: '规格3', price: 69.99, quantity: 1, image: 'https://via.placeholder.com/100' }
        ],
        actions: [
          { text: '取消订单', action: 'cancel', type: 'default' },
          { text: '去支付', action: 'pay', type: 'primary' }
        ]
      },
      {
        orderId: '1002',
        merchantId: '2002',
        merchantName: '测试商家2',
        merchantLogo: 'https://via.placeholder.com/50x50',
        createTime: '2026-03-19 15:30:00',
        status: '1',
        statusText: '待发货',
        totalPrice: 299.99,
        originalPrice: 299.99,
        totalQuantity: 2,
        goodsList: [
          { goodsId: '201', name: '商品4', spec: '规格1', price: 149.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '202', name: '商品5', spec: '规格2', price: 149.99, quantity: 1, image: 'https://via.placeholder.com/100' }
        ],
        actions: [
          { text: '查看物流', action: 'logistics', type: 'default' },
          { text: '取消订单', action: 'cancel', type: 'primary' }
        ]
      },
      {
        orderId: '1003',
        merchantId: '2003',
        merchantName: '测试商家3',
        merchantLogo: 'https://via.placeholder.com/50x50',
        createTime: '2026-03-18 09:00:00',
        status: '3',
        statusText: '已完成',
        totalPrice: 399.99,
        originalPrice: 429.99,
        totalQuantity: 4,
        goodsList: [
          { goodsId: '301', name: '商品6', spec: '规格1', price: 99.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '302', name: '商品7', spec: '规格2', price: 99.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '303', name: '商品8', spec: '规格3', price: 99.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '304', name: '商品9', spec: '规格4', price: 99.99, quantity: 1, image: 'https://via.placeholder.com/100' }
        ],
        actions: [
          { text: '评价', action: 'review', type: 'primary' },
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'default' }
        ]
      },
      {
        orderId: '1004',
        merchantId: '2001',
        merchantName: '测试商家',
        merchantLogo: 'https://via.placeholder.com/50x50',
        createTime: '2026-03-17 14:00:00',
        status: '3',
        statusText: '已完成',
        totalPrice: 99.99,
        originalPrice: 99.99,
        totalQuantity: 1,
        goodsList: [
          { goodsId: '401', name: '商品10', spec: '规格1', price: 99.99, quantity: 1, image: 'https://via.placeholder.com/100' }
        ],
        actions: [
          { text: '评价', action: 'review', type: 'primary' },
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'default' }
        ]
      },
      {
        orderId: '1005',
        merchantId: '2002',
        merchantName: '测试商家2',
        merchantLogo: 'https://via.placeholder.com/50x50',
        createTime: '2026-03-16 11:00:00',
        status: '4',
        statusText: '已取消',
        totalPrice: 149.99,
        originalPrice: 149.99,
        totalQuantity: 2,
        goodsList: [
          { goodsId: '501', name: '商品11', spec: '规格1', price: 74.99, quantity: 1, image: 'https://via.placeholder.com/100' },
          { goodsId: '502', name: '商品12', spec: '规格2', price: 74.99, quantity: 1, image: 'https://via.placeholder.com/100' }
        ],
        actions: [
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'primary' }
        ]
      }
    ];
    
    // 根据Tab筛选订单
    const filteredOrders = this.data.activeTab 
      ? mockOrders.filter(order => order.status === this.data.activeTab)
      : mockOrders;
    
    // 按时间倒序排列
    const sortedOrders = filteredOrders.sort((a, b) => {
      return new Date(b.createTime) - new Date(a.createTime);
    });
    
    setTimeout(() => {
      this.setData({
        orders: this.data.page === 1 ? sortedOrders : [...this.data.orders, ...sortedOrders],
        loading: false,
        hasMore: sortedOrders.length === this.data.pageSize
      });
    }, 500);
  },

  /**
   * 切换Tab
   */
  switchTab(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      activeTab: status,
      page: 1,
      orders: []
    });
    this.loadOrders();
  },

  /**
   * 处理订单操作
   */
  handleAction(e) {
    const { orderId, action } = e.currentTarget.dataset;
    console.log('订单操作:', orderId, action);
    
    // 根据不同的操作执行不同的逻辑
    switch (action) {
      case 'cancel':
        // 取消订单
        this.cancelOrder(orderId);
        break;
      case 'pay':
        // 去支付
        this.goToPay(orderId);
        break;
      case 'logistics':
        // 查看物流
        this.viewLogistics(orderId);
        break;
      case 'confirm':
        // 确认收货
        this.confirmReceipt(orderId);
        break;
      case 'buyAgain':
        // 再次购买
        this.buyAgain(orderId);
        break;
      case 'review':
        // 评价
        this.goToReview(orderId);
        break;
      case 'delete':
        // 删除订单
        this.deleteOrder(orderId);
        break;
    }
  },

  /**
   * 取消订单
   */
  cancelOrder(orderId) {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用取消订单接口
          console.log('取消订单:', orderId);
          wx.showToast({ title: '订单已取消' });
          // 刷新订单列表
          this.loadOrders();
        }
      }
    });
  },

  /**
   * 去支付
   */
  goToPay(orderId) {
    wx.navigateTo({ url: `/pages/pay/pay?orderId=${orderId}` });
  },

  /**
   * 查看物流
   */
  viewLogistics(orderId) {
    wx.navigateTo({ url: `/pages/logistics/logistics?orderId=${orderId}` });
  },

  /**
   * 确认收货
   */
  confirmReceipt(orderId) {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用确认收货接口
          console.log('确认收货:', orderId);
          wx.showToast({ title: '已确认收货' });
          // 刷新订单列表
          this.loadOrders();
        }
      }
    });
  },

  /**
   * 再次购买
   */
  buyAgain(orderId) {
    // 调用再次购买接口
    console.log('再次购买:', orderId);
    wx.showToast({ title: '商品已加入购物车' });
    wx.switchTab({ url: '/pages/cart/cart' });
  },

  /**
   * 去评价
   */
  goToReview(orderId) {
    wx.navigateTo({ url: `/pages/review/review?orderId=${orderId}` });
  },

  /**
   * 删除订单
   */
  deleteOrder(orderId) {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: (res) => {
        if (res.confirm) {
          // 调用删除订单接口
          console.log('删除订单:', orderId);
          wx.showToast({ title: '订单已删除' });
          // 刷新订单列表
          this.loadOrders();
        }
      }
    });
  },

  /**
   * 跳转到订单详情页
   */
  goToOrderDetail(e) {
    const orderId = e.currentTarget.dataset.orderId;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${orderId}` });
  },

  /**
   * 跳转到商家主页
   */
  goToMerchant(e) {
    const merchantId = e.currentTarget.dataset.merchantId;
    wx.navigateTo({ url: `/pages/merchant/merchant?id=${merchantId}` });
  },

  /**
   * 去逛逛
   */
  goShopping() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.setData({ page: 1, orders: [] });
    this.loadOrders();
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    if (this.data.loading || !this.data.hasMore) return;
    this.setData({ page: this.data.page + 1 });
    this.loadOrders();
  }
})