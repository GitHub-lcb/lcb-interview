import type {
  StudyPaceAction,
  StudyPaceCoach,
  StudyPaceCoachLevel,
  StudyPaceMetric,
  StudyProgress,
} from '../types'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'

export function buildStudyPaceCoach(
  progress: StudyProgress,
  now = new Date().toISOString(),
): StudyPaceCoach {
  const trackedCount = Object.keys(progress.questionStates).length
  const plannedCount = progress.dailyPlan.length
  const dailyQuestionTarget = resolveDailyTarget(progress.sprintDays)
  const reviewSummary = summarizeReviewSchedule(buildScheduledReviewQueue(progress, now, 1000))
  const reviewDueCount = reviewSummary.overdue + reviewSummary.dueToday
  const interviewAttemptCount = Object.values(progress.interviewAttempts).flat().length
  const weakCount = Object.values(progress.questionStates).filter(state => state.status === 'weak').length
  const level = resolveLevel({
    trackedCount,
    plannedCount,
    dailyQuestionTarget,
    reviewDueCount,
    interviewAttemptCount,
  })
  const actions = buildActions({
    trackedCount,
    plannedCount,
    dailyQuestionTarget,
    reviewDueCount,
    interviewAttemptCount,
    dailyPlan: progress.dailyPlan,
  })
  const primaryAction = actions[0]

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, dailyQuestionTarget, plannedCount, reviewDueCount, interviewAttemptCount, weakCount),
    dailyQuestionTarget,
    plannedCount,
    reviewDueCount,
    interviewAttemptCount,
    metrics: buildMetrics(dailyQuestionTarget, plannedCount, reviewDueCount, interviewAttemptCount),
    actions,
    primaryAction,
  }
}

/**
 * 构建备考配速 Markdown，便于把当天节奏诊断复制到外部打卡或复盘文档。
 *
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和复习债判断
 * @returns 可复制或下载的 Markdown 配速报告
 */
export function buildStudyPaceMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const coach = buildStudyPaceCoach(progress, now)
  const targetRole = progress.targetRole.trim() || '岗位'

  return [
    `# ${targetRole} 备考配速报告`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderPaceOverview(coach),
    renderPaceMetrics(coach.metrics),
    renderPaceActions(coach.actions),
  ].join('\n').trimEnd()
}

function renderPaceOverview(coach: StudyPaceCoach): string {
  return [
    '## 配速概览',
    `- 状态：${coach.title}`,
    `- 等级：${labelForPaceLevel(coach.level)}`,
    `- 今日目标：${coach.dailyQuestionTarget} 道`,
    `- 已排计划：${coach.plannedCount} 道`,
    `- 复习债：${coach.reviewDueCount} 道`,
    `- 模拟样本：${coach.interviewAttemptCount} 次`,
    `- 摘要：${coach.summary}`,
    `- 主行动：${coach.primaryAction.label}`,
    '',
  ].join('\n')
}

function renderPaceMetrics(metrics: StudyPaceMetric[]): string {
  if (metrics.length === 0) {
    return [
      '## 指标明细',
      '- 暂无配速指标。先建立学习轨迹，再生成配速报告。',
      '',
    ].join('\n')
  }

  const lines = ['## 指标明细']
  metrics.forEach((metric, index) => {
    lines.push(
      `${index + 1}. ${metric.label}`,
      `   - 数值：${metric.value}`,
      `   - 说明：${metric.detail}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderPaceActions(actions: StudyPaceAction[]): string {
  if (actions.length === 0) {
    return [
      '## 行动队列',
      '- 暂无行动建议。先进入题库建立轨迹。',
    ].join('\n')
  }

  const lines = ['## 行动队列']
  actions.forEach((action, index) => {
    lines.push(
      `${index + 1}. ${action.label}`,
      `   - 说明：${action.description}`,
      `   - 入口：${action.to}`,
    )
  })

  return lines.join('\n')
}

function labelForPaceLevel(level: StudyPaceCoachLevel): string {
  if (level === 'empty') {
    return '待启动'
  }
  if (level === 'behind') {
    return '需补齐'
  }
  if (level === 'ahead') {
    return '超前'
  }
  return '稳定'
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function resolveDailyTarget(sprintDays: number): number {
  if (sprintDays <= 14) {
    return 8
  }
  if (sprintDays <= 30) {
    return 6
  }
  return 4
}

function resolveLevel(input: {
  trackedCount: number
  plannedCount: number
  dailyQuestionTarget: number
  reviewDueCount: number
  interviewAttemptCount: number
}): StudyPaceCoachLevel {
  if (input.trackedCount === 0) {
    return 'empty'
  }
  if (
    input.reviewDueCount > 0
    || input.plannedCount < input.dailyQuestionTarget
    || input.interviewAttemptCount === 0
  ) {
    return 'behind'
  }
  if (input.plannedCount >= input.dailyQuestionTarget + 2 && input.interviewAttemptCount >= 2) {
    return 'ahead'
  }
  return 'balanced'
}

function buildActions(input: {
  trackedCount: number
  plannedCount: number
  dailyQuestionTarget: number
  reviewDueCount: number
  interviewAttemptCount: number
  dailyPlan: number[]
}): StudyPaceAction[] {
  if (input.trackedCount === 0) {
    return [{
      key: 'start',
      label: '进入题库建轨迹',
      description: '先把第一批题目加入学习计划，配速教练才有本地样本。',
      to: '/banks',
    }]
  }

  const actions: StudyPaceAction[] = []
  if (input.reviewDueCount > 0) {
    actions.push({
      key: 'review',
      label: '先处理复习债',
      description: `${input.reviewDueCount} 道题到期或逾期，先复盘再扩展新题。`,
      to: '/study',
    })
  }
  if (input.plannedCount < input.dailyQuestionTarget) {
    actions.push({
      key: 'plan',
      label: '补齐今日计划',
      description: `今日计划 ${input.plannedCount} 道，建议补到 ${input.dailyQuestionTarget} 道。`,
      to: '/study',
    })
  }
  if (input.interviewAttemptCount === 0) {
    actions.push({
      key: 'interview',
      label: '补一次模拟面试',
      description: '题目会看不等于能讲清，今天至少建立一次表达评分。',
      to: '/practice',
    })
  }
  actions.push({
    key: 'practice',
    label: '按今日计划训练',
    description: '计划、复习和面试样本都具备后，直接进入今日队列。',
    to: input.dailyPlan.length > 0 ? `/practice?queue=${input.dailyPlan.slice(0, 12).join(',')}` : '/practice',
  })

  return actions
}

function buildMetrics(
  dailyQuestionTarget: number,
  plannedCount: number,
  reviewDueCount: number,
  interviewAttemptCount: number,
): StudyPaceMetric[] {
  return [
    {
      key: 'target',
      label: '今日目标',
      value: `${dailyQuestionTarget} 道`,
      detail: '由冲刺周期自动换算',
    },
    {
      key: 'planned',
      label: '已排计划',
      value: `${plannedCount} 道`,
      detail: plannedCount >= dailyQuestionTarget ? '已覆盖今日目标' : '还需要补齐题量',
    },
    {
      key: 'review',
      label: '复习债',
      value: `${reviewDueCount} 道`,
      detail: reviewDueCount > 0 ? '先处理到期与逾期' : '暂无明显复习压力',
    },
    {
      key: 'interview',
      label: '模拟样本',
      value: `${interviewAttemptCount} 次`,
      detail: interviewAttemptCount > 0 ? '已有表达评分样本' : '今天建议开口一次',
    },
  ]
}

function titleForLevel(level: StudyPaceCoachLevel): string {
  if (level === 'empty') {
    return '先建立备考轨迹'
  }
  if (level === 'behind') {
    return '今日节奏需要补齐'
  }
  if (level === 'ahead') {
    return '今日节奏已经超前'
  }
  return '今日节奏稳定'
}

function summaryForLevel(
  level: StudyPaceCoachLevel,
  dailyQuestionTarget: number,
  plannedCount: number,
  reviewDueCount: number,
  interviewAttemptCount: number,
  weakCount: number,
): string {
  if (level === 'empty') {
    return '先从题库加入题目，系统会按冲刺周期自动给出免费配速建议。'
  }
  if (level === 'behind') {
    return `建议今日完成 ${dailyQuestionTarget} 道题；当前计划 ${plannedCount} 道，复习债 ${reviewDueCount} 道，模拟样本 ${interviewAttemptCount} 次。`
  }
  if (level === 'ahead') {
    return `今日计划已经超过目标，可把多余精力转向 ${weakCount} 道薄弱题和追问加压。`
  }
  return `今日计划达到 ${dailyQuestionTarget} 道目标，保持复习、训练、模拟面试的闭环节奏。`
}
