DROP TABLE IF EXISTS question_tag;
DROP TABLE IF EXISTS question;
DROP TABLE IF EXISTS tag;
DROP TABLE IF EXISTS category;

CREATE TABLE IF NOT EXISTS category (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '分类名称',
    icon        VARCHAR(255) DEFAULT ''                 COMMENT '图标 key',
    description VARCHAR(500) DEFAULT ''                 COMMENT '分类描述',
    sort_order  INT          DEFAULT 0                  COMMENT '排序权重',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_sort_order (sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题库分类';

CREATE TABLE IF NOT EXISTS tag (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '标签名称',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT   DEFAULT 0                  COMMENT '逻辑删除标记'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签';

CREATE TABLE IF NOT EXISTS question (
    id            BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    category_id   BIGINT       NOT NULL                   COMMENT '关联分类 ID',
    title         VARCHAR(500) NOT NULL                   COMMENT '题目标题',
    summary       TEXT                                     COMMENT '30秒速览',
    content       TEXT         NOT NULL                   COMMENT '标准回答（Markdown）',
    answer        TEXT                                     COMMENT '答案（保留兼容，新数据用 content）',
    principle     TEXT                                     COMMENT '原理解析',
    comparison    TEXT                                     COMMENT '对比分析',
    scenario      TEXT                                     COMMENT '适用场景',
    risk          TEXT                                     COMMENT '风险与避坑',
    project_exp   TEXT                                     COMMENT '项目实战',
    code_examples JSON                                     COMMENT '代码示例 [{lang,title,code,description}]',
    diagrams      JSON                                     COMMENT '图解 [{type,alt,content,caption}]',
    related_ids   JSON                                     COMMENT '关联题目ID列表',
    difficulty    VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM'  COMMENT '难度：EASY/MEDIUM/HARD',
    view_count    INT          DEFAULT 0                  COMMENT '浏览次数',
    status        VARCHAR(20)  DEFAULT 'PUBLISHED'        COMMENT 'DRAFT/PUBLISHED/REJECTED',
    source        VARCHAR(20)  DEFAULT 'MANUAL'           COMMENT 'AI_GENERATED/MANUAL',
    create_time   DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time   DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted    TINYINT   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_category (category_id),
    INDEX idx_difficulty (difficulty),
    INDEX idx_status (status),
    INDEX idx_view_count (view_count DESC),
    INDEX idx_create_time (create_time DESC),
    FULLTEXT INDEX ft_question_search (title, summary, principle, content, scenario, project_exp) WITH PARSER ngram
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '面试题目';

CREATE TABLE IF NOT EXISTS question_tag (
    question_id BIGINT NOT NULL COMMENT '题目 ID',
    tag_id      BIGINT NOT NULL COMMENT '标签 ID',
    PRIMARY KEY (question_id, tag_id),
    INDEX idx_tag_id (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签关联';
