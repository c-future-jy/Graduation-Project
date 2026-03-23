// pages/order-detail/order-detail.js
const { getOrderById, cancelOrder, completeOrder } = require('../../utils/api');

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
  async loadOrderDetail(orderId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await getOrderById(orderId);
      const order = res.data.order;
      
      // 设置订单操作按钮
      order.actions = this.getOrderActions(order.status);
      
      // 设置订单状态信息
      order.statusIcon = this.getStatusIcon(order.status);
      order.statusDesc = this.getStatusDesc(order.status);
      
      wx.hideLoading();
      this.setData({
        order: order
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '加载失败', icon: 'none' });
      console.error('加载订单详情失败:', error);
    }
  },

  /**
   * 获取订单操作按钮
   */
  getOrderActions(status) {
    switch (status) {
      case '0':
        return [
          { text: '取消订单', action: 'cancel', type: 'default' },
          { text: '去支付', action: 'pay', type: 'primary' }
        ];
      case '1':
        return [
          { text: '查看物流', action: 'logistics', type: 'default' },
          { text: '取消订单', action: 'cancel', type: 'primary' }
        ];
      case '2':
        return [
          { text: '查看物流', action: 'logistics', type: 'default' },
          { text: '确认收货', action: 'confirm', type: 'primary' }
        ];
      case '3':
        return [
          { text: '评价', action: 'review', type: 'primary' },
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'default' }
        ];
      case '4':
        return [
          { text: '删除订单', action: 'delete', type: 'default' },
          { text: '再次购买', action: 'buyAgain', type: 'primary' }
        ];
      default:
        return [];
    }
  },

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    switch (status) {
      case '0': return '💳';
      case '1': return '📦';
      case '2': return '🚚';
      case '3': return '✅';
      case '4': return '❌';
      default: return '📋';
    }
  },

  /**
   * 获取状态描述
   */
  getStatusDesc(status) {
    switch (status) {
      case '0': return '请在30分钟内完成支付';
      case '1': return '商家正在准备商品';
      case '2': return '商品正在配送中';
      case '3': return '订单已完成';
      case '4': return '订单已取消';
      default: return '订单处理中';
    }
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
  async cancelOrder() {
    wx.showModal({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await cancelOrder(this.data.order.orderId);
            wx.hideLoading();
            wx.showToast({ title: '订单已取消' });
            // 刷新订单详情
            this.loadOrderDetail(this.data.order.orderId);
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '取消失败', icon: 'none' });
            console.error('取消订单失败:', error);
          }
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
  async confirmReceipt() {
    wx.showModal({
      title: '确认收货',
      content: '确定已收到商品吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await completeOrder(this.data.order.orderId);
            wx.hideLoading();
            wx.showToast({ title: '已确认收货' });
            // 刷新订单详情
            this.loadOrderDetail(this.data.order.orderId);
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '确认失败', icon: 'none' });
            console.error('确认收货失败:', error);
          }
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
  async deleteOrder() {
    wx.showModal({
      title: '删除订单',
      content: '确定要删除该订单吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          try {
            await deleteOrder(this.data.order.orderId);
            wx.hideLoading();
            wx.showToast({ title: '订单已删除' });
            // 跳回订单列表页
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          } catch (error) {
            wx.hideLoading();
            wx.showToast({ title: '删除失败', icon: 'none' });
            console.error('删除订单失败:', error);
          }
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