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

/**
 * 构建模拟面试复盘 Markdown，便于用户把表达趋势和短板维度沉淀到外部复盘文档。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期
 * @returns 可复制或下载的 Markdown 复盘报告
 */
export function buildInterviewReviewMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const summary = buildInterviewReviewSummary(progress)
  const targetRole = progress.targetRole.trim() || '岗位'

  return [
    `# ${targetRole} 模拟面试复盘`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderReviewOverview(summary),
    renderWeakestCriterion(summary),
    renderCriteria(summary.criteria),
    renderRecentAttempts(summary.recentAttempts),
    renderReviewNextStep(summary),
  ].join('\n').trimEnd()
}

function renderReviewOverview(summary: InterviewReviewSummary): string {
  return [
    '## 复盘概览',
    `- 趋势：${labelForTrend(summary.trend)}`,
    `- 平均分：${summary.averageScore}`,
    `- 最高分：${summary.bestScore}`,
    `- 最近一次：${summary.latestScore ?? '暂无'}`,
    `- 练习次数：${summary.totalAttempts}`,
    `- 覆盖题目：${summary.answeredQuestions}`,
    `- 建议：${summary.recommendation}`,
    '',
  ].join('\n')
}

function renderWeakestCriterion(summary: InterviewReviewSummary): string {
  if (!summary.weakestCriterion) {
    return [
      '## 当前短板',
      '- 暂无短板维度。先开始模拟面试，系统会按评分维度生成复盘。',
      '',
    ].join('\n')
  }

  const criterion = summary.weakestCriterion
  return [
    '## 当前短板',
    `- 维度：${criterion.label}`,
    `- 平均分：${criterion.averageScore}`,
    `- 样本数：${criterion.attempts}`,
    `- 摘要：${criterion.summary}`,
    '',
  ].join('\n')
}

function renderCriteria(criteria: InterviewCriterionSummary[]): string {
  if (criteria.length === 0) {
    return [
      '## 维度均分',
      '- 暂无维度均分。完成一次模拟面试后会生成覆盖度、结构化、具体性和风险意识评分。',
      '',
    ].join('\n')
  }

  const lines = ['## 维度均分']
  criteria.forEach((criterion, index) => {
    lines.push(`${index + 1}. ${criterion.label}：${criterion.averageScore} 分，${criterion.attempts} 次`)
  })

  return [...lines, ''].join('\n')
}

function renderRecentAttempts(attempts: InterviewReviewAttempt[]): string {
  if (attempts.length === 0) {
    return [
      '## 最近记录',
      '- 暂无模拟面试记录。',
      '',
    ].join('\n')
  }

  const lines = ['## 最近记录']
  attempts.forEach((attempt, index) => {
    lines.push(
      `${index + 1}. ${attempt.question?.title ?? `题目 #${attempt.questionId}`}`,
      `   - 得分：${attempt.feedback.score}`,
      `   - 时间：${formatMarkdownDate(attempt.createdAt)}`,
      `   - 入口：/question/${attempt.questionId}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderReviewNextStep(summary: InterviewReviewSummary): string {
  const action = summary.totalAttempts === 0 ? '开始模拟面试' : '继续模拟面试'
  return [
    '## 下一步',
    `- 动作：${action}`,
    '- 入口：/practice',
  ].join('\n')
}

function labelForTrend(trend: InterviewTrend): string {
  if (trend === 'empty') {
    return '等待首评'
  }
  if (trend === 'improving') {
    return '正在上升'
  }
  if (trend === 'declining') {
    return '需要复盘'
  }
  return '稳定推进'
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
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
