# SQL / Migrations

本目录用于集中管理数据库迁移（schema changes）。

## 关键点（和你提的“出问题就撤回”对应）

- MySQL 的大多数 DDL（`CREATE/ALTER/DROP`）会 **隐式提交**，不能像普通事务那样自动回滚。
- 所以“撤回操作”的正确做法是：每个迁移同时提供 `down.sql`，由迁移工具执行 **显式回滚**（best-effort）。
- 迁移工具支持：
  - 记录已执行迁移（`schema_migrations`）
  - `up` 执行新迁移
  - `down` 回滚最近的迁移
  - `--rollback-on-fail`：迁移执行失败时自动尝试执行该迁移的 `down.sql`

## 目录结构

- `sql/migrations/<migration_name>/up.sql`
- `sql/migrations/<migration_name>/down.sql`
- `sql/migrate.js`：迁移执行器（会读取 `campus-service-backend/.env` 连接数据库）

## 常用命令

在 `campus-service-backend` 目录下运行：

- 查看状态：`npm run migrate:status`
- 执行迁移：`npm run migrate:up`
- 执行迁移（失败自动撤回）：`npm run migrate:up:safe`
- 回滚最近 1 个：`npm run migrate:down`

> 注意：如果回滚涉及 `DROP COLUMN/DROP TABLE` 会丢数据，请先确认。 
