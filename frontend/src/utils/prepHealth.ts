import type { PrepRoute } from '../data/freeSuperiority'
import type {
  AbilityMapItem,
  PrepHealthAction,
  PrepHealthDimension,
  PrepHealthDimensionStatus,
  PrepHealthLevel,
  PrepHealthReport,
  StudyProgress,
} from '../types'
import { buildAbilityMap } from './abilityMap'
import { buildInterviewReviewSummary } from './interviewReview'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'

interface HealthCandidate extends PrepHealthDimension {
  action: PrepHealthAction
}

const DIMENSION_ORDER = ['review', 'ability', 'interview', 'pace'] as const

export function buildPrepHealthReport(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PrepHealthReport {
  const abilityItems = buildAbilityMap(routes, progress)
  const candidates: HealthCandidate[] = [
    buildReviewDimension(progress, now),
    buildAbilityDimension(abilityItems),
    buildInterviewDimension(progress),
    buildPaceDimension(progress),
  ]

  const score = Math.round(candidates.reduce((sum, item) => sum + item.score, 0) / candidates.length)
  const level = resolveLevel(progress, score)
  const primary = resolvePrimaryCandidate(candidates, level)

  return {
    score,
    level,
    title: levelTitle(level),
    summary: buildSummary(level, primary),
    dimensions: candidates.map(({ action, ...dimension }) => dimension),
    primaryDimension: stripAction(primary),
    primaryAction: level === 'empty'
      ? {
        label: '建立学习轨迹',
        description: '先把题目加入计划或完成一次练习，健康雷达才会进入精准诊断。',
        to: '/study',
      }
      : primary.action,
  }
}

function buildReviewDimension(progress: StudyProgress, now: string): HealthCandidate {
  const queue = buildScheduledReviewQueue(progress, now, 1000)
  const summary = summarizeReviewSchedule(queue)
  const tracked = Object.keys(progress.questionStates).length
  const weakDue = queue.filter(item => item.status === 'weak' && item.dueStatus !== 'upcoming').length

  if (tracked === 0) {
    return withAction({
      key: 'review',
      label: '复习债',
      score: 45,
      status: 'empty',
      metric: '待建立',
      description: '还没有复习轨迹，系统暂时无法判断遗忘风险。',
      detail: '先把题目加入学习计划，再用间隔复习捕捉薄弱点。',
    }, '打开学习计划', '建立第一批复习样本', '/study')
  }

  const score = clampScore(100 - summary.overdue * 70 - summary.dueToday * 18 - weakDue * 10)
  const status = statusForScore(score)
  const description = summary.overdue > 0
    ? `有 ${summary.overdue} 道题已经逾期，先清掉复习债。`
    : summary.dueToday > 0
      ? `今天有 ${summary.dueToday} 道题到期，适合先做短复习。`
      : '复习节奏稳定，暂时没有明显逾期压力。'

  return withAction({
    key: 'review',
    label: '复习债',
    score,
    status,
    metric: summary.overdue > 0 ? `${summary.overdue} 逾期` : `${summary.dueToday} 今日`,
    description,
    detail: `逾期 ${summary.overdue} 道，今日到期 ${summary.dueToday} 道，薄弱到期 ${weakDue} 道。`,
  }, '处理复习债', '先复习逾期和薄弱题，避免越刷越忘。', '/study')
}

function buildAbilityDimension(abilityItems: AbilityMapItem[]): HealthCandidate {
  const focus = abilityItems.find(item => item.remembered > 0) ?? abilityItems[0]

  if (!focus || focus.remembered === 0) {
    return withAction({
      key: 'ability',
      label: '能力覆盖',
      score: 0,
      status: 'empty',
      metric: '0 覆盖',
      description: '还没有可用于岗位画像的题目轨迹。',
      detail: '先从目标岗位路线进入题目，系统会自动生成能力画像。',
    }, '打开备考路线', '先建立岗位能力样本', '/routes')
  }

  // 岗位准备度不能只看平均分，薄弱题会在面试中放大，因此额外扣除薄弱和学习中权重。
  const score = clampScore(focus.readinessScore - focus.weak * 8 - focus.learning * 2)
  const to = focus.nextQuestionIds.length > 0
    ? `/practice?queue=${focus.nextQuestionIds.join(',')}`
    : '/routes'

  return withAction({
    key: 'ability',
    label: '能力覆盖',
    score,
    status: statusForScore(score),
    metric: `${focus.readinessScore} 准备度`,
    description: focus.weak > 0
      ? `还有 ${focus.weak} 道薄弱题拖累岗位能力。`
      : '岗位能力覆盖正在成型，继续补齐学习中题目。',
    detail: `${focus.title}：覆盖 ${focus.remembered} 道，薄弱 ${focus.weak} 道，学习中 ${focus.learning} 道。`,
  }, '训练短板能力', '直接进入当前岗位最值得补的题目队列。', to)
}

function buildInterviewDimension(progress: StudyProgress): HealthCandidate {
  const summary = buildInterviewReviewSummary(progress)
  const tracked = Object.keys(progress.questionStates).length

  if (summary.totalAttempts === 0) {
    const score = tracked === 0 ? 35 : 62
    return withAction({
      key: 'interview',
      label: '表达稳定性',
      score,
      status: tracked === 0 ? 'empty' : 'warning',
      metric: '未评分',
      description: '还没有模拟面试评分，表达风险需要通过开口练习暴露。',
      detail: tracked === 0 ? '先建立题目轨迹，再做模拟面试。' : '已具备题目样本，建议补一次模拟回答。',
    }, '开始模拟面试', '用本地规则评分先检查表达结构。', '/practice')
  }

  const trendPenalty = summary.trend === 'declining' ? 25 : 0
  const trendBonus = summary.trend === 'improving' ? 5 : 0
  const score = clampScore(summary.averageScore - trendPenalty + trendBonus)
  const description = summary.trend === 'declining'
    ? '最近模拟面试分数回落，需要先稳住表达结构。'
    : summary.averageScore < 70
      ? '表达平均分偏低，建议用追问继续打磨答案。'
      : '表达评分整体稳定，可以继续加压训练。'

  return withAction({
    key: 'interview',
    label: '表达稳定性',
    score,
    status: statusForScore(score),
    metric: `${summary.averageScore} 平均分`,
    description,
    detail: `已完成 ${summary.totalAttempts} 次模拟，趋势 ${trendLabel(summary.trend)}，最弱维度 ${summary.weakestCriterion?.label ?? '待积累'}。`,
  }, '强化模拟面试', '进入练习页继续做结构化回答。', '/practice')
}

function buildPaceDimension(progress: StudyProgress): HealthCandidate {
  const tracked = Object.keys(progress.questionStates).length
  const planned = progress.dailyPlan.length

  if (tracked === 0) {
    return withAction({
      key: 'pace',
      label: '执行节奏',
      score: 20,
      status: 'empty',
      metric: '未启动',
      description: '还没有学习节奏记录，今天先建立一个小计划。',
      detail: `目标岗位：${progress.targetRole}，冲刺周期：${progress.sprintDays} 天。`,
    }, '制定今日计划', '先把 3-5 道题加入今日计划。', '/study')
  }

  const score = planned === 0
    ? clampScore(45 + Math.min(tracked, 5))
    : clampScore(55 + Math.min(planned * 8, 32) + Math.min(tracked * 3, 15))

  return withAction({
    key: 'pace',
    label: '执行节奏',
    score,
    status: statusForScore(score),
    metric: planned === 0 ? '无计划' : `${planned} 今日`,
    description: planned === 0
      ? '今日计划为空，容易从“看过题”滑回无节奏刷题。'
      : '今日计划已建立，可以按任务队列稳定推进。',
    detail: `已跟踪 ${tracked} 道题，今日计划 ${planned} 道，冲刺周期 ${progress.sprintDays} 天。`,
  }, planned === 0 ? '补齐今日计划' : '查看学习计划', '把下一组题目固定到今天，减少选择成本。', '/study')
}

function resolvePrimaryCandidate(candidates: HealthCandidate[], level: PrepHealthLevel): HealthCandidate {
  if (level === 'empty') {
    return candidates.find(item => item.key === 'pace') ?? candidates[0]
  }

  return [...candidates].sort((a, b) => {
    const scoreDiff = a.score - b.score
    if (scoreDiff !== 0) {
      return scoreDiff
    }
    return DIMENSION_ORDER.indexOf(a.key) - DIMENSION_ORDER.indexOf(b.key)
  })[0]
}

function resolveLevel(progress: StudyProgress, score: number): PrepHealthLevel {
  const attempts = Object.values(progress.interviewAttempts).flat().length
  const tracked = Object.keys(progress.questionStates).length
  if (tracked === 0 && attempts === 0 && progress.dailyPlan.length === 0) {
    return 'empty'
  }
  if (score < 50) {
    return 'risk'
  }
  if (score < 80) {
    return 'watch'
  }
  return 'healthy'
}

function statusForScore(score: number): PrepHealthDimensionStatus {
  if (score < 45) {
    return 'danger'
  }
  if (score < 75) {
    return 'warning'
  }
  return 'stable'
}

function levelTitle(level: PrepHealthLevel): string {
  if (level === 'empty') {
    return '先建立轨迹'
  }
  if (level === 'risk') {
    return '备考风险偏高'
  }
  if (level === 'watch') {
    return '备考需要校准'
  }
  return '备考节奏健康'
}

function buildSummary(level: PrepHealthLevel, primary: HealthCandidate): string {
  if (level === 'empty') {
    return '系统会在本地记录题目、复习和模拟面试结果，随后生成免费健康诊断。'
  }
  return `当前最需要处理的是${primary.label}：${primary.description}`
}

function trendLabel(trend: string): string {
  if (trend === 'improving') {
    return '上升'
  }
  if (trend === 'declining') {
    return '回落'
  }
  if (trend === 'empty') {
    return '未建立'
  }
  return '稳定'
}

function withAction(
  dimension: PrepHealthDimension,
  label: string,
  description: string,
  to: string,
): HealthCandidate {
  return {
    ...dimension,
    action: { label, description, to },
  }
}

function stripAction({ action, ...dimension }: HealthCandidate): PrepHealthDimension {
  return dimension
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}
