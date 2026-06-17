import type {
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewCriterionSummary,
  InterviewReviewAttempt,
  InterviewReviewSummary,
  InterviewTrend,
  QuestionSnapshot,
  StudyProgress,
} from '../types'

const TREND_THRESHOLD = 5
const RECENT_ATTEMPT_LIMIT = 3

export function buildInterviewReviewSummary(progress: StudyProgress): InterviewReviewSummary {
  const attempts = flattenAttempts(progress)

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      answeredQuestions: 0,
      averageScore: 0,
      bestScore: 0,
      trend: 'empty',
      criteria: [],
      recentAttempts: [],
      recommendation: '先完成一次模拟面试评分，系统会自动生成表达复盘。',
    }
  }

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0)
  const criteria = summarizeCriteria(attempts.flatMap(attempt => attempt.feedback.criteria))
  const weakestCriterion = criteria[0]
  const trend = resolveTrend(attempts)

  return {
    totalAttempts: attempts.length,
    answeredQuestions: new Set(attempts.map(attempt => attempt.questionId)).size,
    averageScore: Math.round(totalScore / attempts.length),
    bestScore: Math.max(...attempts.map(attempt => attempt.feedback.score)),
    latestScore: attempts[0].feedback.score,
    trend,
    weakestCriterion,
    criteria,
    recentAttempts: attempts.slice(0, RECENT_ATTEMPT_LIMIT),
    recommendation: buildRecommendation(trend, weakestCriterion),
  }
}

function flattenAttempts(progress: StudyProgress): InterviewReviewAttempt[] {
  return Object.values(progress.interviewAttempts)
    .flat()
    .map(attempt => ({
      ...attempt,
      question: progress.questionSnapshots[attempt.questionId] ?? fallbackSnapshot(attempt.questionId),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function resolveTrend(attempts: InterviewAttempt[]): InterviewTrend {
  if (attempts.length < 4) {
    return 'stable'
  }

  const recentAverage = average(attempts.slice(0, 3).map(attempt => attempt.feedback.score))
  const previousAverage = average(attempts.slice(3, 6).map(attempt => attempt.feedback.score))
  const diff = recentAverage - previousAverage

  // 5 分以内的波动很可能来自题目难度差异，不把它误判成真实能力变化。
  if (diff >= TREND_THRESHOLD) {
    return 'improving'
  }
  if (diff <= -TREND_THRESHOLD) {
    return 'declining'
  }
  return 'stable'
}

function summarizeCriteria(criteria: InterviewCriterion[]): InterviewCriterionSummary[] {
  const buckets = new Map<InterviewCriterionKey, { label: string; total: number; attempts: number; summaries: string[] }>()

  for (const item of criteria) {
    const current = buckets.get(item.key) ?? { label: item.label, total: 0, attempts: 0, summaries: [] }
    current.total += item.score
    current.attempts += 1
    current.summaries.push(item.summary)
    buckets.set(item.key, current)
  }

  // 维度复盘按平均分升序，最低维度就是下一轮训练最值得补的短板。
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      averageScore: Math.round(bucket.total / bucket.attempts),
      attempts: bucket.attempts,
      summary: bucket.summaries[0] ?? '',
    }))
    .sort((a, b) => a.averageScore - b.averageScore)
}

function buildRecommendation(
  trend: InterviewTrend,
  weakestCriterion?: InterviewCriterionSummary,
): string {
  if (!weakestCriterion) {
    return '继续提交模拟回答，积累更多评分后会定位表达短板。'
  }
  if (trend === 'improving') {
    return `最近表现正在上升，下一轮优先把「${weakestCriterion.label}」补到 80 分以上。`
  }
  if (trend === 'declining') {
    return `最近表现回落，先放慢节奏复盘「${weakestCriterion.label}」，再进入下一题。`
  }
  return `下一轮重点提升「${weakestCriterion.label}」，把答案从知道概念推进到可面试表达。`
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
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
