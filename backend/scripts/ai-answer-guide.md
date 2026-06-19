# AI 答案生成指南

## 工作流程

1. **读取数据**: 从 `data/{slug}.json` 读取某分类的题目列表
2. **生成答案**: 为每题生成结构化答案（参照下方字段说明）
3. **输出 SQL**: 将 UPDATE SQL 追加到 `sql/ai-update-answers.sql`

## 每题的答案结构

| 字段 | 必需 | 说明 | 字数 |
|------|------|------|------|
| `summary` | ✅ | 30秒速览，纯文本，概括核心要点 | 50-100字 |
| `content` | ✅ | 标准回答（Markdown），涵盖知识点完整论述 | 200-800字 |
| `principle` | ❌ | 原理深度解析，底层机制 | 100-500字 |
| `comparison` | ❌ | 对比分析（如 X vs Y） | 50-200字 |
| `scenario` | ❌ | 适用场景 | 50-150字 |
| `risk` | ❌ | 风险与常见坑 | 50-150字 |
| `project_exp` | ❌ | 项目实战经验 | 50-200字 |

必填字段（`summary`, `content`）每道题都必须有。可选字段根据题目复杂程度决定是否填写：
- 简单题（EASY）：至少填 `summary` + `content`
- 中等题（MEDIUM）：填 `summary` + `content` + 至少 2 个可选字段
- 困难题（HARD）：填满所有可选字段

## 输出 SQL 格式

```sql
-- =============================================
-- Java 基础 — 第 1/65 题
-- 题目: Java 中的序列化和反序列化是什么？
-- 来源: https://www.mianshiya.com/question/1780933294448209922
-- =============================================
UPDATE question SET
  summary = '序列化将 Java 对象转换为字节序列...',
  content = '## 序列化与反序列化\n\n**序列化**：将 Java 对象转换为字节序列...',
  principle = '### 序列化原理\n\nJava 序列化通过反射...',
  comparison = 'JSON 序列化 vs Java 原生序列化...',
  scenario = 'RPC 远程调用、分布式缓存...',
  risk = '版本兼容性：serialVersionUID 不一致...'
WHERE id = (SELECT id FROM question WHERE title = 'Java 中的序列化和反序列化是什么？' AND category_id = 1 LIMIT 1);
```

## content 书写规范

- 使用 Markdown 格式（## 三级标题、- 无序列表、1. 有序列表、`code`、```code blocks```）
- 代码块必须标注语言（`java`, `sql`, `xml`, `shell` 等）
- 每段文字不宜过长，善用列表分点论述
- 关键概念加粗 **加粗**

## SQL 注意事项

1. 单引号转义：`'` → `''`
2. 所有文本字段用 `''` 包裹，NULL 用 `NULL`
3. 每生成完一个分类的完整答案，运行一次 mvn spring-boot:run 验证 SQL 语法
4. 最终文件保存到 `backend/scripts/sql/ai-update-answers.sql`

## 执行顺序

1. 先执行 `backend/scripts/sql/init.sql` 初始化表结构、分类、标签和 DRAFT 题目
2. 再执行 `sql/ai-update-answers.sql` 填充答案，或直接使用管理后台 `/admin/ai-generate` 流式补答案
3. 确认 `summary`、`content` 等核心字段已填充后，再将 DRAFT 状态改为 PUBLISHED
