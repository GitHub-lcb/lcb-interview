# AGENTS.md — lcb-interview

Java 面试题库网站（Spring Boot 3 + MyBatis-Plus + React 18 + Ant Design 5）。

## 项目结构

```
lcb-interview/
├── backend/              # Spring Boot 3 (Maven, JDK 21)
│   └── src/main/java/com/lcbinterview/
│       ├── common/       # ApiResponse, BusinessException, GlobalExceptionHandler
│       ├── config/       # CorsConfig, CacheConfig, MyBatisPlusConfig, SwaggerConfig
│       ├── model/        # MyBatis-Plus Entity（Category, Tag, Question）
│       ├── mapper/       # BaseMapper 接口（CategoryMapper, TagMapper, QuestionMapper）
│       ├── service/      # Service 层（CategoryService, QuestionService, ViewCountService）
│       ├── controller/   # REST 控制器
│       └── dto/          # Query/VO records（QuestionQuery, QuestionVO, PageResult）
├── frontend/             # React 18 + Vite + Ant Design 5
└── docs/superpowers/     # 设计文档和实现计划
```

## 开发命令

| 位置 | 命令 | 说明 |
|------|------|------|
| `backend/` | `mvn spring-boot:run` | 启动后端 (localhost:8080) |
| `frontend/` | `npm run dev` | 启动前端 (localhost:3000) |

## 后端 Java 规范

### JDK 21 特性使用

| 特性 | 使用位置 |
|------|----------|
| **Record** | 所有 DTO/VO 均用 `record`（`ApiResponse`, `QuestionVO`, `PageResult`, `QuestionQuery`） |
| **Text Block** | Mapper 中复杂 SQL 用 `"""..."""` |
| **Virtual Threads** | `spring.threads.virtual.enabled: true` 全局开启 |
| **SequencedCollection** | 有序集合用 `SequencedSet` / `SequencedCollection` |
| **Stream.toList()** | 替代 `.collect(Collectors.toList())`，返回不可变 List |

### 分层约定

- **Entity** (`model/`): MyBatis-Plus 注解（`@TableName`, `@TableId`, `@TableField`, `@TableLogic`），字段必须加业务注释
- **Mapper** (`mapper/`): 继承 `BaseMapper<T>`，复杂查询用 `@Select` + Text Block SQL
- **Service** (`service/`): 查询方法标记 `@Transactional(readOnly=true)`，使用 `LambdaQueryWrapper` 动态拼接条件
- **Controller** (`controller/`): 统一返回 `ResponseEntity<ApiResponse<T>>`，路径 `/api/...`
- **DTO** (`dto/`): 使用 `record`，与 Entity 分离。`QuestionQuery` 用 `@Builder`，`QuestionVO` 含 `from()` 工厂方法

### 注释规范

- **类注释**：每个类必须有 Javadoc，说明类职责和设计意图（如 `题目 Service，处理题目的分页查询、详情查看、缓存等业务逻辑`）
- **方法注释**：所有 public 方法必须有 Javadoc，说明功能、参数含义和返回值
- **字段注释**：Entity 字段必须有行尾注释说明业务含义（`/** 关联分类 ID */`）
- **核心逻辑注释**：关键算法、复杂分支、性能敏感代码内联中文注释说明 why 而非 what

```java
// 类注释
/**
 * 题目 Service，处理题目的分页查询、详情查看、缓存等业务逻辑。
 */
public class QuestionService { ... }

// 方法注释
/**
 * 分页查询题目（含搜索和筛选）。
 *
 * @param categoryId 分类 ID，可选
 * @param difficulty 难度，可选
 * @param keyword    搜索关键词，可选
 * @param page       页码，从 0 开始
 * @param size       每页条数
 * @return 分页结果
 */
public IPage<Question> search(...) { ... }

// 字段注释
/** 关联分类 ID */
@TableField("category_id")
private Long categoryId;

// 核心逻辑注释
// 标签筛选走自定义 JOIN SQL，不走通用 LambdaQueryWrapper
if (tagId != null) { ... }
```

### 异常处理

- 业务异常：`BusinessException(code, message)` 由 `GlobalExceptionHandler` 统一捕获
- 参数校验：`MethodArgumentNotValidException` 自动解析为 400 错误详情
- 未知异常：统一返回 500，日志打印完整堆栈（`log.error`）

### 日志级别

- INFO: 业务流程关键节点（查询结果条数、缓存命中/未命中）
- WARN: 可自动恢复的异常（参数校验失败、缓存未命中回查 DB、业务异常）
- ERROR: 需人工介入的异常（数据库异常、未知异常含堆栈）

### 缓存

- Spring Cache + Redis，默认 TTL 10 分钟（`CacheConfig` 中统一配置）
- `@Cacheable("categories")` / `@Cacheable("hotQuestions")` 标注缓存方法

### 数据库

- **不使用物理外键**：关联字段（`category_id`, `question_id`, `tag_id`）加普通索引即可，外键约束交由应用层保证，避免写入性能和死锁问题
- MyBatis-Plus 逻辑删除：`is_deleted` (0=正常, 1=删除)，所有查询自动追加 `is_deleted = 0`
- 通用字段：`id`, `create_time`, `update_time`, `is_deleted`（自动填充 `createTime`/`updateTime`）
- 下划线命名（`map-underscore-to-camel-case: true`）
- `view_count` 用 `ViewCountService` 内存累积 + 5 分钟定时批量写入（防热点行锁）

### 性能要点

- **索引设计**：`category_id`、`difficulty`、`view_count DESC`、`create_time DESC`、`question_tag.tag_id` 均加独立索引，满足高频查询排序
- **分页默认 20 条**，禁止无 limit 查询；所有列表接口强制分页
- **Virtual Threads** 全局开启，I/O 密集型请求不阻塞平台线程
- **懒加载**：Entity 间不设 `@ManyToMany` / `@OneToMany`，关联数据由 Service 层手动按需组装，避免 N+1
- **缓存**：分类列表和热门题目缓存 Redis 10 分钟；写操作主动失效缓存
- **批量写入**：`view_count` 内存 buffer 每 5 分钟 flush 一次，避免高并发热点行锁

### API 响应格式

```json
{"code": 200, "message": "success", "data": ...}
```

### Swagger

- SpringDoc OpenAPI，访问 `/swagger-ui.html`
- Controller 类用 `@Tag(name="分类管理")`，方法用 `@Operation(summary="...")`
- DTO 字段用 `@Schema(description="...")`

## 前端规范

- Vite 代理 `/api` → `http://localhost:8080`
- Axios 实例统一拦截 `res.data.code !== 200` 弹错误提示
- Ant Design 5 主题配置在 `src/styles/theme.ts`
- Markdown 渲染用 `react-markdown` + `rehype-highlight` + `remark-gfm`
- 路由：`/` 首页, `/banks` 题库列表, `/bank/:id` 分类下题目, `/question/:id` 题目详情, `/search` 搜索

## Nginx 部署

- SPA 路由：`try_files $uri $uri/ /index.html`
- API 反向代理 `/api/` → backend:8080
- 静态资源 `/assets/` 缓存 1 年
