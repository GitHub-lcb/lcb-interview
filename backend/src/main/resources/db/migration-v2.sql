-- db/migration-v2.sql
-- Phase A: 题库核心 — Question 表扩展

ALTER TABLE question
  ADD COLUMN summary TEXT COMMENT '30秒速览',
  ADD COLUMN principle TEXT COMMENT '原理解析',
  ADD COLUMN comparison TEXT COMMENT '对比分析',
  ADD COLUMN scenario TEXT COMMENT '适用场景',
  ADD COLUMN risk TEXT COMMENT '风险与避坑',
  ADD COLUMN project_exp TEXT COMMENT '项目实战',
  ADD COLUMN code_examples JSON COMMENT '代码示例',
  ADD COLUMN diagrams JSON COMMENT '图解',
  ADD COLUMN related_ids JSON COMMENT '关联题目ID',
  ADD COLUMN status VARCHAR(20) DEFAULT 'PUBLISHED' COMMENT 'DRAFT/PUBLISHED/REJECTED',
  ADD COLUMN source VARCHAR(20) DEFAULT 'MANUAL' COMMENT 'AI_GENERATED/MANUAL';

ALTER TABLE question ADD FULLTEXT INDEX ft_question_search
  (title, summary, principle, content, scenario, project_exp)
  WITH PARSER ngram;

UPDATE question SET status = 'PUBLISHED', source = 'MANUAL' WHERE status IS NULL;
