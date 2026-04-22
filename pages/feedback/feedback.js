// pages/feedback/feedback.js
const { request } = require('../../utils/api');

function toInt(value, fallback = 0) {
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
  data: {
    feedbackType: 1, // 1-订单评价, 2-商家评价, 3-平台反馈
    rating: '',
    content: '',
    loading: false,
    orderId: null,
    merchantId: null,
    orderIndex: -1,
    merchantIndex: -1,
    orders: [],
    merchants: []
  },

  onLoad(options) {
    // 获取订单ID和商家ID
    if (options.order_id) {
      this.setData({ orderId: options.order_id, feedbackType: 1 });
    }
    if (options.merchant_id) {
      this.setData({ merchantId: options.merchant_id, feedbackType: 2 });
    }
    // 加载订单和商家列表
    this.loadOrders();
    this.loadMerchants();
  },

  // 加载用户订单列表
  async loadOrders() {
    try {
      const normalizeOrder = (order) => {
        const id = order && (order.id ?? order.order_id);
        const orderNoRaw = order && (order.orderNo || order.order_no || order.orderNoText || order.order_no_text);
        const merchantName = order && (order.merchantName || order.merchant_name);
        const orderNo = toStr(orderNoRaw, id ? `订单#${id}` : '');
        const orderNoText = merchantName ? `${orderNo} - ${merchantName}` : orderNo;
        return {
          ...order,
          id,
          orderNo: orderNoText
        };
      };

      // 取更多订单用于选择；反馈仅允许选择“已完成”的订单（3=已完成）
      const res = await request({ url: '/orders', method: 'GET', data: { pageSize: 50 } });
      if (!res || !res.success) return;

      const rawOrders = (res.data && res.data.orders) || [];
      let selectableOrders = rawOrders
        .map(normalizeOrder)
        .filter((order) => toInt(order.status, -1) === 3);

      // 如果从其它页面带了 order_id，确保该订单一定出现在列表里（避免分页/筛选导致找不到）
      const { orderId } = this.data;
      if (orderId && !selectableOrders.some((o) => String(o.id) === String(orderId))) {
        try {
          const detail = await request({ url: `/orders/${orderId}`, method: 'GET', silent: true });
          const order = detail && detail.success && detail.data && detail.data.order;
          if (order) {
            const normalized = normalizeOrder(order);
            // 仅允许已完成
            if (toInt(normalized.status, -1) === 3) {
              selectableOrders = [normalized, ...selectableOrders];
            }
          }
        } catch (e) {
          // ignore
        }
      }

      const orderIndex = orderId
        ? selectableOrders.findIndex((o) => String(o.id) === String(orderId))
        : -1;

      this.setData({
        orders: selectableOrders,
        orderIndex: orderIndex >= 0 ? orderIndex : -1
      });
    } catch (err) {
      console.error('加载订单失败:', err);
    }
  },

  // 加载商家列表
  async loadMerchants() {
    try {
      const res = await request({ url: '/merchants', method: 'GET' });
      if (!res || !res.success) return;

      const merchants = (res.data && res.data.merchants) || [];
      const { merchantId } = this.data;
      const merchantIndex = merchantId
        ? merchants.findIndex((m) => String(m.id) === String(merchantId))
        : -1;

      this.setData({
        merchants,
        merchantIndex: merchantIndex >= 0 ? merchantIndex : -1
      });
    } catch (err) {
      console.error('加载商家失败:', err);
    }
  },

  // 选择反馈类型
  selectFeedbackType(e) {
    const type = toInt(e.currentTarget.dataset.type, 1);
    const next = { feedbackType: type };
    if (type === 1) {
      next.merchantId = null;
      next.merchantIndex = -1;
    } else if (type === 2) {
      next.orderId = null;
      next.orderIndex = -1;
    } else {
      next.orderId = null;
      next.orderIndex = -1;
      next.merchantId = null;
      next.merchantIndex = -1;
    }
    this.setData(next);
  },

  // 选择订单
  bindOrderChange(e) {
    const idx = toInt(e.detail.value, -1);
    const order = (this.data.orders || [])[idx];
    if (!order) return;
    this.setData({ orderId: order.id, orderIndex: idx });
  },

  // 选择商家
  bindMerchantChange(e) {
    const idx = toInt(e.detail.value, -1);
    const merchant = (this.data.merchants || [])[idx];
    if (!merchant) return;
    this.setData({ merchantId: merchant.id, merchantIndex: idx });
  },

  // 处理评分输入
  onRatingInput(e) {
    const raw = toStr(e.detail && e.detail.value, '').replace(/[^0-9]/g, '');
    if (!raw) {
      this.setData({ rating: '' });
      return;
    }
    const n = toInt(raw, 0);
    const rating = Math.min(5, Math.max(1, n));
    this.setData({ rating });
  },

  // 评价内容输入
  onContentInput(e) {
    this.setData({ content: (e.detail && e.detail.value) || '' });
  },

  _getFormError() {
    const { feedbackType, rating, content, orderId, merchantId } = this.data;
    const trimmed = toStr(content, '').trim();

    if (!trimmed) return '请输入反馈内容';
    if (trimmed.length < 5) return '反馈内容至少5个字';

    const requiresRating = feedbackType === 1 || feedbackType === 2;
    if (requiresRating) {
      if (!rating) return '请给出您的评分';
      if (toInt(rating, 0) < 1 || toInt(rating, 0) > 5) return '评分必须在1-5星之间';
    } else {
      if (rating && (toInt(rating, 0) < 1 || toInt(rating, 0) > 5)) return '评分必须在1-5星之间';
    }

    if (feedbackType === 1 && !orderId) return '请选择订单';
    if (feedbackType === 2 && !merchantId) return '请选择商家';
    return '';
  },

  _buildPayload() {
    const { feedbackType, rating, content, orderId, merchantId } = this.data;
    const data = {
      type: feedbackType,
      content: toStr(content, '').trim()
    };
    if (feedbackType === 1) data.order_id = orderId;
    if (feedbackType === 2) data.merchant_id = merchantId;
    if (rating) data.rating = toInt(rating, 0);
    return data;
  },

  // 提交反馈
  async submitFeedback() {
    if (this.data.loading) return;

    const errMsg = this._getFormError();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const data = this._buildPayload();

      const res = await request({
        url: '/feedback',
        method: 'POST',
        data
      });

      if (res && res.success) {
        wx.showToast({
          title: '反馈提交成功',
          icon: 'success',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({ title: (res && res.message) || '反馈提交失败', icon: 'none' });
      }
    } catch (err) {
      console.error('提交反馈失败:', err);
      wx.showToast({ title: getErrMsg(err, '网络错误'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

});