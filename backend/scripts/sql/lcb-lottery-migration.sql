-- =============================================
-- 彩种推荐表补列迁移（幂等，可重复执行）
-- 2026-08-17：推荐表新增 predicted_draw_date（预测开奖日期），
-- 供前端按当前时间准确展示「今晚开/明天开/X月X日开」。
-- =============================================

SET @kl8_col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lottery_kl8_recommendation' AND COLUMN_NAME = 'predicted_draw_date');
SET @kl8_col_ddl = IF(@kl8_col_exists = 0,
    'ALTER TABLE lottery_kl8_recommendation ADD COLUMN predicted_draw_date DATE NULL COMMENT ''预测开奖日期''',
    'SELECT 1');
PREPARE kl8_col_stmt FROM @kl8_col_ddl;
EXECUTE kl8_col_stmt;
DEALLOCATE PREPARE kl8_col_stmt;

SET @ssq_col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lottery_ssq_recommendation' AND COLUMN_NAME = 'predicted_draw_date');
SET @ssq_col_ddl = IF(@ssq_col_exists = 0,
    'ALTER TABLE lottery_ssq_recommendation ADD COLUMN predicted_draw_date DATE NULL COMMENT ''预测开奖日期''',
    'SELECT 1');
PREPARE ssq_col_stmt FROM @ssq_col_ddl;
EXECUTE ssq_col_stmt;
DEALLOCATE PREPARE ssq_col_stmt;

SET @dlt_col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lottery_dlt_recommendation' AND COLUMN_NAME = 'predicted_draw_date');
SET @dlt_col_ddl = IF(@dlt_col_exists = 0,
    'ALTER TABLE lottery_dlt_recommendation ADD COLUMN predicted_draw_date DATE NULL COMMENT ''预测开奖日期''',
    'SELECT 1');
PREPARE dlt_col_stmt FROM @dlt_col_ddl;
EXECUTE dlt_col_stmt;
DEALLOCATE PREPARE dlt_col_stmt;
