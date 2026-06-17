import type {
  FollowUpDrillItem,
  InterviewAttempt,
  InterviewFollowUpDefense,
  InterviewFollowUpDefenseAction,
  InterviewFollowUpDefenseItem,
  InterviewFollowUpDefenseLevel,
  InterviewFollowUpDefenseMetric,
  QuestionSnapshot,
  StudyProgress,
} from '../types'
import { buildFollowUpDrillPack } from './followUpDrill'

const MAX_DEFENSE_ITEMS = 5
const RISK_SCORE_THRESHOLD = 70

interface LatestAttemptContext {
  questionId: number
  snapshot: QuestionSnapshot
  attempt: InterviewAttempt
}

export function buildInterviewFollowUpDefense(progress: StudyProgress): InterviewFollowUpDefense {
  const latestAttempts = Object.entries(progress.interviewAttempts)
    .map(([questionId, attempts]) => buildLatestAttemptContext(Number(questionId), attempts, progress))
    .filter((context): context is LatestAttemptContext => Boolean(context))

  const allItems = latestAttempts
    .flatMap(context => buildDefenseItems(context))
    .sort((a, b) => b.priority - a.priority)

  const items = allItems.slice(0, MAX_DEFENSE_ITEMS)
  const averageScore = averageLatestScore(latestAttempts)
  const riskCount = latestAttempts.filter(context => context.attempt.feedback.score < RISK_SCORE_THRESHOLD).length
  const categoryCount = new Set(latestAttempts.map(context => context.snapshot.categoryName)).size
  const level = resolveLevel(items.length, averageScore, riskCount)

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, items.length, averageScore, riskCount),
    averageScore,
    riskCount,
    categoryCount,
    metrics: buildMetrics(items.length, averageScore, riskCount, categoryCount),
    items,
    primaryAction: actionForLevel(level, items),
  }
}

function buildLatestAttemptContext(
  questionId: number,
  attempts: InterviewAttempt[],
  progress: StudyProgress,
): LatestAttemptContext | null {
  const attempt = [...attempts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (!attempt) {
    return null
  }

  return {
    questionId,
    snapshot: progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId),
    attempt,
  }
}

function buildDefenseItems(context: LatestAttemptContext): InterviewFollowUpDefenseItem[] {
  const pack = buildFollowUpDrillPack(context.snapshot, context.attempt.answer, context.attempt.feedback)

  return pack.items.map(item => toDefenseItem(context, item))
}

function toDefenseItem(
  context: LatestAttemptContext,
  item: FollowUpDrillItem,
): InterviewFollowUpDefenseItem {
  const weakestScore = Math.min(...context.attempt.feedback.criteria.map(criterion => criterion.score))

  return {
    id: `${context.questionId}-${context.attempt.createdAt}-${item.id}`,
    questionId: context.questionId,
    title: context.snapshot.title,
    categoryName: context.snapshot.categoryName,
    score: context.attempt.feedback.score,
    criterionKey: item.criterionKey,
    criterionLabel: item.criterionLabel,
    prompt: item.prompt,
    pressurePoint: item.pressurePoint,
    answerGuide: item.answerGuide,
    to: `/practice?queue=${context.questionId}`,
    priority: item.priority + lowScoreBoost(context.attempt.feedback.score) + weakCriterionBoost(weakestScore) + timestampWeight(context.attempt.createdAt),
    createdAt: context.attempt.createdAt,
  }
}

function lowScoreBoost(score: number): number {
  return Math.max(0, 100 - score) * 5
}

function weakCriterionBoost(score: number): number {
  return Math.max(0, 75 - score) * 2
}

function timestampWeight(createdAt: string): number {
  const time = Date.parse(createdAt)
  if (!Number.isFinite(time)) {
    return 0
  }
  return Math.min(9, Math.floor(time / 1000) % 10)
}

function averageLatestScore(contexts: LatestAttemptContext[]): number {
  if (contexts.length === 0) {
    return 0
  }
  const total = contexts.reduce((sum, context) => sum + context.attempt.feedback.score, 0)
  return Math.round(total / contexts.length)
}

function resolveLevel(
  itemCount: number,
  averageScore: number,
  riskCount: number,
): InterviewFollowUpDefenseLevel {
  if (itemCount === 0) {
    return 'empty'
  }
  if (riskCount > 0) {
    return 'risk'
  }
  if (averageScore >= 85) {
    return 'ready'
  }
  return 'pressure'
}

function titleForLevel(level: InterviewFollowUpDefenseLevel): string {
  if (level === 'empty') {
    return '追问防线待建立'
  }
  if (level === 'risk') {
    return '先补高风险追问'
  }
  if (level === 'ready') {
    return '追问防线较稳'
  }
  return '进入追问加压'
}

function summaryForLevel(
  level: InterviewFollowUpDefenseLevel,
  itemCount: number,
  averageScore: number,
  riskCount: number,
): string {
  if (level === 'empty') {
    return '完成一次模拟面试后，系统会把最容易被连续追问的问题整理成防线清单。'
  }
  if (level === 'risk') {
    return `发现 ${riskCount} 道低分回答，先处理前 ${itemCount} 条高风险追问，避免临场被追问打穿。`
  }
  if (level === 'ready') {
    return `最近模拟平均 ${averageScore} 分，面试前快速复盘 ${itemCount} 条追问即可。`
  }
  return `最近模拟平均 ${averageScore} 分，适合继续用 ${itemCount} 条追问做高压加压。`
}

function buildMetrics(
  itemCount: number,
  averageScore: number,
  riskCount: number,
  categoryCount: number,
): InterviewFollowUpDefenseMetric[] {
  return [
    {
      key: 'items',
      label: '防线追问',
      value: String(itemCount),
      detail: itemCount > 0 ? '今日优先演练' : '等待模拟样本',
    },
    {
      key: 'average',
      label: '最近均分',
      value: averageScore > 0 ? `${averageScore} 分` : '暂无',
      detail: averageScore >= 85 ? '表达较稳' : '仍需加压',
    },
    {
      key: 'risk',
      label: '低分回答',
      value: String(riskCount),
      detail: `${RISK_SCORE_THRESHOLD} 分以下优先修复`,
    },
    {
      key: 'categories',
      label: '覆盖分类',
      value: String(categoryCount),
      detail: categoryCount > 1 ? '跨方向防守' : '继续扩展样本',
    },
  ]
}

function actionForLevel(
  level: InterviewFollowUpDefenseLevel,
  items: InterviewFollowUpDefenseItem[],
): InterviewFollowUpDefenseAction {
  if (level === 'empty') {
    return {
      label: '先做一题模拟',
      description: '用一次开口回答生成第一份追问防线。',
      to: '/practice',
    }
  }

  const queue = [...new Set(items.map(item => item.questionId))].join(',')
  const to = queue ? `/practice?queue=${queue}` : '/practice'
  if (level === 'risk') {
    return {
      label: '先修追问短板',
      description: '按最高风险追问重新作答，先把低分断点补上。',
      to: items[0]?.to ?? to,
    }
  }
  if (level === 'ready') {
    return {
      label: '面试前复盘追问',
      description: '用高压追问快速检查边界、权衡和项目落地。',
      to,
    }
  }
  return {
    label: '做一轮追问加压',
    description: '连续回答防线清单，训练被追问后的临场拆解。',
    to,
  }
}

function fallbackSnapshot(questionId: number): QuestionSnapshot {
  return {
    id: questionId,
    title: `题目 #${questionId}`,
    difficulty: 'MEDIUM',
    categoryName: '未分类',
    tags: [],
    viewCount: 0,
  }
}
