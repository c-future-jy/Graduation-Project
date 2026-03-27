// pages/merchant/order-detail/order-detail.js
const { request } = require('../../../utils/api');

Page({
  data: {
    orderInfo: {},
    loading: true,
    orderId: null
  },

  onLoad: function (options) {
    const orderId = options.id;
    if (!orderId) {
      wx.showToast({ title: '订单ID错误', icon: 'none' });
      return;
    }
    this.setData({ orderId: orderId });
    this.loadOrderDetail();
  },

  // 加载订单详情
  loadOrderDetail: function () {
    const { orderId } = this.data;
    
    wx.showLoading({ title: '加载中...' });
    
    request({
      url: `/orders/merchant/orders/${orderId}`,
      method: 'GET'
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        this.setData({
          orderInfo: res.data.order,
          loading: false
        });
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('加载订单详情失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // 处理发货
  handleShip: function () {
    const { orderId } = this.data;
    this.confirmShip(orderId);
  },

  // 确认发货
  confirmShip: function (orderId) {
    wx.showModal({
      title: '确认发货',
      content: '确定要发货吗？',
      success: (res) => {
        if (res.confirm) {
          this.shipOrder(orderId);
        }
      }
    });
  },

  // 执行发货
  shipOrder: function (orderId) {
    wx.showLoading({ title: '发货中...' });

    request({
      url: `/orders/merchant/orders/${orderId}/ship`,
      method: 'POST'
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '发货成功', icon: 'success' });
        // 刷新订单详情
        this.loadOrderDetail();
      } else {
        wx.showToast({ title: res.message || '发货失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('发货失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 处理取消订单
  handleCancel: function () {
    const { orderId } = this.data;
    this.showCancelReasonDialog(orderId);
  },

  // 显示取消原因对话框
  showCancelReasonDialog: function (orderId) {
    const cancelReasons = [
      '库存不足',
      '用户申请取消',
      '商品缺货',
      '其他原因'
    ];

    wx.showActionSheet({
      itemList: cancelReasons,
      success: (res) => {
        const reason = cancelReasons[res.tapIndex];
        this.confirmCancel(orderId, reason);
      }
    });
  },

  // 确认取消订单
  confirmCancel: function (orderId, reason) {
    wx.showModal({
      title: '确认取消',
      content: `确定要取消订单吗？\n原因：${reason}`,
      success: (res) => {
        if (res.confirm) {
          this.cancelOrder(orderId, reason);
        }
      }
    });
  },

  // 执行取消订单
  cancelOrder: function (orderId, reason) {
    wx.showLoading({ title: '取消中...' });

    request({
      url: `/orders/merchant/orders/${orderId}/cancel`,
      method: 'POST',
      data: { reason: reason }
    }).then(res => {
      wx.hideLoading();
      if (res.success) {
        wx.showToast({ title: '取消成功', icon: 'success' });
        // 刷新订单详情
        this.loadOrderDetail();
      } else {
        wx.showToast({ title: res.message || '取消失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('取消订单失败:', err);
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  // 查看评价
  viewFeedback: function () {
    const { orderId } = this.data;
    wx.navigateTo({
      url: `/pages/feedback/feedback?order_id=${orderId}`
    });
  },

  // 返回订单列表
  goToOrderList: function () {
    wx.navigateBack();
  },

  // 手机号脱敏处理
  getMaskedPhone: function (phone) {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  },

  // 获取订单状态文本
  getStatusText: function (status) {
    switch (status) {
      case 1:
        return '待发货';
      case 2:
        return '已发货';
      case 3:
        return '已完成';
      case 4:
        return '已取消';
      default:
        return '未知状态';
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.loadOrderDetail().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});