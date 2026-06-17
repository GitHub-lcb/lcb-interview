import type {
  DailyPlanBrief,
  DailyPlanBriefItem,
  DailyPlanBriefItemSource,
  Question,
  QuestionSnapshot,
  ReviewDueStatus,
  ScheduledReviewItem,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'
import { buildScheduledReviewQueue } from './reviewSchedule'
import { getQuestionState, toQuestionSnapshot } from './studyProgress'

export function buildDailyPlanBrief(
  progress: StudyProgress,
  candidates: Question[],
  now = new Date().toISOString(),
): DailyPlanBrief {
  const snapshots = buildSnapshotMap(progress, candidates)
  const reviewDebtById = new Map(
    buildScheduledReviewQueue(progress, now, 1000)
      .filter(item => item.dueStatus !== 'upcoming')
      .map(item => [item.id, item]),
  )
  const items = [...new Set(progress.dailyPlan)]
    .filter(questionId => typeof questionId === 'number')
    .map(questionId => buildBriefItem(progress, snapshots, reviewDebtById, questionId))
  const reviewDebtCount = items.filter(item => item.source === 'review-debt').length
  const weakCount = items.filter(item => item.status === 'weak').length
  const newCount = items.filter(item => item.status === 'new').length

  return {
    title: items.length === 0 ? '今日计划待生成' : '今日计划已拆解',
    summary: buildSummary(items.length, reviewDebtCount, weakCount, newCount),
    totalCount: items.length,
    reviewDebtCount,
    weakCount,
    newCount,
    metrics: [
      {
        key: 'total',
        label: '计划题量',
        value: `${items.length} 道`,
        detail: items.length > 0 ? '按今日计划顺序执行' : '等待生成计划',
      },
      {
        key: 'reviewDebt',
        label: '复习债',
        value: `${reviewDebtCount} 道`,
        detail: reviewDebtCount > 0 ? '优先补回记忆窗口' : '暂无到期压力',
      },
      {
        key: 'weak',
        label: '薄弱题',
        value: `${weakCount} 道`,
        detail: weakCount > 0 ? '需要主动讲清原因' : '暂无薄弱标记',
      },
      {
        key: 'new',
        label: '新题',
        value: `${newCount} 道`,
        detail: newCount > 0 ? '建立首轮记忆' : '今天以巩固为主',
      },
    ],
    items,
  }
}

function buildBriefItem(
  progress: StudyProgress,
  snapshots: Record<number, QuestionSnapshot>,
  reviewDebtById: Map<number, ScheduledReviewItem>,
  questionId: number,
): DailyPlanBriefItem {
  const state = getQuestionState(progress, questionId)
  const snapshot = snapshots[questionId] ?? fallbackSnapshot(questionId)
  const reviewDebt = reviewDebtById.get(questionId)
  const source = reviewDebt ? 'review-debt' : sourceFromStatus(state.status)

  return {
    id: `daily-plan-${questionId}`,
    questionId,
    title: snapshot.title,
    categoryName: snapshot.categoryName,
    status: state.status,
    source,
    sourceLabel: sourceLabel(source),
    reason: reasonForSource(source, reviewDebt?.dueStatus),
    actionLabel: actionLabel(source),
    to: `/question/${questionId}`,
    priority: priorityForSource(source),
    dueStatus: reviewDebt?.dueStatus,
  }
}

function buildSnapshotMap(
  progress: StudyProgress,
  candidates: Question[],
): Record<number, QuestionSnapshot> {
  const candidateSnapshots = Object.fromEntries(
    candidates.map(question => [question.id, toQuestionSnapshot(question)]),
  ) as Record<number, QuestionSnapshot>
  return {
    ...progress.questionSnapshots,
    ...candidateSnapshots,
  }
}

function sourceFromStatus(status: StudyQuestionStatus): DailyPlanBriefItemSource {
  if (status === 'weak') {
    return 'weak'
  }
  if (status === 'learning') {
    return 'learning'
  }
  if (status === 'mastered') {
    return 'mastered'
  }
  return 'new'
}

function sourceLabel(source: DailyPlanBriefItemSource): string {
  if (source === 'review-debt') {
    return '复习债'
  }
  if (source === 'weak') {
    return '薄弱修复'
  }
  if (source === 'learning') {
    return '学习巩固'
  }
  if (source === 'mastered') {
    return '掌握回看'
  }
  return '新题建立'
}

function reasonForSource(source: DailyPlanBriefItemSource, dueStatus?: ReviewDueStatus): string {
  if (source === 'review-debt') {
    return dueStatus === 'overdue'
      ? '这道题已逾期，先补回记忆断点。'
      : '这道题今天到期，趁遗忘前复盘。'
  }
  if (source === 'weak') {
    return '薄弱题要优先讲清原理、边界和项目场景。'
  }
  if (source === 'learning') {
    return '学习中题继续巩固，避免只看过但讲不出来。'
  }
  if (source === 'mastered') {
    return '已掌握题轻量回看，保持面试前的熟练度。'
  }
  return '新题先建立第一轮记忆，再进入后续复习排期。'
}

function actionLabel(source: DailyPlanBriefItemSource): string {
  if (source === 'review-debt') {
    return '先复盘'
  }
  if (source === 'weak') {
    return '讲清薄弱点'
  }
  if (source === 'learning') {
    return '继续巩固'
  }
  if (source === 'mastered') {
    return '轻量回看'
  }
  return '建立首轮记忆'
}

function priorityForSource(source: DailyPlanBriefItemSource): number {
  if (source === 'review-debt') {
    return 100
  }
  if (source === 'weak') {
    return 90
  }
  if (source === 'learning') {
    return 70
  }
  if (source === 'new') {
    return 50
  }
  return 30
}

function buildSummary(totalCount: number, reviewDebtCount: number, weakCount: number, newCount: number): string {
  if (totalCount === 0) {
    return '先生成今日计划，系统会把每道题拆成复习、修复、巩固和新题建立动作。'
  }
  return `今日 ${totalCount} 道题：${reviewDebtCount} 道复习债，${weakCount} 道薄弱题，${newCount} 道新题。`
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
