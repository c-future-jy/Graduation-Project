# 校园一站式服务平台（微信小程序 + Node 后端）

本仓库同时包含：
- 微信小程序前端（根目录）
- 后端 API 服务（campus-service-backend/）

## 快速入口

- 小程序全局配置：[app.json](app.json)
- 小程序入口逻辑：[app.js](app.js)
- 前端 API 封装：[utils/api.js](utils/api.js)
- 后端入口（Express）：[campus-service-backend/app.js](campus-service-backend/app.js)
- 后端路由聚合：[campus-service-backend/routes/index.js](campus-service-backend/routes/index.js)
- 项目结构说明：[docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

## 运行方式（参考）

- 后端：在 `campus-service-backend/` 下执行 `npm run dev` 或 `npm start`
- 小程序：用微信开发者工具打开本项目根目录进行编译预览
