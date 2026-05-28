INSERT INTO category (name, icon, description, sort_order, create_time, update_time) VALUES
('Java 基础', 'icon-java', 'Java 基础面试题，涵盖数据类型、面向对象、集合框架等', 1, NOW(), NOW()),
('MySQL', 'icon-mysql', 'MySQL 数据库面试题，包括索引、事务、SQL 优化等', 2, NOW(), NOW()),
('Redis', 'icon-redis', 'Redis 缓存面试题，包括数据结构、持久化、集群等', 3, NOW(), NOW()),
('Spring', 'icon-spring', 'Spring 框架面试题，包括 IoC、AOP、事务管理等', 4, NOW(), NOW());

INSERT INTO tag (name, create_time, update_time) VALUES
('Java', NOW(), NOW()), ('集合', NOW(), NOW()), ('多线程', NOW(), NOW()),
('JVM', NOW(), NOW()), ('索引', NOW(), NOW()), ('事务', NOW(), NOW()),
('缓存', NOW(), NOW()), ('IoC', NOW(), NOW()), ('AOP', NOW(), NOW()),
('分布式', NOW(), NOW()), ('数据结构', NOW(), NOW()), ('算法', NOW(), NOW());

INSERT INTO question (category_id, title, content, answer, difficulty, view_count, create_time, update_time) VALUES
(1, '说说 Java 中 HashMap 的原理？',
'请详细说明 HashMap 的底层数据结构、put 和 get 的流程、扩容机制。',
'## HashMap 原理\n\n### 底层结构\n- JDK 1.7：数组 + 链表\n- JDK 1.8：数组 + 链表 + 红黑树（链表长度 > 8 时转红黑树）\n\n### put 流程\n1. 计算 key 的 hash 值\n2. 对数组长度取模找到桶位置\n3. 如果桶为空，直接放入\n4. 如果桶不为空，遍历链表/红黑树\n   - 如果 key 已存在，覆盖 value\n   - 如果 key 不存在，插入尾部（尾插法）\n5. 插入后检查是否超过阈值，超过则扩容\n\n### 扩容机制\n- 默认初始容量 16，负载因子 0.75\n- 扩容为原来的 2 倍\n- 需要 rehash 重新分配位置',
'MEDIUM', 5326, NOW(), NOW()),
(1, 'Java 中的序列化和反序列化是什么？',
'请解释 Java 序列化和反序列化的概念、用途以及注意事项。',
'## 序列化与反序列化\n\n**序列化**：将 Java 对象转换为字节序列，便于存储或网络传输。\n**反序列化**：将字节序列恢复为 Java 对象。\n\n### 实现方式\n- 实现 `Serializable` 接口\n- 使用 `ObjectOutputStream` / `ObjectInputStream`\n\n### 注意事项\n- 使用 `serialVersionUID` 控制版本兼容性\n- `transient` 关键字标记不需要序列化的字段\n- 静态变量不会被序列化\n- 父类实现了 Serializable，子类自动可序列化',
'EASY', 3350, NOW(), NOW()),
(1, 'Java 中 ConcurrentHashMap 1.7 和 1.8 之间有哪些区别？',
'请对比 ConcurrentHashMap 在 JDK 1.7 和 1.8 中的实现差异。',
'## ConcurrentHashMap 1.7 vs 1.8\n\n### JDK 1.7\n- **分段锁（Segment）**：继承 ReentrantLock，将数据分为多个 Segment\n- 并发度默认为 16\n- 两次 hash 定位（先找 Segment，再找 Entry）\n\n### JDK 1.8\n- **CAS + synchronized**：放弃了 Segment，直接用 Node 数组\n- 锁粒度更细：只锁链表/红黑树的头节点\n- 引入红黑树优化 hash 冲突\n- 并发度更高，性能更好',
'MEDIUM', 2908, NOW(), NOW()),
(2, 'MySQL 索引的最左前缀匹配原则是什么？',
'请解释联合索引的最左前缀匹配原则及其对查询性能的影响。',
'## 最左前缀匹配原则\n\n联合索引 `(a, b, c)` 相当于创建了三个索引：\n- `(a)`\n- `(a, b)`\n- `(a, b, c)`\n\n### 匹配规则\n- 查询条件必须从索引的最左列开始\n- 遇到范围查询（>、<、between、like）会停止匹配\n\n### 示例\n```sql\nWHERE a = 1 AND b = 2 -- 走索引\nWHERE a = 1           -- 走索引\nWHERE b = 2           -- 不走索引（跳过了 a）\nWHERE a = 1 AND c = 3 -- 只用到 a 列索引\n```',
'MEDIUM', 3246, NOW(), NOW()),
(2, 'MySQL 的索引类型有哪些？',
'请列举 MySQL 支持的索引类型及其适用场景。',
'## MySQL 索引类型\n\n1. **B+Tree 索引**：最常用，支持全值匹配、范围查询、排序\n2. **Hash 索引**：Memory 引擎支持，精确匹配快，不支持范围查询\n3. **全文索引（Full-Text）**：用于大文本字段的模糊搜索\n4. **空间索引（R-Tree）**：MyISAM 引擎支持地理空间数据\n\n### 从功能角度分类\n- 主键索引（PRIMARY）\n- 唯一索引（UNIQUE）\n- 普通索引（INDEX）\n- 联合索引（复合索引）\n- 覆盖索引（Extra 显示 Using index）',
'EASY', 2941, NOW(), NOW());

INSERT INTO question_tag (question_id, tag_id) VALUES
(1, 1), (1, 2), (2, 1), (3, 1), (3, 3),
(4, 5), (5, 5);
