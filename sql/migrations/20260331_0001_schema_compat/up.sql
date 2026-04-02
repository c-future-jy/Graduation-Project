-- 20260331_0001_schema_compat
-- 目标：在不破坏现有数据的前提下，补齐运行所需的列/索引；可重复执行。

-- ============ helper pattern ============
-- 说明：MySQL 没有普遍支持的 IF NOT EXISTS (DDL)；这里用 information_schema + PREPARE 做条件执行。

-- ---- notification: deleted_at + index ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'notification'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'notification' AND column_name = 'deleted_at'
);

SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE notification ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'notification' AND column_name = 'deleted_at'
);

SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_notification_deleted_at ON notification (deleted_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- merchant: audit fields + index ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'merchant'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_status'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE merchant ADD COLUMN audit_status TINYINT NOT NULL DEFAULT 2 COMMENT '审核状态：1待审核 2通过 3拒绝（历史商家默认通过）'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_remark'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE merchant ADD COLUMN audit_remark VARCHAR(255) NULL COMMENT '审核备注'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE merchant ADD COLUMN audit_time DATETIME NULL COMMENT '审核时间'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE merchant ADD COLUMN audit_admin_id INT NULL COMMENT '审核管理员ID'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_status'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_merchant_audit_status ON merchant (audit_status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- product: offline fields + index ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'product'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'product' AND column_name = 'offline_reason'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE product ADD COLUMN offline_reason VARCHAR(255) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'product' AND column_name = 'offline_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE product ADD COLUMN offline_admin_id BIGINT UNSIGNED NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'product' AND column_name = 'offline_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_offline_admin_id ON product (offline_admin_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- user: username/account/status + indexes ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'user'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'username'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE user ADD COLUMN username VARCHAR(50) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'account'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE user ADD COLUMN account VARCHAR(11) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'status'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE user ADD COLUMN status TINYINT DEFAULT 1 COMMENT '用户状态：1-正常，0-禁用'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- username unique index (only if no unique index exists on username)
SET @uniq_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user'
    AND column_name = 'username' AND non_unique = 0
);
SET @sql := IF(@t_exists = 1 AND @uniq_exists = 0,
  'CREATE UNIQUE INDEX uk_username ON user (username)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- account unique index (only if no unique index exists on account)
SET @uniq_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user'
    AND column_name = 'account' AND non_unique = 0
);
SET @sql := IF(@t_exists = 1 AND @uniq_exists = 0,
  'CREATE UNIQUE INDEX uk_account ON user (account)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- openid unique index (only if no unique index exists on openid)
SET @uniq_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user'
    AND column_name = 'openid' AND non_unique = 0
);
SET @sql := IF(@t_exists = 1 AND @uniq_exists = 0,
  'CREATE UNIQUE INDEX uk_openid ON user (openid)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- phone index (only if no index exists on phone)
SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user'
    AND column_name = 'phone'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_phone ON user (phone)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- order: delivery_time/complete_time + indexes ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'order'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'delivery_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE `order` ADD COLUMN delivery_time DATETIME NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'complete_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE `order` ADD COLUMN complete_time DATETIME NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'delivery_time'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_delivery_time ON `order` (delivery_time)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'complete_time'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_complete_time ON `order` (complete_time)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- admin_operation_log: columns + indexes ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'target_table'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE admin_operation_log ADD COLUMN target_table VARCHAR(50) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'target_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE admin_operation_log ADD COLUMN target_id BIGINT UNSIGNED NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'ip'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE admin_operation_log ADD COLUMN ip VARCHAR(64) NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'admin_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_admin_id ON admin_operation_log (admin_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'created_at'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_created_at ON admin_operation_log (created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- feedback: indexes ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'feedback'
);

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND column_name = 'merchant_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_merchant_id ON feedback (merchant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND column_name = 'status'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_status ON feedback (status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND column_name = 'created_at'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists = 0,
  'CREATE INDEX idx_created_at ON feedback (created_at)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- cart: selected + indexes ----
SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'cart'
);

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND column_name = 'selected'
);
SET @sql := IF(@t_exists = 1 AND @col_exists = 0,
  'ALTER TABLE cart ADD COLUMN selected TINYINT NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 注意：创建唯一索引可能因历史重复数据而失败
-- 若索引已存在会报错，所以先判断
SET @idx_by_name := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'uk_user_product_spec'
);
SET @sql := IF(@t_exists = 1 AND @idx_by_name = 0,
  'CREATE UNIQUE INDEX uk_user_product_spec ON cart (user_id, product_id, spec)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_by_name := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'idx_user_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_by_name = 0,
  'CREATE INDEX idx_user_id ON cart (user_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_by_name := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'idx_merchant_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_by_name = 0,
  'CREATE INDEX idx_merchant_id ON cart (merchant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'OK' AS migration_20260331_0001_schema_compat;
