/**
 * 订单相关工具函数
 */

/**
 * 获取订单操作按钮
 * @param {string} status 订单状态
 * @returns {Array} 操作按钮列表
 */
export function getOrderActions(status) {
  switch (status) {
    case '0':
      return [
        { text: '取消订单', action: 'cancel', type: 'default' },
        { text: '去支付', action: 'pay', type: 'primary' }
      ];
    case '1':
      return [
        { text: '取消订单', action: 'cancel', type: 'primary' }
      ];
    case '2':
      return [
        { text: '确认收货', action: 'confirm', type: 'primary' }
      ];
    case '3':
      return [
        { text: '评价', action: 'review', type: 'primary' },
        { text: '删除订单', action: 'delete', type: 'default' },
        { text: '再次购买', action: 'buyAgain', type: 'default' }
      ];
    case '4':
      return [
        { text: '删除订单', action: 'delete', type: 'default' },
        { text: '再次购买', action: 'buyAgain', type: 'primary' }
      ];
    default:
      return [];
  }
}

/**
 * 获取订单状态图标
 * @param {string} status 订单状态
 * @returns {string} 状态图标
 */
export function getStatusIcon(status) {
  switch (status) {
    case '0': return '💳';
    case '1': return '📦';
    case '2': return '🚚';
    case '3': return '✅';
    case '4': return '❌';
    default: return '📋';
  }
}

/**
 * 获取订单状态描述
 * @param {string} status 订单状态
 * @returns {string} 状态描述
 */
export function getStatusDesc(status) {
  switch (status) {
    case '0': return '请在30分钟内完成支付';
    case '1': return '商家正在准备商品';
    case '2': return '商品正在配送中';
    case '3': return '订单已完成';
    case '4': return '订单已取消';
    default: return '订单处理中';
  }
}

/**
 * 获取订单状态文本
 * @param {number|string} status 订单状态
 * @returns {string} 状态文本
 */
export function getStatusText(status) {
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
 * @param {number|string} status 订单状态
 * @returns {string} 样式类名
 */
export function getStatusClass(status) {
  return `status-${status}`;
}

/**
 * 处理订单操作
 * @param {Object} options 操作选项
 * @param {string} options.action 操作类型
 * @param {string} options.orderId 订单ID
 * @param {Function} options.onCancel 取消订单回调
 * @param {Function} options.onPay 去支付回调
 * @param {Function} options.onConfirm 确认收货回调
 * @param {Function} options.onBuyAgain 再次购买回调
 * @param {Function} options.onReview 去评价回调
 * @param {Function} options.onDelete 删除订单回调
 */
export function handleOrderAction(options) {
  const { action, orderId, onCancel, onPay, onConfirm, onBuyAgain, onReview, onDelete } = options;
  
  switch (action) {
    case 'cancel':
      onCancel && onCancel(orderId);
      break;
    case 'pay':
      onPay && onPay(orderId);
      break;
    case 'confirm':
      onConfirm && onConfirm(orderId);
      break;
    case 'buyAgain':
      onBuyAgain && onBuyAgain(orderId);
      break;
    case 'review':
      onReview && onReview(orderId);
      break;
    case 'delete':
      onDelete && onDelete(orderId);
      break;
  }
}
