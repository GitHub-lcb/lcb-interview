import type {
  DailyPlanCompletion,
  InterviewFollowUpDefense,
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewMaterialVault,
  NextTrainingQueue,
  PracticeQueueItem,
  PracticeSessionReport,
  PracticeSessionReportAction,
  PracticeSessionReportLevel,
  PracticeSessionReportMetric,
  PracticeSessionQueueProfile,
  PracticeSessionRepairAction,
  QuestionSnapshot,
  StudyProgress,
} from '../types'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewFollowUpDefense } from './interviewFollowUpDefense'
import { buildInterviewMaterialVault } from './interviewMaterialVault'
import { buildNextTrainingQueue, formatNextTrainingQueueItemMeta } from './nextTrainingQueue'

const PASSING_SCORE = 70
const STRONG_SESSION_SCORE = 80

const queueSourceLabels: Record<PracticeQueueItem['source'], string> = {
  review: '复习优先',
  plan: '今日计划',
  page: '当前筛选',
  new: '新题训练',
}

const statusLabels: Record<PracticeQueueItem['status'], string> = {
  new: '新题',
  learning: '学习中',
  mastered: '已掌握',
  weak: '薄弱',
}

const difficultyLabels: Record<string, string> = {
  EASY: '简单',
  MEDIUM: '中等',
  HARD: '困难',
}

interface SessionAttemptItem {
  question: PracticeQueueItem
  attempt?: InterviewAttempt
}

interface WeakestCriterionSummary {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  summary: string
}

export function buildPracticeSessionReport(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionReport {
  // 只取当前队列每题的最新一次尝试，避免历史旧分数或队列外训练污染本轮战报。
  const sessionItems = queue.map(question => ({
    question,
    attempt: latestAttemptForQuestion(progress, question.id),
  }))
  const answeredItems = sessionItems.filter(item => Boolean(item.attempt))
  const totalCount = queue.length
  const answeredCount = answeredItems.length
  const weakQuestionIds = resolveWeakQuestionIds(sessionItems, progress)
  const repairActions = buildRepairActions(sessionItems, progress)
  const queueProfile = buildQueueProfile(queue, progress, weakQuestionIds)

  if (totalCount === 0 || answeredCount === 0) {
    return buildEmptyReport(totalCount, repairActions, weakQuestionIds, queueProfile)
  }

  const averageScore = Math.round(
    answeredItems.reduce((sum, item) => sum + (item.attempt?.feedback.score ?? 0), 0) / answeredCount,
  )
  const passCount = answeredItems.filter(item => (item.attempt?.feedback.score ?? 0) >= PASSING_SCORE).length
  const weakestCriterion = summarizeWeakestCriterion(answeredItems)
  const unansweredIds = sessionItems
    .filter(item => !item.attempt)
    .map(item => item.question.id)
  const level = resolveLevel({
    answeredCount,
    averageScore,
    totalCount,
    weakQuestionIds,
  })
  const primaryAction = buildPrimaryAction(level, weakQuestionIds, unansweredIds)

  return {
    level,
    title: titleForLevel(level, unansweredIds.length),
    summary: summaryForLevel(level, answeredCount, totalCount, averageScore, weakQuestionIds.length),
    answeredCount,
    totalCount,
    averageScore,
    passCount,
    weakQuestionIds,
    metrics: buildMetrics({
      answeredCount,
      totalCount,
      averageScore,
      passCount,
      weakestCriterion,
      unansweredCount: unansweredIds.length,
    }),
    repairActions,
    queueProfile,
    primaryAction,
  }
}

export function buildPracticeSessionReportMarkdown(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const report = buildPracticeSessionReport(queue, progress)

  return [
    `# ${progress.targetRole} 本轮模拟面试战报`,
    '',
    `生成时间：${formatDate(now)}`,
    `队列题数：${queue.length}`,
    '',
    renderSessionSummary(report),
    renderSessionMetrics(report.metrics),
    renderSessionQueueProfile(report.queueProfile),
    renderSessionDailyClosure(queue, progress, now),
    renderSessionMaterialVault(queue, progress),
    renderSessionFollowUpDefense(queue, progress),
    renderSessionNextTraining(queue, progress, now),
    renderSessionRepairActions(report.repairActions),
    renderSessionQueue(queue, progress),
    renderSessionAction(report.primaryAction),
  ].join('\n')
}

export function buildPracticeSessionNextTrainingQueue(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = 5,
): NextTrainingQueue {
  return buildNextTrainingQueue(buildPracticeSessionProgressContext(queue, progress), now, limit)
}

export function buildPracticeSessionDailyCompletion(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): DailyPlanCompletion {
  return buildDailyPlanCompletion(buildPracticeSessionProgressContext(queue, progress), now)
}

export function buildPracticeSessionMaterialVault(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewMaterialVault {
  const queueIdSet = new Set(
    queue
      .map(item => item.id)
      .filter(questionId => Number.isFinite(questionId) && questionId > 0),
  )
  const context = buildPracticeSessionProgressContext(queue, progress)
  const interviewAttempts = Object.fromEntries(
    Object.entries(context.interviewAttempts)
      .filter(([questionId]) => queueIdSet.has(Number(questionId))),
  )

  return buildInterviewMaterialVault({
    ...context,
    interviewAttempts,
  })
}

export function buildPracticeSessionFollowUpDefense(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewFollowUpDefense {
  const queueIdSet = new Set(
    queue
      .map(item => item.id)
      .filter(questionId => Number.isFinite(questionId) && questionId > 0),
  )
  const context = buildPracticeSessionProgressContext(queue, progress)
  const interviewAttempts = Object.fromEntries(
    Object.entries(context.interviewAttempts)
      .filter(([questionId]) => queueIdSet.has(Number(questionId))),
  )

  return buildInterviewFollowUpDefense({
    ...context,
    interviewAttempts,
  })
}

export function buildPracticeSessionRepairDraft(action: PracticeSessionRepairAction): string {
  const hints = repairDraftHints(action.criterionKey)
  const criterionScore = typeof action.criterionScore === 'number' ? ` ${action.criterionScore} 分` : ''

  return [
    `补弱题目：${action.title}`,
    `补弱维度：${action.criterionLabel}${criterionScore}`,
    `补弱原因：${action.reason}`,
    `本次目标：${action.action}`,
    '',
    '我的重答：',
    `结论：${hints.conclusion}`,
    `原因：${hints.reason}`,
    `场景：${hints.scenario}`,
    `边界：${hints.boundary}`,
  ].join('\n')
}

function renderSessionSummary(report: PracticeSessionReport): string {
  return [
    '## 本轮摘要',
    `- 状态：${report.title}`,
    `- 说明：${report.summary}`,
    `- 已答：${report.answeredCount}/${report.totalCount}`,
    `- 平均分：${report.averageScore}`,
    `- 通过数：${report.passCount}`,
    `- 低分/薄弱题：${formatQuestionIds(report.weakQuestionIds)}`,
    '',
  ].join('\n')
}

function renderSessionMetrics(metrics: PracticeSessionReportMetric[]): string {
  return [
    '## 核心指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderSessionQueueProfile(profile: PracticeSessionQueueProfile): string {
  if (profile.isEmpty) {
    return [
      '## 队列画像',
      '- 暂无队列画像。先从学习计划、薄弱题或题库进入模拟面试。',
      '',
    ].join('\n')
  }

  return [
    '## 队列画像',
    `- 来源构成：${profile.sourceSummary}`,
    `- 下一题：${profile.nextQuestionTitle}（${profile.nextQuestionMeta}）`,
    `- 未答题：${formatQuestionIds(profile.unansweredQuestionIds)}`,
    `- 低分/薄弱题：${formatQuestionIds(profile.weakQuestionIds)}`,
    `- 队列入口：${profile.queuePath}`,
    '',
  ].join('\n')
}

function renderSessionDailyClosure(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const completion = buildPracticeSessionDailyCompletion(queue, progress, now)
  const riskCount = completion.reviewDebtCount + completion.weakCount
  const impactLines = completion.statusImpacts.length > 0
    ? completion.statusImpacts.slice(0, 4).map(impact => (
      `- 评分影响：${impact.title}，${impact.score} 分，${impact.message}；行动：${impact.actionLabel}；入口：${impact.to}`
    ))
    : ['- 评分影响：暂无计划内模拟面试评分。']

  return [
    '## 今日闭环快照',
    `- 状态：${completion.title}`,
    `- 摘要：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    `- 风险项：${riskCount}`,
    `- 今日模拟：${completion.interviewTodayCount} 次`,
    `- 主行动：${completion.primaryAction.label}，${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    ...impactLines,
    '',
  ].join('\n')
}

function renderSessionMaterialVault(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): string {
  const vault = buildPracticeSessionMaterialVault(queue, progress)
  const lines = [
    '## 本轮高分素材',
    `- 状态：${vault.title}`,
    `- 摘要：${vault.summary}`,
    `- 主行动：${vault.primaryAction.label}，${vault.primaryAction.description}（${vault.primaryAction.to}）`,
    '',
  ]

  if (vault.snippets.length === 0) {
    return [
      ...lines,
      '- 暂无本轮高分素材。完成 80 分以上模拟回答后，战报会自动沉淀可复用表达。',
      '',
    ].join('\n')
  }

  vault.snippets.slice(0, 5).forEach((snippet, index) => {
    lines.push(
      `${index + 1}. ${snippet.title}`,
      `   - 类型：${snippet.label}`,
      `   - 得分：${snippet.score} 分`,
      `   - 片段：${snippet.content}`,
      `   - 原因：${snippet.reason}`,
      `   - 入口：${snippet.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionFollowUpDefense(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): string {
  const defense = buildPracticeSessionFollowUpDefense(queue, progress)
  const lines = [
    '## 本轮追问防线',
    `- 状态：${defense.title}`,
    `- 摘要：${defense.summary}`,
    `- 主行动：${defense.primaryAction.label}，${defense.primaryAction.description}（${defense.primaryAction.to}）`,
    '',
  ]

  if (defense.items.length === 0) {
    return [
      ...lines,
      '- 暂无本轮追问防线。完成一次模拟面试后，战报会自动生成可防守追问。',
      '',
    ].join('\n')
  }

  defense.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 维度：${item.criterionLabel}`,
      `   - 得分：${item.score} 分`,
      `   - 追问：${item.prompt}`,
      `   - 压力点：${item.pressurePoint}`,
      `   - 回答引导：${item.answerGuide}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionNextTraining(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)
  const lines = [
    '## 下一轮训练建议',
    `- 状态：${nextQueue.title}`,
    `- 摘要：${nextQueue.summary}`,
    `- 下一步：${nextQueue.primaryAction.label}`,
    `- 说明：${nextQueue.primaryAction.description}`,
    `- 入口：${nextQueue.primaryAction.to}`,
    '',
  ]

  if (nextQueue.items.length === 0) {
    return [
      ...lines,
      '- 暂无下一轮训练题。先做一次模拟面试或生成今日计划后，系统会自动排下一轮。',
      '',
    ].join('\n')
  }

  nextQueue.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 来源：${formatNextTrainingQueueItemMeta(item)}`,
      `   - 原因：${item.reason}`,
      `   - 行动：${item.actionLabel}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionRepairActions(actions: PracticeSessionRepairAction[]): string {
  const lines = actions.length > 0
    ? actions.map((action, index) => [
      `${index + 1}. ${action.title}`,
      `   - 维度：${action.criterionLabel}`,
      `   - 原因：${action.reason}`,
      `   - 动作：${action.action}`,
      `   - 入口：${action.to}`,
      '   - 重答模板：',
      indentRepairDraft(buildPracticeSessionRepairDraft(action)),
    ].join('\n'))
    : ['- 暂无补弱动作，先完成本轮评分后自动生成。']

  return [
    '## 补弱动作清单',
    ...lines,
    '',
  ].join('\n')
}

function indentRepairDraft(draft: string): string {
  return draft
    .split('\n')
    .map(line => `     ${line}`)
    .join('\n')
}

function renderSessionQueue(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const lines = queue.length > 0
    ? queue.map((item, index) => {
      const latestScore = latestAttemptForQuestion(progress, item.id)?.feedback.score
      const status = progress.questionStates[item.id]?.status ?? item.status
      return `- ${index + 1}. ${item.title}：${item.categoryName}，${formatDifficulty(item.difficulty)}，来源 ${formatQueueSource(item.source)}，状态 ${formatStatus(status)}，最近评分 ${formatScore(latestScore)}`
    })
    : ['- 暂无题目，先从学习计划、弱题或题库进入模拟面试。']

  return [
    '## 题目队列',
    ...lines,
    '',
  ].join('\n')
}

function renderSessionAction(action: PracticeSessionReportAction): string {
  return [
    '## 下一步行动',
    `- ${action.label}：${action.description}（${action.to}）`,
    '',
  ].join('\n')
}

function buildEmptyReport(
  totalCount: number,
  repairActions: PracticeSessionRepairAction[],
  weakQuestionIds: number[],
  queueProfile: PracticeSessionQueueProfile,
): PracticeSessionReport {
  const hasRepairActions = repairActions.length > 0

  return {
    level: hasRepairActions ? 'risk' : 'empty',
    title: hasRepairActions
      ? '本轮优先补弱'
      : totalCount > 0
        ? '等待开始本轮练习'
        : '先选择一组面试题',
    summary: hasRepairActions
      ? `本轮已有 ${totalCount} 道题，${repairActions.length} 道已标记薄弱；先按补弱模板完成评分。`
      : totalCount > 0
        ? `本轮已有 ${totalCount} 道题，完成第一道评分后会生成整体战报。`
        : '当前还没有练习队列，先从学习计划、弱题或题库中选择题目进入模拟面试。',
    answeredCount: 0,
    totalCount,
    averageScore: 0,
    passCount: 0,
    weakQuestionIds,
    metrics: buildMetrics({
      answeredCount: 0,
      totalCount,
      averageScore: 0,
      passCount: 0,
      unansweredCount: totalCount,
    }),
    repairActions,
    queueProfile,
    primaryAction: hasRepairActions
      ? {
        kind: 'repair',
        label: '补弱重练',
        description: '先回到已标记薄弱的题目，完成评分并按最低维度补弱。',
        to: buildQueuePath(repairActions.map(action => action.questionId)),
      }
      : {
        kind: 'start',
        label: '开始本轮练习',
        description: '进入模拟面试并完成第一道题评分。',
        to: '/practice',
      },
  }
}

function latestAttemptForQuestion(progress: StudyProgress, questionId: number): InterviewAttempt | undefined {
  return [...(progress.interviewAttempts[questionId] ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function resolveWeakQuestionIds(
  items: SessionAttemptItem[],
  progress: StudyProgress,
): number[] {
  return items
    .filter(item => {
      const latestScore = item.attempt?.feedback.score
      const trackedStatus = progress.questionStates[item.question.id]?.status ?? item.question.status
      return (typeof latestScore === 'number' && latestScore < PASSING_SCORE) || trackedStatus === 'weak'
    })
    .map(item => item.question.id)
}

function summarizeWeakestCriterion(items: SessionAttemptItem[]): WeakestCriterionSummary | undefined {
  const buckets = new Map<InterviewCriterionKey, { label: string; total: number; count: number; summary: string }>()

  for (const item of items) {
    for (const criterion of item.attempt?.feedback.criteria ?? []) {
      const current = buckets.get(criterion.key) ?? {
        label: criterion.label,
        total: 0,
        count: 0,
        summary: criterion.summary,
      }
      current.total += criterion.score
      current.count += 1
      current.summary = current.summary || criterion.summary
      buckets.set(criterion.key, current)
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      averageScore: Math.round(bucket.total / bucket.count),
      summary: bucket.summary,
    }))
    .sort((a, b) => a.averageScore - b.averageScore)[0]
}

function buildRepairActions(
  items: SessionAttemptItem[],
  progress: StudyProgress,
): PracticeSessionRepairAction[] {
  return items
    .map(item => buildRepairAction(item, progress))
    .filter((action): action is PracticeSessionRepairAction => Boolean(action))
    .sort((a, b) => repairPriority(a) - repairPriority(b))
}

function buildRepairAction(
  item: SessionAttemptItem,
  progress: StudyProgress,
): PracticeSessionRepairAction | undefined {
  const latestScore = item.attempt?.feedback.score
  const trackedStatus = progress.questionStates[item.question.id]?.status ?? item.question.status
  const shouldRepair = (typeof latestScore === 'number' && latestScore < PASSING_SCORE) || trackedStatus === 'weak'

  if (!shouldRepair) {
    return undefined
  }

  if (!item.attempt) {
    return {
      questionId: item.question.id,
      title: item.question.title,
      criterionLabel: '未评分',
      reason: '已标记薄弱但本轮还没有评分记录。',
      action: '先完成一次模拟评分，再按最低维度补弱。',
      to: buildQuestionPath(item.question.id),
    }
  }

  const weakest = resolveWeakestAttemptCriterion(item.attempt.feedback.criteria)

  return {
    questionId: item.question.id,
    title: item.question.title,
    score: item.attempt.feedback.score,
    criterionKey: weakest.key,
    criterionLabel: weakest.label,
    criterionScore: weakest.score,
    reason: `最近评分 ${item.attempt.feedback.score} 分，${weakest.label} ${weakest.score} 分拖低本轮表现。`,
    action: actionForCriterion(weakest.key),
    to: buildQuestionPath(item.question.id),
  }
}

function repairPriority(action: PracticeSessionRepairAction): number {
  const score = action.score ?? Number.MAX_SAFE_INTEGER
  const criterionScore = action.criterionScore ?? Number.MAX_SAFE_INTEGER
  return score * 1000 + criterionScore
}

function resolveWeakestAttemptCriterion(criteria: InterviewCriterion[]): InterviewCriterion {
  return [...criteria].sort((a, b) => a.score - b.score)[0] ?? {
    key: 'structure',
    label: '结构化',
    score: 0,
    summary: '暂无评分维度',
  }
}

function resolveLevel(input: {
  answeredCount: number
  averageScore: number
  totalCount: number
  weakQuestionIds: number[]
}): PracticeSessionReportLevel {
  if (input.weakQuestionIds.length > 0 || input.averageScore < PASSING_SCORE) {
    return 'risk'
  }
  if (input.answeredCount === input.totalCount && input.averageScore >= STRONG_SESSION_SCORE) {
    return 'passed'
  }
  return 'in-progress'
}

function buildPrimaryAction(
  level: PracticeSessionReportLevel,
  weakQuestionIds: number[],
  unansweredIds: number[],
): PracticeSessionReportAction {
  if (level === 'risk') {
    return {
      kind: 'repair',
      label: '补弱重练',
      description: '优先回到低分题和标弱题，先把本轮短板修到通过线。',
      to: buildQueuePath(weakQuestionIds),
    }
  }

  if (level === 'passed') {
    return {
      kind: 'review',
      label: '复盘沉淀',
      description: '本轮已经稳定通过，回到学习页沉淀为可复用表达。',
      to: '/study',
    }
  }

  if (unansweredIds.length > 0) {
    return {
      kind: 'continue',
      label: '继续未答题',
      description: '先完成剩余题目，再判断整轮是否需要补弱。',
      to: buildQueuePath(unansweredIds),
    }
  }

  return {
    kind: 'review',
    label: '复盘本轮表现',
    description: '本轮已答完但还不够稳定，先回到学习页整理薄弱表达。',
    to: '/study',
  }
}

function buildQueuePath(questionIds: number[]): string {
  if (questionIds.length === 0) {
    return '/practice'
  }
  return `/practice?queue=${questionIds.join(',')}`
}

function buildQueueProfile(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  weakQuestionIds: number[],
): PracticeSessionQueueProfile {
  if (queue.length === 0) {
    return {
      isEmpty: true,
      sourceSummary: '暂无来源',
      nextQuestionTitle: '暂无下一题',
      nextQuestionMeta: '先从学习计划、薄弱题或题库进入模拟面试。',
      unansweredQuestionIds: [],
      weakQuestionIds,
      queuePath: '/practice',
    }
  }

  const unansweredQuestionIds = resolveUnansweredQuestionIds(queue, progress)
  const nextQuestion = queue.find(item => unansweredQuestionIds.includes(item.id))
    ?? queue.find(item => weakQuestionIds.includes(item.id))
    ?? queue[0]
  const nextScore = latestAttemptForQuestion(progress, nextQuestion.id)?.feedback.score
  const nextStatus = progress.questionStates[nextQuestion.id]?.status ?? nextQuestion.status

  return {
    isEmpty: false,
    sourceSummary: summarizeQueueSources(queue),
    nextQuestionTitle: nextQuestion.title,
    nextQuestionMeta: `${nextQuestion.categoryName}，${formatStatus(nextStatus)}，${formatScore(nextScore)}`,
    unansweredQuestionIds,
    weakQuestionIds,
    queuePath: buildQueuePath(queue.map(item => item.id)),
  }
}

function buildPracticeSessionProgressContext(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): StudyProgress {
  if (queue.length === 0) {
    return progress
  }

  const sessionQuestionIds = queue
    .map(item => item.id)
    .filter(questionId => Number.isFinite(questionId) && questionId > 0)

  // 本轮练习队列可能来自 URL 临时参数，未必已经写入今日计划；这里仅在生成战报时补齐上下文，
  // 让下一轮训练能使用本轮评分和题目信息，不修改用户真实的本地进度。
  const questionSnapshots = { ...progress.questionSnapshots }
  const questionStates = { ...progress.questionStates }

  for (const item of queue) {
    questionSnapshots[item.id] = questionSnapshots[item.id] ?? snapshotFromQueueItem(item)
    questionStates[item.id] = questionStates[item.id] ?? {
      status: item.status,
      addedToPlan: item.source === 'plan',
      reviewCount: 0,
    }
  }

  return {
    ...progress,
    dailyPlan: [...new Set([...progress.dailyPlan, ...sessionQuestionIds])],
    questionSnapshots,
    questionStates,
  }
}

function snapshotFromQueueItem(item: PracticeQueueItem): QuestionSnapshot {
  return {
    id: item.id,
    title: item.title,
    difficulty: item.difficulty,
    categoryName: item.categoryName,
    tags: item.tags,
    viewCount: item.viewCount,
  }
}

function resolveUnansweredQuestionIds(queue: PracticeQueueItem[], progress: StudyProgress): number[] {
  return queue
    .filter(item => !latestAttemptForQuestion(progress, item.id))
    .map(item => item.id)
}

function summarizeQueueSources(queue: PracticeQueueItem[]): string {
  const counts = queue.reduce((accumulator, item) => {
    accumulator.set(item.source, (accumulator.get(item.source) ?? 0) + 1)
    return accumulator
  }, new Map<PracticeQueueItem['source'], number>())

  return [...counts.entries()]
    .map(([source, count]) => `${formatQueueSource(source)} ${count} 道`)
    .join('、') || '暂无来源'
}

function formatQueueSource(source: PracticeQueueItem['source']): string {
  return queueSourceLabels[source] ?? source
}

function formatStatus(status: PracticeQueueItem['status']): string {
  return statusLabels[status] ?? status
}

function formatDifficulty(difficulty: string): string {
  return difficultyLabels[difficulty] ?? difficulty
}

function buildQuestionPath(questionId: number): string {
  return `/practice?question=${questionId}`
}

function titleForLevel(level: PracticeSessionReportLevel, unansweredCount: number): string {
  if (level === 'empty') {
    return '等待开始本轮练习'
  }
  if (level === 'risk') {
    return '本轮优先补弱'
  }
  if (level === 'passed') {
    return '本轮已稳定通过'
  }
  return unansweredCount > 0 ? '本轮正在推进' : '本轮需要复盘'
}

function summaryForLevel(
  level: PracticeSessionReportLevel,
  answeredCount: number,
  totalCount: number,
  averageScore: number,
  weakCount: number,
): string {
  if (level === 'risk') {
    return `已答 ${answeredCount}/${totalCount}，平均 ${averageScore} 分；${weakCount} 道题需要先补弱重练。`
  }
  if (level === 'passed') {
    return `本轮 ${totalCount} 道题全部完成，平均 ${averageScore} 分，可以沉淀为面试表达素材。`
  }
  return `已答 ${answeredCount}/${totalCount}，平均 ${averageScore} 分；先补齐剩余题目再做整轮判断。`
}

function buildMetrics(input: {
  answeredCount: number
  totalCount: number
  averageScore: number
  passCount: number
  weakestCriterion?: WeakestCriterionSummary
  unansweredCount: number
}): PracticeSessionReportMetric[] {
  return [
    {
      key: 'answered',
      label: '已答题',
      value: `${input.answeredCount} / ${input.totalCount}`,
      detail: input.unansweredCount > 0 ? `剩余 ${input.unansweredCount} 道` : '本轮已答完',
    },
    {
      key: 'average',
      label: '平均分',
      value: `${input.averageScore} 分`,
      detail: input.averageScore >= PASSING_SCORE ? '达到通过线' : '低于通过线',
    },
    {
      key: 'pass',
      label: '通过数',
      value: `${input.passCount} 道`,
      detail: `${PASSING_SCORE} 分以上计为通过`,
    },
    {
      key: 'weakest',
      label: '最弱项',
      value: input.weakestCriterion
        ? `${input.weakestCriterion.label} ${input.weakestCriterion.averageScore}`
        : '暂无',
      detail: input.weakestCriterion?.summary ?? '完成评分后自动定位',
    },
  ]
}

function actionForCriterion(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '先补定义、机制和替代方案，再重答本题。'
  }
  if (key === 'structure') {
    return '先按“结论 -> 原因 -> 场景 -> 边界”重组结构。'
  }
  if (key === 'specificity') {
    return '补一个项目场景、触发条件和可验证指标。'
  }
  return '补失败边界、误区和兜底方案。'
}

function repairDraftHints(key?: InterviewCriterionKey): {
  conclusion: string
  reason: string
  scenario: string
  boundary: string
} {
  if (key === 'coverage') {
    return {
      conclusion: '先一句话给出定义和适用边界。',
      reason: '补核心机制、关键步骤和替代方案差异。',
      scenario: '补一个真实项目触发场景和选择依据。',
      boundary: '补不适用场景、常见误区和兜底方案。',
    }
  }
  if (key === 'structure') {
    return {
      conclusion: '先给明确结论。',
      reason: '按 2-3 点展开原因。',
      scenario: '补项目场景、规模、指标或数据。',
      boundary: '补风险、边界条件和落地方案。',
    }
  }
  if (key === 'specificity') {
    return {
      conclusion: '先把结论落到具体业务场景。',
      reason: '说明触发条件、约束和为什么这样选。',
      scenario: '补项目规模、流量、数据量、排查过程或指标。',
      boundary: '补验证方式、监控指标和回滚方案。',
    }
  }
  if (key === 'risk') {
    return {
      conclusion: '先说明核心方案和主要风险。',
      reason: '解释风险来源、影响范围和取舍。',
      scenario: '补线上异常、容量、并发或数据一致性场景。',
      boundary: '补兜底、降级、监控和恢复策略。',
    }
  }
  return {
    conclusion: '先给出可以评分的明确结论。',
    reason: '补核心原理、关键步骤和取舍依据。',
    scenario: '补一个项目场景、触发条件和验证指标。',
    boundary: '补风险边界、常见误区和兜底方案。',
  }
}

function formatQuestionIds(questionIds: number[]): string {
  return questionIds.length > 0 ? questionIds.join(', ') : '暂无'
}

function formatScore(score?: number): string {
  return typeof score === 'number' ? `${score} 分` : '暂无'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
