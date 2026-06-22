# AGENTS.md — lcb-interview

本文件对整个仓库生效。开始任何任务前先阅读本文件；如果子目录存在更近层级的 `AGENTS.md`，同时遵循更近层级文件。

LCB Interview 是 Java 面试题库与备考训练系统，后端使用 Spring Boot 3 + MyBatis-Plus + JDK 21，前端使用 React 18 + Vite + Ant Design 5。项目核心能力包括题库浏览、题目搜索、结构化答案展示、学习计划、模拟练习、后台质检和 AI 批量补答案。

## 工作原则

- 先看当前代码与配置，再改文档或实现；事实优先级为：当前代码 > `README.md` > `docs/superpowers/` 历史设计文档。
- 工作区可能存在用户未提交改动。编辑前用 `git status --short` 确认范围，不回滚、不覆盖与当前任务无关的改动。
- 修改文件使用 UTF-8。已有中文文档保持中文，不把中文改成乱码或拼音。
- Git 提交信息使用中文描述，说明本次变更的业务目的或技术意图。
- 代码中的新增注释使用中文；复杂算法、关键分支、降级策略和性能相关逻辑必须说明为什么这样做。
- 不为自解释代码堆砌机械注释，避免“给变量赋值”这类无信息量描述。
- 不提交新的真实密钥、Token、Cookie 或个人环境配置；生产环境敏感配置必须通过环境变量覆盖。

## 项目结构

```text
lcb-interview/
├── backend/
│   ├── pom.xml
│   ├── scripts/
│   │   ├── fetch-questions.js          # 从 mianshiya.com 抓取题目
│   │   ├── ai-generate-answers.js      # AI 生成答案 SQL
│   │   ├── ai-answer-guide.md          # AI 答案生成说明
│   │   ├── data/                       # 各分类抓取结果
│   │   └── sql/init.sql                # 建表 + 初始题库数据
│   └── src/
│       ├── main/java/com/lcbinterview/
│       │   ├── common/                 # ApiResponse、BusinessException、GlobalExceptionHandler
│       │   ├── config/                 # CORS、缓存、MyBatis-Plus、Swagger
│       │   ├── controller/             # 公开 API 与面试训练接口
│       │   ├── controller/admin/       # 管理后台接口
│       │   ├── dto/                    # Query/VO/PageResult records
│       │   ├── mapper/                 # MyBatis-Plus Mapper
│       │   ├── model/                  # Entity
│       │   └── service/                # 业务逻辑、缓存、AI、质检、浏览量批量写入
│       └── test/java/com/lcbinterview/ # 后端单元测试
├── frontend/
│   ├── package.json
│   ├── vite.config.ts                  # Vite 端口与 /api 代理
│   ├── nginx.conf                      # SPA 与 API 反向代理配置
│   └── src/
│       ├── api/                        # Axios 实例与 API 封装
│       ├── build/manualChunks.ts       # 前端构建分包策略
│       ├── components/                 # 学习、练习、复盘、后台通用组件
│       ├── pages/                      # 首页、题库、练习、路线、后台等页面
│       ├── styles/                     # 全局样式与 Ant Design 主题
│       ├── types.ts                    # 前端领域类型
│       └── utils/                      # 学习进度、评分、导出、训练策略算法
└── docs/superpowers/                   # 设计文档和实现计划
```

## 开发命令

| 位置 | 命令 | 说明 |
|------|------|------|
| `backend/` | `mvn spring-boot:run` | 启动后端 (localhost:8080) |
| `backend/` | `mvn test` | 运行后端 JUnit 测试 |
| `backend/` | `mvn package` | 打包后端可执行 jar |
| `frontend/` | `npm install` | 安装前端依赖 |
| `frontend/` | `npm run dev` | 启动前端 (localhost:3000) |
| `frontend/` | `npm run test` | 运行前端 Vitest 测试 |
| `frontend/` | `npm run build` | TypeScript 检查并构建前端 |
| `frontend/` | `npm run preview` | 本地预览构建产物 |

开发环境默认需要 MySQL 8 和 Redis。后端默认读取环境变量，未设置时使用 `backend/src/main/resources/application.yml` 中的开发默认值：

| 变量 | 说明 |
|------|------|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | MySQL 连接配置 |
| `REDIS_HOST` / `REDIS_PORT` | Redis 连接配置 |
| `ADMIN_TOKEN` | 管理后台 Token |
| `AI_INTERVIEW_ENABLED` / `AI_INTERVIEW_TIMEOUT_MS` | AI 面试评分开关与超时 |
| `AI_OPENCODE_API_KEY` / `AI_DEEPSEEK_MODEL` / `AI_DEEPSEEK_URL` | OpenAI 兼容 AI 服务配置 |

## 后端 Java 规范

### JDK 21 特性使用

| 特性 | 使用位置 |
|------|----------|
| **Record** | DTO/VO 优先用 `record`（如 `ApiResponse`, `QuestionVO`, `PageResult`, `QuestionQuery`） |
| **Text Block** | Mapper 或复杂 SQL 用 `"""..."""` |
| **Virtual Threads** | `spring.threads.virtual.enabled: true` 全局开启 |
| **SequencedCollection** | 明确需要有序集合语义时用 `SequencedSet` / `SequencedCollection` |
| **Stream.toList()** | 替代 `.collect(Collectors.toList())`，注意返回不可变 List |

### 分层约定

- **Entity** (`model/`): MyBatis-Plus 注解（`@TableName`, `@TableId`, `@TableField`, `@TableLogic`），字段必须加业务注释。
- **Mapper** (`mapper/`): 继承 `BaseMapper<T>`；复杂查询用 `@Select` + Text Block SQL。
- **Service** (`service/`): 查询方法标记 `@Transactional(readOnly = true)`；使用 `LambdaQueryWrapper` 动态拼接条件；避免 Controller 直接承载业务逻辑。
- **Controller** (`controller/`): 统一返回 `ResponseEntity<ApiResponse<T>>`，路径以 `/api/...` 开头；使用 `@Tag` 和 `@Operation` 维护 Swagger 说明。
- **DTO** (`dto/`): 与 Entity 分离；查询参数、VO、分页结果优先使用 `record`；`QuestionVO` 保留 `from()` 工厂方法。
- **后台接口** (`controller/admin/`): 路径以 `/api/admin/...` 开头，保持 Token 校验、草稿审核、质量总览和 AI 生成职责清晰。

### 代码风格

- **强制大括号**：`if` / `else` / `for` / `while` 即使只有一行也必须使用 `{}`，禁止单行无括号写法。
  - 正确：`if (page == null) { page = 0; }`
  - 错误：`if (page == null) page = 0;`
- 类、方法、字段命名沿用现有 Java 风格；不要引入与 Spring/MyBatis-Plus 惯例冲突的抽象。
- 不做与当前任务无关的大规模重构。

### 注释规范

- **类注释**：每个类必须有 Javadoc，说明类职责和设计意图。
- **方法注释**：所有 public 方法必须有 Javadoc，说明功能、参数含义和返回值。
- **字段注释**：Entity 字段必须有业务含义注释（例如 `/** 关联分类 ID */`）。
- **核心逻辑注释**：关键算法、复杂分支、降级策略、性能敏感代码内联中文注释说明 why 而非 what。

```java
/**
 * 题目 Service，处理题目的分页查询、详情查看、缓存等业务逻辑。
 */
public class QuestionService { ... }

/**
 * 分页查询题目（含搜索和筛选）。
 *
 * @param category 分类 ID，可选
 * @param difficulty 难度，可选
 * @param keyword 搜索关键词，可选
 * @param tag 标签 ID，可选
 * @param page 页码，从 0 开始
 * @param size 每页条数
 * @return 分页结果
 */
public PageResult<QuestionVO> searchVo(...) { ... }

// 标签筛选走自定义 JOIN SQL，不走通用 LambdaQueryWrapper，避免分页统计和标签关联条件不一致。
if (tag != null) { ... }
```

### 异常、日志和缓存

- 业务异常：`BusinessException(code, message)` 由 `GlobalExceptionHandler` 统一捕获。
- 参数校验：`MethodArgumentNotValidException` 自动解析为 400 错误详情。
- 未知异常：统一返回 500，日志打印完整堆栈（`log.error`）。
- INFO：业务流程关键节点（查询结果条数、缓存命中/未命中）。
- WARN：可自动恢复的异常（参数校验失败、缓存未命中回查 DB、业务异常）。
- ERROR：需人工介入的异常（数据库异常、未知异常含堆栈）。
- Spring Cache + Redis 默认 TTL 10 分钟；分类列表和热门题目可缓存，写操作需要主动失效相关缓存。

### 数据库和性能

- 不使用物理外键：关联字段（`category_id`, `question_id`, `tag_id`）加普通索引即可，外键约束交由应用层保证。
- MyBatis-Plus 逻辑删除：`is_deleted` (0=正常, 1=删除)，所有查询自动追加 `is_deleted = 0`。
- 通用字段：`id`, `create_time`, `update_time`, `is_deleted`；下划线命名，开启 `map-underscore-to-camel-case: true`。
- `view_count` 用 `ViewCountService` 内存累积 + 5 分钟定时批量写入，避免高并发热点行锁。
- 索引设计关注 `category_id`、`difficulty`、`view_count DESC`、`create_time DESC`、`question_tag.tag_id`。
- 分页默认 20 条，列表接口必须强制分页，禁止无 limit 查询。
- Entity 间不设 `@ManyToMany` / `@OneToMany`，关联数据由 Service 层按需组装，避免 N+1。

### AI 与 SSE

- AI 生成相关入口在 `/api/admin/ai/...`，实时输出使用 `SseEmitter`。
- 批量生成、补答案、质量审核必须走现有策略类（如 `AiGenerationRequestPolicy`, `AiAnswerQualityPolicy`），不要绕过数量限制和质量门槛。
- 远程 AI 评分不可用时，面试训练应保留本地规则评分或可解释降级路径。
- SSE 事件需要明确 `thinking`、`content`、`progress`、`question_result`、`done`、`error` 等语义，前后端事件名保持一致。

### 后端 API 响应格式

```json
{"code": 200, "message": "success", "data": ...}
```

公开接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/categories` | 获取全部分类 |
| `GET` | `/api/categories/{id}` | 获取分类详情 |
| `GET` | `/api/tags` | 获取全部标签 |
| `GET` | `/api/questions` | 分页查询题目，支持 `category`、`difficulty`、`tag`、`keyword`、`page`、`size` |
| `GET` | `/api/questions/{id}` | 获取题目详情 |
| `GET` | `/api/questions/hot` | 热门题目排行 |
| `POST` | `/api/interview/evaluate` | 生成面试训练评分 |

管理后台接口：

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/verify` | 校验管理员 Token |
| `GET` | `/api/admin/dashboard/quality-summary` | 查询题库质量总览 |
| `GET` | `/api/admin/questions/draft` | 分页查询草稿题目 |
| `GET` | `/api/admin/questions/draft/{id}` | 查询草稿详情 |
| `PUT` | `/api/admin/questions/draft/{id}` | 更新草稿内容 |
| `POST` | `/api/admin/questions/draft/{id}/approve` | 发布单个草稿 |
| `POST` | `/api/admin/questions/draft/{id}/reject` | 拒绝单个草稿 |
| `POST` | `/api/admin/questions/draft/batch-approve` | 批量发布草稿 |
| `POST` | `/api/admin/questions/draft/batch-reject` | 批量拒绝草稿 |
| `GET` | `/api/admin/ai/generate-stream` | SSE 方式生成题目答案 |
| `GET` | `/api/admin/ai/fill-answer-stream` | SSE 方式补齐答案字段 |
| `POST` | `/api/admin/ai/batch` | 启动批量生成任务 |
| `GET` | `/api/admin/ai/batch/status` | 查询批量生成进度 |

## 前端规范

- Vite 代理 `/api` 到 `http://localhost:8080`，代理配置在 `frontend/vite.config.ts`。
- Axios 实例统一放在 `src/api/`，继续使用统一拦截规则处理 `res.data.code !== 200`。
- Ant Design 5 主题配置在 `src/styles/theme.ts`；新增页面和组件优先使用现有布局、主题和组件模式。
- Markdown 渲染使用 `react-markdown` + `rehype-highlight` + `remark-gfm`；编辑场景使用 `@uiw/react-md-editor`。
- 构建分包策略在 `src/build/manualChunks.ts`，新增重量级依赖时同步评估分包影响。
- 测试使用 Vitest + Testing Library；新增纯逻辑放入 `src/utils/` 时配套 `*.test.ts`。
- 浏览器状态、学习进度、练习记录等前端领域类型统一维护在 `src/types.ts`。

### 前端路由

| 路径 | 页面 |
|------|------|
| `/` | 首页 |
| `/banks` | 题库分类列表 |
| `/bank/:id` | 分类下题目列表 |
| `/question/:id` | 题目详情 |
| `/search` | 搜索结果 |
| `/routes` | 备考路线 |
| `/study` | 学习计划与进度中心 |
| `/practice` | 模拟练习 |
| `/experiences` | 面试经验与材料沉淀 |
| `/admin/login` | 管理后台登录 |
| `/admin/dashboard` | 题库质量总览 |
| `/admin/ai-generate` | AI 批量生成答案 |
| `/admin/draft-review` | 草稿题目审核 |

## Nginx 部署

- SPA 路由：`try_files $uri $uri/ /index.html`
- API 反向代理：`/api/` → `backend:8080`
- 静态资源：`/assets/` 缓存 1 年，使用 `Cache-Control: public, immutable`

## 题目数据工作流

### 1. 从 mianshiya.com 抓取题目

```bash
cd backend/scripts
node fetch-questions.js
```

输出：

- `data/{slug}.json`：每分类的题目数据（标题、难度、标签、来源 URL）。
- `sql/insert-draft.sql`：抓取过程的临时 DRAFT SQL 片段；正式初始化只保留并执行 `sql/init.sql`。

### 2. 初始化数据库（一站式）

```bash
# init.sql 包含: 建表 + 46个分类 + 71个标签 + 6386道DRAFT题目
mysql -u root -p lcb_interview < backend/scripts/sql/init.sql
```

### 3. AI 填充答案（中后台）

通过管理后台 `/admin/ai-generate` 使用 AI 补答案功能，或手动运行 `node ai-generate-answers.js` 生成 UPDATE SQL。

```bash
# 列出所有可用分类
node ai-generate-answers.js

# 处理单个分类
node ai-generate-answers.js java-basics

# 处理所有分类
node ai-generate-answers.js --all
```

输出文件：`backend/scripts/sql/ai-update-answers.sql`

### 4. 发布（可选）

```sql
UPDATE question SET status = 'PUBLISHED' WHERE status = 'DRAFT' AND source = 'AI_GENERATED';
```

后台草稿审核页也支持按题目或批量发布。

### 46 个分类

| 分类 | Slug | 抓取题目数 | 包含子题库 |
|------|------|-----------|-----------|
| Java 基础 | java-basics | 237 | Java面试题/面试鸭Java后端/手写代码 |
| Java 集合 | java-collections | 26 | |
| Java 并发 | java-concurrency | 63 | |
| JVM | jvm | 46 | |
| MySQL | mysql | 82 | |
| Redis | redis | 53 | |
| MongoDB | mongodb | 72 | |
| Spring | spring | 71 | |
| SpringBoot | spring-boot | 26 | |
| SpringCloud | spring-cloud | 55 | |
| MyBatis | mybatis | 17 | |
| Netty | netty | 13 | |
| 计算机网络 | computer-network | 161 | 网络配置/协议/安全/故障排查/网络工程师 |
| 操作系统 | os | 24 | |
| 算法与数据结构 | algorithm-data-structure | 242 | 数据结构、大厂算法真题 |
| 设计模式 | design-patterns | 36 | |
| 消息队列 | message-queue | 31 | |
| RabbitMQ | rabbitmq | 33 | |
| Kafka | kafka | 59 | |
| Nginx | nginx | 115 | 原理/配置/应用 |
| Docker 与 K8s | docker-k8s | 53 | Docker + Kubernetes |
| Git | git | 183 | 基础/进阶/操作/概念/协作 |
| Linux | linux | 44 | |
| 后端系统设计 | system-design | 181 | 分布式系统/微服务/Zookeeper |
| 后端场景题 | backend-scenario | 291 | SQL电商/网站场景/后端经典合集 |
| Dubbo | dubbo | 66 | 原理/配置/性能优化 |
| Elasticsearch | elasticsearch | 177 | 原理/集群/配置/应用/评分/优化 |
| DevOps | devops | 150 | |
| HR 面试 | hr | 55 | |
| Go | go | 231 | 基础/标准库/并发/GC/代码分析 |
| Python | python | 126 | 基础/代码分析/手写代码 |
| C++ | c-plus-plus | 113 | 基础/进阶/新特性/STL/并发 |
| C# | c-sharp | 696 | .NET/框架/并发/集合/底层/WPF |
| PHP | php | 151 | 基础/OOP/框架/应用场景 |
| JavaScript | javascript | 293 | 基础/进阶/ES6 |
| TypeScript | typescript | 43 | |
| Vue | vue | 304 | 基础/进阶/Router/状态管理/Vue3 |
| React | react | 365 | 基础/进阶/Router/状态管理/React Native |
| 前端手写代码 | frontend-handwrite | 54 | |
| 前端代码分析 | frontend-code-analysis | 62 | |
| 前端工程化 | frontend-engineering | 347 | HTML/CSS/场景/系统设计/Webpack/优化 |
| AI 大模型 | ai-llm | 345 | RAG/Agent/LangChain/Prompt/微调 |
| AI 项目实战 | ai-project | 363 | 智能体/应用平台/评测/部署 |
| 系统运维 | system-ops | 101 | |
| IT 运维 | it-ops | 101 | |
| OpenClaw | openclaw | 29 | |
| **合计** | | **6386** | 含所有子题库，已去重 |
