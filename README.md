# LCB Interview - Java 面试题库网站

LCB Interview 是一个前后端分离的面试题库与备考训练系统。项目以 Java 后端面试为核心，同时覆盖前端、运维、AI 大模型等方向，提供题库浏览、搜索筛选、Markdown 答案展示、学习计划、模拟问答、后台质检、AI 批量补答案和个人工具能力。

## 核心能力

- **公开题库**：内置 46 个分类、71 个标签、6386 道题目数据，支持分类、难度、标签和关键词筛选。
- **题目详情**：支持摘要、原理、对比、场景、风险、项目经验、代码示例和图示等结构化答案字段。
- **学习计划**：提供备考路线、每日任务、复习进度、能力地图、健康雷达和下一步训练队列。
- **模拟训练**：支持按题目进行回答练习、面试评分、追问训练、反馈闭环和复盘材料沉淀。
- **个人工具**：支持普通用户注册登录、读书摘录管理与 Markdown 导出、福彩快乐8选5历史开奖同步和 AI 深度统计推荐参考。
- **管理后台**：支持管理员 Token 校验、题库质量总览、草稿审核、批量发布/拒绝和 AI 生成答案。
- **工程化支持**：Spring Boot 3 + JDK 21 后端、React 18 + Vite 前端、Vitest/JUnit 测试、Nginx SPA 部署配置。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端语言 | JDK 21、Virtual Threads、Record、Text Block |
| 后端框架 | Spring Boot 3.2、MyBatis-Plus 3.5、Spring Validation、Spring Cache |
| 数据存储 | MySQL 8、Redis |
| API 文档 | SpringDoc OpenAPI，Swagger UI |
| 前端框架 | React 18、TypeScript、Vite 5、React Router 6 |
| UI 与内容 | Ant Design 5、@ant-design/icons、react-markdown、rehype-highlight、remark-gfm、@uiw/react-md-editor |
| 请求与测试 | Axios、Vitest、Testing Library、JUnit 5 |
| 部署 | 后端可执行 jar、前端静态资源 + Nginx 反向代理 |

## 项目结构

```text
lcb-interview/
├── backend/
│   ├── pom.xml
│   ├── scripts/
│   │   └── sql/init.sql                # 建表 + 初始题库数据
│   └── src/
│       ├── main/java/com/lcbinterview/
│       │   ├── common/                 # 统一响应、业务异常、全局异常处理
│       │   ├── config/                 # CORS、缓存、MyBatis-Plus、Swagger
│       │   ├── controller/             # 公开 API 与面试训练接口
│       │   ├── controller/admin/       # 管理后台接口
│       │   ├── controller/tools/       # 个人工具接口
│       │   ├── dto/                    # Query/VO/PageResult records
│       │   ├── mapper/                 # MyBatis-Plus Mapper
│       │   ├── model/                  # Entity
│       │   └── service/                # 业务逻辑、缓存、AI、质检、个人工具、浏览量批量写入
│       └── test/java/com/lcbinterview/ # 后端单元测试
├── frontend/
│   ├── package.json
│   ├── vite.config.ts                  # Vite 端口与 /api 代理
│   ├── nginx.conf                      # SPA 与 API 反向代理配置
│   └── src/
│       ├── api/                        # Axios 实例与 API 封装
│       ├── build/manualChunks.ts       # 前端构建分包策略
│       ├── components/                 # 学习、练习、复盘、后台通用组件
│       ├── pages/                      # 首页、题库、练习、路线、工具、后台等页面
│       ├── styles/                     # 全局样式与 Ant Design 主题
│       ├── types.ts                    # 前端领域类型
│       └── utils/                      # 学习进度、评分、导出、训练策略算法
├── docs/superpowers/
│   ├── specs/                          # 设计文档
│   └── plans/                          # 实现计划
├── AGENTS.md                           # 项目协作与代码规范
└── README.md
```

## 环境要求

- JDK 21
- Maven 3.9+
- Node.js 18+ 与 npm
- MySQL 8+
- Redis 6+

后端默认读取环境变量，未设置时使用 `application.yml` 中的开发默认值。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/lcb_interview?...` | MySQL 连接地址 |
| `DB_USERNAME` | `root` | MySQL 用户名 |
| `DB_PASSWORD` | `123456` | MySQL 密码 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `ADMIN_TOKEN` | `dev-admin-token-change-me` | 管理后台访问 Token |
| `APP_AUTH_SECRET` | `dev-user-auth-secret-change-me` | 普通用户登录令牌签名密钥 |
| `APP_AUTH_TOKEN_TTL_HOURS` | `168` | 普通用户登录令牌有效期，单位小时 |
| `AI_INTERVIEW_ENABLED` | `true` | 是否启用远程 AI 面试评分 |
| `AI_INTERVIEW_TIMEOUT_MS` | `8000` | AI 面试评分超时时间 |
| `AI_OPENCODE_API_KEY` | 空 | AI 服务 API Key；不配置时远程 AI 能力不可用 |
| `AI_DEEPSEEK_MODEL` | `glm-5.2` | AI 模型名 |
| `AI_DEEPSEEK_URL` | OpenAI 兼容接口地址 | AI 服务地址 |

生产环境必须通过环境变量覆盖 `ADMIN_TOKEN`、`APP_AUTH_SECRET` 和 `AI_OPENCODE_API_KEY`；AI Key 不提供源码默认值。

## 快速启动

### 1. 初始化数据库

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS lcb_interview DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p lcb_interview < backend/scripts/sql/init.sql
```

`init.sql` 会重建 `category`、`tag`、`question`、`question_tag`、`app_user`、`reading_excerpt`、`lottery_kl8_draw`、`lottery_kl8_recommendation` 等核心表，并导入 46 个分类、71 个标签和 6386 道 DRAFT 题目。

### 2. 启动 Redis

```bash
redis-server
```

项目使用 Spring Cache + Redis 缓存分类列表和热门题目。开发环境如使用 Docker，也可以自行启动 Redis 容器并保持 `REDIS_HOST`、`REDIS_PORT` 与后端配置一致。

### 3. 启动后端

```bash
cd backend
mvn spring-boot:run
```

- 后端地址：`http://localhost:8080`
- Swagger UI：`http://localhost:8080/swagger-ui.html`
- OpenAPI JSON：`http://localhost:8080/api-docs`

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端地址：`http://localhost:3000`。Vite 已配置 `/api` 代理到 `http://localhost:8080`。

## 常用命令

| 位置 | 命令 | 说明 |
|---|---|---|
| `backend/` | `mvn spring-boot:run` | 启动后端 |
| `backend/` | `mvn test` | 运行后端测试 |
| `backend/` | `mvn package` | 打包可执行 jar |
| `frontend/` | `npm install` | 安装前端依赖 |
| `frontend/` | `npm run dev` | 启动 Vite 开发服务 |
| `frontend/` | `npm run test` | 运行 Vitest 测试 |
| `frontend/` | `npm run build` | 类型检查并构建前端 |
| `frontend/` | `npm run preview` | 本地预览构建产物 |

## 前端路由

| 路径 | 页面 |
|---|---|
| `/` | 首页，展示分类入口与热门题目 |
| `/banks` | 题库分类列表 |
| `/bank/:id` | 分类下题目列表 |
| `/question/:id` | 题目详情、答案阅读、练习入口 |
| `/search` | 搜索结果页 |
| `/routes` | 备考路线 |
| `/study` | 学习计划与进度中心 |
| `/practice` | 模拟问答与反馈闭环 |
| `/experiences` | 面试经验与材料沉淀 |
| `/tools` | 个人工具，包含读书摘录和快乐8选5推荐 |
| `/auth/login` | 普通用户登录 |
| `/auth/register` | 普通用户注册 |
| `/admin/login` | 管理后台登录 |
| `/admin/dashboard` | 题库质量总览 |
| `/admin/ai-generate` | AI 批量生成答案 |
| `/admin/draft-review` | 草稿题目审核 |

## API 概览

统一响应格式：

```json
{"code": 200, "message": "success", "data": {}}
```

### 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/categories` | 获取全部分类 |
| `GET` | `/api/categories/{id}` | 获取分类详情 |
| `GET` | `/api/tags` | 获取全部标签 |
| `GET` | `/api/questions` | 分页查询题目，支持 `category`、`difficulty`、`tag`、`keyword`、`page`、`size` |
| `GET` | `/api/questions/{id}` | 获取题目详情并记录浏览量 |
| `GET` | `/api/questions/hot` | 获取热门题目排行 |
| `POST` | `/api/interview/evaluate` | 生成面试训练评分 |

### 普通用户与工具接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/auth/register` | 注册普通用户 |
| `POST` | `/api/auth/login` | 普通用户登录 |
| `GET` | `/api/auth/me` | 查询当前普通用户 |
| `GET` | `/api/tools/reading/excerpts` | 分页查询当前用户书摘，支持书名、作者、标签和关键词筛选 |
| `POST` | `/api/tools/reading/excerpts` | 新增书摘 |
| `PUT` | `/api/tools/reading/excerpts/{id}` | 更新书摘 |
| `DELETE` | `/api/tools/reading/excerpts/{id}` | 删除书摘 |
| `GET` | `/api/tools/reading/excerpts/export` | 导出当前筛选结果为 Markdown |
| `POST` | `/api/tools/lottery/kl8/sync` | 手动同步福彩快乐8开奖数据 |
| `GET` | `/api/tools/lottery/kl8/sync-status` | 查询开奖同步状态 |
| `GET` | `/api/tools/lottery/kl8/draws` | 分页查询近期开奖 |
| `POST` | `/api/tools/lottery/kl8/recommendations` | 生成快乐8选5深度推荐，每次返回 1 组、每组 5 个号码，并附带分析和候选池 |
| `GET` | `/api/tools/lottery/kl8/recommendations` | 查询当前用户推荐历史 |

快乐8推荐使用纯 Java 规则引擎分析历史开奖数据；后端会先构造号码画像、候选池、遗漏趋势、区间尾数、上一期左右邻位、连号结构和滚动回测结果，再输出 1 组号码和深度分析。同步新开奖或生成新推荐时，系统会自动把历史推荐按下一期开奖结算命中结果，并用最近已结算表现动态校准热号、冷号、高遗漏、趋势和均衡信号权重。推荐内容仅作为娱乐和统计参考，不承诺命中率，也不构成投注建议。

### 管理后台接口

| 方法 | 路径 | 说明 |
|---|---|---|
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

## 题目数据工作流

### 初始化数据库

```bash
mysql -u root -p lcb_interview < backend/scripts/sql/init.sql
```

`init.sql` 包含建表 + 46 个分类 + 71 个标签 + 6386 道 DRAFT 题目。初始数据仅整理题目标题、分类和标签，答案字段通过站内自研流程补齐。

### AI 填充答案

通过管理后台 `/admin/ai-generate` 使用 SSE 实时进度补齐答案字段（`/api/admin/ai/fill-answer-stream`、`/api/admin/ai/batch`）。早期依赖 `backend/scripts` 下 Node 脚本的离线生成方式已移除，统一走后端 AI 服务。

### 发布题目

```sql
UPDATE question
SET status = 'PUBLISHED'
WHERE status = 'DRAFT'
  AND source = 'AI_GENERATED';
```

后台草稿审核页也支持按题目或批量发布。

## 测试

当前项目包含后端 JUnit 测试和前端 Vitest 测试。

```bash
cd backend
mvn test
```

```bash
cd frontend
npm run test
```

前端构建会先运行 TypeScript 类型检查：

```bash
cd frontend
npm run build
```

## 部署

### 后端 jar

```bash
cd backend
mvn clean package
java -jar target/lcb-interview-0.0.1-SNAPSHOT.jar
```

部署时建议显式传入环境变量：

```bash
DB_URL="jdbc:mysql://mysql:3306/lcb_interview?useUnicode=true&characterEncoding=utf-8" \
DB_USERNAME="lcb" \
DB_PASSWORD="change-me" \
REDIS_HOST="redis" \
ADMIN_TOKEN="change-me" \
APP_AUTH_SECRET="change-me-with-at-least-32-random-chars" \
AI_OPENCODE_API_KEY="change-me" \
java -jar target/lcb-interview-0.0.1-SNAPSHOT.jar
```

### 前端 Nginx

```bash
cd frontend
npm run build
```

将 `frontend/dist` 部署到 Nginx 静态目录，并参考 `frontend/nginx.conf` 配置：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}

location /api/ {
    proxy_pass http://backend:8080;
}

location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 开发约定

- 后端 Controller 统一返回 `ResponseEntity<ApiResponse<T>>`，路径以 `/api/...` 开头。
- DTO/VO 使用 JDK 21 `record`，与 Entity 分离。
- 查询方法标记 `@Transactional(readOnly = true)`，分页接口必须限制 `page` 和 `size`。
- Entity 字段保留业务注释，所有 public 方法保留 Javadoc。
- `if` / `else` / `for` / `while` 即使只有一行也必须使用大括号。
- 新增注释使用中文，只解释关键分支、降级策略、复杂算法和性能相关原因。
- Git 提交信息使用中文，说明业务目的或技术意图。

更多协作和代码规范见 `AGENTS.md`。

## 常见问题

### 后端启动时数据库连接失败

检查 MySQL 是否启动，数据库名、用户名和密码是否与 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 一致。开发默认密码是 `123456`，本地不一致时请通过环境变量覆盖。

### 热门题目或分类缓存异常

检查 Redis 是否启动，以及 `REDIS_HOST`、`REDIS_PORT` 是否指向正确实例。

### 前端请求 404 或跨域

开发环境请确认后端运行在 `8080`，前端通过 Vite `/api` 代理访问。生产环境请确认 Nginx 的 `/api/` 反向代理指向后端服务。

### 管理后台无法进入

访问 `/admin/login`，输入与后端 `ADMIN_TOKEN` 一致的 Token。生产环境请务必使用强 Token。

### 个人工具无法进入

访问 `/auth/register` 注册普通用户，或访问 `/auth/login` 登录。生产环境请务必使用强 `APP_AUTH_SECRET`，避免普通用户令牌可被伪造。

### AI 评分或生成失败

检查 `AI_INTERVIEW_ENABLED`、`AI_OPENCODE_API_KEY`、`AI_DEEPSEEK_MODEL`、`AI_DEEPSEEK_URL` 和网络连通性。远程 AI 不可用时，面试评分逻辑会尽量回退到本地规则评分。

### 快乐8推荐无法生成

先在 `/tools` 中点击同步开奖数据；历史数据不足或公开开奖源不可访问时，推荐接口会提示先同步更多数据。AI 配置缺失时会使用基于深度候选池的规则推荐降级。
