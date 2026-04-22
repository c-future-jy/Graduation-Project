-- 20260410_0002_feedback_images (down)
-- 说明：仅在需要回滚时使用；生产环境通常不建议删除列。

SET @t_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'feedback'
);

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'feedback' AND column_name = 'images'
);

SET @sql := IF(
  @t_exists = 1 AND @col_exists = 1,
  'ALTER TABLE feedback DROP COLUMN images',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
