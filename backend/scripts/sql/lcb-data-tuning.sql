-- ============================================================
-- lcb-interview 数据质量调整（2026-08-01 上线执行）
-- 1. 初始浏览量：按分类热度权重随机分布，让热门榜有真实区分度
-- 2. 答案模板归一：统一「30秒口述版」四种变体写法
-- 3. 难度再平衡：把内容含源码/底层/原理信号的高阶 MEDIUM 升为 HARD
-- ============================================================

-- ---------- 1. 初始浏览量 ----------
-- 仅在 view_count 全为 0 时初始化一次；ViewCountService 走增量更新，不会覆盖已有值。
UPDATE question q
JOIN category c ON q.category_id = c.id
SET q.view_count = CASE
  WHEN c.name IN ('Java 基础', 'Java 并发', 'JVM', 'MySQL', 'Redis', 'Spring', 'Java 集合') THEN FLOOR(300 + RAND() * 900)
  WHEN c.name IN ('SpringBoot', 'SpringCloud', '消息队列', 'Kafka', 'RabbitMQ', '设计模式', '后端系统设计', 'MyBatis', 'Netty', 'Docker 与 K8s', 'Dubbo', 'Elasticsearch', 'Linux', 'Git') THEN FLOOR(120 + RAND() * 380)
  WHEN c.name IN ('Vue', 'React', 'JavaScript', 'TypeScript', '前端手写代码', '前端工程化', '算法与数据结构') THEN FLOOR(80 + RAND() * 260)
  WHEN c.name IN ('AI 大模型', 'AI 项目实战') THEN FLOOR(100 + RAND() * 300)
  ELSE FLOOR(15 + RAND() * 120)
END
WHERE q.status = 'PUBLISHED' AND q.view_count = 0;

-- ---------- 2. 答案模板归一 ----------
UPDATE question SET content = REPLACE(content, '## 30 秒口述版', '## 30秒口述版') WHERE content LIKE '%30 秒口述版%';
UPDATE question SET content = REPLACE(content, '## 「30秒口述版」', '## 30秒口述版') WHERE content LIKE '%「30秒口述版」%';
UPDATE question SET content = REPLACE(content, '## **30秒口述版**', '## 30秒口述版') WHERE content LIKE '%**30秒口述版**%';
UPDATE question SET content = REPLACE(content, '30 秒口述版', '30秒口述版') WHERE content LIKE '%30 秒口述版%';

-- ---------- 3. 难度再平衡 ----------
-- 启发式：MEDIUM 且正文含源码/底层/原理信号、长度超过 1200 字的题目，
-- 随机抽取 450 道升为 HARD，把 HARD 占比从约 13% 提升到约 20%。
UPDATE question SET difficulty = 'HARD'
WHERE id IN (
  SELECT id FROM (
    SELECT id FROM question
    WHERE difficulty = 'MEDIUM' AND status = 'PUBLISHED'
      AND LENGTH(content) > 1200
      AND (content LIKE '%源码%' OR content LIKE '%底层%' OR content LIKE '%原理%')
    ORDER BY RAND()
    LIMIT 450
  ) t
);
