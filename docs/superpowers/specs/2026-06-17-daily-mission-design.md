# LCB Interview 今日冲刺任务设计

## 背景

现在首页已经有备考指挥中心、模拟面试复盘、岗位能力地图、免费承诺和题库入口。学习页也有智能复习排期。能力已经很强，但还缺一个更直接的“今天按什么顺序做”的任务编排层。

普通题库网站大多让用户自己决定刷什么。下一步要把系统升级成“免费个人教练”：每天自动把最该做的动作排成清单，用户直接开始执行。

## 目标

- 首页新增“今日冲刺任务”面板。
- 基于本地 `StudyProgress`、智能复习排期、岗位能力地图、模拟面试复盘生成任务。
- 每个任务有优先级、标题、说明、行动入口和理由。
- 无登录、无付费、无后端依赖。
- 不新增 API 请求，只使用本地状态和已有路线配置。

## 非目标

- 不做日历提醒和浏览器通知。
- 不把任务写入 localStorage。任务应由当前状态实时计算。
- 不替代学习页、路线页和练习页，只提供今日行动入口。

## 任务来源

新增 `frontend/src/utils/dailyMission.ts`：

任务按以下来源生成：

1. **到期复习任务**
   - 使用 `buildScheduledReviewQueue(progress)`。
   - 有逾期/今日到期题时生成最高优先级任务。
   - 行动入口：`/study`。

2. **岗位短板任务**
   - 使用 `buildAbilityMap(prepRoutes, progress)`。
   - 找出有 `nextQuestionIds` 且准备度最低的能力域。
   - 行动入口：`/practice?queue=...`。

3. **模拟面试任务**
   - 使用 `buildInterviewReviewSummary(progress)`。
   - 没有记录时，引导完成首次模拟面试。
   - 趋势下降或最弱维度低于 70 时，引导进行表达复盘训练。
   - 行动入口：`/practice`。

4. **今日计划任务**
   - `dailyPlan` 不为空时，引导继续今日计划训练。
   - `dailyPlan` 为空时，引导打开学习页生成计划。

## 排序规则

每个任务有 `priority`：

- 到期复习：100
- 岗位短板：80 + weak * 5 + (100 - readinessScore) / 10
- 模拟面试：70，趋势下降时 85
- 今日计划：60，有计划时 65

最终按 `priority` 降序，最多展示 4 个任务。

## 数据类型

新增类型：

```ts
export type DailyMissionKind = 'review' | 'ability' | 'interview' | 'plan'

export interface DailyMissionItem {
  id: string
  kind: DailyMissionKind
  title: string
  description: string
  reason: string
  to: string
  priority: number
  metric: string
}

export interface DailyMissionPlan {
  title: string
  summary: string
  missions: DailyMissionItem[]
}
```

## UI 设计

新增 `frontend/src/components/DailyMissionPanel.tsx`。

首页位置：

- `StudyCommandCenter` 下方。
- `InterviewReviewPanel` 上方。

展示：

- 左侧总标题：今日冲刺任务。
- 右侧最多 4 条任务卡。
- 任务卡展示：
  - metric
  - title
  - description
  - reason
  - button

## 边界

- 完全空状态：给出“建立学习轨迹”“完成首次模拟面试”“生成今日计划”等任务。
- 如果能力地图没有本地快照，不生成短板训练队列，只引导打开路线。
- 如果任务目标 URL 重复，保留优先级最高的任务，避免首页重复按钮。

## 测试

新增 `frontend/src/utils/dailyMission.test.ts`：

- 空进度生成起步任务。
- 逾期复习任务排第一。
- 能力短板任务带 practice queue。
- 模拟面试趋势下降时优先级高于普通面试任务。
- 重复目标入口会去重。

## 验收标准

- `npm run test -- dailyMission` 先红后绿。
- 首页出现今日冲刺任务面板。
- 面板不触发新增 API 请求。
- `npm run test`、`npm run build`、`mvn test`、`git diff --check` 通过。
