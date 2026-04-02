// pages/address/address.js
const { getAddresses, deleteAddress, setDefaultAddress } = require('../../utils/api');

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

function toTime(value) {
  const s = toStr(value, '');
  if (!s) return 0;
  const d = new Date(s.replace(/-/g, '/'));
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function maskPhone(phone) {
  const s = toStr(phone, '');
  if (!s) return '';
  return s.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

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
    const rawSelectMode = options && options.selectMode;
    const selectMode = String(rawSelectMode) === '1' || String(rawSelectMode).toLowerCase() === 'true';
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
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.loadAddresses();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  async onPullDownRefresh() {
    try {
      await this.loadAddresses();
    } finally {
      wx.stopPullDownRefresh();
    }
  },

  /**
   * 加载地址列表
   */
  async loadAddresses() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await getAddresses();
      if (!res || res.success === false) {
        wx.showToast({ title: (res && res.message) || '获取地址列表失败', icon: 'none' });
        this.setData({ addresses: [] });
        return;
      }

      const list = (res && res.data) || [];
      const normalized = list.map((a) => ({
        ...a,
        is_default: toInt(a.is_default, 0) === 1 ? 1 : 0,
        maskedPhone: maskPhone(a.phone)
      }));

      // 默认地址在前，其次按创建时间倒序
      normalized.sort((a, b) => {
        if (a.is_default === 1 && b.is_default === 0) return -1;
        if (a.is_default === 0 && b.is_default === 1) return 1;
        return toTime(b.created_at) - toTime(a.created_at);
      });

      this.setData({ addresses: normalized });
    } catch (err) {
      console.error('获取地址列表失败:', err);
      wx.showToast({ title: getErrMsg(err, '获取地址列表失败'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 跳转到新增地址页面
   */
  navigateToAddAddress() {
    wx.navigateTo({
      url: '/pages/address/edit-address/edit-address?title=' + encodeURIComponent('新增地址'),
      fail: (err) => {
        console.error('跳转到编辑地址页面失败:', err);
        wx.showToast({ title: getErrMsg(err, '跳转失败，请重试'), icon: 'none', duration: 3000 });
      }
    });
  },

  /**
   * 跳转到编辑地址页面
   */
  navigateToEditAddress(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/address/edit-address/edit-address?id=${id}&title=${encodeURIComponent('编辑地址')}`,
      fail: (err) => {
        console.error('跳转到编辑地址页面失败:', err);
        wx.showToast({ title: getErrMsg(err, '跳转失败，请重试'), icon: 'none', duration: 3000 });
      }
    });
  },

  /**
   * 删除地址
   */
  async deleteAddress(e) {
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
      success: async (res) => {
        if (!res.confirm) return;
        if (this.data.loading) return;

        this.setData({ loading: true });
        try {
          const resp = await deleteAddress(id);
          if (resp && resp.success === false) {
            wx.showToast({ title: (resp && resp.message) || '删除失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: '删除成功', icon: 'success', duration: 1500 });
          await this.loadAddresses();
        } catch (err) {
          console.error('删除地址失败:', err);
          wx.showToast({ title: getErrMsg(err, '删除失败'), icon: 'none' });
        } finally {
          this.setData({ loading: false });
        }
      }
    });
  },

  /**
   * 设置默认地址
   */
  async setDefaultAddress(e) {
    const { id } = e.currentTarget.dataset;
    if (this.data.loading) return;

    this.setData({ loading: true });
    try {
      const res = await setDefaultAddress(id);
      if (res && res.success === false) {
        wx.showToast({ title: (res && res.message) || '设置失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '设置成功', icon: 'success', duration: 1500 });
      await this.loadAddresses();
    } catch (err) {
      console.error('设置默认地址失败:', err);
      wx.showToast({ title: getErrMsg(err, '设置失败'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
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