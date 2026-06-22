# LCB Interview 岗位能力地图设计

## 背景

系统已经具备路线、学习计划、复习排期和模拟面试复盘，但首页还缺一个“岗位能力全局视角”。用户知道今天做什么，也知道最近面试表现如何，但还不知道自己在 Java 后端、前端、AI 应用、架构运维等路线上的能力差距。

普通题库站点通常按分类展示题目，用户需要自己推断哪些分类对应岗位能力。本阶段要把备考路线和本地学习记录结合，直接输出岗位能力地图。

## 目标

- 在首页展示每条备考路线的准备度、已覆盖题量、薄弱题数量和下一步训练入口。
- 完全基于本地 `StudyProgress.questionSnapshots` 与 `questionStates` 计算，不新增后端接口。
- 复用 `prepRoutes` 的岗位/路线/分类定义，避免重复维护能力域。
- 能处理空状态：没有学习轨迹时提示先浏览题目或进入路线。
- 能一键进入路线训练：把该能力域内未掌握题目拼成 `/practice?queue=...`。

## 非目标

- 不做全量题库扫描。首页不能为了能力地图主动拉 6386 道题。
- 不新增复杂岗位配置后台。
- 不替代 `/routes` 页面，只在首页提供全局能力概览。

## 方案比较

### 方案 A：按技术分类聚合

直接按 `categoryName` 聚合，开发简单，但无法体现“岗位路线”，用户看到的是零散分类。

### 方案 B：按 `prepRoutes` 聚合能力域

把每条路线视为能力域，用路线的 `categories` 匹配题目快照的 `categoryName` 和 `tags`。能直接复用现有路线设计，且和 `/routes` 页一致。

### 方案 C：新增岗位能力配置文件

可定制性最好，但会重复维护路线和能力域，短期收益不如复用现有路线。

## 决策

采用方案 B。

核心原因：

- 不新增后端或配置维护成本。
- 能把路线页、学习计划和首页统一成同一套岗位能力语言。
- 用户可以从首页直接进入最弱路线训练。

## 数据模型

新增类型：

```ts
export type AbilityReadinessLevel = 'empty' | 'weak' | 'building' | 'ready'

export interface AbilityMapItem {
  routeId: string
  title: string
  role: string
  readinessScore: number
  readinessLevel: AbilityReadinessLevel
  remembered: number
  mastered: number
  weak: number
  learning: number
  nextQuestionIds: number[]
  summary: string
}
```

## 计算规则

新增 `frontend/src/utils/abilityMap.ts`：

- 输入 `prepRoutes` 和 `StudyProgress`。
- 用路线 `categories` 匹配本地题目快照：
  - `snapshot.categoryName` 命中路线分类；
  - 或 `snapshot.tags` 任一命中路线分类。
- 只计算用户已浏览/记忆过的题目，避免首页触发全量请求。
- 分数：
  - `mastered` = 100
  - `learning` = 60
  - `weak` = 25
  - `new` = 10
  - `readinessScore = round(total / remembered)`
- 等级：
  - remembered = 0：`empty`
  - score < 45：`weak`
  - score < 75：`building`
  - score >= 75：`ready`
- `nextQuestionIds` 取 weak、learning、new 且未掌握题，最多 12 个。
- `summary` 根据等级生成中文解释。

核心匹配和评分逻辑要写中文注释，说明为什么只使用本地快照、为什么不把掌握题放入训练队列。

## UI 设计

新增 `frontend/src/components/AbilityMapPanel.tsx`。

首页位置：`InterviewReviewPanel` 下方、免费承诺区上方。

展示结构：

- 标题：岗位能力地图
- 每条路线一张紧凑卡：
  - 准备度进度条
  - 角色/路线名
  - 已覆盖、薄弱、学习中、已掌握
  - 一句摘要
  - 主按钮：有 `nextQuestionIds` 时进入 `/practice?queue=...`；否则进入 `/routes`

## 边界

- 没有本地快照：展示 0 分空状态，但保留“打开路线”入口。
- 某条路线没有未掌握题：按钮进入 `/routes`，避免空队列练习。
- 同一题可能匹配多条路线，这是预期，因为一个题可能同时属于后端和架构能力。

## 测试

新增 `frontend/src/utils/abilityMap.test.ts`：

- 没有快照时返回 empty 能力项。
- 分类命中和标签命中都能归入路线。
- 准备度能按 mastered/learning/weak/new 计算。
- nextQuestionIds 排除 mastered 题。
- 能按薄弱优先排序能力项。

## 验收标准

- 首页出现岗位能力地图。
- 能力地图不发起新增 API 请求。
- `npm run test -- abilityMap` 先红后绿。
- `npm run test`、`npm run build`、`mvn test`、`git diff --check` 通过。
