// pages/feedback/feedback.js
const { request } = require('../../utils/api');

Page({
  data: {
    rating: 0,
    content: '',
    images: [],
    loading: false,
    orderId: null,
    merchantId: null
  },

  onLoad: function (options) {
    // 获取订单ID和商家ID
    if (options.order_id) {
      this.setData({ orderId: options.order_id });
    }
    if (options.merchant_id) {
      this.setData({ merchantId: options.merchant_id });
    }
  },

  // 设置评分
  setRating: function (e) {
    const rating = e.currentTarget.dataset.rating;
    this.setData({ rating: rating });
  },

  // 评价内容输入
  onContentInput: function (e) {
    this.setData({ content: e.detail.value });
  },

  // 选择图片
  chooseImage: function () {
    const { images } = this.data;
    const remaining = 5 - images.length;

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

  // 提交评价
  submitFeedback: function () {
    const { rating, content, images, orderId, merchantId, loading } = this.data;

    // 表单验证
    if (!rating) {
      wx.showToast({ title: '请选择评分', icon: 'none' });
      return;
    }

    if (!content) {
      wx.showToast({ title: '请输入评价内容', icon: 'none' });
      return;
    }

    if (loading) return;

    this.setData({ loading: true });

    // 构建请求数据
    const data = {
      order_id: orderId,
      merchant_id: merchantId,
      type: 'product',
      rating: rating,
      content: content
    };

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

      images.forEach((image, index) => {
        wx.uploadFile({
          url: 'http://localhost:3000/api/upload',
          filePath: image,
          name: 'file',
          success: (res) => {
            try {
              const result = JSON.parse(res.data);
              if (result.success) {
                uploadedImages.push(result.data.url);
              }
            } catch (e) {
              console.error('解析上传结果失败:', e);
            }
          },
          fail: (err) => {
            console.error('上传图片失败:', err);
          },
          complete: () => {
            uploadedCount++;
            if (uploadedCount === images.length) {
              resolve(uploadedImages);
            }
          }
        });
      });
    });
  },

  // 发送评价
  sendFeedback: function (data) {
    request({
      url: '/feedbacks',
      method: 'POST',
      data: data
    }).then(res => {
      this.setData({ loading: false });
      if (res.success) {
        wx.showToast({ title: '评价成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({ title: res.message || '评价失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('提交评价失败:', err);
      this.setData({ loading: false });
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});