function getBaseUrl() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const url = app && app.globalData && app.globalData.baseUrl;
    if (url) return String(url).trim();

    const stored = String(wx.getStorageSync('baseUrl') || '').trim();
    return stored || 'http://localhost:3000/api';
  } catch (_) {
    try {
      const stored = String(wx.getStorageSync('baseUrl') || '').trim();
      return stored || 'http://localhost:3000/api';
    } catch (__) {
      return 'http://localhost:3000/api';
    }
  }
}

function getOrigin() {
  const baseUrl = getBaseUrl();
  return String(baseUrl || '').replace(/\/api\/?$/, '');
}

function normalizeOrigin(origin) {
  const v = String(origin || '').trim();
  if (!v) return '';
  return v.replace(/\/$/, '');
}

/**
 * 上传/静态资源的 origin（可与 API baseUrl 不同）
 * - 优先读全局 app.globalData.uploadsOrigin
 * - 其次读本地缓存 wx.getStorageSync('uploadsOrigin')
 * - 最后回退到 API origin
 */
function getUploadsOrigin() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const fromGlobal = app && app.globalData && app.globalData.uploadsOrigin;
    if (fromGlobal) return normalizeOrigin(fromGlobal);

    const stored = String(wx.getStorageSync('uploadsOrigin') || '').trim();
    if (stored) return normalizeOrigin(stored);
  } catch (_) {
    // ignore
  }
  return normalizeOrigin(getOrigin());
}

/**
 * 把后端返回的相对静态资源路径（如 /uploads/files/xxx.jpg）转换成可访问的完整 URL。
 * 注意：只转换 /uploads/ 开头的路径，避免把小程序本地资源 /assets/... 误当成网络资源。
 */
function toNetworkUrl(maybeUrl) {
  const url = String(maybeUrl || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return 'https:' + url;

  if (url.startsWith('/uploads/')) {
    return getUploadsOrigin() + url;
  }

  return url;
}

module.exports = {
  getOrigin,
  getUploadsOrigin,
  toNetworkUrl
};
