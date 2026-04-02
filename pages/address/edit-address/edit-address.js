// pages/address/edit-address/edit-address.js
import { createAddress, updateAddress, getAddresses } from '../../../utils/api';

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

  /**
   * 页面的初始数据
   */
  data: {
    addressId: null,
    formData: {
      receiver_name: '',
      phone: '',
      province: '',
      city: '',
      district: '',
      detail: '',
      is_default: 0
    },
    loading: false,
    // 内置 region picker 使用 [省, 市, 区/县]
    region: ['', '', ''],
    customItem: '全部',
    // 历史自定义省市区数据已弃用，改为使用微信内置 region picker
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const initialTitle = this.safeDecodeURIComponent(options && options.title);
    const id = options && options.id;

    const fallbackTitle = id ? '编辑地址' : '新增地址';
    wx.setNavigationBarTitle({ title: initialTitle || fallbackTitle });

    if (id) {
      this.setData({ addressId: id });
      this.loadAddress(id);
    }
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
   * 加载地址详情
   */
  _normalizeAddress(raw) {
    const a = raw || {};
    const province = toStr(a.province, '');
    const city = toStr(a.city, '');
    const district = toStr(a.district, '');
    return {
      id: a.id,
      receiver_name: toStr(a.receiver_name, ''),
      phone: toStr(a.phone, ''),
      province,
      city,
      district,
      detail: toStr(a.detail, ''),
      is_default: toInt(a.is_default, 0) === 1 ? 1 : 0,
      region: [province, city, district]
    };
  },

  async loadAddress(id) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const res = await getAddresses();
      if (!res || res.success === false) {
        wx.showToast({ title: (res && res.message) || '获取地址信息失败', icon: 'none' });
        return;
      }
      const list = (res && res.data) || [];
      const address = list.find((item) => String(item.id) === String(id));
      if (!address) {
        wx.showToast({ title: '地址不存在或已删除', icon: 'none' });
        return;
      }

      const normalized = this._normalizeAddress(address);
      this.setData({
        formData: {
          receiver_name: normalized.receiver_name,
          phone: normalized.phone,
          province: normalized.province,
          city: normalized.city,
          district: normalized.district,
          detail: normalized.detail,
          is_default: normalized.is_default
        },
        region: normalized.region
      });
    } catch (err) {
      console.error('获取地址详情失败:', err);
      wx.showToast({ title: getErrMsg(err, '获取地址信息失败'), icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 表单输入事件
   */
  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    const rawValue = e && e.detail ? e.detail.value : '';
    let value = toStr(rawValue, '');

    if (field === 'receiver_name') {
      if (value.length > 20) value = value.slice(0, 20);
    }

    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 11);
    }

    if (field === 'detail') {
      if (value.length > 100) value = value.slice(0, 100);
    }

    this.setData({ [`formData.${field}`]: value });
  },

  /**
   * 微信内置地区选择器 change
   * e.detail.value => [province, city, county]
   */
  onSystemRegionChange(e) {
    const region = (e && e.detail && e.detail.value) || [];
    const province = region[0] || '';
    const city = region[1] || '';
    const district = region[2] || '';

    this.setData({
      region: [province, city, district],
      'formData.province': province,
      'formData.city': city,
      'formData.district': district
    });
  },

  /**
   * 切换默认地址
   */
  toggleDefault(e) {
    const values = (e && e.detail && e.detail.value) || [];
    const checked = Array.isArray(values) && values.includes('is_default');
    this.setData({ 'formData.is_default': checked ? 1 : 0 });
  },

  _getFormError() {
    const formData = this.data.formData || {};
    const receiverName = toStr(formData.receiver_name, '').trim();
    const phone = toStr(formData.phone, '').trim();
    const province = toStr(formData.province, '').trim();
    const city = toStr(formData.city, '').trim();
    const district = toStr(formData.district, '').trim();
    const detail = toStr(formData.detail, '').trim();

    if (!receiverName) return '请输入收货人姓名';
    if (receiverName.length < 2 || receiverName.length > 20) return '收货人姓名长度应为2-20个字符';
    if (!phone) return '请输入联系电话';

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) return '请输入正确的手机号';

    if (!province || !city || !district) return '请选择完整的地址';
    if (!detail) return '请输入详细地址';
    if (detail.length > 100) return '详细地址不能超过100个字符';

    return '';
  },

  /**
   * 提交表单
   */
  async submitForm() {
    if (this.data.loading) return;

    const errMsg = this._getFormError();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }

    const { addressId } = this.data;
    const formData = this.data.formData || {};
    const payload = {
      receiver_name: toStr(formData.receiver_name, '').trim(),
      phone: toStr(formData.phone, '').trim(),
      province: toStr(formData.province, '').trim(),
      city: toStr(formData.city, '').trim(),
      district: toStr(formData.district, '').trim(),
      detail: toStr(formData.detail, '').trim(),
      is_default: toInt(formData.is_default, 0) === 1 ? 1 : 0
    };

    this.setData({ loading: true });
    try {
      const res = addressId
        ? await updateAddress(addressId, payload)
        : await createAddress(payload);

      if (res && res.success) {
        wx.showToast({
          title: addressId ? '更新成功' : '添加成功',
          icon: 'success',
          duration: 1500
        });
        setTimeout(() => wx.navigateBack(), 1500);
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败，请重试', icon: 'none', duration: 3000 });
      }
    } catch (err) {
      console.error('保存地址失败:', err);
      const statusCode = err && (err.statusCode || err.status);
      let displayMessage = getErrMsg(err, '保存失败，请重试');
      if (statusCode === 401) displayMessage = '未登录，请重新登录';
      else if (statusCode === 400) displayMessage = '参数错误，请检查输入';
      else if (statusCode === 500) displayMessage = '服务器错误，请稍后重试';

      wx.showToast({ title: displayMessage, icon: 'none', duration: 3000 });
    } finally {
      this.setData({ loading: false });
    }
  }
})