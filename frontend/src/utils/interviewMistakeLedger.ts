import type {
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewMistakeLedger,
  InterviewMistakeLedgerItem,
  QuestionSnapshot,
  StudyProgress,
} from '../types'

const LOW_SCORE_THRESHOLD = 70
const QUEUE_LIMIT = 8

interface AttemptWithQuestion extends InterviewAttempt {
  question: QuestionSnapshot
}

interface CriterionBucket {
  key: InterviewCriterionKey
  label: string
  totalScore: number
  attempts: number
  summaries: string[]
  attemptRefs: AttemptWithQuestion[]
}

export function buildInterviewMistakeLedger(progress: StudyProgress): InterviewMistakeLedger {
  const attempts = flattenAttempts(progress)
  const criterionItems = buildCriterionItems(attempts)
  const weakUnspokenItem = buildWeakUnspokenItem(progress)
  const issueItems = [...criterionItems, ...(weakUnspokenItem ? [weakUnspokenItem] : [])]
    .sort((a, b) => b.priority - a.priority)

  if (issueItems.length > 0) {
    return {
      level: 'risk',
      title: '面试错因本',
      summary: `已定位 ${issueItems.length} 类高频表达问题，优先按第一项回炉训练。`,
      totalProblems: issueItems.reduce((sum, item) => sum + item.affectedQuestionIds.length, 0),
      items: issueItems,
      primaryAction: buildPrimaryAction(issueItems[0]),
    }
  }

  if (attempts.length > 0) {
    const advancedItem = buildAdvancedItem(attempts)
    return {
      level: 'stable',
      title: '面试错因本',
      summary: '最近的模拟面试没有明显低分维度，可以进入更高压的连续追问训练。',
      totalProblems: 0,
      items: [advancedItem],
      primaryAction: buildPrimaryAction(advancedItem),
    }
  }

  return {
    level: 'empty',
    title: '面试错因本待建立',
    summary: '先完成一次免费模拟面试，系统会自动沉淀你的历史错因和回炉题单。',
    totalProblems: 0,
    items: [],
    primaryAction: {
      label: '开始模拟面试',
      description: '用一次开口作答建立第一条错因记录。',
      to: '/practice',
    },
  }
}

function buildCriterionItems(attempts: AttemptWithQuestion[]): InterviewMistakeLedgerItem[] {
  const buckets = new Map<InterviewCriterionKey, CriterionBucket>()

  for (const attempt of attempts) {
    for (const criterion of attempt.feedback.criteria) {
      if (criterion.score >= LOW_SCORE_THRESHOLD) {
        continue
      }
      const bucket = buckets.get(criterion.key) ?? createCriterionBucket(criterion)
      bucket.totalScore += criterion.score
      bucket.attempts += 1
      bucket.summaries.push(criterion.summary)
      bucket.attemptRefs.push(attempt)
      buckets.set(criterion.key, bucket)
    }
  }

  return [...buckets.values()].map(bucket => {
    const averageScore = Math.round(bucket.totalScore / bucket.attempts)
    const affectedQuestionIds = uniqueQuestionIds(bucket.attemptRefs)
    const latestQuestion = bucket.attemptRefs[0]?.question
    // 重复出现的低分维度比单次低分更值得优先修复，所以排序权重同时看次数和分差。
    const priority = (LOW_SCORE_THRESHOLD - averageScore) + bucket.attempts * 15

    return {
      id: `criterion-${bucket.key}`,
      type: 'criterion',
      criterionKey: bucket.key,
      label: `${bucket.label}反复失分`,
      summary: `${bucket.attempts} 次回答低于 ${LOW_SCORE_THRESHOLD} 分，先把这类答案补到可复述、可追问。`,
      averageScore,
      attempts: bucket.attempts,
      affectedQuestionIds,
      latestQuestionTitle: latestQuestion?.title ?? '最近一次模拟题',
      priority,
      to: buildPracticeQueuePath(affectedQuestionIds),
      actionLabel: '回炉训练',
    } satisfies InterviewMistakeLedgerItem
  })
}

function buildWeakUnspokenItem(progress: StudyProgress): InterviewMistakeLedgerItem | null {
  const weakQuestionIds = Object.entries(progress.questionStates)
    .filter(([, state]) => state.status === 'weak')
    .map(([questionId]) => Number(questionId))
    .filter(questionId => (progress.interviewAttempts[questionId]?.length ?? 0) === 0)
    .sort((a, b) => a - b)
    .slice(0, QUEUE_LIMIT)

  if (weakQuestionIds.length === 0) {
    return null
  }

  const firstQuestion = progress.questionSnapshots[weakQuestionIds[0]]
  return {
    id: 'weak-unspoken',
    type: 'weak-unspoken',
    label: '薄弱题待开口',
    summary: `${weakQuestionIds.length} 道薄弱题还没有做过模拟面试，先把“会不会”变成“能不能说清”。`,
    averageScore: 0,
    attempts: weakQuestionIds.length,
    affectedQuestionIds: weakQuestionIds,
    latestQuestionTitle: firstQuestion?.title ?? '薄弱题',
    priority: 40 + weakQuestionIds.length * 5,
    to: buildPracticeQueuePath(weakQuestionIds),
    actionLabel: '开口补练',
  }
}

function buildAdvancedItem(attempts: AttemptWithQuestion[]): InterviewMistakeLedgerItem {
  const affectedQuestionIds = uniqueQuestionIds(attempts)
  const averageScore = Math.round(
    attempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0) / attempts.length,
  )

  return {
    id: 'advanced-pressure',
    type: 'advanced',
    label: '进入高压追问',
    summary: '当前错因不明显，适合用连续追问和边界场景继续拉高上限。',
    averageScore,
    attempts: attempts.length,
    affectedQuestionIds,
    latestQuestionTitle: attempts[0]?.question.title ?? '最近一次模拟题',
    priority: 1,
    to: buildPracticeQueuePath(affectedQuestionIds),
    actionLabel: '继续加压',
  }
}

function createCriterionBucket(criterion: InterviewCriterion): CriterionBucket {
  return {
    key: criterion.key,
    label: criterion.label,
    totalScore: 0,
    attempts: 0,
    summaries: [],
    attemptRefs: [],
  }
}

function flattenAttempts(progress: StudyProgress): AttemptWithQuestion[] {
  return Object.values(progress.interviewAttempts)
    .flat()
    .map(attempt => ({
      ...attempt,
      question: progress.questionSnapshots[attempt.questionId] ?? fallbackSnapshot(attempt.questionId),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function uniqueQuestionIds(attempts: AttemptWithQuestion[]): number[] {
  const result: number[] = []
  const seen = new Set<number>()

  for (const attempt of attempts) {
    if (seen.has(attempt.questionId)) {
      continue
    }
    seen.add(attempt.questionId)
    result.push(attempt.questionId)
    if (result.length >= QUEUE_LIMIT) {
      break
    }
  }

  return result
}

function buildPrimaryAction(item: InterviewMistakeLedgerItem) {
  return {
    label: item.actionLabel,
    description: item.summary,
    to: item.to,
  }
}

function buildPracticeQueuePath(questionIds: number[]): string {
  if (questionIds.length === 0) {
    return '/practice'
  }
  return `/practice?queue=${questionIds.join(',')}`
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
