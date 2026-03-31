// pages/feedback/feedback.js
const { request, uploadImage } = require('../../utils/api');

Page({
  data: {
    feedbackType: 1, // 1-订单评价, 2-商家评价, 3-平台反馈
    rating: 0,
    content: '',
    images: [],
    loading: false,
    orderId: null,
    merchantId: null,
    orders: [],
    merchants: []
  },

  onLoad: function (options) {
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
  loadOrders: function () {
    request({
      url: '/orders',
      method: 'GET'
    }).then(res => {
      if (res.success) {
        // 只显示已完成的订单
        const completedOrders = res.data.orders.filter(order => order.status === 4);
        this.setData({ orders: completedOrders });
      }
    }).catch(err => {
      console.error('加载订单失败:', err);
    });
  },

  // 加载商家列表
  loadMerchants: function () {
    request({
      url: '/merchants',
      method: 'GET'
    }).then(res => {
      if (res.success) {
        this.setData({ merchants: res.data.merchants });
      }
    }).catch(err => {
      console.error('加载商家失败:', err);
    });
  },

  // 选择反馈类型
  selectFeedbackType: function (e) {
    const type = parseInt(e.currentTarget.dataset.type);
    this.setData({ feedbackType: type });
  },

  // 选择订单
  bindOrderChange: function (e) {
    const orderId = this.data.orders[e.detail.value].id;
    this.setData({ orderId: orderId });
  },

  // 选择商家
  bindMerchantChange: function (e) {
    const merchantId = this.data.merchants[e.detail.value].id;
    this.setData({ merchantId: merchantId });
  },

  // 处理评分输入
  onRatingInput: function (e) {
    const value = e.detail.value;
    // 只允许输入数字
    const numericValue = value.replace(/[^0-9]/g, '');
    let rating = parseInt(numericValue);
    // 限制评分范围在1-5之间
    if (isNaN(rating)) {
      rating = '';
    } else if (rating < 1) {
      rating = 1;
    } else if (rating > 5) {
      rating = 5;
    }
    this.setData({ rating: rating });
  },

  // 评价内容输入
  onContentInput: function (e) {
    this.setData({ content: e.detail.value });
  },

  // 选择图片
  chooseImage: function () {
    const { images } = this.data;
    const remaining = 4 - images.length;

    wx.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = [...images, ...res.tempFilePaths];
        this.setData({ images: newImages });
      }
    });
  },

  // 预览图片
  previewImage: function (e) {
    const { images } = this.data;
    const index = e.currentTarget.dataset.index;

    wx.previewImage({
      urls: images,
      current: images[index]
    });
  },

  // 删除图片
  deleteImage: function (e) {
    const { images } = this.data;
    const index = e.currentTarget.dataset.index;
    images.splice(index, 1);
    this.setData({ images: images });
  },

  // 提交反馈
  submitFeedback: function () {
    const { feedbackType, rating, content, images, orderId, merchantId, loading } = this.data;

    // 表单验证
    if (!content) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' });
      return;
    }

    if (content.length < 5) {
      wx.showToast({ title: '反馈内容至少5个字', icon: 'none' });
      return;
    }

    if (feedbackType === 1 || feedbackType === 2) {
      if (!rating) {
        wx.showToast({ title: '请给出您的评分', icon: 'none' });
        return;
      }

      if (rating < 1 || rating > 5) {
        wx.showToast({ title: '评分必须在1-5星之间', icon: 'none' });
        return;
      }
    }

    if (feedbackType === 1 && !orderId) {
      wx.showToast({ title: '请选择订单', icon: 'none' });
      return;
    }

    if (feedbackType === 2 && !merchantId) {
      wx.showToast({ title: '请选择商家', icon: 'none' });
      return;
    }

    if (loading) return;

    this.setData({ loading: true });

    // 构建请求数据
    const data = {
      type: feedbackType,
      content: content
    };

    if (feedbackType === 1) {
      data.order_id = orderId;
    } else if (feedbackType === 2) {
      data.merchant_id = merchantId;
    }

    if (rating) {
      data.rating = rating;
    }

    // 上传图片（如果有）
    if (images.length > 0) {
      this.uploadImages(images).then(uploadedImages => {
        data.images = uploadedImages;
        this.sendFeedback(data);
      }).catch(err => {
        console.error('图片上传失败:', err);
        wx.showToast({ title: '图片上传失败', icon: 'none' });
        this.setData({ loading: false });
      });
    } else {
      this.sendFeedback(data);
    }
  },

  // 上传图片
  uploadImages: function (images) {
    return new Promise((resolve, reject) => {
      const uploadedImages = [];
      let uploadedCount = 0;
      let hasError = false;

      images.forEach((image, index) => {
        uploadImage(image)
          .then((res) => {
            if (res && res.success && res.data && res.data.url) {
              uploadedImages.push(res.data.url);
            } else {
              console.error('上传图片失败:', res && res.message);
              hasError = true;
            }
          })
          .catch((err) => {
            console.error('上传图片失败:', err);
            hasError = true;
          })
          .finally(() => {
            uploadedCount++;
            if (uploadedCount === images.length) {
              if (hasError) {
                reject(new Error('图片上传失败'));
              } else {
                resolve(uploadedImages);
              }
            }
          });
      });
    });
  },

  // 发送反馈
  sendFeedback: function (data) {
    request({
      url: '/feedback',
      method: 'POST',
      data: data
    }).then(res => {
      this.setData({ loading: false });
      if (res.success) {
        wx.showToast({ 
          title: '反馈提交成功', 
          icon: 'success',
          duration: 2000
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 2000);
      } else {
        wx.showToast({ title: res.message || '反馈提交失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('提交反馈失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});