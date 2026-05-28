CREATE TABLE IF NOT EXISTS category (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '分类名称',
    icon        VARCHAR(255) DEFAULT ''                 COMMENT '图标 URL',
    description VARCHAR(500) DEFAULT ''                 COMMENT '分类描述',
    sort_order  INT          DEFAULT 0                  COMMENT '排序权重',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_sort_order (sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题库分类';

CREATE TABLE IF NOT EXISTS tag (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '标签名称',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签';

CREATE TABLE IF NOT EXISTS question (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    category_id BIGINT       NOT NULL                   COMMENT '关联分类 ID',
    title       VARCHAR(500) NOT NULL                   COMMENT '题目标题',
    content     TEXT         NOT NULL                   COMMENT '题目内容（Markdown）',
    answer      TEXT         NOT NULL                   COMMENT '题目答案（Markdown）',
    difficulty  VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM'  COMMENT '难度：EASY/MEDIUM/HARD',
    view_count  INT          DEFAULT 0                  COMMENT '浏览次数',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_category (category_id),
    INDEX idx_difficulty (difficulty),
    INDEX idx_view_count (view_count DESC),
    INDEX idx_create_time (create_time DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '面试题目';

CREATE TABLE IF NOT EXISTS question_tag (
    question_id BIGINT NOT NULL COMMENT '题目 ID',
    tag_id      BIGINT NOT NULL COMMENT '标签 ID',
    PRIMARY KEY (question_id, tag_id),
    INDEX idx_tag_id (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签关联';
