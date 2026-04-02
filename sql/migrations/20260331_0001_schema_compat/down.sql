-- 20260331_0001_schema_compat (DOWN)
-- 警告：DROP COLUMN / DROP TABLE 会丢数据；回滚前请确认。

-- ---- cart ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'cart'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'uk_user_product_spec'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX uk_user_product_spec ON cart',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'idx_user_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_user_id ON cart',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND index_name = 'idx_merchant_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_merchant_id ON cart',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'cart' AND column_name = 'selected'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE cart DROP COLUMN selected',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- feedback ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'feedback'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND index_name = 'idx_merchant_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_merchant_id ON feedback',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND index_name = 'idx_status'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_status ON feedback',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND index_name = 'idx_created_at'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_created_at ON feedback',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- admin_operation_log ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND index_name = 'idx_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_admin_id ON admin_operation_log',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND index_name = 'idx_created_at'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_created_at ON admin_operation_log',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'target_table'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE admin_operation_log DROP COLUMN target_table',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'target_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE admin_operation_log DROP COLUMN target_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'admin_operation_log' AND column_name = 'ip'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE admin_operation_log DROP COLUMN ip',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- order ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'order'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'order' AND index_name = 'idx_delivery_time'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_delivery_time ON `order`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'order' AND index_name = 'idx_complete_time'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_complete_time ON `order`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'delivery_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE `order` DROP COLUMN delivery_time',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'order' AND column_name = 'complete_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE `order` DROP COLUMN complete_time',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- user ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'user'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = 'uk_username'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX uk_username ON user',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = 'uk_account'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX uk_account ON user',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = 'uk_openid'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX uk_openid ON user',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user' AND index_name = 'idx_phone'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_phone ON user',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'status'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE user DROP COLUMN status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'account'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE user DROP COLUMN account',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user' AND column_name = 'username'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE user DROP COLUMN username',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- product ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'product'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'product' AND index_name = 'idx_offline_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_offline_admin_id ON product',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'product' AND column_name = 'offline_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE product DROP COLUMN offline_admin_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'product' AND column_name = 'offline_reason'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE product DROP COLUMN offline_reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- merchant ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'merchant'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND index_name = 'idx_merchant_audit_status'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_merchant_audit_status ON merchant',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_admin_id'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE merchant DROP COLUMN audit_admin_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_time'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE merchant DROP COLUMN audit_time',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_remark'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE merchant DROP COLUMN audit_remark',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'merchant' AND column_name = 'audit_status'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE merchant DROP COLUMN audit_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---- notification ----
SET @t_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'notification'
);

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'notification' AND index_name = 'idx_notification_deleted_at'
);
SET @sql := IF(@t_exists = 1 AND @idx_exists > 0,
  'DROP INDEX idx_notification_deleted_at ON notification',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'notification' AND column_name = 'deleted_at'
);
SET @sql := IF(@t_exists = 1 AND @col_exists > 0,
  'ALTER TABLE notification DROP COLUMN deleted_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT 'OK' AS rollback_20260331_0001_schema_compat;
