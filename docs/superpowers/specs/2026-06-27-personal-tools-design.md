# 个人工具：书摘库与快乐8 AI 推荐设计

## 背景

LCB Interview 当前核心是面试题库、学习计划、模拟训练和材料沉淀。现有个性化能力多依赖浏览器本地状态，但本次功能要求后端保存、多用户隔离，并新增两个个人工具：

- 书摘库：摘录、标签、搜索、导出 Markdown。
- 福彩快乐8选5：抓取公开网页历史开奖数据，复用现有 AI 配置分析历史数据，每次推荐 5 组号码。

本设计按一期可落地范围推进，不重做现有管理后台，不改变题库主链路。

## 目标

1. 新增普通用户注册、登录和当前用户识别能力。
2. 新增 `/tools` 个人工具入口，登录后访问。
3. 书摘库支持按用户保存、搜索、筛选、编辑、删除和 Markdown 导出。
4. 快乐8模块支持后端同步公开网页开奖数据，保存历史期号。
5. 快乐8模块支持 AI 基于历史数据推荐下一期可能出现的 5 组“选5”号码。
6. AI 输出必须经过后端规则校验；AI 不可用或输出不合规时回退到规则推荐。
7. 前端显著展示风险提示：彩票结果随机，推荐仅为娱乐统计参考，不保证命中，不构成投注建议。

## 非目标

- 不实现充值、投注、资金、开奖推送或任何交易链路。
- 不承诺预测命中率，不展示“必中”“稳赚”等暗示性文案。
- 不新增 OAuth、短信验证码、找回密码、用户头像等完整用户中心能力。
- 不做复杂预测策略配置、模型微调或策略市场。
- 不把普通用户认证与现有管理员 Token 混用。

## 术语

- 普通用户：使用用户名和密码注册登录的个人工具用户。
- 管理员：现有后台 Token 用户，仅用于后台题库管理。
- 快乐8开奖：每期从 1 到 80 中开出 20 个号码。
- 选5推荐：每组 5 个号码，号码范围 1 到 80，组内不重复，一次返回 5 组。
- AI 推荐：复用现有 OpenAI 兼容配置生成的号码组合与推荐理由。
- 规则推荐：AI 不可用时由后端基于历史统计生成的降级组合。

## 架构

后端新增普通用户域和个人工具域。普通用户域负责注册、登录、令牌解析和用户上下文。个人工具域包含书摘服务、快乐8开奖同步服务、历史特征服务、AI 推荐服务、推荐策略校验和推荐历史服务。

前端新增 `/auth/login`、`/auth/register` 和 `/tools` 页面。`/tools` 使用标签页或分区呈现书摘库与快乐8选5，不干扰现有题库、学习计划、训练和管理后台。

### 后端模块

- `model/AppUser`：普通用户实体。
- `model/ReadingExcerpt`：书摘实体。
- `model/LotteryKl8Draw`：快乐8开奖实体。
- `model/LotteryKl8Recommendation`：快乐8推荐历史实体。
- `mapper/*Mapper`：MyBatis-Plus Mapper。
- `dto/auth/*`：注册、登录、当前用户 DTO。
- `dto/tools/*`：书摘、开奖、同步状态、推荐结果 DTO。
- `service/AppUserService`：用户注册、密码校验、登录令牌生成。
- `service/AuthTokenService`：令牌签发、解析和过期校验。
- `service/ReadingExcerptService`：书摘 CRUD、搜索和导出。
- `service/LotteryKl8SyncService`：公开网页抓取和入库。
- `service/LotteryKl8FeatureService`：历史开奖特征提取。
- `service/LotteryKl8AiRecommendationService`：调用现有 AI 配置生成推荐。
- `service/LotteryKl8RecommendationPolicy`：校验 AI 输出和规则降级。
- `service/LotteryKl8RecommendationService`：编排特征提取、AI 推荐、校验、保存历史。
- `controller/AuthController`：普通用户认证 API。
- `controller/tools/ReadingToolController`：书摘 API。
- `controller/tools/LotteryKl8Controller`：快乐8 API。
- `config/UserAuthInterceptor`：普通用户 API 访问拦截。

### 前端模块

- `src/api/auth.ts`：注册、登录、当前用户 API。
- `src/api/tools.ts`：书摘、开奖同步、推荐 API。
- `src/utils/authToken.ts`：普通用户令牌读写。
- `src/pages/Auth/Login.tsx`：普通用户登录页。
- `src/pages/Auth/Register.tsx`：普通用户注册页。
- `src/pages/Tools/index.tsx`：个人工具入口。
- `src/components/ReadingExcerptPanel.tsx`：书摘库面板。
- `src/components/LotteryKl8Panel.tsx`：快乐8选5面板。
- `src/types.ts`：新增认证、书摘、开奖和推荐类型。

## 数据模型

### `app_user`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint | 主键 |
| `username` | varchar(64) | 登录用户名，唯一 |
| `password_hash` | varchar(220) | PBKDF2 密码哈希 |
| `display_name` | varchar(64) | 展示昵称 |
| `status` | varchar(16) | `ACTIVE` 或 `DISABLED` |
| `create_time` | datetime | 创建时间 |
| `update_time` | datetime | 更新时间 |
| `is_deleted` | tinyint | 逻辑删除标记 |

索引：

- `uk_app_user_username(username)`
- `idx_app_user_status(status)`

### `reading_excerpt`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint | 主键 |
| `user_id` | bigint | 所属普通用户 |
| `book_title` | varchar(160) | 书名 |
| `author` | varchar(120) | 作者，可空 |
| `content` | text | 摘录正文 |
| `note` | text | 个人评论，可空 |
| `tags` | varchar(300) | 标签，逗号分隔 |
| `chapter` | varchar(120) | 章节，可空 |
| `page_no` | varchar(40) | 页码，可空 |
| `create_time` | datetime | 创建时间 |
| `update_time` | datetime | 更新时间 |
| `is_deleted` | tinyint | 逻辑删除标记 |

索引：

- `idx_reading_excerpt_user_time(user_id, create_time)`
- `idx_reading_excerpt_user_book(user_id, book_title)`

### `lottery_kl8_draw`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint | 主键 |
| `issue_no` | varchar(32) | 期号，唯一 |
| `draw_date` | date | 开奖日期 |
| `numbers` | varchar(260) | 20 个开奖号码，逗号分隔 |
| `source_url` | varchar(500) | 来源页面 |
| `source_name` | varchar(80) | 来源名称 |
| `create_time` | datetime | 创建时间 |
| `update_time` | datetime | 更新时间 |

索引：

- `uk_lottery_kl8_issue(issue_no)`
- `idx_lottery_kl8_draw_date(draw_date)`

### `lottery_kl8_recommendation`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | bigint | 主键 |
| `user_id` | bigint | 所属普通用户 |
| `source` | varchar(20) | `AI` 或 `RULE_BASED` |
| `base_issue_count` | int | 使用的历史期数 |
| `latest_issue_no` | varchar(32) | 生成时最新期号 |
| `recommendations_json` | text | 5 组推荐号码和理由 JSON |
| `feature_summary` | text | 本次历史特征摘要 |
| `disclaimer` | varchar(300) | 风险提示 |
| `create_time` | datetime | 创建时间 |
| `is_deleted` | tinyint | 逻辑删除标记 |

索引：

- `idx_kl8_recommend_user_time(user_id, create_time)`
- `idx_kl8_recommend_latest_issue(latest_issue_no)`

## API

统一响应沿用现有格式：

```json
{"code": 200, "message": "success", "data": {}}
```

### 认证 API

`POST /api/auth/register`

请求：

```json
{"username":"lcb","password":"password123","displayName":"LCB"}
```

响应：

```json
{"token":"...","user":{"id":1,"username":"lcb","displayName":"LCB"}}
```

校验：

- 用户名 3 到 32 位，只允许字母、数字、下划线。
- 密码至少 8 位。
- 用户名重复返回 400 业务错误。

`POST /api/auth/login`

请求：

```json
{"username":"lcb","password":"password123"}
```

响应同注册。

`GET /api/auth/me`

需要普通用户令牌。返回当前用户信息。

### 书摘 API

`GET /api/tools/reading/excerpts?page=0&size=20&keyword=架构&tag=系统设计&bookTitle=重构`

返回分页书摘。查询仅返回当前用户数据。

`POST /api/tools/reading/excerpts`

请求：

```json
{
  "bookTitle": "重构",
  "author": "Martin Fowler",
  "content": "任何一个傻瓜都能写出计算机可以理解的代码。",
  "note": "这段可以沉淀成代码可读性的面试表达。",
  "tags": ["代码质量", "重构"],
  "chapter": "第一章",
  "pageNo": "12"
}
```

`PUT /api/tools/reading/excerpts/{id}`

只能更新自己的书摘。

`DELETE /api/tools/reading/excerpts/{id}`

逻辑删除自己的书摘。

`GET /api/tools/reading/excerpts/export?keyword=&tag=&bookTitle=`

返回 Markdown 文本或包装后的导出 DTO，由前端下载为 `.md`。

### 快乐8 API

`POST /api/tools/lottery/kl8/sync`

手动触发同步。后端也会每天定时同步。

响应：

```json
{
  "success": true,
  "sourceName": "中彩网快乐8开奖信息",
  "fetchedCount": 100,
  "insertedCount": 3,
  "latestIssueNo": "2026150",
  "message": "同步完成"
}
```

`GET /api/tools/lottery/kl8/sync-status`

进入预测页时前端调用。后端如果发现数据过期，可以启动一次轻量同步或提示前端可手动同步。

响应：

```json
{
  "latestIssueNo": "2026150",
  "latestDrawDate": "2026-06-27",
  "drawCount": 100,
  "lastSyncAt": "2026-06-27T09:00:00",
  "stale": false,
  "message": "开奖数据已是最新缓存"
}
```

`GET /api/tools/lottery/kl8/draws?page=0&size=30`

分页返回近期开奖。

`POST /api/tools/lottery/kl8/recommendations`

请求：

```json
{"baseIssueCount": 100}
```

响应：

```json
{
  "id": 1,
  "source": "AI",
  "baseIssueCount": 100,
  "latestIssueNo": "2026150",
  "groups": [
    {"numbers":[3,18,29,46,71],"reason":"冷热均衡，覆盖低中高区间。"}
  ],
  "featureSummary": "近100期热号集中在...",
  "disclaimer": "彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。",
  "createdAt": "2026-06-27T09:05:00"
}
```

`GET /api/tools/lottery/kl8/recommendations?page=0&size=10`

分页返回当前用户推荐历史。

## 快乐8数据同步

首选来源为公开网页的快乐8开奖信息页，例如中彩网快乐8开奖信息页。备用来源可以接入其他公开省级福彩开奖页。抓取逻辑必须单独封装为 `LotteryKl8DrawFetcher`，输出标准化 `issueNo`、`drawDate`、`numbers`、`sourceUrl`、`sourceName`。

同步策略：

- 后端每天定时同步一次。
- 用户打开快乐8页面时调用同步状态接口；如果数据过期，后端尝试轻量同步或提示前端可重试。
- 用户可手动点击“同步开奖数据”。
- 同步按期号去重，不覆盖已存在的同一期数据，除非号码为空或格式无效。
- 抓取失败时保留旧数据，不清空历史表。

网页结构变化处理：

- 抓取失败返回明确错误消息，不影响推荐历史查看。
- 若历史数据不足 20 期，AI 推荐接口返回业务错误，提示先同步更多开奖数据。
- 若公开网页不可用，一期不自动切换第三方付费 API。

## AI 推荐策略

`LotteryKl8FeatureService` 从最近 N 期历史开奖中提取：

- 每个号码出现次数。
- 热号 Top 15 和冷号 Top 15。
- 每个号码遗漏期数。
- 号码区间分布：1-20、21-40、41-60、61-80。
- 奇偶比例。
- 连号数量。
- 尾号分布。
- 最近 10 期波动摘要。

`LotteryKl8AiRecommendationService` 使用现有 AI 配置：

- `AI_OPENCODE_API_KEY`
- `AI_DEEPSEEK_MODEL`
- `AI_DEEPSEEK_URL`

Prompt 要求：

- 只返回 JSON。
- 生成 5 组推荐。
- 每组 5 个整数，范围 1 到 80，组内不重复。
- 每组提供 20 到 80 字中文理由。
- 不输出“必中”“保证”等承诺。

`LotteryKl8RecommendationPolicy` 校验：

- 必须恰好 5 组。
- 每组必须恰好 5 个号码。
- 号码必须是整数，范围 1 到 80。
- 组内不得重复。
- 组间允许重复，但完全相同的组合不得重复。
- 理由为空时补充规则理由。
- AI 输出无法解析或不合规时回退规则推荐。

规则降级：

- 每组从热号、遗漏候选、区间均衡候选和随机候选中组合。
- 每组保持 2 到 3 个奇数，2 到 3 个偶数。
- 每组尽量覆盖至少 3 个区间。
- 生成后同样经过 `LotteryKl8RecommendationPolicy` 校验。

## 前端交互

### 登录与注册

- 导航新增“工具”入口。
- 未登录访问 `/tools` 时跳转 `/auth/login`。
- 登录页提供用户名、密码登录和跳转注册。
- 注册成功后直接进入 `/tools`。
- 普通用户令牌保存到 `localStorage`，Axios 请求个人工具 API 时自动带上。

### 书摘库

页面能力：

- 搜索框：按书名、作者、摘录正文、评论搜索。
- 标签筛选：输入或选择标签。
- 新增/编辑书摘表单：书名、作者、摘录、评论、标签、章节、页码。
- 列表卡片：书名、作者、标签、摘录摘要、评论摘要、更新时间。
- 删除确认。
- 导出 Markdown。

空状态：

- 无书摘时显示“添加第一条书摘”按钮。

### 快乐8选5

页面能力：

- 同步状态卡：最新期号、最新开奖日期、历史期数、同步状态。
- 同步按钮：手动触发开奖数据同步。
- 推荐按钮：生成 5 组 AI 推荐。
- 推荐结果：5 组号码卡片、来源标识、推荐理由、历史期数、最新期号。
- 推荐历史：分页展示自己的历史推荐。
- 近期开奖：显示最近 30 期号码。
- 风险提示固定展示在推荐区域上方。

文案边界：

- 使用“推荐”“统计参考”“娱乐分析”。
- 禁止“预测必中”“稳赚”“高命中”等承诺性文案。

## 安全与权限

- 普通用户 API 需要普通用户令牌。
- 用户只能访问自己的书摘和推荐历史。
- 开奖历史是公共数据，登录用户可查看。
- 密码使用 PBKDF2 带盐哈希，不存明文。
- 令牌有过期时间，解析失败返回 401。
- 管理员 Token 不可访问普通用户个人数据 API。
- 普通用户令牌不可访问 `/api/admin/**`。

## 错误处理

- 注册用户名重复：400 业务错误。
- 登录失败：401 或 400，提示用户名或密码错误。
- 普通用户令牌缺失或过期：401，前端跳转登录。
- 书摘不存在或不属于当前用户：404。
- 开奖同步失败：返回失败状态和原因，保留旧数据。
- 历史开奖不足：推荐接口返回 400，提示先同步更多数据。
- AI 配置缺失或调用失败：回退规则推荐，响应 `source` 为 `RULE_BASED`。
- AI 输出不合规：记录 WARN 日志，回退规则推荐。

## 测试计划

后端：

- `AppUserServiceTest`：注册校验、重复用户名、密码哈希、登录成功与失败。
- `AuthTokenServiceTest`：令牌签发、解析、过期和篡改失败。
- `ReadingExcerptServiceTest`：用户隔离、分页搜索、标签筛选、Markdown 导出、逻辑删除。
- `LotteryKl8FeatureServiceTest`：热号、冷号、遗漏、区间、奇偶特征计算。
- `LotteryKl8RecommendationPolicyTest`：AI 输出校验、非法号码过滤、重复组合拒绝、规则降级。
- `LotteryKl8RecommendationServiceTest`：AI 成功、AI 失败降级、历史数据不足。
- `LotteryKl8SyncServiceTest`：HTML 样例解析、期号去重、抓取失败保留旧数据。

前端：

- `authToken.test.ts`：令牌保存、读取、清理。
- `Login.test.tsx`：登录成功跳转、失败提示。
- `Register.test.tsx`：注册成功进入工具页。
- `ReadingExcerptPanel.test.tsx`：新增、搜索、编辑、删除、导出交互。
- `LotteryKl8Panel.test.tsx`：同步状态、AI 推荐展示、规则降级标识、免责声明。
- `Tools.test.tsx`：未登录跳转登录，登录后显示两个工具模块。

验证命令：

```bash
cd backend && mvn test
cd frontend && npm run test
cd frontend && npm run build
git diff --check
```

## 交付顺序

1. 数据库表和后端认证基础。
2. 前端登录、注册和 API 令牌拦截。
3. 书摘库后端与前端。
4. 快乐8开奖同步和历史数据展示。
5. 快乐8历史特征、AI 推荐、校验和规则降级。
6. 快乐8前端推荐面板。
7. 全量测试、构建和文档更新。

## 风险

- 公开网页结构可能变化：抓取器必须隔离，失败时保留旧数据并提示用户。
- AI 输出不稳定：必须用后端策略校验，不允许前端直接信任 AI JSON。
- 多用户认证影响面扩大：普通用户拦截只作用于 `/api/tools/**` 和 `/api/auth/me`，避免影响公开题库。
- 彩票推荐存在误导风险：页面和接口都返回免责声明，文案避免收益承诺。
