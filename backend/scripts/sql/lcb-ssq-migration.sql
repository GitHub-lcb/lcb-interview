-- =============================================
-- 双色球功能迁移脚本（幂等，可重复执行）
-- 2026-08-16 设计：开奖同步 → 7红1蓝预测 → 命中结算 → 自动推荐
-- =============================================

CREATE TABLE IF NOT EXISTS lottery_ssq_draw (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    issue_no    VARCHAR(32)  NOT NULL COMMENT '期号，如 2026094',
    draw_date   DATE         NOT NULL COMMENT '开奖日期',
    red_numbers VARCHAR(60)  NOT NULL COMMENT '6 个红球号码，逗号分隔',
    blue_number VARCHAR(10)  NOT NULL COMMENT '1 个蓝球号码',
    source_url  VARCHAR(500) DEFAULT '' COMMENT '来源页面',
    source_name VARCHAR(80)  DEFAULT '' COMMENT '来源名称',
    create_time DATETIME     NOT NULL COMMENT '创建时间',
    update_time DATETIME     NOT NULL COMMENT '更新时间',
    UNIQUE KEY uk_lottery_ssq_issue (issue_no),
    INDEX idx_lottery_ssq_draw_date (draw_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '双色球开奖记录';

CREATE TABLE IF NOT EXISTS lottery_ssq_recommendation (
    id                   BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id              BIGINT       NOT NULL COMMENT '所属普通用户 ID',
    source               VARCHAR(20)  NOT NULL COMMENT '推荐来源：RULE_BASED',
    red_numbers          VARCHAR(60)  NOT NULL COMMENT '7 个红球号码，逗号分隔',
    blue_number          VARCHAR(10)  NOT NULL COMMENT '1 个蓝球号码',
    base_issue_count     INT          NOT NULL COMMENT '使用的历史期数',
    latest_issue_no      VARCHAR(32)  DEFAULT '' COMMENT '生成时最新期号',
    feature_summary      TEXT COMMENT '历史特征摘要',
    analysis_json        MEDIUMTEXT COMMENT '分析 JSON（回测摘要等）',
    evaluated_issue_no   VARCHAR(32)  DEFAULT '' COMMENT '结算开奖期号',
    evaluated_draw_date  DATE         DEFAULT NULL COMMENT '结算开奖日期',
    hit_summary_json     MEDIUMTEXT COMMENT '命中结果 JSON',
    total_hit_count      INT          DEFAULT NULL COMMENT '红球命中数 + 蓝球命中数',
    max_hit_count        INT          DEFAULT NULL COMMENT '红球命中数（0-7）',
    evaluated_at         DATETIME     DEFAULT NULL COMMENT '命中结算时间',
    disclaimer           VARCHAR(300) NOT NULL COMMENT '风险提示',
    create_time          DATETIME     NOT NULL COMMENT '创建时间',
    update_time          DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted           TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_ssq_recommend_user_time (user_id, create_time),
    INDEX idx_ssq_recommend_latest_issue (latest_issue_no),
    INDEX idx_ssq_recommend_eval_issue (evaluated_issue_no)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '双色球推荐历史';
