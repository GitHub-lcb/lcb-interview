-- =============================================
-- 模拟战场功能迁移脚本（幂等，可重复执行）
-- 2026-08-18 设计：选择最近 N 期（100-1000）逐期滚动预测并结算，
-- 统计预测算法的历史命中表现，与线上推荐号码分开存储。
-- =============================================

CREATE TABLE IF NOT EXISTS lottery_simulation (
    id                 BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id            BIGINT       NOT NULL COMMENT '所属普通用户 ID',
    lottery_type       VARCHAR(20)  NOT NULL COMMENT '模拟类型：KL8/SSQ/DLT',
    window_size        INT          NOT NULL COMMENT '模拟期数（100-1000）',
    lead_history       INT          NOT NULL COMMENT '每期预测使用的前置历史期数',
    start_issue_no     VARCHAR(32)  NOT NULL COMMENT '模拟起始期号',
    end_issue_no       VARCHAR(32)  NOT NULL COMMENT '模拟结束期号',
    evaluated_count    INT          NOT NULL COMMENT '实际结算期数',
    total_hits         INT          DEFAULT 0 COMMENT '总命中数',
    avg_hits           DECIMAL(6,2) DEFAULT 0 COMMENT '平均命中',
    hit_rate           DECIMAL(5,2) DEFAULT 0 COMMENT '至少命中 1 个的比例（%）',
    zero_hit_count     INT          DEFAULT 0 COMMENT '全不中期数',
    max_hits           INT          DEFAULT 0 COMMENT '单期最高命中',
    secondary_avg      DECIMAL(6,2) DEFAULT 0 COMMENT '次维度平均命中（KL8 两组总命中/SSQ 蓝球/DLT 后区）',
    hit4_count         INT          DEFAULT 0 COMMENT 'KL8 单组全中 4 个的期数',
    hit_distribution_json VARCHAR(500) DEFAULT '' COMMENT '主维度命中数分布 JSON，如 {"0":5,"1":20,"2":40}',
    result_json        MEDIUMTEXT COMMENT '逐期模拟明细 JSON',
    summary            VARCHAR(500) DEFAULT '' COMMENT '统计摘要',
    create_time        DATETIME     NOT NULL COMMENT '创建时间',
    update_time        DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted         TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_sim_user_time (user_id, create_time),
    INDEX idx_sim_type (lottery_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '彩票模拟战场结果';

SET @sim_hit4_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lottery_simulation' AND COLUMN_NAME = 'hit4_count');
SET @sim_hit4_ddl = IF(@sim_hit4_exists = 0,
    'ALTER TABLE lottery_simulation ADD COLUMN hit4_count INT DEFAULT 0 COMMENT ''KL8 单组全中 4 个的期数''',
    'SELECT 1');
PREPARE sim_hit4_stmt FROM @sim_hit4_ddl;
EXECUTE sim_hit4_stmt;
DEALLOCATE PREPARE sim_hit4_stmt;

SET @sim_dist_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lottery_simulation' AND COLUMN_NAME = 'hit_distribution_json');
SET @sim_dist_ddl = IF(@sim_dist_exists = 0,
    'ALTER TABLE lottery_simulation ADD COLUMN hit_distribution_json VARCHAR(500) DEFAULT '''' COMMENT ''主维度命中数分布 JSON''',
    'SELECT 1');
PREPARE sim_dist_stmt FROM @sim_dist_ddl;
EXECUTE sim_dist_stmt;
DEALLOCATE PREPARE sim_dist_stmt;
