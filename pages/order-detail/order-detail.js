// pages/order-detail/order-detail.js
const { getOrderById, cancelOrder, completeOrder } = require('../../utils/api');
const { getOrderActions, getStatusIcon, getStatusDesc, handleOrderAction } = require('../../utils/orderUtils');
const { showLoading, hideLoading, showError, showSuccess } = require('../../utils/pageUtils');

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
    showLoading('加载中...');
    
    try {
      const res = await getOrderById(orderId);
      const order = res.data.order;
      
      // 设置订单操作按钮
      order.actions = getOrderActions(order.status);
      
      // 设置订单状态信息
      order.statusIcon = getStatusIcon(order.status);
      order.statusDesc = getStatusDesc(order.status);
      
      hideLoading();
      this.setData({
        order: order
      });
    } catch (error) {
      hideLoading();
      showError('加载失败');
      console.error('加载订单详情失败:', error);
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
    
    handleOrderAction({
      action,
      orderId: this.data.order.orderId,
      onCancel: () => this.cancelOrder(),
      onPay: () => this.goToPay(),
      onLogistics: () => this.viewLogistics(),
      onConfirm: () => this.confirmReceipt(),
      onBuyAgain: () => this.buyAgain(),
      onReview: () => this.goToReview(),
      onDelete: () => this.deleteOrder()
    });
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
          showLoading('处理中...');
          try {
            await cancelOrder(this.data.order.orderId);
            hideLoading();
            showSuccess('订单已取消');
            // 刷新订单详情
            this.loadOrderDetail(this.data.order.orderId);
          } catch (error) {
            hideLoading();
            showError('取消失败');
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
          showLoading('处理中...');
          try {
            await completeOrder(this.data.order.orderId);
            hideLoading();
            showSuccess('已确认收货');
            // 刷新订单详情
            this.loadOrderDetail(this.data.order.orderId);
          } catch (error) {
            hideLoading();
            showError('确认失败');
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
    const { order } = this.data;
    wx.navigateTo({
      url: `/pages/feedback/feedback?order_id=${order.orderId}&merchant_id=${order.merchantId}`
    });
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
          showLoading('处理中...');
          try {
            await deleteOrder(this.data.order.orderId);
            hideLoading();
            showSuccess('订单已删除');
            // 跳回订单列表页
            setTimeout(() => {
              wx.navigateBack();
            }, 1000);
          } catch (error) {
            hideLoading();
            showError('删除失败');
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