# Phase A: 题库核心 — 设计文档

## 概述

在现有 lcb-interview MVP 基础上，将面试题库从 5 道题扩展到 1 万+ 高质量题目，
核心差异化优势是**内容质量**——每道题都是结构化深度文章，远超面试鸭的单层问答。

## 核心理念

- **无登录、全免费**：零门槛使用，所有功能完全开放
- **内容质量第一**：每道题含原理/对比/场景/风险/项目经验等多维度解析
- **AI 生成 + 人工审核**：批量生成后逐条审核，兼顾效率与质量

## 1. 内容模型

### Question 表扩展字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary` | TEXT | 30秒速览，50-100字纯文本 |
| `principle` | TEXT | 原理深度解析 (Markdown) |
| `comparison` | TEXT | 对比分析 (Markdown) |
| `scenario` | TEXT | 适用场景 (Markdown) |
| `risk` | TEXT | 风险与常见坑 (Markdown) |
| `project_exp` | TEXT | 项目实战经验 (Markdown) |
| `code_examples` | JSON | `[{lang: "java"|"sql"|"javascript"|"python"|"go"|"xml"|"yaml"|"shell", title, code, description}]` |
| `diagrams` | JSON | `[{type: "mermaid"|"svg"|"url", alt, content, caption}]` |
| `related_ids` | JSON | `[Long]` — AI 生成时自动填充 + 人工补充 |

所有新字段均可选，简单题只填 `summary`，大而全的题填满所有字段。

### 前端展示顺序

```
标题 + 难度标签 + 分类面包屑
├── 摘要 (灰色背景框)
├── 原理 (Markdown)
├── 对比分析 (Markdown)
├── 适用场景 (Markdown)
├── 风险与避坑 (Markdown)
├── 项目实战 (Markdown)
├── 代码示例 (可折叠卡片 + Tab切换 + 复制按钮)
├── 图解 (可折叠)
└── 相关题目 (卡片列表)
```

每个区块使用 Ant Design Collapse 可折叠面板，支持展开/收起。

## 2. AI 题目生成管线

### 流程

```
管理员选择分类/主题 → AI批量生成(5-10道/次) → 存入草稿表(DRAFT)
→ 人工逐条预览/编辑 → 审核通过(PUBLISHED)或驳回(REJECTED)
```

### 后端新增

| 类 | 说明 |
|------|------|
| `AiGenerationController` | 触发生成、查询任务状态 |
| `AiQuestionService` | 调用 LLM API，按分类/主题批量生成 |
| `QuestionAdminController` | 草稿 CRUD、审核通过/驳回 |
| `DraftQuestion` 实体 | 与 question 结构相同，多 `status` 字段 |

### 数据库

不在 question 之外建独立草稿表。直接在 `question` 表新增两个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | VARCHAR(20) | `DRAFT` / `PUBLISHED` / `REJECTED`，默认 `PUBLISHED` |
| `source` | VARCHAR(20) | `AI_GENERATED` / `MANUAL`，默认 `MANUAL` |

- AI 生成的题目初始 `status=DRAFT`，审核通过后改为 `PUBLISHED`
- 发布后题目在公开 API 可见（`WHERE status='PUBLISHED'`）
- 无需独立草稿表，避免了表结构同步维护问题

### AI Prompt

每次调用 LLM，传参 `{category, difficulty, count}`，要求输出结构化 JSON，
直接映射到 question 各字段（summary, principle, comparison, scenario, risk, project_exp, code_examples）。

### AI 异常处理

| 失败场景 | 处理方式 | 用户看到 |
|----------|----------|----------|
| LLM API 超时（>30s） | 重试 1 次，仍超时则标记任务失败 | "生成超时，请重试" |
| LLM 返回空/截断 | 丢弃结果，标记任务失败 | "生成结果异常，请重试" |
| LLM 返回格式错误 | 尝试 JSON 修复，失败则丢弃 | "内容格式错误，已跳过" |
| LLM 返回合法但质量低（空字段过多） | 标记为 LOW_QUALITY，人工决定是否保留 | 草稿列表可见质量标签 |
| 部分成功（10道中7道成功3道失败） | 保存成功部分，失败项单独记录 | "成功 7/10 道，3 道生成失败" |

## 3. 搜索基础设施

MySQL FULLTEXT INDEX 过渡方案（中文需 ngram 解析器）：

```sql
ALTER TABLE question ADD FULLTEXT INDEX ft_question_search
  (title, summary, principle, content, scenario, project_exp)
  WITH PARSER ngram;
```

注意：`ngram` 默认分词长度为 2（`ngram_token_size=2`），如需单字搜索需在 my.cnf 中调整。
FULLTEXT 查询使用 `MATCH(...) AGAINST(? IN BOOLEAN MODE)`。

搜索排序：标题匹配 > 摘要/原理匹配 > 内容/场景匹配

覆盖场景：
- 关键词全文搜索
- 分类筛选 (已有索引)
- 难度筛选 (已有索引)
- 标签筛选 (已有 question_tag JOIN)
- 以上条件组合

后续迁移 Elasticsearch 时，数据结构已冗余设计好，只需写同步脚本。

## 4. 管理后台

### 路由

`/admin` — 前端从 localStorage 读取 token，所有 admin API 请求携带 `Authorization: Bearer <token>` Header。

> Token 放 URL 的弊端：会出现在 nginx access log、浏览器历史、Referer 头中。使用 Header 更安全。

### 页面

| 页面 | 功能 |
|------|------|
| Dashboard | 总览：题目总数、草稿数、分类统计 |
| AI Generation | 选择分类/难度/数量 → 生成 → 进度跟踪 |
| Draft Review | 草稿列表 → 预览/编辑/通过/驳回 |
| Category Mgmt | 分类管理（后续扩展） |

### 后端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/ai/generate` | 触发生成 |
| GET | `/api/admin/ai/tasks/{id}` | 查询任务状态 |
| GET | `/api/admin/questions/draft` | 草稿分页列表 |
| GET | `/api/admin/questions/draft/{id}` | 草稿详情 |
| PUT | `/api/admin/questions/draft/{id}` | 编辑保存 |
| POST | `/api/admin/questions/draft/{id}/approve` | 审核通过 |
| POST | `/api/admin/questions/draft/{id}/reject` | 驳回 |

## 5. 现有代码改动

### 后端
- `Question.java` — 添加新字段
- `QuestionVO.java` — 映射新字段
- `QuestionMapper.java` — 添加 FULLTEXT 搜索 SQL
- `QuestionService.java` — 扩展搜索逻辑
- 新增 `controller/admin/` 包
- 新增 `service/AiQuestionService.java`
- `Question.java` — 新增 `status`, `source` 字段
- 所有公开查询追加 `status='PUBLISHED'` 条件（保留 `is_deleted=0` 软删除逻辑，两者独立）

### 前端
- `types.ts` — 扩展 Question 类型（新字段 + `status`, `source`）
- `api/question.ts` — 请求新字段
- `QuestionDetail/index.tsx` — 重构为结构化展示（Collapse 区块 + 空字段隐藏 + 响应式）
- `QuestionDetail/ContentView.tsx` — 抽取内容渲染子组件（管理端复用）
- `QuestionDetail/CodeBlock.tsx` — 代码示例 Tab 组件（可复用）
- `QuestionDetail/DiagramBlock.tsx` — 图解展示组件
- `QuestionDetail/Skeleton.tsx` — 骨架屏组件
- 各页面统一加 Loading / Error / Empty 状态处理
- 新增 `admin/` 目录：`AdminLayout.tsx`, `Dashboard.tsx`, `AIGenerate.tsx`, `DraftReview.tsx`
- 新增 `api/admin.ts`

## 6. 非功能需求

- AI 生成接口异步执行，前端每 3 秒轮询任务状态（`GET /api/admin/ai/tasks/{id}`）
- 草稿编辑支持 Markdown 实时预览
- 全文搜索使用 BOOLEAN MODE，支持 +/- 操作符
- 管理后台 Token 校验：`application.yml` 配置 `admin.token=xxx`，前端存储于 localStorage，请求携带 `Authorization: Bearer <token>` Header

### 存量数据迁移

现有 5 道题缺少新字段（summary, principle 等），上线前执行一次 AI 批量补全：

1. 查询所有 `status=PUBLISHED` 且 `summary IS NULL` 的题目
2. 逐批（5 道/批）调用 LLM 补全缺失字段（已有 `content` 作为输入）
3. 补全结果存入对应字段，`source` 标记为 `AI_GENERATED`
4. 迁移完成后前端不会出现空白区块（所有区块可折叠，空字段自动隐藏）

## 7. 管理后台 UI 设计

### 布局

复用现有 Ant Design Layout 组件：左侧 Sider 导航 + 右侧 Content 区域。

```
┌──────────────────────────────────────────────────┐
│ Header: "LCB Interview Admin" + 退出按钮           │
├────────┬─────────────────────────────────────────┤
│ Sider  │ Content (Outlet)                        │
│        │                                         │
│ 📊    │ 根据路由渲染对应页面                      │
│  Dashboard   │                                     │
│ 🤖 生成题目  │                                     │
│ 📝 审核草稿  │                                     │
│ 🏷 分类管理  │                                     │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

### 组件复用策略

| 页面 | 复用的 Ant Design 组件 | 说明 |
|------|----------------------|------|
| Dashboard | `Statistic`, `Row/Col`, `Card`, `Table` | 统计卡片 + 最近操作列表 |
| AI Generation | `Form`, `Select`, `InputNumber`, `Button`, `Progress` | 生成参数表单 + 进度条 |
| Draft Review | `Table`, `Tag`, `Modal`, `Button`, `message` | 草稿列表 + Markdown 编辑弹窗 |

- 不引入新 UI 组件库，全部使用 Ant Design 5 现有组件
- Markdown 编辑使用 `@uiw/react-md-editor`（轻量，已在前端依赖中）
- 编辑弹窗预览区复用 QuestionDetail 的渲染逻辑

### 代码复用

- `api/admin.ts` 统一管理所有 admin 接口，与 `api/question.ts` 分离
- 编辑弹窗中的内容预览直接复用 `QuestionDetail` 的 `ContentView` 子组件
- Admin Header 复用现有 `Layout/Header.tsx` 的布局模式

### 路由结构

```
/admin
├── /                     → Dashboard（重定向）
├── /dashboard            → 统计总览
├── /ai-generate          → AI 生成配置
├── /draft-review         → 草稿列表
├── /draft-review/:id     → 草稿编辑（弹窗）
└── /categories           → 分类管理（后续）
```

## 8. 题目详情页响应式设计

### 断点策略

| 断点 | 行为 |
|------|------|
| < 768px（手机） | 所有区块占满宽度，默认全部折叠，用户手动展开 |
| 768-1200px（平板） | 默认展开摘要 + 原理，其余折叠，代码 Tab 切换 |
| > 1200px（桌面） | 按设计顺序展示，默认全部展开 |

### 移动端（< 768px）

```
标题 + 难度标签
├── 摘要 ──────── [默认展开] 灰色背景框
├── 原理 ──────── [折叠] 点击展开
│   └── Markdown 内容（字体 15px）
├── 对比分析 ──── [折叠]
├── 适用场景 ──── [折叠]
├── 风险避坑 ──── [折叠]
├── 项目实战 ──── [折叠]
├── 代码示例 ──── [折叠] 用 Select 下拉代替 Tab 切换语言
├── 图解 ──────── [折叠] 图表宽度自适应 viewport
└── 相关题目 ──── 卡片列表水平滚动
```

- Collapse 组件 `expandIconPosition="end"`，便于单手操作
- 代码块横向滚动（`overflow-x: auto`），不折行
- 图解最大宽度 100%，防止溢出

## 9. 前端 Loading/Error/Empty 状态覆盖

### 状态总表

| 页面/组件 | 加载中 | 空状态 | 错误状态 | 备注 |
|-----------|--------|--------|----------|------|
| Home 分类网格 | Skeleton 卡片（4 个） | "暂无分类" + 提示 | message.error + 重试按钮 | 目前缓存，几乎不会失败 |
| Home 热门题目 | Skeleton 列表（5 行） | "暂无热门题目" + 引导 | message.error + 重试 | 10 分钟缓存 |
| QuestionList 题目列表 | Skeleton + Spin 分页 | "该分类暂无题目" + 返回首页 | 空列表 + "加载失败，点击重试" | 分页保留已加载数据 |
| QuestionDetail | Spin 居中 + 骨架屏标题 | N/A（题目不存在显示 404） | "题目加载失败" + 返回按钮 | 空字段区块自动隐藏 |
| 搜索结果 | Spin + Skeleton | "未找到相关题目" + 搜索建议 | "搜索失败" + 重试 | 关键词高亮保留 |
| Admin Dashboard | Statistic 骨架屏 | "暂无数据" | "加载失败" + 重试 | — |
| Admin AI Generation | 生成按钮 loading + Progress | — | "生成失败" + 错误详情 | 部分成功显示明细 |
| Admin Draft Review | Table loading | "暂无草稿，去生成" + 快捷入口 | "加载失败" + 重试 | — |

### 实现原则

- 所有列表页加载中保留分页组件（显示 skeleton 而非空白）
- 空状态必须提供下一步操作按钮，不能只显示文字
- 错误状态统一用 `message.error` 轻提示 + 内联重试，避免全屏错误阻断页面
- 题目详情中为 null/空字符串的字段区块自动 `display:none`（Collapse Panel 的 `hidden` prop）
