import type {
  QuestionSnapshot,
  QuestionStudyState,
  ReviewDueStatus,
  ReviewScheduleSummary,
  ScheduledReviewItem,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
const ENCOUNTER_REVIEW_THRESHOLD = 2

export function buildScheduledReviewQueue(
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = 12,
): ScheduledReviewItem[] {
  const currentDate = parseReviewDate(now) ?? new Date()
  const items: ScheduledReviewItem[] = []

  for (const [id, state] of Object.entries(progress.questionStates)) {
    const isEncounterReview = shouldScheduleEncounterReview(state)
    if (state.status === 'new' && !isEncounterReview) {
      continue
    }

    const questionId = Number(id)
    const intervalDays = reviewIntervalDays(state.status, state.reviewCount)
    const lastReviewedAt = parseReviewDate(state.lastReviewedAt)
    // 老数据可能没有 lastReviewedAt。宁可把已跟踪题放到今天，也不要让用户错过复习窗口。
    const nextReviewDate = isEncounterReview
      ? currentDate
      : lastReviewedAt
        ? addDays(lastReviewedAt, intervalDays)
        : currentDate
    const dueStatus = resolveDueStatus(nextReviewDate, currentDate)
    const snapshot = progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)

    items.push({
      ...snapshot,
      status: state.status,
      lastReviewedAt: state.lastReviewedAt,
      reviewCount: state.reviewCount,
      lastEncounteredAt: state.lastEncounteredAt,
      encounterCount: state.encounterCount,
      reason: dueStatusLabel(dueStatus),
      dueStatus,
      nextReviewAt: nextReviewDate.toISOString(),
      daysUntilDue: daysBetween(startOfUtcDay(currentDate), startOfUtcDay(nextReviewDate)),
      scheduleReason: scheduleReason(state.status, state.reviewCount, isEncounterReview),
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
    activeRecall: items.filter(isActiveRecallReviewItem).length,
    nextReviewAt: upcomingItems[0]?.nextReviewAt,
  }
}

/**
 * 构建智能复习队列 Markdown，便于用户把到期复习债复制到外部计划或打卡文档。
 *
 * @param progress 本地学习进度
 * @param now      生成时间，默认取当前时间
 * @param limit    导出的队列上限，默认与页面展示保持一致
 * @returns 可复制或下载的 Markdown 复习队列
 */
export function buildReviewScheduleMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = 12,
): string {
  const queue = buildScheduledReviewQueue(progress, now, limit)
  const summary = summarizeReviewSchedule(queue)
  return [
    `# ${sanitizeMarkdownValue(progress.targetRole, '岗位')} 智能复习队列`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    '## 排期概览',
    renderScheduleOverview(summary),
    '',
    '## 复习队列',
    renderReviewQueue(queue),
  ].join('\n')
}

function shouldScheduleEncounterReview(state: QuestionStudyState): boolean {
  return state.status === 'new' && (state.encounterCount ?? 0) >= ENCOUNTER_REVIEW_THRESHOLD
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

function scheduleReason(status: StudyQuestionStatus, reviewCount: number, isEncounterReview = false): string {
  if (isEncounterReview) {
    return '多次遇见但还没完成复习，先安排一次主动回忆。'
  }
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

function isActiveRecallReviewItem(item: ScheduledReviewItem): boolean {
  return item.status === 'new'
    && item.reviewCount === 0
    && (item.encounterCount ?? 0) >= ENCOUNTER_REVIEW_THRESHOLD
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

function renderScheduleOverview(summary: ReviewScheduleSummary): string {
  return [
    `- 已逾期：${summary.overdue} 道`,
    `- 今日到期：${summary.dueToday} 道`,
    `- 主动回忆：${summary.activeRecall} 道`,
    `- 即将到期：${summary.upcoming} 道`,
    `- 下次复习：${formatMarkdownDate(summary.nextReviewAt)}`,
  ].join('\n')
}

function renderReviewQueue(items: ScheduledReviewItem[]): string {
  if (items.length === 0) {
    return [
      '1. 暂无到期复习题',
      '   - 下一步：先把薄弱题标记为“薄弱”或加入今日计划，再回来生成队列。',
      '   - 入口：/banks',
    ].join('\n')
  }

  return items
    .map((item, index) => {
      const title = `${index + 1}. ${sanitizeMarkdownValue(item.title, `题目 #${item.id}`)}`

      if (isActiveRecallReviewItem(item)) {
        return [
          title,
          '   - 状态：主动回忆',
          `   - 排期：${dueStatusLabel(item.dueStatus)}`,
          `   - 分类：${sanitizeMarkdownValue(item.categoryName, '未分组')}`,
          `   - 遇见次数：${item.encounterCount ?? ENCOUNTER_REVIEW_THRESHOLD} 次`,
          `   - 下次复习：${formatMarkdownDate(item.nextReviewAt)}`,
          `   - 原因：${sanitizeMarkdownValue(item.scheduleReason, '多次遇见但还没完成复习，先安排一次主动回忆。')}`,
          `   - 训练入口：/practice?queue=${item.id}&from=review-due`,
          `   - 题目入口：/question/${item.id}`,
        ].join('\n')
      }

      return [
        title,
        `   - 状态：${dueStatusLabel(item.dueStatus)}`,
        `   - 分类：${sanitizeMarkdownValue(item.categoryName, '未分组')}`,
        `   - 复习次数：${item.reviewCount} 次`,
        `   - 下次复习：${formatMarkdownDate(item.nextReviewAt)}`,
        `   - 原因：${sanitizeMarkdownValue(item.scheduleReason, '按当前掌握状态进入复习队列。')}`,
        `   - 入口：/question/${item.id}`,
      ].join('\n')
    })
    .join('\n\n')
}

function formatMarkdownDate(value?: string): string {
  const date = parseReviewDate(value)
  if (!date) {
    return '暂无'
  }
  return date.toISOString().slice(0, 10)
}

function sanitizeMarkdownValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
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
