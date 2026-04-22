-- 20260410_0002_feedback_images
-- 目标：为 feedback 表补齐 images 字段，用于保存评价/反馈图片（JSON 数组字符串）；可重复执行。

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
  @t_exists = 1 AND @col_exists = 0,
  "ALTER TABLE feedback ADD COLUMN images TEXT NULL COMMENT '评价/反馈图片，JSON数组字符串（最多4张）'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
