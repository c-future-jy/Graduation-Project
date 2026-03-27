/**
 * 页面相关工具函数
 */

/**
 * 页面加载状态管理
 * @param {Object} page 页面实例
 * @param {boolean} loading 是否加载中
 */
export function setLoading(page, loading) {
  page.setData({ loading });
}

/**
 * 分页参数初始化
 * @returns {Object} 分页参数
 */
export function initPagination() {
  return {
    page: 1,
    pageSize: 10,
    hasMore: true
  };
}

/**
 * 重置分页参数
 * @param {Object} page 页面实例
 */
export function resetPagination(page) {
  page.setData({
    page: 1,
    hasMore: true
  });
}

/**
 * 处理分页加载
 * @param {Object} page 页面实例
 * @param {Array} newData 新数据
 * @param {boolean} isLoadMore 是否加载更多
 * @param {string} dataKey 数据键名
 * @param {number} pageSize 每页数量
 */
export function handlePagination(page, newData, isLoadMore, dataKey = 'data', pageSize = 10) {
  const currentData = page.data[dataKey] || [];
  const mergedData = isLoadMore ? [...currentData, ...newData] : newData;
  
  page.setData({
    [dataKey]: mergedData,
    hasMore: newData.length === pageSize,
    loading: false
  });
}

/**
 * 防抖函数
 * @param {Function} fn 要执行的函数
 * @param {number} delay 延迟时间（毫秒）
 * @returns {Function} 防抖处理后的函数
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
 * 处理下拉刷新
 * @param {Object} page 页面实例
 * @param {Function} refreshFn 刷新函数
 */
export async function handlePullDownRefresh(page, refreshFn) {
  resetPagination(page);
  await refreshFn();
  wx.stopPullDownRefresh();
}

/**
 * 处理上拉加载
 * @param {Object} page 页面实例
 * @param {Function} loadMoreFn 加载更多函数
 */
export function handleReachBottom(page, loadMoreFn) {
  if (page.data.loading || !page.data.hasMore) return;
  page.setData({ page: page.data.page + 1 });
  loadMoreFn();
}

/**
 * 显示加载提示
 * @param {string} title 提示文本
 */
export function showLoading(title = '加载中...') {
  wx.showLoading({ title });
}

/**
 * 隐藏加载提示
 */
export function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示成功提示
 * @param {string} title 提示文本
 * @param {number} duration 持续时间
 */
export function showSuccess(title, duration = 2000) {
  wx.showToast({ title, icon: 'success', duration });
}

/**
 * 显示错误提示
 * @param {string} title 提示文本
 * @param {number} duration 持续时间
 */
export function showError(title, duration = 2000) {
  wx.showToast({ title, icon: 'none', duration });
}
