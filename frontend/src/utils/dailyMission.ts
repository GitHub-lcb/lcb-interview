import type { PrepRoute } from '../data/freeSuperiority'
import type { AbilityMapItem, DailyMissionItem, DailyMissionPlan, StudyProgress } from '../types'
import { buildAbilityMap } from './abilityMap'
import { buildInterviewReviewSummary } from './interviewReview'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'
import { getQuestionState } from './studyProgress'

const MISSION_LIMIT = 4

export function buildDailyMissionPlan(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): DailyMissionPlan {
  const missions = [
    buildReviewMission(progress, now),
    buildAbilityMission(routes, progress),
    buildInterviewMission(progress),
    buildPlanMission(progress),
  ].filter((mission): mission is DailyMissionItem => Boolean(mission))

  return {
    title: '今日冲刺任务',
    summary: buildPlanSummary(progress),
    // 今日任务只做运行时编排，不写入本地存储；这样用户每次标记题目后任务会自然刷新。
    missions: dedupeByTarget(missions)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MISSION_LIMIT),
  }
}

/**
 * 构建今日冲刺任务 Markdown，便于用户把首页任务清单复制到外部待办或复盘文档。
 *
 * @param routes 免费备考路线配置
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和复习任务
 * @returns 可携带的 Markdown 今日任务清单
 */
export function buildDailyMissionMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const plan = buildDailyMissionPlan(routes, progress, now)

  return [
    `# ${progress.targetRole} 今日冲刺任务`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderDailyMissionOverview(plan),
    renderDailyMissionItems(plan.missions),
  ].join('\n').trimEnd()
}

function renderDailyMissionOverview(plan: DailyMissionPlan): string {
  return [
    '## 任务概览',
    `- 状态：${plan.title}`,
    `- 摘要：${plan.summary}`,
    `- 任务数：${plan.missions.length} 个`,
    '',
  ].join('\n')
}

function renderDailyMissionItems(missions: DailyMissionItem[]): string {
  if (missions.length === 0) {
    return [
      '## 任务清单',
      '- 暂无任务。可以先打开学习计划，建立今日训练队列。',
    ].join('\n')
  }

  const lines = ['## 任务清单']
  missions.forEach((mission, index) => {
    lines.push(
      `${index + 1}. ${mission.title}`,
      `   - 类型：${labelForMissionKind(mission.kind)}`,
      `   - 指标：${mission.metric}`,
      `   - 说明：${mission.description}`,
      `   - 原因：${mission.reason}`,
      `   - 入口：${mission.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function labelForMissionKind(kind: DailyMissionItem['kind']): string {
  if (kind === 'review') {
    return '复习'
  }
  if (kind === 'ability') {
    return '能力短板'
  }
  if (kind === 'interview') {
    return '模拟面试'
  }
  return '今日计划'
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function buildReviewMission(progress: StudyProgress, now: string): DailyMissionItem | null {
  const queue = buildScheduledReviewQueue(progress, now, 12)
  const summary = summarizeReviewSchedule(queue)
  const dueCount = summary.overdue + summary.dueToday

  if (dueCount === 0) {
    return null
  }

  return {
    id: 'review-due',
    kind: 'review',
    title: summary.overdue > 0 ? '先补逾期复习' : '完成今日到期复习',
    description: summary.overdue > 0
      ? `${summary.overdue} 道题已经逾期，先把记忆断点补上。`
      : `${summary.dueToday} 道题今天到期，趁遗忘前复盘。`,
    reason: '来自智能复习排期',
    to: '/study',
    priority: 100,
    metric: `${dueCount} 道`,
  }
}

function buildAbilityMission(routes: PrepRoute[], progress: StudyProgress): DailyMissionItem | null {
  const ability = buildAbilityMap(routes, progress).find(item => item.nextQuestionIds.length > 0)
  if (!ability) {
    return null
  }

  return {
    id: `ability-${ability.routeId}`,
    kind: 'ability',
    title: `训练 ${ability.role} 短板`,
    description: ability.summary,
    reason: '来自岗位能力地图',
    to: `/practice?queue=${ability.nextQuestionIds.join(',')}`,
    priority: Math.round(80 + ability.weak * 5 + (100 - ability.readinessScore) / 10),
    metric: `${ability.readinessScore} 分`,
  }
}

function buildInterviewMission(progress: StudyProgress): DailyMissionItem {
  const review = buildInterviewReviewSummary(progress)

  if (review.totalAttempts === 0) {
    return {
      id: 'interview-start',
      kind: 'interview',
      title: '完成首次模拟面试',
      description: '先提交一次口述答案，系统会生成表达评分和追问。',
      reason: '来自模拟面试复盘',
      to: '/practice',
      priority: 70,
      metric: '首评',
    }
  }

  const declining = review.trend === 'declining'
  const weakCriterion = review.weakestCriterion && review.weakestCriterion.averageScore < 70

  return {
    id: 'interview-retrospective',
    kind: 'interview',
    title: declining ? '修复面试表现回落' : '补强面试表达短板',
    description: declining
      ? '最近模拟面试分数回落，先复盘表达结构再继续刷题。'
      : review.recommendation,
    reason: '来自模拟面试复盘',
    to: '/practice',
    priority: declining ? 85 : weakCriterion ? 76 : 62,
    metric: `${review.averageScore} 分`,
  }
}

function buildPlanMission(progress: StudyProgress): DailyMissionItem {
  const planIds = uniquePositiveIds(progress.dailyPlan)
  const unfinishedPlanIds = planIds.filter(questionId => getQuestionState(progress, questionId).status !== 'mastered')

  if (unfinishedPlanIds.length > 0) {
    return {
      id: 'plan-continue',
      kind: 'plan',
      title: '推进今日计划',
      description: `今日计划还有 ${unfinishedPlanIds.length} 道题，按队列进入训练。`,
      reason: '来自今日学习计划',
      to: `/practice?queue=${unfinishedPlanIds.slice(0, 12).join(',')}`,
      priority: 65,
      metric: `${unfinishedPlanIds.length} 道`,
    }
  }

  if (planIds.length > 0) {
    return {
      id: 'plan-complete',
      kind: 'plan',
      title: '复盘今日计划',
      description: `今日 ${planIds.length} 道计划题已全部掌握，回到学习计划完成收口。`,
      reason: '来自今日学习计划',
      to: '/study',
      priority: 64,
      metric: `${planIds.length} 道已完成`,
    }
  }

  return {
    id: 'plan-build',
    kind: 'plan',
    title: '生成今日计划',
    description: '先建立今天的题目队列，避免随机刷题。',
    reason: '来自学习计划',
    to: '/study',
    priority: 60,
    metric: '待生成',
  }
}

function buildPlanSummary(progress: StudyProgress): string {
  const trackedCount = Object.keys(progress.questionStates).length
  if (trackedCount === 0) {
    return '先建立学习轨迹，再由系统自动安排复习、短板训练和模拟面试。'
  }
  return '系统已根据复习到期、岗位短板、面试表现和今日计划排好优先级。'
}

function uniquePositiveIds(questionIds: number[]): number[] {
  return [...new Set(questionIds.filter(id => Number.isInteger(id) && id > 0))]
}

function dedupeByTarget(missions: DailyMissionItem[]): DailyMissionItem[] {
  const byTarget = new Map<string, DailyMissionItem>()

  for (const mission of missions) {
    const existing = byTarget.get(mission.to)
    // 多个建议可能指向同一入口，只保留优先级最高的，避免首页出现重复行动。
    if (!existing || mission.priority > existing.priority) {
      byTarget.set(mission.to, mission)
    }
  }

  return [...byTarget.values()]
}
