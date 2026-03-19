// pages/address/edit-address/edit-address.js
import { createAddress, updateAddress, getAddresses } from '../../../utils/api';

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
    showRegionPicker: false,
    region: ['', '', ''],
    customItem: '全部',
    // 省市区数据
    provinces: [
      '北京市', '天津市', '河北省', '山西省', '内蒙古自治区',
      '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省',
      '浙江省', '安徽省', '福建省', '江西省', '山东省',
      '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区',
      '海南省', '重庆市', '四川省', '贵州省', '云南省',
      '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区',
      '新疆维吾尔自治区'
    ],
    cities: [],
    districts: [],
    // 城市数据映射
    cityMap: {
      '北京市': ['北京市'],
      '天津市': ['天津市'],
      '河北省': ['石家庄市', '唐山市', '秦皇岛市', '邯郸市', '邢台市', '保定市', '张家口市', '承德市', '沧州市', '廊坊市', '衡水市'],
      '山西省': ['太原市', '大同市', '阳泉市', '长治市', '晋城市', '朔州市', '晋中市', '运城市', '忻州市', '临汾市', '吕梁市'],
      '内蒙古自治区': ['呼和浩特市', '包头市', '乌海市', '赤峰市', '通辽市', '鄂尔多斯市', '呼伦贝尔市', '巴彦淖尔市', '乌兰察布市', '兴安盟', '锡林郭勒盟', '阿拉善盟'],
      '辽宁省': ['沈阳市', '大连市', '鞍山市', '抚顺市', '本溪市', '丹东市', '锦州市', '营口市', '阜新市', '辽阳市', '盘锦市', '铁岭市', '朝阳市', '葫芦岛市'],
      '吉林省': ['长春市', '吉林市', '四平市', '辽源市', '通化市', '白山市', '松原市', '白城市', '延边朝鲜族自治州'],
      '黑龙江省': ['哈尔滨市', '齐齐哈尔市', '鸡西市', '鹤岗市', '双鸭山市', '大庆市', '伊春市', '佳木斯市', '七台河市', '牡丹江市', '黑河市', '绥化市', '大兴安岭地区'],
      '上海市': ['上海市'],
      '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市', '泰州市', '宿迁市'],
      '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
      '安徽省': ['合肥市', '芜湖市', '蚌埠市', '淮南市', '马鞍山市', '淮北市', '铜陵市', '安庆市', '黄山市', '滁州市', '阜阳市', '宿州市', '巢湖市', '六安市', '亳州市', '池州市', '宣城市'],
      '福建省': ['福州市', '厦门市', '莆田市', '三明市', '泉州市', '漳州市', '南平市', '龙岩市', '宁德市'],
      '江西省': ['南昌市', '景德镇市', '萍乡市', '九江市', '新余市', '鹰潭市', '赣州市', '宜春市', '上饶市', '吉安市', '抚州市'],
      '山东省': ['济南市', '青岛市', '淄博市', '枣庄市', '东营市', '烟台市', '潍坊市', '济宁市', '泰安市', '威海市', '日照市', '莱芜市', '临沂市', '德州市', '聊城市', '滨州市', '菏泽市'],
      '河南省': ['郑州市', '开封市', '洛阳市', '平顶山市', '安阳市', '鹤壁市', '新乡市', '焦作市', '濮阳市', '许昌市', '漯河市', '三门峡市', '南阳市', '商丘市', '信阳市', '周口市', '驻马店市'],
      '湖北省': ['武汉市', '黄石市', '十堰市', '荆州市', '宜昌市', '襄樊市', '鄂州市', '荆门市', '孝感市', '黄冈市', '咸宁市', '随州市', '恩施土家族苗族自治州', '仙桃市', '潜江市', '天门市', '神农架林区'],
      '湖南省': ['长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市', '岳阳市', '常德市', '张家界市', '益阳市', '郴州市', '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州'],
      '广东省': ['广州市', '深圳市', '珠海市', '汕头市', '佛山市', '韶关市', '湛江市', '肇庆市', '江门市', '茂名市', '惠州市', '梅州市', '汕尾市', '河源市', '阳江市', '清远市', '东莞市', '中山市', '潮州市', '揭阳市', '云浮市'],
      '广西壮族自治区': ['南宁市', '柳州市', '桂林市', '梧州市', '北海市', '防城港市', '钦州市', '贵港市', '玉林市', '百色市', '贺州市', '河池市', '来宾市', '崇左市'],
      '海南省': ['海口市', '三亚市', '三沙市', '儋州市', '五指山市', '琼海市', '文昌市', '万宁市', '东方市', '定安县', '屯昌县', '澄迈县', '临高县', '白沙黎族自治县', '昌江黎族自治县', '乐东黎族自治县', '陵水黎族自治县', '保亭黎族苗族自治县', '琼中黎族苗族自治县'],
      '重庆市': ['重庆市'],
      '四川省': ['成都市', '自贡市', '攀枝花市', '泸州市', '德阳市', '绵阳市', '广元市', '遂宁市', '内江市', '乐山市', '南充市', '眉山市', '宜宾市', '广安市', '达州市', '雅安市', '巴中市', '资阳市', '阿坝藏族羌族自治州', '甘孜藏族自治州', '凉山彝族自治州'],
      '贵州省': ['贵阳市', '六盘水市', '遵义市', '安顺市', '铜仁市', '毕节市', '黔西南布依族苗族自治州', '黔东南苗族侗族自治州', '黔南布依族苗族自治州'],
      '云南省': ['昆明市', '曲靖市', '玉溪市', '保山市', '昭通市', '丽江市', '普洱市', '临沧市', '楚雄彝族自治州', '红河哈尼族彝族自治州', '文山壮族苗族自治州', '西双版纳傣族自治州', '大理白族自治州', '德宏傣族景颇族自治州', '怒江傈僳族自治州', '迪庆藏族自治州'],
      '西藏自治区': ['拉萨市', '日喀则市', '昌都市', '林芝市', '山南市', '那曲市', '阿里地区'],
      '陕西省': ['西安市', '铜川市', '宝鸡市', '咸阳市', '渭南市', '延安市', '汉中市', '榆林市', '安康市', '商洛市'],
      '甘肃省': ['兰州市', '嘉峪关市', '金昌市', '白银市', '天水市', '武威市', '张掖市', '平凉市', '酒泉市', '庆阳市', '定西市', '陇南市', '临夏回族自治州', '甘南藏族自治州'],
      '青海省': ['西宁市', '海东市', '海北藏族自治州', '黄南藏族自治州', '海南藏族自治州', '果洛藏族自治州', '玉树藏族自治州', '海西蒙古族藏族自治州'],
      '宁夏回族自治区': ['银川市', '石嘴山市', '吴忠市', '固原市', '中卫市'],
      '新疆维吾尔自治区': ['乌鲁木齐市', '克拉玛依市', '吐鲁番市', '哈密市', '昌吉回族自治州', '博尔塔拉蒙古自治州', '巴音郭楞蒙古自治州', '阿克苏地区', '克孜勒苏柯尔克孜自治州', '喀什地区', '和田地区', '伊犁哈萨克自治州', '塔城地区', '阿勒泰地区', '石河子市', '阿拉尔市', '图木舒克市', '五家渠市', '北屯市', '铁门关市', '双河市', '可克达拉市', '昆玉市']
    },
    // 区县数据映射
    districtMap: {
      '北京市': ['东城区', '西城区', '朝阳区', '丰台区', '石景山区', '海淀区', '门头沟区', '房山区', '通州区', '顺义区', '昌平区', '大兴区', '怀柔区', '平谷区', '密云区', '延庆区'],
      '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区'],
      '广州市': ['越秀区', '海珠区', '荔湾区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区'],
      '深圳市': ['罗湖区', '福田区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区', '大鹏新区'],
      '杭州市': ['上城区', '下城区', '江干区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市'],
      '南京市': ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区'],
      '成都市': ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '金堂县', '大邑县', '蒲江县', '新津县', '都江堰市', '彭州市', '邛崃市', '崇州市'],
      '武汉市': ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区'],
      '重庆市': ['万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区', '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区', '梁平区', '武隆区'],
      '沈阳市': ['和平区', '沈河区', '大东区', '皇姑区', '铁西区', '苏家屯区', '浑南区', '沈北新区', '于洪区', '辽中区', '康平县', '法库县', '新民市'],
      '长春市': ['南关区', '宽城区', '朝阳区', '二道区', '绿园区', '双阳区', '九台区', '农安县', '榆树市', '德惠市'],
      '哈尔滨市': ['道里区', '南岗区', '道外区', '平房区', '松北区', '香坊区', '呼兰区', '阿城区', '双城区', '依兰县', '方正县', '宾县', '巴彦县', '木兰县', '通河县', '延寿县', '尚志市', '五常市']
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const { id } = options;
    if (id) {
      this.setData({ addressId: id });
      this.loadAddress(id);
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
   * 加载地址详情
   */
  loadAddress(id) {
    this.setData({ loading: true });
    getAddresses()
      .then(res => {
        const address = res.data.find(item => item.id == id);
        if (address) {
          this.setData({ 
            formData: address,
            region: [address.province, address.city, address.district]
          });
          // 更新城市和区县列表
          this.updateCities(address.province);
          this.updateDistricts(address.city);
        }
      })
      .catch(err => {
        console.error('获取地址详情失败:', err);
        wx.showToast({ title: '获取地址信息失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  /**
   * 表单输入事件
   */
  handleInput(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    // 验证收货人姓名
    if (field === 'receiver_name' && value.length > 20) {
      wx.showToast({ title: '收货人姓名不能超过20个字符', icon: 'none' });
      return;
    }
    
    // 验证手机号
    if (field === 'phone') {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (value && !phoneRegex.test(value)) {
        wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return;
      }
    }
    
    // 验证详细地址
    if (field === 'detail' && value.length > 100) {
      wx.showToast({ title: '详细地址不能超过100个字符', icon: 'none' });
      return;
    }
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  /**
   * 打开地区选择器
   */
  openRegionPicker() {
    console.log('打开地区选择器');
    // 设置初始城市列表（默认为北京市）
    if (this.data.cities.length === 0) {
      this.updateCities('北京市');
      this.updateDistricts('北京市');
    }
    this.setData({ showRegionPicker: true });
  },

  /**
   * 地区选择变化
   */
  bindRegionChange(e) {
    console.log('地区选择变化:', e);
    const { value } = e.detail;
    const [provinceIndex, cityIndex, districtIndex] = value;
    
    const province = this.data.provinces[provinceIndex];
    
    // 更新城市列表
    this.updateCities(province);
    
    // 获取更新后的城市列表
    const cities = this.data.cities;
    const city = cities[cityIndex] || cities[0];
    
    // 更新区县列表
    this.updateDistricts(city);
    
    // 获取更新后的区县列表
    const districts = this.data.districts;
    const district = districts[districtIndex] || districts[0] || '';
    
    console.log('选择的地址:', { province, city, district });
    
    this.setData({
      region: [provinceIndex, cityIndex < cities.length ? cityIndex : 0, districtIndex < districts.length ? districtIndex : 0],
      'formData.province': province,
      'formData.city': city,
      'formData.district': district
    });
  },

  /**
   * 更新城市列表
   */
  updateCities(province) {
    const cities = this.data.cityMap[province] || [];
    this.setData({ cities });
  },

  /**
   * 更新区县列表
   */
  updateDistricts(city) {
    try {
      let districts = this.data.districtMap[city] || [];
      
      // 如果没有对应的区县数据，提供默认区县列表
      if (districts.length === 0) {
        districts = ['区/县'];
        console.log('城市没有对应的区县数据，使用默认区县列表:', city);
      }
      
      this.setData({ districts });
      console.log('更新区县列表:', districts);
    } catch (error) {
      console.error('更新区县列表失败:', error);
      // 发生错误时使用默认区县列表
      this.setData({ districts: ['区/县'] });
      wx.showToast({ title: '区县数据加载失败，使用默认值', icon: 'none', duration: 2000 });
    }
  },

  /**
   * 关闭地区选择器
   */
  closeRegionPicker() {
    this.setData({ showRegionPicker: false });
  },

  /**
   * 切换默认地址
   */
  toggleDefault() {
    this.setData({
      'formData.is_default': this.data.formData.is_default === 1 ? 0 : 1
    });
  },

  /**
   * 提交表单
   */
  submitForm() {
    const { addressId, formData } = this.data;
    
    console.log('提交地址表单:', { addressId, formData });
    
    // 表单验证
    if (!formData.receiver_name) {
      console.warn('表单验证失败: 未输入收货人姓名');
      wx.showToast({ title: '请输入收货人姓名', icon: 'none' });
      return;
    }
    
    if (formData.receiver_name.length < 2 || formData.receiver_name.length > 20) {
      console.warn('表单验证失败: 收货人姓名长度不符合要求');
      wx.showToast({ title: '收货人姓名长度应为2-20个字符', icon: 'none' });
      return;
    }
    
    if (!formData.phone) {
      console.warn('表单验证失败: 未输入联系电话');
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return;
    }
    
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      console.warn('表单验证失败: 手机号格式不正确');
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    
    if (!formData.province || !formData.city) {
      console.warn('表单验证失败: 未选择完整的地址');
      wx.showToast({ title: '请选择完整的地址', icon: 'none' });
      return;
    }
    
    if (!formData.detail) {
      console.warn('表单验证失败: 未输入详细地址');
      wx.showToast({ title: '请输入详细地址', icon: 'none' });
      return;
    }
    
    if (formData.detail.length > 100) {
      console.warn('表单验证失败: 详细地址长度超过限制');
      wx.showToast({ title: '详细地址不能超过100个字符', icon: 'none' });
      return;
    }
    
    this.setData({ loading: true });
    
    const promise = addressId 
      ? updateAddress(addressId, formData) 
      : createAddress(formData);
    
    promise
      .then(res => {
        console.log('保存地址成功:', res);
        // 检查响应是否成功
        if (res && res.success) {
          wx.showToast({ 
            title: addressId ? '更新成功' : '添加成功', 
            icon: 'success',
            duration: 1500
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          console.error('保存地址失败: 响应格式错误', res);
          wx.showToast({ title: '保存失败，请重试', icon: 'none', duration: 3000 });
        }
      })
      .catch(err => {
        console.error('保存地址失败:', err);
        // 安全地访问错误属性
        const statusCode = err.statusCode || 'N/A';
        const errorMessage = err.message || err.errMsg || '未知错误';
        console.error('错误状态码:', statusCode);
        console.error('错误信息:', errorMessage);
        
        let displayMessage = '保存失败，请重试';
        if (statusCode === 401) {
          displayMessage = '未登录，请重新登录';
        } else if (statusCode === 400) {
          displayMessage = '参数错误，请检查输入';
        } else if (statusCode === 500) {
          displayMessage = '服务器错误，请稍后重试';
        }
        
        wx.showToast({ title: displayMessage, icon: 'none', duration: 3000 });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  }
})