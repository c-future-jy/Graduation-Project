// pages/detail/detail.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    productId: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    if (options && options.id) {
      this.setData({ productId: options.id });
    }

    // 支持从跳转参数动态设置导航栏标题：/pages/detail/detail?id=xx&title=xxx
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    if (initialTitle) {
      wx.setNavigationBarTitle({ title: initialTitle });
    }
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }
})