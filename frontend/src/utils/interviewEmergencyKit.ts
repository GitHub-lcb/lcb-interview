import type {
  InterviewEmergencyKit,
  InterviewEmergencyKitAction,
  InterviewEmergencyKitItem,
  InterviewEmergencyKitLevel,
  InterviewEmergencyKitMetric,
  StudyProgress,
} from '../types'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
import { buildDailyPracticePath } from './practiceRoute'
import { buildScheduledReviewQueue } from './reviewSchedule'

const MAX_TOTAL_MINUTES = 30
const MAX_ACTIONS = 5

const ITEM_KIND_LABELS: Record<InterviewEmergencyKitItem['kind'], string> = {
  review: '复习债',
  mistake: '错因修复',
  weak: '薄弱开口',
  closure: '今日闭环',
  sample: '模拟样本',
}

/**
 * 面试前急救包，把本地学习闭环压缩成 30 分钟内可执行的临场行动。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于判断今日闭环和复习债
 * @returns 面试前急救包
 */
export function buildInterviewEmergencyKit(
  progress: StudyProgress,
  now = new Date().toISOString(),
): InterviewEmergencyKit {
  const reviewDebtItems = buildScheduledReviewQueue(progress, now, 12)
    .filter(item => item.dueStatus !== 'upcoming')
  const reviewDebtIds = reviewDebtItems.map(item => item.id)
  const completion = buildDailyPlanCompletion(progress, now)
  const ledger = buildInterviewMistakeLedger(progress)
  const recoveryPlan = buildInterviewRecoveryPlan(ledger)
  const candidates: InterviewEmergencyKitItem[] = []

  if (reviewDebtIds.length > 0) {
    candidates.push({
      id: 'review-debt',
      kind: 'review',
      title: `${reviewDebtIds.length} 道复习债先清掉`,
      description: '临场前先复盘到期和逾期题，减少最后一轮遗忘损耗。',
      reason: reviewDebtItems[0]?.scheduleReason ?? '复习窗口已经打开。',
      to: buildDailyPracticePath(reviewDebtIds),
      durationMinutes: 12,
      priority: 120,
      questionIds: reviewDebtIds,
      actionLabel: '先清复习债',
    })
  }

  if (ledger.level === 'risk' && recoveryPlan.steps.length > 0) {
    const step = recoveryPlan.steps[0]
    candidates.push({
      id: 'mistake-recovery',
      kind: 'mistake',
      title: step.title,
      description: step.description,
      reason: step.reason,
      to: step.to || '/practice',
      durationMinutes: Math.min(step.durationMinutes, 12),
      priority: 100,
      questionIds: step.questionIds,
      actionLabel: step.actionLabel,
    })
  }

  const weakUnspokenIds = Object.entries(progress.questionStates)
    .filter(([, state]) => state.status === 'weak')
    .map(([questionId]) => Number(questionId))
    .filter(questionId => (progress.interviewAttempts[questionId]?.length ?? 0) === 0)
    .filter(questionId => !reviewDebtIds.includes(questionId))
    .sort((a, b) => a - b)
    .slice(0, 6)

  if (weakUnspokenIds.length > 0) {
    candidates.push({
      id: 'weak-unspoken',
      kind: 'weak',
      title: `${weakUnspokenIds.length} 道薄弱题开口过一遍`,
      description: '把“看过”变成“能说清”，优先暴露临场表达断点。',
      reason: '薄弱题如果没有开口样本，面试前风险不可见。',
      to: buildDailyPracticePath(weakUnspokenIds),
      durationMinutes: 10,
      priority: 80,
      questionIds: weakUnspokenIds,
      actionLabel: '薄弱开口',
    })
  }

  if (!['excellent', 'ready'].includes(completion.level) && completion.primaryAction.to) {
    candidates.push({
      id: 'daily-closure',
      kind: 'closure',
      title: completion.primaryAction.label,
      description: completion.primaryAction.description,
      reason: completion.summary,
      to: completion.primaryAction.to,
      durationMinutes: 8,
      priority: completion.level === 'risk' ? 90 : 60,
      questionIds: progress.dailyPlan,
      actionLabel: completion.primaryAction.label,
    })
  }

  const interviewAttemptCount = Object.values(progress.interviewAttempts).flat().length
  const trackedCount = Object.keys(progress.questionStates).length
  if (interviewAttemptCount === 0) {
    candidates.push({
      id: 'first-interview-sample',
      kind: 'sample',
      title: '先建立一次模拟面试样本',
      description: '用一题开口作答，让系统生成可复盘的表达证据。',
      reason: '没有真实表达样本时，临场风险只能靠猜。',
      to: '/practice',
      durationMinutes: 12,
      priority: 70,
      questionIds: [],
      actionLabel: '开始模拟面试',
    })
  }

  const selected = selectWithinBudget(candidates)
  const items = selected.length > 0 ? selected : [buildReadyWarmup(progress)]
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMinutes, 0)
  const level = resolveLevel({
    reviewDebtCount: reviewDebtIds.length,
    mistakeCount: ledger.totalProblems,
    itemCount: items.length,
    hasOnlyReadyWarmup: items[0]?.id === 'ready-warmup',
    interviewAttemptCount,
    trackedCount,
  })
  const primaryAction = actionFromItem(items[0])

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, items.length, totalMinutes, reviewDebtIds.length, ledger.totalProblems),
    totalMinutes,
    reviewDebtCount: reviewDebtIds.length,
    mistakeCount: ledger.totalProblems,
    metrics: buildMetrics(items.length, totalMinutes, reviewDebtIds.length, ledger.totalProblems),
    items,
    primaryAction,
  }
}

/**
 * 构建面试前急救包 Markdown，便于用户复制到笔记或离线面试清单。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和复用急救包判断
 * @returns 可携带的 Markdown 急救清单
 */
export function buildInterviewEmergencyKitMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const kit = buildInterviewEmergencyKit(progress, now)

  return [
    `# ${progress.targetRole} 面试前急救包`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderEmergencyOverview(kit),
    renderEmergencyMetrics(kit.metrics),
    renderEmergencyItems(kit.items),
  ].join('\n').trimEnd()
}

function renderEmergencyOverview(kit: InterviewEmergencyKit): string {
  return [
    '## 急救概览',
    `- 状态：${kit.title}`,
    `- 摘要：${kit.summary}`,
    `- 预计耗时：${kit.totalMinutes} 分钟`,
    `- 下一步：${kit.primaryAction.label}，${kit.primaryAction.to}`,
    `- 说明：${kit.primaryAction.description}`,
    '',
  ].join('\n')
}

function renderEmergencyMetrics(metrics: InterviewEmergencyKitMetric[]): string {
  return [
    '## 指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderEmergencyItems(items: InterviewEmergencyKitItem[]): string {
  const lines = ['## 急救动作']

  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 类型：${ITEM_KIND_LABELS[item.kind]}`,
      `   - 耗时：${item.durationMinutes} 分钟`,
      `   - 动作：${item.actionLabel}`,
      `   - 说明：${item.description}`,
      `   - 原因：${item.reason}`,
      `   - 题目：${item.questionIds.length > 0 ? item.questionIds.join('、') : '按入口开始'}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function selectWithinBudget(candidates: InterviewEmergencyKitItem[]): InterviewEmergencyKitItem[] {
  const selected: InterviewEmergencyKitItem[] = []
  let totalMinutes = 0

  for (const item of [...candidates].sort((a, b) => b.priority - a.priority)) {
    if (selected.length >= MAX_ACTIONS) {
      break
    }
    if (totalMinutes + item.durationMinutes > MAX_TOTAL_MINUTES) {
      continue
    }
    selected.push(item)
    totalMinutes += item.durationMinutes
  }

  return selected
}

function buildReadyWarmup(progress: StudyProgress): InterviewEmergencyKitItem {
  const questionIds = progress.dailyPlan.length > 0
    ? progress.dailyPlan
    : Object.keys(progress.interviewAttempts).map(Number)

  return {
    id: 'ready-warmup',
    kind: 'sample',
    title: '轻量热身保持手感',
    description: '当前没有明显紧急风险，面试前用熟题做一轮口述热身即可。',
    reason: '最后阶段不再扩展新负担，优先保持表达稳定。',
    to: buildDailyPracticePath(questionIds),
    durationMinutes: 8,
    priority: 10,
    questionIds,
    actionLabel: '轻量热身',
  }
}

function resolveLevel(input: {
  reviewDebtCount: number
  mistakeCount: number
  itemCount: number
  hasOnlyReadyWarmup: boolean
  interviewAttemptCount: number
  trackedCount: number
}): InterviewEmergencyKitLevel {
  if (input.interviewAttemptCount === 0 && input.trackedCount === 0 && !input.reviewDebtCount && !input.mistakeCount) {
    return 'empty'
  }
  if (input.reviewDebtCount > 0 || input.mistakeCount > 0) {
    return 'critical'
  }
  if (input.hasOnlyReadyWarmup) {
    return 'ready'
  }
  return 'focused'
}

function titleForLevel(level: InterviewEmergencyKitLevel): string {
  if (level === 'empty') {
    return '先建立临场样本'
  }
  if (level === 'critical') {
    return '面试前先压最高风险'
  }
  if (level === 'ready') {
    return '可以轻量热身'
  }
  return '按急救包完成最后校准'
}

function summaryForLevel(
  level: InterviewEmergencyKitLevel,
  itemCount: number,
  totalMinutes: number,
  reviewDebtCount: number,
  mistakeCount: number,
): string {
  if (level === 'empty') {
    return '先用 12 分钟完成一次模拟面试，让后续急救包有真实表达证据。'
  }
  if (level === 'critical') {
    return `未来 ${totalMinutes} 分钟处理 ${itemCount} 个动作：${reviewDebtCount} 道复习债，${mistakeCount} 个错因信号。`
  }
  if (level === 'ready') {
    return '今日闭环和表达风险都比较稳定，面试前只需要轻量热身。'
  }
  return `用 ${totalMinutes} 分钟完成 ${itemCount} 个动作，把最后一轮训练收束到可执行队列。`
}

function buildMetrics(
  itemCount: number,
  totalMinutes: number,
  reviewDebtCount: number,
  mistakeCount: number,
): InterviewEmergencyKitMetric[] {
  return [
    {
      key: 'actions',
      label: '行动数',
      value: `${itemCount} 个`,
      detail: itemCount > 0 ? '已压缩排序' : '等待样本',
    },
    {
      key: 'minutes',
      label: '预计耗时',
      value: `${totalMinutes} 分钟`,
      detail: '控制在 30 分钟内',
    },
    {
      key: 'review',
      label: '复习债',
      value: `${reviewDebtCount} 道`,
      detail: reviewDebtCount > 0 ? '优先处理' : '暂无到期压力',
    },
    {
      key: 'mistake',
      label: '错因信号',
      value: `${mistakeCount} 个`,
      detail: mistakeCount > 0 ? '需要回炉' : '暂无明显低分',
    },
  ]
}

function actionFromItem(item: InterviewEmergencyKitItem): InterviewEmergencyKitAction {
  return {
    label: item.actionLabel,
    description: item.description,
    to: item.to || '/practice',
  }
}
