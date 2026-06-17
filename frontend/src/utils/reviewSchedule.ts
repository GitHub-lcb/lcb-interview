import type {
  QuestionSnapshot,
  ReviewDueStatus,
  ReviewScheduleSummary,
  ScheduledReviewItem,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'

const DAY_MS = 24 * 60 * 60 * 1000

export function buildScheduledReviewQueue(
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = 12,
): ScheduledReviewItem[] {
  const currentDate = parseReviewDate(now) ?? new Date()
  const items: ScheduledReviewItem[] = []

  for (const [id, state] of Object.entries(progress.questionStates)) {
    if (state.status === 'new') {
      continue
    }

    const questionId = Number(id)
    const intervalDays = reviewIntervalDays(state.status, state.reviewCount)
    const lastReviewedAt = parseReviewDate(state.lastReviewedAt)
    // 老数据可能没有 lastReviewedAt。宁可把已跟踪题放到今天，也不要让用户错过复习窗口。
    const nextReviewDate = lastReviewedAt
      ? addDays(lastReviewedAt, intervalDays)
      : currentDate
    const dueStatus = resolveDueStatus(nextReviewDate, currentDate)
    const snapshot = progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)

    items.push({
      ...snapshot,
      status: state.status,
      lastReviewedAt: state.lastReviewedAt,
      reviewCount: state.reviewCount,
      reason: dueStatusLabel(dueStatus),
      dueStatus,
      nextReviewAt: nextReviewDate.toISOString(),
      daysUntilDue: daysBetween(startOfUtcDay(currentDate), startOfUtcDay(nextReviewDate)),
      scheduleReason: scheduleReason(state.status, state.reviewCount),
    })
  }

  return items.sort(compareScheduledReviewItems).slice(0, limit)
}

export function summarizeReviewSchedule(items: ScheduledReviewItem[]): ReviewScheduleSummary {
  const upcomingItems = items.filter(item => item.dueStatus === 'upcoming')
  return {
    overdue: items.filter(item => item.dueStatus === 'overdue').length,
    dueToday: items.filter(item => item.dueStatus === 'due-today').length,
    upcoming: upcomingItems.length,
    nextReviewAt: upcomingItems[0]?.nextReviewAt,
  }
}

function reviewIntervalDays(status: StudyQuestionStatus, reviewCount: number): number {
  if (status === 'weak') {
    // 薄弱题固定 1 天复习一次，用高频暴露压住遗忘曲线，直到用户主动标记为掌握。
    return 1
  }
  if (status === 'learning') {
    if (reviewCount <= 1) {
      return 1
    }
    if (reviewCount === 2) {
      return 3
    }
    return 7
  }
  if (status === 'mastered') {
    return reviewCount >= 3 ? 14 : 7
  }
  return 0
}

function resolveDueStatus(nextReviewDate: Date, currentDate: Date): ReviewDueStatus {
  const todayStart = startOfUtcDay(currentDate)
  const todayEnd = new Date(todayStart.getTime() + DAY_MS - 1)

  if (nextReviewDate.getTime() < todayStart.getTime()) {
    return 'overdue'
  }
  if (nextReviewDate.getTime() <= todayEnd.getTime()) {
    return 'due-today'
  }
  return 'upcoming'
}

function compareScheduledReviewItems(a: ScheduledReviewItem, b: ScheduledReviewItem): number {
  const dueDiff = dueStatusRank(a.dueStatus) - dueStatusRank(b.dueStatus)
  if (dueDiff !== 0) {
    return dueDiff
  }

  const statusDiff = statusRank(a.status) - statusRank(b.status)
  if (statusDiff !== 0) {
    return statusDiff
  }

  return a.nextReviewAt.localeCompare(b.nextReviewAt)
}

function dueStatusRank(status: ReviewDueStatus): number {
  if (status === 'overdue') {
    return 0
  }
  if (status === 'due-today') {
    return 1
  }
  return 2
}

function statusRank(status: StudyQuestionStatus): number {
  if (status === 'weak') {
    return 0
  }
  if (status === 'learning') {
    return 1
  }
  if (status === 'mastered') {
    return 2
  }
  return 3
}

function dueStatusLabel(status: ReviewDueStatus): string {
  if (status === 'overdue') {
    return '已逾期'
  }
  if (status === 'due-today') {
    return '今日到期'
  }
  return '即将到期'
}

function scheduleReason(status: StudyQuestionStatus, reviewCount: number): string {
  if (status === 'weak') {
    return '薄弱题每天复习一次，直到能稳定讲清。'
  }
  if (status === 'learning') {
    if (reviewCount <= 1) {
      return '学习中题 1 天后复习，先建立第一轮记忆。'
    }
    if (reviewCount === 2) {
      return '学习中题 3 天后复习，开始拉开间隔。'
    }
    return '学习中题 7 天后复习，巩固长期记忆。'
  }
  if (status === 'mastered') {
    return reviewCount >= 3
      ? '稳定掌握题 14 天后回看，维持长期记忆。'
      : '已掌握题 7 天后巩固，避免长期遗忘。'
  }
  return '新题暂不进入复习排期。'
}

function parseReviewDate(value?: string): Date | null {
  if (!value) {
    return null
  }
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS)
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
