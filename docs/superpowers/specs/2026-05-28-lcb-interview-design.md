# LCB Interview — 面试题库网站设计文档

## 概述

前后端分离的公开面试题库网站，支持浏览器端和手机端访问。MVP 阶段聚焦题库浏览、刷题和搜索，并追求更好的 UI 体验与交互设计。

## 技术栈

| 层 | 技术 |
|------|------|
| 语言 | JDK 21（Virtual Threads, Record, Text Block, SequencedCollection） |
| 后端框架 | Spring Boot 3 + MyBatis-Plus |
| 数据库 | MySQL 8 + Redis (Spring Cache) |
| 前端 | React 18 + Vite + React Router 6 + Ant Design 5 + Axios |
| 前端库 | react-markdown + rehype-highlight（Markdown + 代码高亮） |
| 部署 | 前端 Nginx 静态托管（含 try_files SPA 路由），后端 jar 部署 |
| SEO | prerender-spa-plugin 预渲染 |
| CORS | Spring Boot 全局 CorsFilter |

## 数据模型设计规范

### 通用字段规范

每张业务表都包含以下通用字段：

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK, AUTO_INCREMENT | 主键 |
| create_time | datetime | NOT NULL | 创建时间 |
| update_time | datetime | NOT NULL | 更新时间 |
| is_deleted | tinyint(1) | DEFAULT 0 | 逻辑删除标记（MyBatis-Plus @TableLogic） |

### 索引设计规范

- 主键索引：PRIMARY KEY (id)
- 外键索引：category_id → question 表
- 联合索引：联合查询频繁的字段建复合索引
- 全文索引：title + content 后续可考虑 MySQL FULLTEXT

### Category（题库分类）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | 主键 |
| name | varchar(50) | NOT NULL, UNIQUE | 分类名，如 Java/MySQL/Redis |
| icon | varchar(255) | DEFAULT '' | 图标 URL |
| description | varchar(500) | DEFAULT '' | 分类描述 |
| sort_order | int | DEFAULT 0 | 排序权重，越小越靠前 |
| create_time | datetime | NOT NULL | 创建时间 |
| update_time | datetime | NOT NULL | 更新时间 |
| is_deleted | tinyint(1) | DEFAULT 0 | 逻辑删除 |

索引：`idx_category_sort_order` ON (sort_order)

### Tag（标签）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | 主键 |
| name | varchar(50) | NOT NULL, UNIQUE | 标签名（如 Java/Redis/多线程） |
| create_time | datetime | NOT NULL | 创建时间 |
| update_time | datetime | NOT NULL | 更新时间 |
| is_deleted | tinyint(1) | DEFAULT 0 | 逻辑删除 |

### Question（题目）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | bigint | PK | 主键 |
| category_id | bigint | FK → category.id | 关联分类 |
| title | varchar(500) | NOT NULL | 题目标题 |
| content | text | NOT NULL | 题目内容（Markdown） |
| answer | text | NOT NULL | 答案（Markdown） |
| difficulty | varchar(20) | NOT NULL, DEFAULT 'MEDIUM' | 难度：EASY / MEDIUM / HARD |
| view_count | int | DEFAULT 0 | 浏览次数（定时批量写入） |
| create_time | datetime | NOT NULL | 创建时间 |
| update_time | datetime | NOT NULL | 更新时间 |
| is_deleted | tinyint(1) | DEFAULT 0 | 逻辑删除 |

索引：
- `idx_question_category` ON (category_id)
- `idx_question_difficulty` ON (difficulty)
- `idx_question_view_count` ON (view_count DESC)
- `idx_question_create_time` ON (create_time DESC)

### QuestionTag（中间表）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| question_id | bigint | FK → question.id | 关联题目 |
| tag_id | bigint | FK → tag.id | 关联标签 |

联合主键：PRIMARY KEY (question_id, tag_id)
索引：`idx_question_tag_tag` ON (tag_id)

## 代码注释规范

### 类注释
每个类必须包含 Javadoc 类注释，说明类的职责：
```java
/**
 * 题目 Service，处理题目的分页查询、详情查看、缓存等业务逻辑。
 *
 * @author chongan
 */
public class QuestionService { ... }
```

### 方法注释
所有 public 方法必须包含 Javadoc，说明参数和返回值：
```java
/**
 * 分页查询题目（含搜索和筛选）。
 *
 * @param categoryId 分类 ID，可选
 * @param difficulty 难度，可选
 * @param keyword    搜索关键词，可选
 * @param tagId      标签 ID，可选
 * @param page       页码，从 0 开始
 * @param size       每页条数
 * @return 分页结果
 */
public Page<Question> search(...) { ... }
```

### 字段注释
Entity 字段必须有注释说明业务含义（MyBatis-Plus @TableField 注释优先）。

## 日志打印规范

| 级别 | 使用场景 | 示例 |
|------|----------|------|
| INFO | 业务流程关键节点 | 缓存命中、查询结果条数、定时任务执行 |
| WARN | 异常情况但可自动恢复 | 参数校验失败、缓存未命中回查 DB |
| ERROR | 需人工介入的异常 | 数据库异常、未知异常（含异常堆栈） |

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/categories | 获取所有分类 |
| GET | /api/categories/{id} | 分类详情 |
| GET | /api/questions | 分页查询，支持 category/difficulty/tag/keyword 参数（含搜索） |
| GET | /api/questions/{id} | 题目详情 |
| GET | /api/questions/hot | 热门题目排行（Redis 缓存） |
| GET | /api/tags | 获取所有标签 |

## 前端路由 & 组件树

```
/                  → Home (热门题库 + 排行榜 + 统计)
/banks             → QuestionBank (所有题库列表)
/bank/:id          → QuestionList (分类下题目列表 + 筛选)
/question/:id      → QuestionDetail (题目内容 + 折叠答案)
/search?q=xxx      → SearchResult (搜索结果)

App
├── Layout (响应式壳)
│   ├── Header (logo + 搜索 + 主题切换)
│   ├── SideMenu / BottomTab (自适应)
│   └── Content
├── pages/
│   ├── Home
│   │   ├── CategoryGrid
│   │   ├── HotQuestions
│   │   └── StatsCard
│   ├── QuestionBank (分类侧边栏 + 列表)
│   └── QuestionDetail
│       ├── QuestionContent (react-markdown)
│       ├── AnswerCollapse (折叠展开答案)
│       └── ActionBar
```

## 响应式策略

| 断点 | 布局 |
|------|------|
| < 768px | 单列 + 底部 Tab 导航 |
| 768-1200px | 两列 + 可折叠侧边栏 |
| > 1200px | 三栏/侧边栏+内容区 |

## 体验改进方向

- Ant Design 5 专业设计语言
- 浅色/深色双主题
- 折叠展开式刷题体验（适配长答案）
- Markdown + 代码高亮 + 一键复制
- 移动优先的完全响应式设计
- 实时搜索 + 多维度标签筛选
- 页面级懒加载 + 虚拟滚动

## 非功能需求

- 列表分页（默认 20 条/页）
- 前端路由懒加载
- Redis 缓存热门数据（Spring Cache）
- view_count 定时批量写入（防热点写）
- prerender 预渲染首页 + 题库列表页（SEO）
- Nginx try_files 处理 SPA 路由
- 全局 CORS 配置
- 数据初始化：SQL seed 脚本（50-100 道 Java 面试题）
- 响应式适配桌面/平板/手机
- JDK 21 Virtual Threads 全局开启
- 日志分级：INFO / WARN / ERROR

## 不在 MVP 范围内

- 用户系统 / 注册登录
- 答题记录 / 收藏
- 管理后台
- ES / Meilisearch 全文搜索引擎
- 用户排行榜
- 会员体系
- 自动化测试
