import type {
  InterviewMistakeLedgerItem,
  NextTrainingQueue,
  NextTrainingQueueAction,
  NextTrainingQueueItem,
  NextTrainingQueueMetric,
  QuestionSnapshot,
  ReviewDueStatus,
  ScheduledReviewItem,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { appendPracticeHandoffSource, buildDailyPracticePath } from './practiceRoute'
import { buildScheduledReviewQueue } from './reviewSchedule'
import { getQuestionState } from './studyProgress'

const DEFAULT_LIMIT = 8
const REVIEW_SCAN_LIMIT = 30
const MISTAKE_SCAN_LIMIT = 4
const NEXT_TRAINING_SOURCE = 'next-training'

interface RankedQueueItem extends NextTrainingQueueItem {
  order: number
}

export function buildNextTrainingQueue(
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = DEFAULT_LIMIT,
): NextTrainingQueue {
  const builder = createQueueBuilder()

  addScoreImpactItems(builder, progress, now)
  addReviewDebtItems(builder, progress, now)
  addMistakeItems(builder, progress)
  addStatusItems(builder, progress, 'weak')
  addStatusItems(builder, progress, 'learning')
  addPlanItems(builder, progress)

  const items = [...builder.items.values()]
    .sort(compareRankedItems)
    .slice(0, Math.max(0, limit))
    .map(({ order: _order, ...item }) => item)
  const totalCount = items.length
  const urgentCount = items.filter(isUrgentItem).length
  const weakCount = items.filter(item => item.status === 'weak').length
  const interviewRepairCount = items.filter(isInterviewRepairItem).length
  const primaryAction = buildPrimaryAction(items)

  if (items.length === 0) {
    return {
      title: '下一轮队列待生成',
      summary: '先完成一次模拟面试或把题目加入今日计划，系统会按评分、复习债和错因自动生成训练队列。',
      totalCount,
      urgentCount,
      weakCount,
      interviewRepairCount,
      metrics: buildMetrics(totalCount, urgentCount, weakCount, interviewRepairCount),
      items,
      primaryAction,
    }
  }

  return {
    title: '下一轮训练队列',
    summary: `已按评分影响、复习债、面试错因和今日计划排好 ${items.length} 道题。`,
    totalCount,
    urgentCount,
    weakCount,
    interviewRepairCount,
    metrics: buildMetrics(totalCount, urgentCount, weakCount, interviewRepairCount),
    items,
    primaryAction,
  }
}

export function buildNextTrainingQueueMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = DEFAULT_LIMIT,
): string {
  const queue = buildNextTrainingQueue(progress, now, limit)

  return [
    `# ${sanitizeMarkdownValue(progress.targetRole, '岗位')} 下一轮训练队列`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderOverview(queue),
    renderMetrics(queue.metrics),
    renderTrainingItems(queue.items),
    renderPrimaryAction(queue.primaryAction),
  ].join('\n').trimEnd()
}

function createQueueBuilder(): { items: Map<number, RankedQueueItem>; order: number } {
  return {
    items: new Map<number, RankedQueueItem>(),
    order: 0,
  }
}

function uniquePositiveIds(questionIds: number[]): number[] {
  return [
    ...new Set(
      questionIds.filter(questionId => Number.isInteger(questionId) && questionId > 0),
    ),
  ]
}

function addScoreImpactItems(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  progress: StudyProgress,
  now: string,
): void {
  const completion = buildDailyPlanCompletion(progress, now)

  for (const impact of completion.statusImpacts) {
    const snapshot = resolveSnapshot(progress, impact.questionId)
    pushQueueItem(builder, {
      id: `score-impact-${impact.questionId}`,
      questionId: impact.questionId,
      title: impact.title,
      categoryName: snapshot.categoryName,
      status: impact.status,
      source: 'score-impact',
      sourceLabel: '评分影响',
      reason: `${impact.score} 分，${impact.message}`,
      actionLabel: impact.actionLabel,
      to: withNextTrainingSource(impact.to),
      priority: scoreImpactPriority(impact.status),
      score: impact.score,
    })
  }
}

function addReviewDebtItems(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  progress: StudyProgress,
  now: string,
): void {
  const reviewDebts = buildScheduledReviewQueue(progress, now, REVIEW_SCAN_LIMIT)
    .filter(item => item.dueStatus !== 'upcoming')

  for (const item of reviewDebts) {
    const isActiveRecall = isActiveRecallReview(item)
    pushQueueItem(builder, {
      id: `review-debt-${item.id}`,
      questionId: item.id,
      title: item.title,
      categoryName: item.categoryName,
      status: item.status,
      source: 'review-debt',
      sourceLabel: isActiveRecall ? '主动回忆' : '复习债',
      reason: item.scheduleReason,
      actionLabel: isActiveRecall ? '做一次主动回忆' : '复盘到期题',
      to: buildDailyPracticePath([item.id], 12, 'review-due'),
      priority: reviewDebtPriority(item),
      dueStatus: item.dueStatus,
    })
  }
}

function isActiveRecallReview(item: ScheduledReviewItem): boolean {
  return item.status === 'new' && item.reviewCount === 0 && item.scheduleReason.includes('多次遇见')
}

function addMistakeItems(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  progress: StudyProgress,
): void {
  const ledger = buildInterviewMistakeLedger(progress)

  const mistakeItems = ledger.items
    .filter(item => item.type !== 'advanced')
    .slice(0, MISTAKE_SCAN_LIMIT)

  for (const mistake of mistakeItems) {
    for (const questionId of mistake.affectedQuestionIds) {
      const snapshot = resolveSnapshot(progress, questionId)
      pushQueueItem(builder, {
        id: `mistake-${mistake.id}-${questionId}`,
        questionId,
        title: snapshot.title,
        categoryName: snapshot.categoryName,
        status: getQuestionState(progress, questionId).status,
        source: 'mistake',
        sourceLabel: '面试错因',
        reason: mistake.summary,
        actionLabel: mistake.actionLabel,
        to: withNextTrainingSource(buildMistakeItemPath(mistake, questionId)),
        priority: mistakePriority(mistake),
      })
    }
  }
}

function addStatusItems(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  progress: StudyProgress,
  status: 'weak' | 'learning',
): void {
  const items = Object.entries(progress.questionStates)
    .filter(([, state]) => state.status === status)
    .map(([questionIdText]) => Number(questionIdText))
  const questionIds = uniquePositiveIds(items)
    .sort((left, right) => left - right)

  for (const questionId of questionIds) {
    const snapshot = resolveSnapshot(progress, questionId)
    const isWeak = status === 'weak'
    pushQueueItem(builder, {
      id: `${status}-${questionId}`,
      questionId,
      title: snapshot.title,
      categoryName: snapshot.categoryName,
      status,
      source: status,
      sourceLabel: isWeak ? '薄弱题' : '学习中',
      reason: isWeak
        ? '仍是薄弱状态，先用原理、边界和项目场景讲清。'
        : '学习中题继续巩固，避免只看过但讲不出来。',
      actionLabel: isWeak ? '修复薄弱' : '继续巩固',
      to: buildDailyPracticePath([questionId], 12, NEXT_TRAINING_SOURCE),
      priority: isWeak ? 80 : 60,
    })
  }
}

function addPlanItems(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  progress: StudyProgress,
): void {
  const planIds = uniquePositiveIds(progress.dailyPlan)

  for (const questionId of planIds) {
    const state = getQuestionState(progress, questionId)
    if (state.status === 'mastered') {
      continue
    }
    const snapshot = resolveSnapshot(progress, questionId)
    pushQueueItem(builder, {
      id: `plan-${questionId}`,
      questionId,
      title: snapshot.title,
      categoryName: snapshot.categoryName,
      status: state.status,
      source: 'plan',
      sourceLabel: '今日计划',
      reason: '来自今日计划，保持执行节奏。',
      actionLabel: '推进计划',
      to: buildDailyPracticePath([questionId], 12, 'daily-plan'),
      priority: 50,
    })
  }
}

function pushQueueItem(
  builder: { items: Map<number, RankedQueueItem>; order: number },
  item: NextTrainingQueueItem,
): void {
  const existing = builder.items.get(item.questionId)
  if (existing && existing.priority >= item.priority) {
    return
  }

  // 同一题只保留最高优先级原因，避免一个入口里重复训练同一道题。
  builder.items.set(item.questionId, {
    ...item,
    order: existing?.order ?? builder.order,
  })
  if (!existing) {
    builder.order += 1
  }
}

function compareRankedItems(left: RankedQueueItem, right: RankedQueueItem): number {
  const priorityDiff = right.priority - left.priority
  if (priorityDiff !== 0) {
    return priorityDiff
  }
  const orderDiff = left.order - right.order
  if (orderDiff !== 0) {
    return orderDiff
  }
  return left.questionId - right.questionId
}

function buildPrimaryAction(items: NextTrainingQueueItem[]): NextTrainingQueueAction {
  if (items.length === 0) {
    return {
      label: '先做一次模拟面试',
      description: '先建立评分样本，系统才能生成下一轮个性化训练队列。',
      to: '/practice',
    }
  }

  const activeItems = items.filter(item => item.status !== 'mastered')
  const activeQuestionIds = activeItems.map(item => item.questionId)
  if (activeQuestionIds.length === 0) {
    return {
      label: '沉淀高分题目',
      description: '当前队列都是已掌握题，先沉淀成可复用的面试表达素材。',
      to: items[0].to,
    }
  }

  return {
    label: '开始下一轮训练',
    description: '按评分、复习债和错因优先级进入下一轮练习。',
    to: buildDailyPracticePath(activeQuestionIds, 12, practiceSourceForPrimaryAction(activeItems)),
  }
}

function practiceSourceForPrimaryAction(items: NextTrainingQueueItem[]): string | undefined {
  const sources = new Set(items.map(item => item.source))
  if ([...sources].every(isGenericNextTrainingSource)) {
    return NEXT_TRAINING_SOURCE
  }

  if (sources.size !== 1) {
    return NEXT_TRAINING_SOURCE
  }

  const source = items[0]?.source
  if (source === 'review-debt') {
    return 'review-due'
  }
  if (source === 'plan') {
    return 'daily-plan'
  }
  return undefined
}

function isGenericNextTrainingSource(source: NextTrainingQueueItem['source']): boolean {
  return source === 'score-impact'
    || source === 'mistake'
    || source === 'weak'
    || source === 'learning'
}

function withNextTrainingSource(to: string): string {
  return appendPracticeHandoffSource(to, NEXT_TRAINING_SOURCE)
}

function buildMetrics(
  totalCount: number,
  urgentCount: number,
  weakCount: number,
  interviewRepairCount: number,
): NextTrainingQueueMetric[] {
  return [
    {
      key: 'total',
      label: '队列题',
      value: `${totalCount} 道`,
      detail: totalCount > 0 ? '已按优先级去重' : '等待训练证据',
    },
    {
      key: 'urgent',
      label: '紧急项',
      value: `${urgentCount} 个`,
      detail: urgentCount > 0 ? '先处理评分、复习债和错因' : '暂无高压项',
    },
    {
      key: 'weak',
      label: '薄弱题',
      value: `${weakCount} 道`,
      detail: weakCount > 0 ? '需要重答补强' : '暂无薄弱题',
    },
    {
      key: 'interview',
      label: '面试修复',
      value: `${interviewRepairCount} 项`,
      detail: interviewRepairCount > 0 ? '来自评分或错因账本' : '等待模拟面试样本',
    },
  ]
}

function renderOverview(queue: NextTrainingQueue): string {
  return [
    '## 队列概览',
    `- 状态：${queue.title}`,
    `- 摘要：${queue.summary}`,
    `- 主行动：${queue.primaryAction.label}`,
    `- 入口：${queue.primaryAction.to}`,
    '',
  ].join('\n')
}

function renderMetrics(metrics: NextTrainingQueueMetric[]): string {
  return [
    '## 指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderTrainingItems(items: NextTrainingQueueItem[]): string {
  if (items.length === 0) {
    return [
      '## 训练题单',
      '- 暂无下一轮训练题。先完成一次模拟面试或生成今日计划。',
      '',
    ].join('\n')
  }

  const lines = ['## 训练题单']
  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${sanitizeMarkdownValue(item.title, `题目 #${item.questionId}`)}`,
      `   - 来源：${item.sourceLabel}`,
      `   - 分类：${sanitizeMarkdownValue(item.categoryName, '未分组')}`,
      `   - 状态：${statusLabel(item.status)}`,
      `   - 原因：${sanitizeMarkdownValue(item.reason, '按当前学习状态进入下一轮训练。')}`,
      `   - 行动：${item.actionLabel}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderPrimaryAction(action: NextTrainingQueueAction): string {
  return [
    '## 下一步',
    `- 动作：${action.label}`,
    `- 说明：${action.description}`,
    `- 入口：${action.to}`,
  ].join('\n')
}

function resolveSnapshot(progress: StudyProgress, questionId: number): QuestionSnapshot {
  return progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)
}

function fallbackSnapshot(questionId: number): QuestionSnapshot {
  return {
    id: questionId,
    title: `题目 #${questionId}`,
    difficulty: 'MEDIUM',
    categoryName: '未分组',
    tags: [],
    viewCount: 0,
  }
}

function scoreImpactPriority(status: StudyQuestionStatus): number {
  if (status === 'weak') {
    return 130
  }
  if (status === 'learning') {
    return 120
  }
  return 70
}

function reviewDebtPriority(item: ScheduledReviewItem): number {
  return item.dueStatus === 'overdue' ? 115 : 105
}

function mistakePriority(item: InterviewMistakeLedgerItem): number {
  return 90 + Math.min(25, Math.max(0, item.priority))
}

function isUrgentItem(item: NextTrainingQueueItem): boolean {
  if (item.source === 'score-impact') {
    return item.status !== 'mastered'
  }
  return item.source === 'review-debt' || item.source === 'mistake'
}

function isInterviewRepairItem(item: NextTrainingQueueItem): boolean {
  if (item.source === 'score-impact') {
    return item.status !== 'mastered'
  }
  return item.source === 'mistake'
}

function buildMistakeItemPath(item: InterviewMistakeLedgerItem, questionId: number): string {
  if (item.affectedQuestionIds.length === 1) {
    return item.to
  }
  return buildDailyPracticePath([questionId])
}

function statusLabel(status: StudyQuestionStatus): string {
  if (status === 'weak') {
    return '薄弱'
  }
  if (status === 'learning') {
    return '学习中'
  }
  if (status === 'mastered') {
    return '已掌握'
  }
  return '新题'
}

function dueStatusLabel(status?: ReviewDueStatus): string {
  if (status === 'overdue') {
    return '已逾期'
  }
  if (status === 'due-today') {
    return '今日到期'
  }
  if (status === 'upcoming') {
    return '即将到期'
  }
  return ''
}

function formatMarkdownDate(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function sanitizeMarkdownValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

export function formatNextTrainingQueueItemMeta(item: NextTrainingQueueItem): string {
  const dueLabel = dueStatusLabel(item.dueStatus)
  return dueLabel
    ? `${item.sourceLabel} · ${dueLabel} · ${statusLabel(item.status)}`
    : `${item.sourceLabel} · ${statusLabel(item.status)}`
}
