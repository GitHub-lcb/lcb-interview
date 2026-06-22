# LCB Interview 模拟面试复盘设计

## 背景

LCB Interview 已经具备免费题库、个人学习进度、路线训练和模拟面试评分能力。当前短板是：每次模拟回答的评分会被保存，但用户只能在单题上看到最近一次结果，无法判断整体表达能力、短板维度和进步趋势。

下一步要把这些历史评分转成可直接行动的复盘面板，让用户看到“我这轮面试表达到底弱在哪里，下一题应该怎么补”。这是相对普通题库站点的关键差异：不仅给答案，还持续诊断用户的表达能力。

## 目标

- 完全免费展示模拟面试复盘，不依赖会员、登录或付费开关。
- 基于本地 `StudyProgress.interviewAttempts` 计算总练习次数、覆盖题数、平均分、最高分、最近分、趋势和最弱评分维度。
- 在首页展示全局复盘，让用户进入网站后立即看到面试表达状态。
- 在练习页侧边栏展示同一份复盘，配合当前训练队列形成闭环。
- 无面试记录时给出明确空状态，引导用户进入 `/practice` 开始训练。

## 非目标

- 不新增后端表结构。
- 不上传本地回答内容。
- 不做图表库引入，避免增加包体和维护成本。
- 不替代现有后端/本地评分，只聚合已有评分结果。

## 方案比较

### 方案 A：只在练习页展示复盘

实现最小，但用户只有进入练习后才看到复盘价值，首页仍像普通题库首页。

### 方案 B：首页和练习页复用同一复盘组件

新增一个纯函数计算复盘，再新增复用组件。首页负责拉动用户回到练习，练习页负责训练中即时反馈。实现范围可控，价值外显更强。

### 方案 C：新增独立复盘页面

空间最大，但当前历史数据维度还不够多，单独页面容易显得空。后续有更多时间序列、岗位维度和题型维度后再拆页更合适。

## 决策

采用方案 B。

核心原因：

- 复盘能力可以立即出现在首页，强化“免费个人教练”定位。
- 组件复用，避免首页和练习页各自写一套统计逻辑。
- 不新增路由和后端接口，风险低，符合当前连续增强节奏。

## 数据模型

新增前端类型：

```ts
export type InterviewTrend = 'empty' | 'improving' | 'declining' | 'stable'

export interface InterviewCriterionSummary {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  attempts: number
  summary: string
}

export interface InterviewReviewSummary {
  totalAttempts: number
  answeredQuestions: number
  averageScore: number
  bestScore: number
  latestScore?: number
  trend: InterviewTrend
  weakestCriterion?: InterviewCriterionSummary
  criteria: InterviewCriterionSummary[]
  recentAttempts: Array<InterviewAttempt & { question?: QuestionSnapshot }>
  recommendation: string
}
```

## 复盘计算规则

新增 `frontend/src/utils/interviewReview.ts`：

- 从 `progress.interviewAttempts` 展平所有尝试。
- 按 `createdAt` 倒序排序，得到最近记录。
- `answeredQuestions` 统计有记录的题目数量。
- `averageScore` 和 `bestScore` 基于所有尝试计算，四舍五入。
- 趋势比较最近 3 次和之前 3 次平均分：
  - 最近平均分比之前高 5 分及以上：`improving`
  - 最近平均分比之前低 5 分及以上：`declining`
  - 差值小于 5 分：`stable`
  - 不足 4 次记录：`stable`
- 评分维度按 `criteria.key` 聚合平均分，最低平均分作为 `weakestCriterion`。
- `recommendation` 根据空状态、趋势和最弱维度生成中文建议。

关键逻辑必须有中文注释，说明趋势阈值和维度聚合原因。

## UI 设计

新增 `frontend/src/components/InterviewReviewPanel.tsx`。

组件输入：

```ts
interface InterviewReviewPanelProps {
  progress: StudyProgress
  compact?: boolean
}
```

组件行为：

- 空状态显示“还没有模拟面试记录”，主按钮跳转 `/practice`。
- 有记录时显示：
  - 平均分主卡
  - 趋势文案
  - 总练习次数、覆盖题数、最高分
  - 最弱维度和建议
  - 最近 3 条记录，带题目标题、分数、时间
- `compact=true` 时用于练习页侧栏，少展示最近记录但保留平均分、趋势和最弱维度。

接入位置：

- `Home/index.tsx`：放在 `StudyCommandCenter` 下方、免费承诺区上方。
- `Practice/index.tsx`：放在侧边栏本轮概览之后、训练队列之前。

## 错误和边界

- 没有记录：所有分数为 0，趋势为 `empty`。
- 有尝试但缺少题目快照：最近记录显示 `题目 #id` 作为兜底标题。
- 单次尝试缺少 criteria：不影响平均分，维度统计忽略该次 criteria。
- `createdAt` 异常：字符串排序仍可稳定展示，后续可加强日期格式化。

## 测试

新增 `frontend/src/utils/interviewReview.test.ts`：

- 空进度返回空状态建议。
- 多题多次尝试能计算平均分、最高分和覆盖题数。
- 最近分明显高于之前分时趋势为 `improving`。
- 最近分明显低于之前分时趋势为 `declining`。
- 评分维度聚合后能找出最低维度。
- 最近记录能带上题目快照，缺失快照时使用兜底标题。

## 验收标准

- 首页和练习页均能看到免费面试复盘。
- 不新增付费、登录或后端依赖。
- 新增复盘纯函数有单元测试，且先红后绿。
- `npm run test`、`npm run build`、`mvn test` 通过。
