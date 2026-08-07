-- =============================================
-- 高频考点体系迁移脚本（幂等，可重复执行）
-- 2026-08-05 设计：分类 → 考点 → 题目 + 面经语料 + 回填 + 突击计划
-- =============================================

CREATE TABLE IF NOT EXISTS knowledge_point (
    id              BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    category_id     BIGINT       NOT NULL COMMENT '所属分类 ID',
    name            VARCHAR(80)  NOT NULL COMMENT '考点名称，如 HashMap原理',
    slug            VARCHAR(100) DEFAULT '' COMMENT '唯一英文标识',
    parent_id       BIGINT       DEFAULT NULL COMMENT '依赖的父考点 ID，可空',
    hot_score       INT          DEFAULT 0 COMMENT '高频权重分 0-100',
    hot_score_source VARCHAR(20) DEFAULT 'CORPUS' COMMENT '权重来源：CORPUS/FEEDBACK/BLEND',
    status          VARCHAR(20)  DEFAULT 'DRAFT' COMMENT 'DRAFT 待审核/ACTIVE 生效',
    description     VARCHAR(500) DEFAULT '' COMMENT '考点说明',
    create_time     DATETIME     NOT NULL COMMENT '创建时间',
    update_time     DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted      TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_knowledge_point_category_name (category_id, name),
    UNIQUE KEY uk_knowledge_point_slug (slug),
    INDEX idx_knowledge_point_category (category_id),
    INDEX idx_knowledge_point_parent (parent_id),
    INDEX idx_knowledge_point_hot (hot_score DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '高频考点';

-- 已存在表的增量列（MySQL 8 无 ADD COLUMN IF NOT EXISTS，用信息模式判断保证幂等）
SET @kp_status_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_point' AND COLUMN_NAME = 'status');
SET @kp_status_ddl = IF(@kp_status_exists = 0,
    'ALTER TABLE knowledge_point ADD COLUMN status VARCHAR(20) DEFAULT ''DRAFT'' COMMENT ''DRAFT 待审核/ACTIVE 生效''',
    'SELECT 1');
PREPARE kp_status_stmt FROM @kp_status_ddl;
EXECUTE kp_status_stmt;
DEALLOCATE PREPARE kp_status_stmt;

-- CREATE TABLE IF NOT EXISTS 不会给旧表补索引，升级时需单独判断。
-- 若旧库已有重复业务键，ALTER 会明确失败，避免迁移脚本擅自合并考点。
SET @kp_business_key_named = (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_point'
      AND INDEX_NAME = 'uk_knowledge_point_category_name');
SET @kp_business_key_valid = (SELECT COUNT(*) FROM (
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_point'
      AND INDEX_NAME = 'uk_knowledge_point_category_name' AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'category_id,name'
) valid_index);
SET @kp_business_key_ddl = IF(@kp_business_key_valid = 1,
    'SELECT 1',
    IF(@kp_business_key_named > 0,
        'ALTER TABLE knowledge_point DROP INDEX uk_knowledge_point_category_name, ADD UNIQUE KEY uk_knowledge_point_category_name (category_id, name)',
        'ALTER TABLE knowledge_point ADD UNIQUE KEY uk_knowledge_point_category_name (category_id, name)'));
PREPARE kp_business_key_stmt FROM @kp_business_key_ddl;
EXECUTE kp_business_key_stmt;
DEALLOCATE PREPARE kp_business_key_stmt;

CREATE TABLE IF NOT EXISTS question_knowledge_point (
    question_id       BIGINT NOT NULL COMMENT '题目 ID',
    knowledge_point_id BIGINT NOT NULL COMMENT '考点 ID',
    source              VARCHAR(20) DEFAULT 'MANUAL' COMMENT '关联来源：AI/MANUAL',
    PRIMARY KEY (question_id, knowledge_point_id),
    INDEX idx_qkp_knowledge_point (knowledge_point_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目-考点关联';

SET @qkp_source_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'question_knowledge_point' AND COLUMN_NAME = 'source');
SET @qkp_source_ddl = IF(@qkp_source_exists = 0,
    'ALTER TABLE question_knowledge_point ADD COLUMN source VARCHAR(20) DEFAULT ''AI'' COMMENT ''关联来源：AI/MANUAL''',
    'SELECT 1');
PREPARE qkp_source_stmt FROM @qkp_source_ddl;
EXECUTE qkp_source_stmt;
DEALLOCATE PREPARE qkp_source_stmt;
SET @qkp_source_default_ddl = IF(@qkp_source_exists = 0,
    'ALTER TABLE question_knowledge_point MODIFY COLUMN source VARCHAR(20) DEFAULT ''MANUAL'' COMMENT ''关联来源：AI/MANUAL''',
    'SELECT 1');
PREPARE qkp_source_default_stmt FROM @qkp_source_default_ddl;
EXECUTE qkp_source_default_stmt;
DEALLOCATE PREPARE qkp_source_default_stmt;

CREATE TABLE IF NOT EXISTS interview_source (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    source_url    VARCHAR(500) NOT NULL COMMENT '原文地址，去重键',
    source_name   VARCHAR(80)  DEFAULT '' COMMENT '来源站点',
    company       VARCHAR(80)  DEFAULT '' COMMENT 'AI 提取的公司',
    position      VARCHAR(80)  DEFAULT '' COMMENT 'AI 提取的岗位',
    publish_date  DATE         DEFAULT NULL COMMENT '发布日期',
    raw_content   MEDIUMTEXT COMMENT '原文文本，仅本地处理不对外展示',
    status        VARCHAR(20)  DEFAULT 'RAW' COMMENT 'RAW/EXTRACTED/FAILED',
    extract_error VARCHAR(500) DEFAULT '' COMMENT '提取失败原因',
    create_time   DATETIME     NOT NULL COMMENT '创建时间',
    update_time   DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted    TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_interview_source_url (source_url),
    INDEX idx_interview_source_status (status),
    INDEX idx_interview_source_company (company)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '面经语料';

CREATE TABLE IF NOT EXISTS knowledge_point_mention (
    id                   BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    interview_source_id  BIGINT       NOT NULL COMMENT '语料 ID',
    knowledge_point_id   BIGINT       NOT NULL COMMENT '考点 ID',
    mention_count        INT          DEFAULT 1 COMMENT '该篇中被问次数',
    context              VARCHAR(500) DEFAULT '' COMMENT '提及上下文片段，用于权重解释',
    create_time          DATETIME     NOT NULL COMMENT '创建时间',
    is_deleted           TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_kpm_source_point (interview_source_id, knowledge_point_id),
    INDEX idx_kpm_knowledge_point (knowledge_point_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '考点提及统计';

SET @kpm_business_key_named = (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_point_mention'
      AND INDEX_NAME = 'uk_kpm_source_point');
SET @kpm_business_key_valid = (SELECT COUNT(*) FROM (
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'knowledge_point_mention'
      AND INDEX_NAME = 'uk_kpm_source_point' AND NON_UNIQUE = 0
    GROUP BY INDEX_NAME
    HAVING GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) = 'interview_source_id,knowledge_point_id'
) valid_index);
SET @kpm_business_key_ddl = IF(@kpm_business_key_valid = 1,
    'SELECT 1',
    IF(@kpm_business_key_named > 0,
        'ALTER TABLE knowledge_point_mention DROP INDEX uk_kpm_source_point, ADD UNIQUE KEY uk_kpm_source_point (interview_source_id, knowledge_point_id)',
        'ALTER TABLE knowledge_point_mention ADD UNIQUE KEY uk_kpm_source_point (interview_source_id, knowledge_point_id)'));
PREPARE kpm_business_key_stmt FROM @kpm_business_key_ddl;
EXECUTE kpm_business_key_stmt;
DEALLOCATE PREPARE kpm_business_key_stmt;

CREATE TABLE IF NOT EXISTS interview_feedback (
    id                 BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id            BIGINT       NOT NULL COMMENT '回填用户 ID',
    company            VARCHAR(80)  DEFAULT '' COMMENT '面试公司',
    position           VARCHAR(80)  DEFAULT '' COMMENT '面试岗位',
    question_id        BIGINT       DEFAULT NULL COMMENT '被问到的题目 ID，可空',
    knowledge_point_id BIGINT       DEFAULT NULL COMMENT '命中考点 ID',
    interview_date     DATE         DEFAULT NULL COMMENT '面试日期',
    create_time        DATETIME     NOT NULL COMMENT '创建时间',
    update_time        DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted         TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_ifb_user_time (user_id, create_time),
    INDEX idx_ifb_knowledge_point (knowledge_point_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户面试回填';

CREATE TABLE IF NOT EXISTS study_plan (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id       BIGINT       NOT NULL COMMENT '所属用户 ID',
    target_date   DATE         NOT NULL COMMENT '目标面试日期',
    position      VARCHAR(80)  DEFAULT '' COMMENT '目标岗位',
    status        VARCHAR(20)  DEFAULT 'ACTIVE' COMMENT 'ACTIVE/DONE/ABANDONED',
    create_time   DATETIME     NOT NULL COMMENT '创建时间',
    update_time   DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted    TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_study_plan_user (user_id, create_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '突击计划';

CREATE TABLE IF NOT EXISTS study_plan_item (
    id                 BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    plan_id            BIGINT       NOT NULL COMMENT '计划 ID',
    knowledge_point_id BIGINT       DEFAULT NULL COMMENT '考点 ID',
    question_id        BIGINT       NOT NULL COMMENT '题目 ID',
    scheduled_date     DATE         NOT NULL COMMENT '计划背诵日期',
    status             VARCHAR(20)  DEFAULT 'TODO' COMMENT 'TODO/DONE/REVIEW',
    create_time        DATETIME     NOT NULL COMMENT '创建时间',
    update_time        DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted         TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_spi_plan (plan_id, scheduled_date),
    INDEX idx_spi_question (question_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '突击计划明细';
