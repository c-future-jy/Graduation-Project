# 项目结构说明

本文目标：让目录更清晰，并解释主要文件/目录的作用。页面文件数量较多，因此对 pages/ 采用“按页面目录解释 + 四件套文件说明”的方式。

## 顶层（微信小程序前端）

- [.eslintrc.js](../.eslintrc.js)
  - ESLint 规则配置（用于代码规范检查）。
- [app.js](../app.js)
  - 小程序入口；负责 App 初始化、全局状态与启动时登录态校验。
- [app.json](../app.json)
  - 小程序全局配置：页面注册、窗口样式、tabBar、权限等。
- [app.wxss](../app.wxss)
  - 小程序全局样式。
- [project.config.json](../project.config.json)
  - 微信开发者工具项目配置（编译选项、Sass 插件等）。
- [project.private.config.json](../project.private.config.json)
  - 本机私有配置（通常与个人开发环境相关，不建议在多人协作时依赖其内容）。
- [sitemap.json](../sitemap.json)
  - 小程序 sitemap 配置（搜索收录相关）。

### 资源目录

- [assets/](../assets/)
  - 静态资源（图片、tabbar 图标等）。

### 前端业务目录

- [pages/](../pages/)
  - 小程序页面目录。每个页面通常包含“四件套”：
    - `xxx.js`：页面逻辑（数据、生命周期、事件处理）。
    - `xxx.wxml`：页面结构模板。
    - `xxx.(wxss|scss)`：页面样式。
    - `xxx.json`：页面配置（标题、下拉刷新、usingComponents 等）。

- [utils/](../utils/)
  - 前端通用工具与 API 封装。
  - [utils/api.js](../utils/api.js)：统一封装 `wx.request`，并提供各业务 API 方法。
  - [utils/auth.js](../utils/auth.js)：token / userInfo 的本地存储与登录态工具。
  - [utils/pageUtils.js](../utils/pageUtils.js)：页面通用交互工具（loading/toast/分页、防抖等）。
  - [utils/orderUtils.js](../utils/orderUtils.js)：订单状态/动作相关的展示与交互工具。

- [components/](../components/)
  - 自定义组件目录（目前为空，可用于后续沉淀可复用组件）。

- [config/](../config/)
  - 前端配置目录（目前为空；如后续要抽离 baseUrl、常量、枚举，可放在这里）。

### 前端页面一览（按目录）

- [pages/index/](../pages/index/)：首页（推荐商家、分类入口、搜索入口等）。
- [pages/search/](../pages/search/)：搜索页。
- [pages/cate/](../pages/cate/)：分类页（分类/商家/商品浏览）。
- [pages/cart/](../pages/cart/)：购物车页。
- [pages/order-confirm/](../pages/order-confirm/)：结算确认页（从购物车下单流程进入）。
- [pages/order/](../pages/order/)：订单列表页。
- [pages/order-detail/](../pages/order-detail/)：订单详情页。
- [pages/detail/](../pages/detail/)：商品/商家详情页（按你的实现为准）。
- [pages/address/](../pages/address/)：地址管理页。
- [pages/address/edit-address/](../pages/address/edit-address/)：编辑/新增地址。
- [pages/profile/](../pages/profile/)：个人中心。
- [pages/profile/edit-profile.js](../pages/profile/edit-profile.js)：编辑个人资料（页面路径为 `pages/profile/edit-profile`）。
- [pages/profile/password-edit.js](../pages/profile/password-edit.js)：修改密码（页面路径为 `pages/profile/password-edit`）。
- [pages/login/](../pages/login/)：登录。
- [pages/login/register.js](../pages/login/register.js)：注册（页面路径为 `pages/login/register`）。
- [pages/feedback/](../pages/feedback/)：反馈。
- [pages/notice/](../pages/notice/)：通知/公告。

#### 商家端页面

- [pages/merchant/merchant.js](../pages/merchant/merchant.js)（目录同名四件套）：商家端入口/概览页。
- [pages/merchant/dashboard/](../pages/merchant/dashboard/)：商家仪表盘。
- [pages/merchant/index/](../pages/merchant/index/)：商家端首页/列表。
- [pages/merchant/orders/](../pages/merchant/orders/)：商家订单管理。
- [pages/merchant/order-detail/](../pages/merchant/order-detail/)：商家订单详情。
- [pages/merchant/products/](../pages/merchant/products/)：商家商品管理。
- [pages/merchant/profile/](../pages/merchant/profile/)：商家资料/店铺信息。

#### 管理员端页面

- [pages/admin/index.js](../pages/admin/index.js)（目录同名四件套）：管理员入口页。
- [pages/admin/dashboard/](../pages/admin/dashboard/)：管理员仪表盘。
- [pages/admin/users/](../pages/admin/users/)：用户管理。
- [pages/admin/merchants/](../pages/admin/merchants/)：商家管理。
- [pages/admin/products/](../pages/admin/products/)：商品管理。
- [pages/admin/orders/](../pages/admin/orders/)：订单管理。
- [pages/admin/feedbacks/](../pages/admin/feedbacks/)：反馈管理（含列表与详情）。
- [pages/admin/notifications/](../pages/admin/notifications/)：通知管理。

## 后端（campus-service-backend/）

后端是一个 Express API 服务，默认监听端口在 [campus-service-backend/app.js](../campus-service-backend/app.js) 中通过 `PORT` 环境变量或 `3000`。

- [campus-service-backend/package.json](../campus-service-backend/package.json)
  - 后端依赖与脚本：`npm run dev`（nodemon）、`npm start`。
- [campus-service-backend/.env](../campus-service-backend/.env)
  - 后端运行环境变量（数据库连接、微信 appid/secret 等）。

### 后端入口与分层

- [campus-service-backend/app.js](../campus-service-backend/app.js)
  - Express 应用创建、通用中间件、路由注册、错误处理、启动服务器。

- [campus-service-backend/routes/](../campus-service-backend/routes/)
  - 路由层：定义 URL 与 controller 的映射。
  - [campus-service-backend/routes/index.js](../campus-service-backend/routes/index.js)：聚合各业务路由并挂载到 `/api`。

  路由文件一览（按业务）：
  - [campus-service-backend/routes/user.js](../campus-service-backend/routes/user.js)：用户注册/登录/个人信息等。
  - [campus-service-backend/routes/address.js](../campus-service-backend/routes/address.js)：收货地址相关接口。
  - [campus-service-backend/routes/cart.js](../campus-service-backend/routes/cart.js)：购物车相关接口。
  - [campus-service-backend/routes/order.js](../campus-service-backend/routes/order.js)：订单相关接口。
  - [campus-service-backend/routes/product.js](../campus-service-backend/routes/product.js)：商品相关接口。
  - [campus-service-backend/routes/category.js](../campus-service-backend/routes/category.js)：分类相关接口。
  - [campus-service-backend/routes/merchant.js](../campus-service-backend/routes/merchant.js)：商家相关接口。
  - [campus-service-backend/routes/notification.js](../campus-service-backend/routes/notification.js)：通知相关接口。
  - [campus-service-backend/routes/feedback.js](../campus-service-backend/routes/feedback.js)：反馈相关接口。
  - [campus-service-backend/routes/upload.js](../campus-service-backend/routes/upload.js)：上传相关接口（头像等）。
  - [campus-service-backend/routes/dashboard.js](../campus-service-backend/routes/dashboard.js)：统计/仪表盘相关接口。
  - [campus-service-backend/routes/admin.js](../campus-service-backend/routes/admin.js)：管理员端接口（用户/商家/订单/反馈/通知/日志等）。

- [campus-service-backend/controllers/](../campus-service-backend/controllers/)
  - 控制器层：处理请求、校验参数、调用数据库/业务逻辑、返回响应。

  控制器文件一览（按业务）：
  - [campus-service-backend/controllers/userController.js](../campus-service-backend/controllers/userController.js)：用户认证、资料、列表等。
  - [campus-service-backend/controllers/addressController.js](../campus-service-backend/controllers/addressController.js)：地址 CRUD、默认地址。
  - [campus-service-backend/controllers/cartController.js](../campus-service-backend/controllers/cartController.js)：购物车增删改查、选中项处理。
  - [campus-service-backend/controllers/orderController.js](../campus-service-backend/controllers/orderController.js)：订单创建、查询、取消、完成等。
  - [campus-service-backend/controllers/productController.js](../campus-service-backend/controllers/productController.js)：商品列表/详情、管理相关。
  - [campus-service-backend/controllers/categoryController.js](../campus-service-backend/controllers/categoryController.js)：分类查询/管理。
  - [campus-service-backend/controllers/merchantController.js](../campus-service-backend/controllers/merchantController.js)：商家列表/详情、商家端能力。
  - [campus-service-backend/controllers/notificationController.js](../campus-service-backend/controllers/notificationController.js)：通知列表、已读状态等。
  - [campus-service-backend/controllers/feedbackController.js](../campus-service-backend/controllers/feedbackController.js)：反馈提交、查询、处理。
  - [campus-service-backend/controllers/uploadController.js](../campus-service-backend/controllers/uploadController.js)：文件上传与存储。
  - [campus-service-backend/controllers/searchController.js](../campus-service-backend/controllers/searchController.js)：搜索聚合/关键字搜索。
  - [campus-service-backend/controllers/dashboardController.js](../campus-service-backend/controllers/dashboardController.js)：统计数据、趋势等。
  - [campus-service-backend/controllers/logController.js](../campus-service-backend/controllers/logController.js)：管理员操作日志/查询。

- [campus-service-backend/models/](../campus-service-backend/models/)
  - 数据模型层（如有 ORM/数据访问封装）。

- [campus-service-backend/config/db.js](../campus-service-backend/config/db.js)
  - 数据库连接池与连接测试。

- [campus-service-backend/middleware/](../campus-service-backend/middleware/)
  - 通用中间件：认证鉴权、错误处理、限流等。
  - [campus-service-backend/middleware/auth.js](../campus-service-backend/middleware/auth.js)：JWT 校验与角色检查。
  - [campus-service-backend/middleware/errorHandler.js](../campus-service-backend/middleware/errorHandler.js)：404 + 全局错误处理。
  - [campus-service-backend/middleware/rateLimit.js](../campus-service-backend/middleware/rateLimit.js)：登录/接口限流。

- [campus-service-backend/utils/jwt.js](../campus-service-backend/utils/jwt.js)
  - JWT 生成/验证的工具封装。

- [campus-service-backend/uploads/](../campus-service-backend/uploads/)
  - 上传文件存储目录（头像、临时文件等）。

### 后端脚本（数据库表维护）

以下脚本用于初始化/调整数据库表结构，通常是开发或部署时手动执行：

- [campus-service-backend/check-db.js](../campus-service-backend/check-db.js)：检查数据库连通性/基础状态。
- [campus-service-backend/check-tables.js](../campus-service-backend/check-tables.js)：检查表是否存在/结构是否正确。
- [campus-service-backend/check-user-table.js](../campus-service-backend/check-user-table.js)：检查用户表。
- [campus-service-backend/create_order_tables.js](../campus-service-backend/create_order_tables.js)：创建订单相关表。
- [campus-service-backend/create_cart_table.js](../campus-service-backend/create_cart_table.js)：创建购物车表。
- [campus-service-backend/create_feedback_table.js](../campus-service-backend/create_feedback_table.js)：创建反馈表。
- [campus-service-backend/create-admin-log-table.js](../campus-service-backend/create-admin-log-table.js)：创建管理员日志表。
- [campus-service-backend/update_user_table.js](../campus-service-backend/update_user_table.js)：更新用户表结构。
- [campus-service-backend/update_cart_table.js](../campus-service-backend/update_cart_table.js)：更新购物车表结构。
- [campus-service-backend/add-user-status-field.js](../campus-service-backend/add-user-status-field.js)：给用户表新增字段。

## docs/（文档与报告）

- [docs/dependency_analysis_report.md](dependency_analysis_report.md)
  - 依赖分析报告（归档文件）。
- [docs/dry_optimization_report.md](dry_optimization_report.md)
  - 重复代码（DRY）优化建议报告（归档文件）。

