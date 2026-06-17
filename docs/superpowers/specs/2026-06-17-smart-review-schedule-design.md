# LCB Interview 智能复习排期设计

## 背景

当前系统已经有今日计划、薄弱题、学习中题和模拟面试复盘，但复习队列仍然偏静态：只按题目状态和最近复习时间排序，没有告诉用户“今天必须复习什么”“为什么现在复习”“延迟了多久”。普通题库网站通常只提供收藏、错题或列表，缺少真正的间隔重复节奏。

本阶段要把本地学习记录升级成智能复习排期，让用户打开学习页就能看到今日到期、已逾期和后续即将到期的题目。这是“免费个人教练”的核心能力之一。

## 目标

- 完全基于本地 `StudyProgress` 计算复习排期，不新增后端接口和账号依赖。
- 根据题目状态、复习次数和最近复习时间计算下一次复习时间。
- 在学习页显示“今日到期”“已逾期”“即将到期”的复习摘要。
- 复习队列优先展示到期/逾期题，并给出原因和下次复习提示。
- 兼容旧数据：没有 `lastReviewedAt` 的学习中/薄弱题默认今天需要复习。

## 非目标

- 不引入复杂 SM-2 算法和熟练度参数。
- 不修改后端表结构。
- 不新增登录态、云同步或提醒推送。
- 不改变现有“标记薄弱/已掌握”的交互语义。

## 方案比较

### 方案 A：只改排序规则

实现最小，但用户仍看不到到期原因，也无法形成复习节奏感。

### 方案 B：新增纯函数排期 + 学习页摘要

新增 `reviewSchedule.ts` 计算到期状态、下次复习时间和摘要；学习页直接复用结果。逻辑集中、可测试、对现有数据侵入小。

### 方案 C：把排期字段写入 localStorage

后续查询更快，但会增加迁移复杂度。当前题量和本地状态规模较小，运行时计算足够。

## 决策

采用方案 B。

核心原因：

- 纯函数可测试，适合 TDD。
- 不污染已有 `StudyProgress` 数据结构。
- 学习页立即获得“今天做什么”的明确指导。

## 排期规则

新增 `frontend/src/utils/reviewSchedule.ts`。

### 复习间隔

- `weak`：固定 1 天后复习。薄弱题需要高频暴露，直到用户手动标记掌握。
- `learning`：
  - `reviewCount <= 1`：1 天
  - `reviewCount === 2`：3 天
  - `reviewCount >= 3`：7 天
- `mastered`：
  - `reviewCount < 3`：7 天
  - `reviewCount >= 3`：14 天
- `new`：不进入排期。

### 到期状态

```ts
export type ReviewDueStatus = 'overdue' | 'due-today' | 'upcoming'
```

- 没有 `lastReviewedAt` 的 `weak` / `learning` 题：`due-today`。
- `nextReviewAt < todayStart`：`overdue`。
- `todayStart <= nextReviewAt <= todayEnd`：`due-today`。
- 其他：`upcoming`。

### 排序

排序优先级：

1. `overdue`
2. `due-today`
3. `upcoming`

同一优先级内：

1. `weak` 优先
2. `learning` 优先
3. 下一次复习时间更早优先

## 类型

新增前端类型：

```ts
export type ReviewDueStatus = 'overdue' | 'due-today' | 'upcoming'

export interface ScheduledReviewItem extends ReviewQueueItem {
  dueStatus: ReviewDueStatus
  nextReviewAt: string
  daysUntilDue: number
  scheduleReason: string
}

export interface ReviewScheduleSummary {
  overdue: number
  dueToday: number
  upcoming: number
  nextReviewAt?: string
}
```

## UI 设计

学习页新增一块排期摘要，放在四个指标卡下方、今日计划和复习队列上方：

- 已逾期
- 今日到期
- 即将到期
- 下一次复习时间

复习队列标题改为“智能复习队列”，每条显示：

- 到期标签：逾期 / 今日 / 即将
- 题目标题
- 分类、复习次数
- `scheduleReason`

点击仍进入题目详情，沿用现有交互。

## 错误和边界

- 空状态：显示“先标记薄弱或加入计划后生成排期”。
- 日期解析失败：按今天到期处理，避免用户漏复习。
- `mastered` 题默认不出现在旧的 `buildReviewQueue`，新排期可包含近期掌握但仍需巩固的题；但学习页默认展示前 12 条，薄弱和学习中仍优先。

## 测试

新增 `frontend/src/utils/reviewSchedule.test.ts`：

- 无复习记录的薄弱题今天到期。
- 学习中题按复习次数计算 1/3/7 天间隔。
- 已掌握题按复习次数计算 7/14 天间隔。
- 逾期题排在今日题和即将题前面。
- 摘要能统计逾期、今日、即将和下一次复习时间。
- 新题不进入排期。

## 验收标准

- `npm run test -- reviewSchedule` 先红后绿。
- 学习页显示排期摘要和智能复习队列。
- 不新增后端依赖，不引入新包。
- `npm run test`、`npm run build`、`mvn test`、`git diff --check` 通过。
