import type {
  DailyPlanCompletion,
  DailyPlanCompletionAction,
  DailyPlanCompletionLevel,
  DailyPlanCompletionMetric,
  DailyPlanCompletionTodo,
  StudyProgress,
} from '../types'
import { buildScheduledReviewQueue } from './reviewSchedule'
import { getQuestionState } from './studyProgress'
import { buildDailyPracticePath } from './practiceRoute'

export function buildDailyPlanCompletion(
  progress: StudyProgress,
  now = new Date().toISOString(),
): DailyPlanCompletion {
  const planIds = uniquePositiveIds(progress.dailyPlan)
  const totalCount = planIds.length
  const planIdSet = new Set(planIds)
  const states = planIds.map(questionId => getQuestionState(progress, questionId))
  const masteredCount = states.filter(state => state.status === 'mastered').length
  const weakIds = planIds.filter(questionId => getQuestionState(progress, questionId).status === 'weak')
  const reviewDebtIds = buildScheduledReviewQueue(progress, now, 1000)
    .filter(item => planIdSet.has(item.id) && item.dueStatus !== 'upcoming')
    .map(item => item.id)
  const interviewTodayCount = countTodayInterviewAttempts(progress, planIdSet, now)
  const remainingCount = Math.max(0, totalCount - masteredCount)
  const completionRate = totalCount === 0 ? 0 : Math.round((masteredCount / totalCount) * 100)
  const level = resolveLevel({
    totalCount,
    remainingCount,
    weakCount: weakIds.length,
    reviewDebtCount: reviewDebtIds.length,
    interviewTodayCount,
  })
  const primaryAction = buildPrimaryAction(level, planIds, reviewDebtIds, weakIds)

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, totalCount, masteredCount, remainingCount, reviewDebtIds.length, weakIds.length, interviewTodayCount),
    completionRate,
    totalCount,
    masteredCount,
    remainingCount,
    weakCount: weakIds.length,
    reviewDebtCount: reviewDebtIds.length,
    interviewTodayCount,
    metrics: buildMetrics(completionRate, masteredCount, totalCount, reviewDebtIds.length, weakIds.length, interviewTodayCount),
    todos: buildTodos(level, planIds, reviewDebtIds, weakIds, remainingCount, interviewTodayCount),
    primaryAction,
  }
}

/**
 * 构建今日闭环验收 Markdown，便于用户把当天完成率、风险和下一步行动带走复盘。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和判断今日面试样本
 * @returns 可复制或下载的 Markdown 验收报告
 */
export function buildDailyPlanCompletionMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const completion = buildDailyPlanCompletion(progress, now)

  return [
    `# ${progress.targetRole} 今日闭环验收`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderDailyCompletionOverview(completion),
    renderDailyCompletionMetrics(completion.metrics),
    renderDailyCompletionTodos(completion.todos),
    renderDailyCompletionPrimaryAction(completion.primaryAction),
  ].join('\n').trimEnd()
}

function renderDailyCompletionOverview(completion: DailyPlanCompletion): string {
  return [
    '## 验收概览',
    `- 状态：${completion.title}`,
    `- 摘要：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    '',
  ].join('\n')
}

function renderDailyCompletionMetrics(metrics: DailyPlanCompletionMetric[]): string {
  return [
    '## 指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderDailyCompletionTodos(todos: DailyPlanCompletionTodo[]): string {
  if (todos.length === 0) {
    return [
      '## 待办验收',
      '- 暂无待办验收。可以沉淀今日复盘，再进入下一轮训练。',
      '',
    ].join('\n')
  }

  const lines = ['## 待办验收']
  todos.forEach((todo, index) => {
    lines.push(
      `${index + 1}. ${todo.title}`,
      `   - 说明：${todo.description}`,
      `   - 入口：${todo.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderDailyCompletionPrimaryAction(action: DailyPlanCompletionAction): string {
  return [
    '## 主行动',
    `- 动作：${action.label}`,
    `- 说明：${action.description}`,
    `- 入口：${action.to}`,
  ].join('\n')
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function resolveLevel(input: {
  totalCount: number
  remainingCount: number
  weakCount: number
  reviewDebtCount: number
  interviewTodayCount: number
}): DailyPlanCompletionLevel {
  if (input.totalCount === 0) {
    return 'empty'
  }
  if (input.reviewDebtCount > 0 || input.weakCount > 0) {
    return 'risk'
  }
  if (input.remainingCount > 0) {
    return 'active'
  }
  if (input.interviewTodayCount === 0) {
    return 'ready'
  }
  return 'excellent'
}

function buildPrimaryAction(
  level: DailyPlanCompletionLevel,
  planIds: number[],
  reviewDebtIds: number[],
  weakIds: number[],
): DailyPlanCompletionAction {
  if (level === 'empty') {
    return {
      label: '生成今日计划',
      description: '先建立今天的题目队列，再进入训练和验收。',
      to: '/study',
    }
  }
  if (reviewDebtIds.length > 0) {
    return {
      label: '先清复习债',
      description: '计划内存在到期或逾期题，先复盘再继续扩展。',
      to: buildDailyPracticePath(reviewDebtIds),
    }
  }
  if (weakIds.length > 0) {
    return {
      label: '修复薄弱题',
      description: '先把薄弱题讲清，再判断今日计划是否闭环。',
      to: buildDailyPracticePath(weakIds),
    }
  }
  if (level === 'active') {
    return {
      label: '继续今日队列',
      description: '还有计划题未掌握，继续按今日队列推进。',
      to: buildDailyPracticePath(planIds),
    }
  }
  if (level === 'ready') {
    return {
      label: '补一次模拟面试',
      description: '题目已掌握，补一个今日表达样本完成闭环。',
      to: buildDailyPracticePath(planIds),
    }
  }
  return {
    label: '查看冲刺报告',
    description: '今日计划和表达样本都已闭环，可以沉淀复盘。',
    to: '/study',
  }
}

function buildMetrics(
  completionRate: number,
  masteredCount: number,
  totalCount: number,
  reviewDebtCount: number,
  weakCount: number,
  interviewTodayCount: number,
): DailyPlanCompletionMetric[] {
  return [
    {
      key: 'completion',
      label: '完成率',
      value: `${completionRate}%`,
      detail: totalCount > 0 ? '按已掌握题计算' : '等待今日计划',
    },
    {
      key: 'mastered',
      label: '已掌握',
      value: `${masteredCount}/${totalCount}`,
      detail: masteredCount === totalCount && totalCount > 0 ? '计划题已清完' : '仍需推进',
    },
    {
      key: 'risk',
      label: '风险项',
      value: `${reviewDebtCount + weakCount} 个`,
      detail: reviewDebtCount > 0 ? '含复习债' : weakCount > 0 ? '含薄弱题' : '暂无明显风险',
    },
    {
      key: 'interview',
      label: '今日面试',
      value: `${interviewTodayCount} 次`,
      detail: interviewTodayCount > 0 ? '已有表达样本' : '建议补一次',
    },
  ]
}

function buildTodos(
  level: DailyPlanCompletionLevel,
  planIds: number[],
  reviewDebtIds: number[],
  weakIds: number[],
  remainingCount: number,
  interviewTodayCount: number,
): DailyPlanCompletionTodo[] {
  if (level === 'empty') {
    return [{
      id: 'plan-empty',
      title: '今日计划还没生成',
      description: '先生成或补齐今日计划，再开始闭环验收。',
      tone: 'default',
      to: '/study',
    }]
  }

  const todos: DailyPlanCompletionTodo[] = []
  if (reviewDebtIds.length > 0) {
    todos.push({
      id: 'review-debt',
      title: `${reviewDebtIds.length} 道计划题已到期或逾期`,
      description: '复习窗口已经打开，先处理它们能减少遗忘损耗。',
      tone: 'danger',
      to: buildDailyPracticePath(reviewDebtIds),
    })
  }
  if (weakIds.length > 0) {
    todos.push({
      id: 'weak-planned',
      title: `${weakIds.length} 道计划题仍是薄弱状态`,
      description: '用原理、边界和项目场景把薄弱点讲清。',
      tone: 'warning',
      to: buildDailyPracticePath(weakIds),
    })
  }
  if (remainingCount > 0 && reviewDebtIds.length === 0 && weakIds.length === 0) {
    todos.push({
      id: 'continue-plan',
      title: `还有 ${remainingCount} 道计划题未掌握`,
      description: '继续今日队列，完成后再做模拟面试验收。',
      tone: 'default',
      to: buildDailyPracticePath(planIds),
    })
  }
  if (remainingCount === 0 && interviewTodayCount === 0) {
    todos.push({
      id: 'interview-sample',
      title: '还缺今日模拟面试样本',
      description: '掌握不等于能讲清，补一次口述评分完成闭环。',
      tone: 'warning',
      to: buildDailyPracticePath(planIds),
    })
  }
  if (remainingCount === 0 && interviewTodayCount > 0) {
    todos.push({
      id: 'closed-loop',
      title: '今日计划已经闭环',
      description: '题目掌握和表达样本都具备，可以沉淀复盘。',
      tone: 'success',
      to: '/study',
    })
  }

  return todos.slice(0, 4)
}

function titleForLevel(level: DailyPlanCompletionLevel): string {
  if (level === 'empty') {
    return '今日计划待验收'
  }
  if (level === 'risk') {
    return '今日闭环还有风险'
  }
  if (level === 'active') {
    return '今日计划推进中'
  }
  if (level === 'ready') {
    return '题目已清完，待面试验收'
  }
  return '今日闭环已加强'
}

function summaryForLevel(
  level: DailyPlanCompletionLevel,
  totalCount: number,
  masteredCount: number,
  remainingCount: number,
  reviewDebtCount: number,
  weakCount: number,
  interviewTodayCount: number,
): string {
  if (level === 'empty') {
    return '先生成今日计划，系统会实时检查题目掌握、复习债和面试样本。'
  }
  if (level === 'risk') {
    return `今日 ${totalCount} 道计划题，已掌握 ${masteredCount} 道；还有 ${reviewDebtCount} 道复习债、${weakCount} 道薄弱题需要先处理。`
  }
  if (level === 'active') {
    return `今日 ${totalCount} 道计划题，已掌握 ${masteredCount} 道，还差 ${remainingCount} 道完成。`
  }
  if (level === 'ready') {
    return `今日 ${totalCount} 道计划题已掌握，补一次模拟面试后形成表达样本。`
  }
  return `今日 ${totalCount} 道计划题已掌握，并完成 ${interviewTodayCount} 次模拟面试样本。`
}

function countTodayInterviewAttempts(
  progress: StudyProgress,
  planIdSet: Set<number>,
  now: string,
): number {
  const todayKey = dateKey(now)
  return Object.entries(progress.interviewAttempts)
    .filter(([questionId]) => planIdSet.has(Number(questionId)))
    .flatMap(([, attempts]) => attempts)
    .filter(attempt => dateKey(attempt.createdAt) === todayKey)
    .length
}

function dateKey(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function uniquePositiveIds(questionIds: number[]): number[] {
  return [...new Set(questionIds)]
    .filter(questionId => Number.isFinite(questionId) && questionId > 0)
}
