// pages/merchant/orders/orders.js
// 引入数据库连接模块
const db = require('../../../db.js');

Component({

  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的初始数据
   */
  data: {
    orders: []
  },

  /**
   * 组件的方法列表
   */
  /**
   * 组件的方法列表
   */
  methods: {
    // 获取订单数据
    async getOrders() {
      try {
        // 从数据库中查询订单数据
        const [orders] = await db.query('SELECT * FROM order WHERE merchant_id = ?', [this.data.merchantId]);
        // 更新组件数据
        this.setData({
          orders: orders
        });
      } catch (error) {
        console.error('获取订单数据失败:', error);
      }
    }
  }
})