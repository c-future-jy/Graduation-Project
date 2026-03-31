/**
 * 小程序入口文件
 */

import { getUserProfile } from './utils/api';
import { setCurrentUser, getToken } from './utils/auth';

const NAV_TITLE_STORAGE_KEY = '__nextNavTitle';

const TAB_ROUTES = new Set([
  'pages/index/index',
  'pages/cate/cate',
  'pages/cart/cart',
  'pages/profile/profile'
]);

const ROUTE_TITLE_MAP = {
  'pages/index/index': '首页',
  'pages/cate/cate': '分类',
  'pages/cart/cart': '购物车',
  'pages/profile/profile': '我的',
  'pages/profile/edit-profile': '编辑资料',
  'pages/profile/password-edit': '修改密码',
  'pages/detail/detail': '商品详情',
  'pages/login/login': '登录',
  'pages/login/register': '注册',
  'pages/address/address': '地址管理',
  'pages/address/edit-address/edit-address': '编辑地址',
  'pages/order/order': '我的订单',
  'pages/order-detail/order-detail': '订单详情',
  'pages/order-confirm/order-confirm': '确认订单',
  'pages/feedback/feedback': '意见反馈',
  'pages/notice/notice': '消息通知',
  'pages/merchant/merchant': '商家详情',
  'pages/merchant/dashboard/dashboard': '商家仪表盘',
  'pages/merchant/index/index': '商家中心',
  'pages/merchant/orders/orders': '订单管理',
  'pages/merchant/products/products': '商品管理',
  'pages/merchant/profile/profile': '商家资料',
  'pages/search/search': '搜索',
  'pages/admin/index': '管理后台',
  'pages/admin/dashboard/dashboard': '数据统计',
  'pages/admin/users/users': '用户管理',
  'pages/admin/merchants/merchants': '商家管理',
  'pages/admin/products/products': '商品管理',
  'pages/admin/orders/orders': '订单管理',
  'pages/admin/feedbacks/feedbacks': '反馈管理',
  'pages/admin/feedbacks/detail': '反馈详情',
  'pages/admin/notifications/notifications': '通知管理'
};

function safeDecodeURIComponent(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

function normalizeRouteFromUrl(url) {
  if (!url) return '';
  const pathOnly = String(url).split('?')[0];
  return pathOnly.replace(/^\//, '');
}

function parseQueryFromUrl(url) {
  const parts = String(url || '').split('?');
  const queryString = parts[1] || '';
  const query = {};
  queryString.split('&').forEach(pair => {
    if (!pair) return;
    const idx = pair.indexOf('=');
    if (idx === -1) {
      query[pair] = '';
      return;
    }
    const key = pair.slice(0, idx);
    const val = pair.slice(idx + 1);
    query[key] = val;
  });
  return query;
}

function hasTitleParam(url) {
  return /(?:^|[?&])title=/.test(String(url || ''));
}

function withTitleParam(url, title) {
  if (!title) return url;
  if (hasTitleParam(url)) return url;
  const separator = String(url).includes('?') ? '&' : '?';
  return String(url) + separator + 'title=' + encodeURIComponent(title);
}

function deriveDefaultTitleByRoute(route) {
  if (!route) return '';
  const normalized = String(route).replace(/^\//, '');
  if (ROUTE_TITLE_MAP[normalized]) return ROUTE_TITLE_MAP[normalized];

  // 兜底：用最后一段做简单映射
  const last = normalized.split('/').pop();
  const fallbackMap = {
    index: '首页',
    cate: '分类',
    cart: '购物车',
    profile: '我的',
    login: '登录',
    register: '注册',
    search: '搜索',
    merchant: '商家详情',
    detail: '详情',
    order: '订单',
    'order-detail': '订单详情',
    notice: '通知',
    feedback: '反馈',
    address: '地址管理',
    'edit-address': '编辑地址',
    dashboard: '仪表盘',
    users: '用户管理',
    merchants: '商家管理',
    products: '商品管理',
    orders: '订单管理',
    feedbacks: '反馈管理',
    notifications: '通知管理'
  };
  return fallbackMap[last] || '';
}

function installNavigationTitleEnhancement() {
  try {
    // 1) 全局 Page() 包装：所有页面自动读取 title 并设置导航栏
    const rawPage = Page;
    Page = function (pageConfig) {
      const originalOnLoad = pageConfig && pageConfig.onLoad;
      const originalOnShow = pageConfig && pageConfig.onShow;

      pageConfig.onLoad = function (options) {
        try {
          const pages = getCurrentPages();
          const currentRoute = pages && pages.length ? pages[pages.length - 1].route : '';
          const titleFromOptions = safeDecodeURIComponent(options && options.title);
          const fallbackTitle = deriveDefaultTitleByRoute(currentRoute);
          const title = titleFromOptions || fallbackTitle;
          if (title) {
            wx.setNavigationBarTitle({ title });
          }
        } catch (e) {
          // ignore
        }

        if (typeof originalOnLoad === 'function') {
          return originalOnLoad.call(this, options);
        }
      };

      pageConfig.onShow = function () {
        try {
          const pages = getCurrentPages();
          const currentRoute = pages && pages.length ? pages[pages.length - 1].route : '';
          const pending = wx.getStorageSync(NAV_TITLE_STORAGE_KEY);
          if (pending && pending.route === currentRoute && pending.title) {
            wx.setNavigationBarTitle({ title: pending.title });
            wx.removeStorageSync(NAV_TITLE_STORAGE_KEY);
          } else if (TAB_ROUTES.has(currentRoute)) {
            const fallbackTitle = deriveDefaultTitleByRoute(currentRoute);
            if (fallbackTitle) {
              wx.setNavigationBarTitle({ title: fallbackTitle });
            }
          }
        } catch (e) {
          // ignore
        }

        if (typeof originalOnShow === 'function') {
          return originalOnShow.call(this);
        }
      };

      return rawPage(pageConfig);
    };

    // 2) 全局 wx.* 跳转包装：没带 title 就按路由自动补
    const rawNavigateTo = wx.navigateTo;
    const rawRedirectTo = wx.redirectTo;
    const rawReLaunch = wx.reLaunch;
    const rawSwitchTab = wx.switchTab;

    wx.navigateTo = function (opts) {
      if (!opts || !opts.url) return rawNavigateTo(opts);
      const route = normalizeRouteFromUrl(opts.url);
      const title = deriveDefaultTitleByRoute(route);
      const url = withTitleParam(opts.url, title);
      return rawNavigateTo({ ...opts, url });
    };

    wx.redirectTo = function (opts) {
      if (!opts || !opts.url) return rawRedirectTo(opts);
      const route = normalizeRouteFromUrl(opts.url);
      const title = deriveDefaultTitleByRoute(route);
      const url = withTitleParam(opts.url, title);
      return rawRedirectTo({ ...opts, url });
    };

    wx.reLaunch = function (opts) {
      if (!opts || !opts.url) return rawReLaunch(opts);
      const route = normalizeRouteFromUrl(opts.url);
      const title = deriveDefaultTitleByRoute(route);
      const url = withTitleParam(opts.url, title);
      return rawReLaunch({ ...opts, url });
    };

    wx.switchTab = function (opts) {
      if (!opts || !opts.url) return rawSwitchTab(opts);

      const route = normalizeRouteFromUrl(opts.url);
      const query = parseQueryFromUrl(opts.url);
      const titleFromUrl = safeDecodeURIComponent(query.title);
      const title = titleFromUrl || deriveDefaultTitleByRoute(route);

      if (title) {
        // switchTab 不支持 query，这里用缓存把标题带过去
        wx.setStorageSync(NAV_TITLE_STORAGE_KEY, {
          route,
          title
        });
      }

      return rawSwitchTab({ ...opts, url: '/' + route });
    };
  } catch (e) {
    // ignore
  }
}

installNavigationTitleEnhancement();

App({
  globalData: {
    userInfo: null,
    token: null,
    baseUrl: 'http://192.168.3.194:3000/api'
  },

  onLaunch() {
    console.log('小程序启动');
    this.initBaseUrl();
    // 检查登录状态
    this.checkLoginStatus();
  },

  /**
   * 初始化 API BaseUrl
   * - 开发者工具：默认 http://localhost:3000/api
   * - 真机：优先使用 wx.setStorageSync('baseUrl', 'http://<电脑IP>:3000/api') 设置的值
   */
  initBaseUrl() {
    try {
      const sys = wx.getSystemInfoSync();
      const isDevtools = sys && sys.platform === 'devtools';
      const stored = String(wx.getStorageSync('baseUrl') || '').trim();

      // 优先使用用户显式配置（真机/开发者工具都允许）
      if (stored) {
        this.globalData.baseUrl = stored;
        return;
      }

      // 开发者工具默认走本机
      if (isDevtools) {
        this.globalData.baseUrl = 'http://192.168.3.194:3000/api';
        return;
      }

      // 真机未配置时：不要继续使用 localhost（手机的 localhost 不是电脑）
      // 这里给一个可改的兜底值；更推荐你用 wx.setStorageSync('baseUrl', 'http://<电脑局域网IP>:3000/api') 覆盖。
      console.warn('[baseUrl] 真机未配置 baseUrl，将使用兜底值；请在真机执行 wx.setStorageSync(\'baseUrl\', \'http://<电脑局域网IP>:3000/api\')');
      this.globalData.baseUrl = 'http://192.168.3.194:3000/api';
    } catch (e) {
      this.globalData.baseUrl = this.globalData.baseUrl || 'http://localhost:3000/api';
    }
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    const token = getToken();
    
    if (token) {
      try {
        // 验证 token 是否有效
        const res = await getUserProfile();
        this.globalData.userInfo = res.data.user;
        setCurrentUser(res.data.user);
        console.log('用户已登录:', res.data.user);
      } catch (error) {
        // token 失效，清除本地数据
        console.log('Token 已失效，请重新登录');
        wx.removeStorageSync('token');
        wx.removeStorageSync('userInfo');
      }
    } else {
      console.log('用户未登录');
    }
  },

  /**
   * 获取全局用户信息
   */
  getUserInfo() {
    return this.globalData.userInfo;
  },

  /**
   * 设置全局用户信息
   */
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
    setCurrentUser(userInfo);
  }
});