/**
 * 通用工具函数
 */

/**
 * 格式化时间
 * @param {Date} date 日期对象
 * @returns {String} 格式化后的时间字符串
 */
export function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`;
}

/**
 * 格式化数字（补零）
 * @param {Number} n 
 * @returns {String}
 */
export function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : `0${n}`;
}

/**
 * 格式化价格
 * @param {Number} price 
 * @returns {String}
 */
export function formatPrice(price) {
  return parseFloat(price).toFixed(2);
}

/**
 * 计算订单总金额
 * @param {Array} items 商品列表
 * @returns {Number}
 */
export function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * 获取订单状态文本
 * @param {Number} status 订单状态
 * @returns {String}
 */
export function getOrderStatusText(status) {
  const statusMap = {
    0: '待支付',
    1: '待发货',
    2: '待收货',
    3: '已完成',
    4: '已取消'
  };
  return statusMap[status] || '未知状态';
}

/**
 * 获取订单状态样式类
 * @param {Number} status 订单状态
 * @returns {String}
 */
export function getOrderStatusClass(status) {
  const classMap = {
    0: 'status-pending',
    1: 'status-processing',
    2: 'status-shipping',
    3: 'status-completed',
    4: 'status-cancelled'
  };
  return classMap[status] || '';
}

/**
 * 防抖函数
 * @param {Function} fn 
 * @param {Number} delay 
 * @returns {Function}
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} fn 
 * @param {Number} interval 
 * @returns {Function}
 */
export function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}