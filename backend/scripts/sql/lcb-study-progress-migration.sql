-- =============================================
-- 学习进度云同步迁移脚本（幂等，可重复执行）
-- 每个普通用户仅保留一份最新学习进度 JSON 快照
-- =============================================

CREATE TABLE IF NOT EXISTS study_progress_snapshot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id BIGINT NOT NULL COMMENT '用户 ID',
    progress_json MEDIUMTEXT NOT NULL COMMENT '学习进度 JSON 快照',
    client_updated_at VARCHAR(40) DEFAULT '' COMMENT '客户端进度更新时间 ISO 字符串',
    create_time DATETIME NOT NULL COMMENT '创建时间',
    update_time DATETIME NOT NULL COMMENT '更新时间',
    is_deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_study_progress_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '学习进度云同步快照';
