// pages/address/address.js
const { getAddresses, createAddress, updateAddress, deleteAddress, setDefaultAddress } = require('../../utils/api');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    addresses: [],
    loading: false,
    selectMode: false // 是否为选择地址模式
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const selectMode = !!(options && options.selectMode);
    if (selectMode) {
      this.setData({ selectMode: true });
    }

    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    const fallbackTitle = selectMode ? '选择收货地址' : '地址管理';
    wx.setNavigationBarTitle({ title: initialTitle || fallbackTitle });
  },

  safeDecodeURIComponent(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadAddresses();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.loadAddresses(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载地址列表
   */
  loadAddresses(callback) {
    this.setData({ loading: true });
    getAddresses()
      .then(res => {
        // 对地址进行排序：默认地址在前，然后按创建时间倒序
        const sortedAddresses = (res.data || []).sort((a, b) => {
          if (a.is_default === 1 && b.is_default === 0) return -1;
          if (a.is_default === 0 && b.is_default === 1) return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        // 对手机号进行脱敏处理
        const addressesWithMaskedPhone = sortedAddresses.map(address => {
          return {
            ...address,
            maskedPhone: address.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
          };
        });
        
        this.setData({ addresses: addressesWithMaskedPhone });
        if (callback) callback();
      })
      .catch(err => {
        console.error('获取地址列表失败:', err);
        if (callback) callback();
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  /**
   * 跳转到新增地址页面
   */
  navigateToAddAddress() {
    console.log('点击了添加地址按钮');
    wx.showLoading({ title: '加载中...' });
    wx.navigateTo({
      url: '/pages/address/edit-address/edit-address?title=' + encodeURIComponent('新增地址'),
      success: function(res) {
        console.log('跳转到编辑地址页面成功', res);
        wx.hideLoading();
      },
      fail: function(err) {
        console.error('跳转到编辑地址页面失败:', err);
        wx.hideLoading();
        
        // 分析错误原因并提供更清晰的错误信息
        let errorMessage = '跳转失败，请重试';
        if (err.errMsg && err.errMsg.includes('is not found')) {
          errorMessage = '编辑地址页面未注册，请检查app.json配置';
          console.error('错误原因：编辑地址页面未在app.json中注册');
          console.error('解决方案：在app.json的pages数组中添加 "pages/address/edit-address/edit-address"');
        } else if (err.errMsg && err.errMsg.includes('permission')) {
          errorMessage = '权限不足，无法跳转';
        } else if (err.errMsg && err.errMsg.includes('network')) {
          errorMessage = '网络错误，请检查网络连接';
        }
        
        wx.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
      }
    });
  },

  /**
   * 跳转到编辑地址页面
   */
  navigateToEditAddress(e) {
    const { id } = e.currentTarget.dataset;
    console.log('点击了编辑地址按钮，地址ID:', id);
    wx.showLoading({ title: '加载中...' });
    wx.navigateTo({
      url: `/pages/address/edit-address/edit-address?id=${id}&title=${encodeURIComponent('编辑地址')}`,
      success: function(res) {
        console.log('跳转到编辑地址页面成功', res);
        wx.hideLoading();
      },
      fail: function(err) {
        console.error('跳转到编辑地址页面失败:', err);
        wx.hideLoading();
        
        // 分析错误原因并提供更清晰的错误信息
        let errorMessage = '跳转失败，请重试';
        if (err.errMsg && err.errMsg.includes('is not found')) {
          errorMessage = '编辑地址页面未注册，请检查app.json配置';
          console.error('错误原因：编辑地址页面未在app.json中注册');
          console.error('解决方案：在app.json的pages数组中添加 "pages/address/edit-address/edit-address"');
        } else if (err.errMsg && err.errMsg.includes('permission')) {
          errorMessage = '权限不足，无法跳转';
        } else if (err.errMsg && err.errMsg.includes('network')) {
          errorMessage = '网络错误，请检查网络连接';
        }
        
        wx.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
      }
    });
  },

  /**
   * 删除地址
   */
  deleteAddress(e) {
    const { id } = e.currentTarget.dataset;
    const { addresses } = this.data;
    
    // 检查是否是最后一个地址
    if (addresses.length === 1) {
      wx.showToast({ title: '至少保留一个收货地址', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ loading: true });
          deleteAddress(id)
            .then(() => {
              wx.showToast({ 
                title: '删除成功', 
                icon: 'success',
                duration: 1500
              });
              // 3秒内可撤销
              this.showUndoToast(id);
              this.loadAddresses();
            })
            .catch(err => {
              console.error('删除地址失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            })
            .finally(() => {
              this.setData({ loading: false });
            });
        }
      }
    });
  },

  /**
   * 显示撤销删除提示
   */
  showUndoToast(addressId) {
    // 这里可以实现撤销功能，暂时只做提示
  },

  /**
   * 设置默认地址
   */
  setDefaultAddress(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({ loading: true });
    setDefaultAddress(id)
      .then(() => {
        wx.showToast({ 
          title: '设置成功', 
          icon: 'success',
          duration: 1500
        });
        this.loadAddresses();
      })
      .catch(err => {
        console.error('设置默认地址失败:', err);
        wx.showToast({ title: '设置失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  /**
   * 选择地址（选择模式下）
   */
  selectAddress(e) {
    if (!this.data.selectMode) return;
    
    const { address } = e.currentTarget.dataset;
    wx.setStorageSync('selectedAddress', address);
    wx.navigateBack();
  }
})