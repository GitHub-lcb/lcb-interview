import type {
  InterviewCriterionKey,
  InterviewLastMinuteBrief,
  InterviewLastMinuteBriefAction,
  InterviewLastMinuteBriefItem,
  InterviewLastMinuteBriefLevel,
  InterviewLastMinuteBriefMetric,
  StudyProgress,
} from '../types'
import { buildInterviewEmergencyKit } from './interviewEmergencyKit'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewReviewSummary } from './interviewReview'
import { buildDailyPracticePath } from './practiceRoute'
import { buildScheduledReviewQueue } from './reviewSchedule'

const MAX_ITEMS = 5

const ITEM_KIND_LABELS: Record<InterviewLastMinuteBriefItem['kind'], string> = {
  'must-review': '必看复习',
  'talk-track': '进场主线',
  avoid: '失分禁忌',
  closing: '收尾话术',
  sample: '模拟样本',
}

/**
 * 最后 24 小时面试简报，把本地学习轨迹压缩成进场前可执行的一页清单。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于判断复习债和临场风险
 * @returns 面试前最后 24 小时简报
 */
export function buildInterviewLastMinuteBrief(
  progress: StudyProgress,
  now = new Date().toISOString(),
): InterviewLastMinuteBrief {
  const emergencyKit = buildInterviewEmergencyKit(progress, now)
  const reviewDebtItems = buildScheduledReviewQueue(progress, now, 12)
    .filter(item => item.dueStatus !== 'upcoming')
  const reviewDebtIds = reviewDebtItems.map(item => item.id)
  const mistakeLedger = buildInterviewMistakeLedger(progress)
  const reviewSummary = buildInterviewReviewSummary(progress)
  const interviewAttemptCount = reviewSummary.totalAttempts
  const trackedCount = Object.keys(progress.questionStates).length
  const masteredCount = Object.values(progress.questionStates).filter(state => state.status === 'mastered').length
  const mistakeCount = mistakeLedger.totalProblems
  const confidenceScore = resolveConfidenceScore({
    averageScore: reviewSummary.averageScore,
    emergencyLevel: emergencyKit.level,
    interviewAttemptCount,
    masteredCount,
    mistakeCount,
    reviewDebtCount: reviewDebtIds.length,
    trackedCount,
  })
  const level = resolveLevel(confidenceScore, trackedCount, interviewAttemptCount, reviewDebtIds.length, mistakeCount)

  if (level === 'empty') {
    const items = [buildFirstSampleItem()]
    return {
      level,
      title: titleForLevel(level),
      summary: summaryForLevel(level, confidenceScore, reviewDebtIds.length, mistakeCount),
      confidenceScore,
      metrics: buildMetrics(confidenceScore, interviewAttemptCount, reviewDebtIds.length, mistakeCount, reviewSummary.averageScore),
      items,
      primaryAction: actionFromItem(items[0]),
    }
  }

  const candidates: InterviewLastMinuteBriefItem[] = []

  if (reviewDebtIds.length > 0) {
    candidates.push({
      id: 'must-review-debt',
      kind: 'must-review',
      title: `${reviewDebtIds.length} 道复习债面试前必须回看`,
      detail: '先用最短路径把逾期和今日到期题过一遍，避免临场被熟题打穿。',
      evidence: reviewDebtItems[0]?.scheduleReason ?? '复习窗口已经打开。',
      to: buildDailyPracticePath(reviewDebtIds),
      questionIds: reviewDebtIds,
      priority: 120,
      actionLabel: '先复盘高风险题',
    })
  }

  const avoidItem = buildAvoidItem(progress, reviewSummary.weakestCriterion?.key, reviewSummary.weakestCriterion?.label)
  if (avoidItem) {
    candidates.push(avoidItem)
  }

  candidates.push(buildTalkTrackItem(progress))
  candidates.push(buildClosingItem(progress))

  if (interviewAttemptCount === 0) {
    candidates.push(buildFirstSampleItem())
  }

  const items = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_ITEMS)

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, confidenceScore, reviewDebtIds.length, mistakeCount),
    confidenceScore,
    metrics: buildMetrics(confidenceScore, interviewAttemptCount, reviewDebtIds.length, mistakeCount, reviewSummary.averageScore),
    items,
    primaryAction: actionFromItem(items[0]),
  }
}

/**
 * 构建最后 24 小时面试简报 Markdown，便于用户复制到面试前笔记。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和复用简报判断
 * @returns 可携带的 Markdown 进场简报
 */
export function buildInterviewLastMinuteBriefMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const brief = buildInterviewLastMinuteBrief(progress, now)

  return [
    `# ${progress.targetRole} 最后 24 小时面试简报`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderLastMinuteOverview(brief),
    renderLastMinuteMetrics(brief.metrics),
    renderLastMinuteItems(brief.items),
  ].join('\n').trimEnd()
}

function renderLastMinuteOverview(brief: InterviewLastMinuteBrief): string {
  return [
    '## 简报概览',
    `- 状态：${brief.title}`,
    `- 摘要：${brief.summary}`,
    `- 进场信心：${brief.confidenceScore} 分`,
    `- 下一步：${brief.primaryAction.label}，${brief.primaryAction.to}`,
    `- 说明：${brief.primaryAction.description}`,
    '',
  ].join('\n')
}

function renderLastMinuteMetrics(metrics: InterviewLastMinuteBriefMetric[]): string {
  return [
    '## 指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderLastMinuteItems(items: InterviewLastMinuteBriefItem[]): string {
  const lines = ['## 进场动作']

  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 类型：${ITEM_KIND_LABELS[item.kind]}`,
      `   - 动作：${item.actionLabel}`,
      `   - 说明：${item.detail}`,
      `   - 证据：${item.evidence}`,
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

function buildAvoidItem(
  progress: StudyProgress,
  criterionKey?: InterviewCriterionKey,
  criterionLabel?: string,
): InterviewLastMinuteBriefItem | null {
  if (!criterionKey || !criterionLabel) {
    return null
  }

  const questionIds = Object.entries(progress.interviewAttempts)
    .filter(([, attempts]) => attempts.some(attempt => (
      attempt.feedback.criteria.some(criterion => criterion.key === criterionKey && criterion.score < 70)
    )))
    .map(([questionId]) => Number(questionId))
    .slice(0, 8)

  if (questionIds.length === 0) {
    return null
  }

  return {
    id: `avoid-${criterionKey}`,
    kind: 'avoid',
    title: `不要再让${criterionLabel}失分`,
    detail: avoidGuidance(criterionKey),
    evidence: `${questionIds.length} 道模拟回答暴露了这个薄弱维度。`,
    to: buildDailyPracticePath(questionIds),
    questionIds,
    priority: 100,
    actionLabel: '回看失分禁忌',
  }
}

function buildTalkTrackItem(progress: StudyProgress): InterviewLastMinuteBriefItem {
  const strongestCategory = resolveStrongestCategory(progress)
  const questionIds = buildKnownQuestionIds(progress)

  return {
    id: 'talk-track',
    kind: 'talk-track',
    title: `进场主线：${progress.targetRole}`,
    detail: `开场先对齐目标岗位，再用「${strongestCategory}」做技术主线，回答时固定按结论、原理、场景、边界收束。`,
    evidence: strongestCategory === '核心题域'
      ? '当前轨迹还不够集中，先使用通用结构稳定表达。'
      : `本地轨迹里「${strongestCategory}」的掌握信号最稳定。`,
    to: buildDailyPracticePath(questionIds),
    questionIds,
    priority: 70,
    actionLabel: '演练进场主线',
  }
}

function buildClosingItem(progress: StudyProgress): InterviewLastMinuteBriefItem {
  const questionIds = buildKnownQuestionIds(progress)

  return {
    id: 'closing',
    kind: 'closing',
    title: '最后 30 秒用复盘式收尾',
    detail: '每道题结束前补一句「如果放到项目里，我会重点关注容量、回滚和监控」，把答案从背诵拉到工程落地。',
    evidence: '临场收尾比继续堆知识点更能显出工程判断。',
    to: buildDailyPracticePath(questionIds),
    questionIds,
    priority: 50,
    actionLabel: '练一轮收尾',
  }
}

function buildFirstSampleItem(): InterviewLastMinuteBriefItem {
  return {
    id: 'first-sample',
    kind: 'sample',
    title: '先建立一题真实开口样本',
    detail: '随机挑一道题完整说 3 分钟，让系统拿到表达证据后再生成更准的临场简报。',
    evidence: '没有开口样本时，最后 24 小时无法判断表达断点。',
    to: '/practice',
    questionIds: [],
    priority: 90,
    actionLabel: '先做一题模拟',
  }
}

function resolveStrongestCategory(progress: StudyProgress): string {
  const buckets = new Map<string, number>()

  for (const [id, snapshot] of Object.entries(progress.questionSnapshots)) {
    const questionId = Number(id)
    const state = progress.questionStates[questionId]
    const attemptCount = progress.interviewAttempts[questionId]?.length ?? 0
    let score = attemptCount

    if (state?.status === 'mastered') {
      score += 3
    } else if (state?.status === 'learning') {
      score += 2
    } else if (state?.status === 'weak') {
      score += 1
    }

    if (score === 0) {
      continue
    }

    buckets.set(snapshot.categoryName, (buckets.get(snapshot.categoryName) ?? 0) + score)
  }

  return [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '核心题域'
}

function buildKnownQuestionIds(progress: StudyProgress): number[] {
  const ids = [
    ...progress.dailyPlan,
    ...Object.keys(progress.interviewAttempts).map(Number),
    ...Object.keys(progress.questionStates).map(Number),
  ]
  return [...new Set(ids.filter(Number.isFinite))].slice(0, 8)
}

function resolveConfidenceScore(input: {
  averageScore: number
  emergencyLevel: string
  interviewAttemptCount: number
  masteredCount: number
  mistakeCount: number
  reviewDebtCount: number
  trackedCount: number
}): number {
  if (input.interviewAttemptCount === 0 && input.trackedCount === 0) {
    return 0
  }

  const score = 30
    + Math.min(25, input.interviewAttemptCount * 10)
    + (input.interviewAttemptCount > 0 ? Math.round(input.averageScore * 0.35) : 0)
    + Math.min(15, input.masteredCount * 4)
    - Math.min(30, input.reviewDebtCount * 10)
    - Math.min(25, input.mistakeCount * 8)
    - (input.emergencyLevel === 'critical' ? 10 : 0)

  return Math.max(0, Math.min(100, score))
}

function resolveLevel(
  confidenceScore: number,
  trackedCount: number,
  interviewAttemptCount: number,
  reviewDebtCount: number,
  mistakeCount: number,
): InterviewLastMinuteBriefLevel {
  if (trackedCount === 0 && interviewAttemptCount === 0) {
    return 'empty'
  }
  if (reviewDebtCount > 0 || mistakeCount > 0 || confidenceScore < 60) {
    return 'risk'
  }
  if (confidenceScore >= 80) {
    return 'ready'
  }
  return 'focused'
}

function titleForLevel(level: InterviewLastMinuteBriefLevel): string {
  if (level === 'empty') {
    return '先生成第一份进场简报'
  }
  if (level === 'risk') {
    return '最后 24 小时先压临场风险'
  }
  if (level === 'ready') {
    return '可以带着主线进场'
  }
  return '按简报完成最后校准'
}

function summaryForLevel(
  level: InterviewLastMinuteBriefLevel,
  confidenceScore: number,
  reviewDebtCount: number,
  mistakeCount: number,
): string {
  if (level === 'empty') {
    return '先完成一题免费模拟面试，系统会据此生成更贴近你真实表达的进场清单。'
  }
  if (level === 'risk') {
    return `进场信心 ${confidenceScore} 分，优先处理 ${reviewDebtCount} 道复习债和 ${mistakeCount} 个错因信号。`
  }
  if (level === 'ready') {
    return `进场信心 ${confidenceScore} 分，保持主线、禁忌和收尾话术即可。`
  }
  return `进场信心 ${confidenceScore} 分，按清单完成一轮表达校准。`
}

function buildMetrics(
  confidenceScore: number,
  interviewAttemptCount: number,
  reviewDebtCount: number,
  mistakeCount: number,
  averageScore: number,
): InterviewLastMinuteBriefMetric[] {
  return [
    {
      key: 'confidence',
      label: '进场信心',
      value: `${confidenceScore} 分`,
      detail: confidenceScore >= 80 ? '主线稳定' : '仍需校准',
    },
    {
      key: 'attempts',
      label: '面试样本',
      value: `${interviewAttemptCount} 次`,
      detail: interviewAttemptCount > 0 ? '已有表达证据' : '等待开口样本',
    },
    {
      key: 'review',
      label: '复习债',
      value: `${reviewDebtCount} 道`,
      detail: reviewDebtCount > 0 ? '进场前先清' : '暂无到期压力',
    },
    {
      key: 'mistake',
      label: '错因数',
      value: `${mistakeCount} 个`,
      detail: mistakeCount > 0 ? '需要禁忌提醒' : '无明显低分信号',
    },
    {
      key: 'average',
      label: '平均表达',
      value: interviewAttemptCount > 0 ? `${Math.round(averageScore)} 分` : '暂无',
      detail: interviewAttemptCount > 0 ? '来自模拟面试' : '先完成一题',
    },
  ]
}

function avoidGuidance(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '不要只背概念，先补定义、适用场景、关键机制和边界条件。'
  }
  if (key === 'structure') {
    return '不要散点回答，先给结论，再按三段式展开，最后回到工程取舍。'
  }
  if (key === 'specificity') {
    return '不要只讲一般情况，主动补项目场景、数据量、指标或故障处理细节。'
  }
  return '不要漏掉风险，主动补并发、一致性、回滚、监控和容量边界。'
}

function actionFromItem(item: InterviewLastMinuteBriefItem): InterviewLastMinuteBriefAction {
  return {
    label: item.actionLabel,
    description: item.detail,
    to: item.to,
  }
}
