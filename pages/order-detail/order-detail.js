// pages/order-detail/order-detail.js
const { getOrderById, cancelOrder, completeOrder, updateOrderAddress } = require('../../utils/api');
const { getOrderActions, getStatusIcon, getStatusDesc, getStatusText, handleOrderAction } = require('../../utils/orderUtils');
const { showError, showSuccess } = require('../../utils/pageUtils');
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
    order: {},
    showAllGoods: false,
    loading: false,
    orderId: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this._loadingCount = 0;
    this._loadingShown = false;
    this._detailLoadingPromise = null;

    const orderId = this.normalizeOrderId(options);
    if (!orderId) {
      showError('订单参数缺失');
      setTimeout(() => {
        wx.navigateBack();
      }, 800);
      return;
    }

    this.setData({ orderId });
    this.loadOrderDetail(orderId);
  },

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

  _normalizeOrder(orderRaw, items) {
    const raw = orderRaw || {};
    const list = Array.isArray(items) ? items : [];

    const status = raw.status != null ? String(raw.status) : '';
    const orderNo = raw.orderNo || raw.order_no || '';
    const totalPrice = raw.totalPrice != null
      ? raw.totalPrice
      : (raw.total_amount != null ? raw.total_amount : raw.totalAmount);

    const goodsList = list.map((it) => ({
      goodsId: it.product_id,
      name: it.product_name,
      image: toNetworkUrl(it.product_image) || '/assets/images/kong.jpg',
      price: toNum(it.price, 0),
      quantity: toInt(it.quantity, 0),
      subtotal: toNum(it.subtotal, 0),
      spec: it.spec
    }));

    const order = {
      ...raw,
      orderId: raw.orderId != null ? raw.orderId : raw.id,
      orderNo,
      // 展示用订单号：未支付时仍显示数字 id；已支付后显示 ORD...（由后端在支付完成时生成）
      displayOrderNo: (status === '0' || !orderNo) ? String(raw.orderId != null ? raw.orderId : raw.id) : String(orderNo),
      merchantId: raw.merchantId != null ? raw.merchantId : raw.merchant_id,
      merchantName: raw.merchantName || raw.merchant_name || '',
      merchantLogo: toNetworkUrl(raw.merchantLogo || raw.merchant_logo) || '/assets/images/morentouxiang.jpg',
      status,
      statusText: raw.statusText || getStatusText(status),
      receiverName: raw.receiverName || raw.receiver_name || '',
      receiverPhone: raw.receiverPhone || raw.receiver_phone || '',
      receiverAddress: raw.receiverAddress || raw.receiver_address || '',
      createTime: raw.createTime || raw.created_at || raw.createdAt || '',
      payTime: raw.payTime || raw.payment_time || raw.pay_time || '',
      totalPrice: toNum(totalPrice, 0),
      shippingFee: toNum(raw.shippingFee != null ? raw.shippingFee : raw.shipping_fee, 0),
      discount: toNum(raw.discount, 0),
      payPrice: toNum(raw.payPrice != null ? raw.payPrice : raw.pay_price, toNum(totalPrice, 0)),
      timestamps: {
        paidAt: (raw.timestamps && raw.timestamps.paidAt) || raw.payment_time || '',
        shippedAt: (raw.timestamps && raw.timestamps.shippedAt) || '',
        // 后端实际字段为 delivery_time（商家发货/配送开始时间）
        deliveredAt: (raw.timestamps && raw.timestamps.deliveredAt) || raw.delivery_time || '',
        completedAt: (raw.timestamps && raw.timestamps.completedAt) || raw.complete_time || ''
      },
      goodsList
    };

    order.canEditAddress = (status === '0' || status === '1');
    order.isSelfPickup = order.receiverName === '到店自取' || /配送方式[:：]到店自取/.test(String(order.remark || ''));

    order.totalQuantity = goodsList.reduce((sum, g) => sum + toInt(g.quantity, 0), 0);
    order.actions = getOrderActions(status);
    order.statusIcon = getStatusIcon(status);
    order.statusDesc = getStatusDesc(status);
    return order;
  },

  applySelectedAddressFromStorage() {
    try {
      const raw = wx.getStorageSync('selectedAddress');
      const addrId = raw && raw.id ? raw.id : null;
      if (!addrId) return;

      // 用完即清，避免下次误用旧选择
      wx.removeStorageSync('selectedAddress');

      const order = this.data.order || {};
      if (!order || !order.orderId) return;
      if (order.isSelfPickup) {
        wx.showToast({ title: '到店自取无需修改收货地址', icon: 'none' });
        return;
      }
      if (!order.canEditAddress) {
        wx.showToast({ title: '当前状态不可修改地址', icon: 'none' });
        return;
      }

      this.updateOrderAddressById(order.orderId, addrId);
    } catch (_) {
      // ignore
    }
  },

  async updateOrderAddressById(orderId, addressId) {
    this._showLoading('更新地址...');
    try {
      const res = await updateOrderAddress(orderId, { address_id: addressId });
      if (!res || !res.success) {
        wx.showToast({ title: (res && res.message) || '更新失败', icon: 'none' });
        return;
      }
      showSuccess('地址已更新');
      await this.loadOrderDetail(orderId);
    } catch (err) {
      showError(getErrMsg(err, '更新失败'));
      console.error('更新订单地址失败:', err);
    } finally {
      this._hideLoading();
    }
  },

  editDeliveryInfo() {
    const order = this.data.order || {};
    if (!order || !order.orderId) return;
    if (order.isSelfPickup) {
      wx.showToast({ title: '到店自取无需修改收货地址', icon: 'none' });
      return;
    }
    if (!order.canEditAddress) {
      wx.showToast({ title: '当前状态不可修改地址', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: '/pages/address/address?selectMode=1&title=' + encodeURIComponent('选择收货地址')
    });
  },

  normalizeOrderId(options) {
    const raw = options && (options.orderId || options.id || options.order_id);
    const value = String(raw == null ? '' : raw).trim();
    if (!value || value === 'undefined' || value === 'null') return '';
    return value;
  },

  /**
   * 加载订单详情
   */
  async loadOrderDetail(orderId) {
    if (this._detailLoadingPromise) return this._detailLoadingPromise;

    const normalizedId = String(orderId == null ? '' : orderId).trim();
    if (!normalizedId || normalizedId === 'undefined' || normalizedId === 'null') {
      showError('订单不存在');
      return;
    }
    if (this.data.loading) return;

    this.setData({ loading: true });
    this._showLoading('加载中...');

    this._detailLoadingPromise = (async () => {
      try {
        const res = await getOrderById(normalizedId);
        if (!res || !res.success) {
          showError((res && res.message) || '加载失败');
          return;
        }

        const orderRaw = (res && res.data && res.data.order) ? res.data.order : {};
        const items = (res && res.data && Array.isArray(res.data.items)) ? res.data.items : [];
        const order = this._normalizeOrder(orderRaw, items);
        this.setData({ order, showAllGoods: false });
      } catch (error) {
        showError(getErrMsg(error, '加载失败'));
        console.error('加载订单详情失败:', error);
      } finally {
        this._hideLoading();
        this.setData({ loading: false });
        this._detailLoadingPromise = null;
      }
    })();

    return this._detailLoadingPromise;
  },

  /**
   * 联系商家
   */
  callShop() {
    // 联系商家模块：按需求暂时移除（WXML 已隐藏入口）。
    wx.showToast({ title: '暂不提供联系商家', icon: 'none' });

    /*
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
    */
  },

  /**
   * 处理订单操作
   */
  handleAction(e) {
    const action = e.currentTarget.dataset.action;

    handleOrderAction({
      action,
      orderId: this.data.order.orderId,
      onCancel: () => this.cancelOrder(),
      onPay: () => this.goToPay(),
      onConfirm: () => this.confirmReceipt(),
      onBuyAgain: () => this.buyAgain(),
      onReview: () => this.goToReview()
    });
  },

  /**
   * 取消订单
   */
  _confirmAndRun({ title, content, run, successMsg, after }) {
    wx.showModal({
      title,
      content,
      success: async (res) => {
        if (!res.confirm) return;
        this._showLoading('处理中...');
        try {
          await run();
          showSuccess(successMsg);
          if (after) after();
        } catch (error) {
          showError(getErrMsg(error, '操作失败'));
          console.error(`${title}失败:`, error);
        } finally {
          this._hideLoading();
        }
      }
    });
  },

  cancelOrder() {
    const id = this.data.order.orderId;
    this._confirmAndRun({
      title: '取消订单',
      content: '确定要取消该订单吗？',
      run: () => cancelOrder(id),
      successMsg: '订单已取消',
      after: () => this.loadOrderDetail(id)
    });
  },

  /**
   * 去支付
   */
  goToPay() {
    wx.navigateTo({ url: `/pages/pay/pay?orderId=${this.data.order.orderId}` });
  },

  /**
   * 确认收货
   */
  confirmReceipt() {
    const id = this.data.order.orderId;
    this._confirmAndRun({
      title: '确认收货',
      content: '确定已收到商品吗？',
      run: () => completeOrder(id),
      successMsg: '已确认收货',
      after: () => this.loadOrderDetail(id)
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
   * 跳转到商家主页
   */
  goToMerchant(e) {
    const merchantId = e.currentTarget.dataset.merchantId;
    const merchantName = e.currentTarget.dataset.name;
    const titleParam = merchantName ? `&title=${encodeURIComponent(merchantName)}` : '';
    wx.navigateTo({ url: `/pages/merchant/merchant?id=${merchantId}${titleParam}` });
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
    const orderId = this.data.order.displayOrderNo || this.data.order.orderId;
    wx.setClipboardData({
      data: orderId,
      success: function() {
        wx.showToast({ title: '订单号已复制' });
      }
    });
  }
})