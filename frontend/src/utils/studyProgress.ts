import type {
  InterviewAttempt,
  Question,
  QuestionSnapshot,
  QuestionStudyState,
  PracticeQueueItem,
  ReviewQueueItem,
  StudyProgress,
  StudyQuestionStatus,
  StudySummary,
  WeakArea,
} from '../types'

export const STUDY_PROGRESS_STORAGE_KEY = 'lcb-interview-study-progress'
export const STUDY_PROGRESS_EVENT = 'lcb-study-progress-change'

const DEFAULT_ROLE = 'Java 后端'
const DEFAULT_SPRINT_DAYS = 21
const MIN_SPRINT_DAYS = 7
const MAX_SPRINT_DAYS = 60
const MAX_ATTEMPTS_PER_QUESTION = 5

export interface QuestionSetProgressSummary {
  total: number
  tracked: number
  planned: number
  hasQuestions: boolean
  allPlanned: boolean
}

export function createDefaultProgress(now = new Date().toISOString()): StudyProgress {
  return {
    targetRole: DEFAULT_ROLE,
    sprintDays: DEFAULT_SPRINT_DAYS,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: now,
  }
}

export function parseStudyProgress(raw: string | null): StudyProgress {
  if (!raw) {
    return createDefaultProgress()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StudyProgress>
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultProgress()
    }
    return {
      targetRole: typeof parsed.targetRole === 'string' ? parsed.targetRole : DEFAULT_ROLE,
      sprintDays: typeof parsed.sprintDays === 'number' ? parsed.sprintDays : DEFAULT_SPRINT_DAYS,
      questionStates: parsed.questionStates && typeof parsed.questionStates === 'object'
        ? parsed.questionStates as Record<number, QuestionStudyState>
        : {},
      questionSnapshots: parsed.questionSnapshots && typeof parsed.questionSnapshots === 'object'
        ? parsed.questionSnapshots as Record<number, QuestionSnapshot>
        : {},
      interviewAttempts: parsed.interviewAttempts && typeof parsed.interviewAttempts === 'object'
        ? parsed.interviewAttempts as Record<number, InterviewAttempt[]>
        : {},
      dailyPlan: Array.isArray(parsed.dailyPlan)
        ? [...new Set(parsed.dailyPlan.filter(id => typeof id === 'number'))]
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return createDefaultProgress()
  }
}

export function readStudyProgress(storage: Storage = window.localStorage): StudyProgress {
  return parseStudyProgress(storage.getItem(STUDY_PROGRESS_STORAGE_KEY))
}

export function writeStudyProgress(progress: StudyProgress, storage: Storage = window.localStorage): void {
  storage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  window.dispatchEvent(new Event(STUDY_PROGRESS_EVENT))
}

export function getQuestionState(progress: StudyProgress, questionId: number): QuestionStudyState {
  return progress.questionStates[questionId] ?? {
    status: 'new',
    addedToPlan: progress.dailyPlan.includes(questionId),
    reviewCount: 0,
  }
}

export function updateQuestionStatus(
  progress: StudyProgress,
  questionId: number,
  status: StudyQuestionStatus,
  now = new Date().toISOString(),
): StudyProgress {
  const current = getQuestionState(progress, questionId)
  return {
    ...progress,
    questionStates: {
      ...progress.questionStates,
      [questionId]: {
        ...current,
        status,
        lastReviewedAt: now,
        reviewCount: current.reviewCount + 1,
      },
    },
    updatedAt: now,
  }
}

export function toggleQuestionInPlan(
  progress: StudyProgress,
  questionId: number,
  added: boolean,
  now = new Date().toISOString(),
): StudyProgress {
  const current = getQuestionState(progress, questionId)
  const dailyPlan = added
    ? [...new Set([...progress.dailyPlan, questionId])]
    : progress.dailyPlan.filter(id => id !== questionId)
  return {
    ...progress,
    dailyPlan,
    questionStates: {
      ...progress.questionStates,
      [questionId]: {
        ...current,
        addedToPlan: added,
        status: current.status === 'new' && added ? 'learning' : current.status,
      },
    },
    updatedAt: now,
  }
}

export function replaceDailyPlan(
  progress: StudyProgress,
  questionIds: number[],
  now = new Date().toISOString(),
): StudyProgress {
  const dailyPlan = [...new Set(questionIds.filter(id => typeof id === 'number'))]
  const planIds = new Set(dailyPlan)
  const affectedIds = new Set([...progress.dailyPlan, ...dailyPlan])
  const questionStates = { ...progress.questionStates }

  for (const questionId of affectedIds) {
    const current = getQuestionState(progress, questionId)
    const addedToPlan = planIds.has(questionId)
    questionStates[questionId] = {
      ...current,
      addedToPlan,
      status: current.status === 'new' && addedToPlan ? 'learning' : current.status,
    }
  }

  return {
    ...progress,
    dailyPlan,
    questionStates,
    updatedAt: now,
  }
}

export function appendDailyPlanQuestions(
  progress: StudyProgress,
  questionIds: number[],
  now = new Date().toISOString(),
): StudyProgress {
  return replaceDailyPlan(progress, [...progress.dailyPlan, ...questionIds], now)
}

export function summarizeQuestionSetProgress(
  progress: StudyProgress,
  questionIds: number[],
): QuestionSetProgressSummary {
  const uniqueIds = [...new Set(questionIds.filter(id => typeof id === 'number'))]
  const states = uniqueIds.map(questionId => getQuestionState(progress, questionId))
  const planned = states.filter(state => state.addedToPlan).length
  const tracked = states.filter(state => state.status !== 'new' || state.addedToPlan).length
  const total = uniqueIds.length

  return {
    total,
    tracked,
    planned,
    hasQuestions: total > 0,
    allPlanned: total > 0 && planned === total,
  }
}

export function recordInterviewAttempt(
  progress: StudyProgress,
  attempt: InterviewAttempt,
): StudyProgress {
  const currentAttempts = progress.interviewAttempts[attempt.questionId] ?? []
  return {
    ...progress,
    interviewAttempts: {
      ...progress.interviewAttempts,
      [attempt.questionId]: [attempt, ...currentAttempts].slice(0, MAX_ATTEMPTS_PER_QUESTION),
    },
    updatedAt: attempt.createdAt,
  }
}

export function updateStudySettings(
  progress: StudyProgress,
  patch: { targetRole?: string; sprintDays?: number | null },
  now = new Date().toISOString(),
): StudyProgress {
  const targetRole = patch.targetRole?.trim()
  const sprintDays = typeof patch.sprintDays === 'number'
    ? clampSprintDays(patch.sprintDays)
    : progress.sprintDays
  return {
    ...progress,
    targetRole: targetRole ? targetRole : progress.targetRole,
    sprintDays,
    updatedAt: now,
  }
}

function clampSprintDays(value: number): number {
  const rounded = Math.round(value)
  return Math.min(MAX_SPRINT_DAYS, Math.max(MIN_SPRINT_DAYS, rounded))
}

export function toQuestionSnapshot(question: Question): QuestionSnapshot {
  return {
    id: question.id,
    title: question.title,
    difficulty: question.difficulty,
    categoryName: question.categoryName,
    categoryId: question.categoryId,
    tags: question.tags ?? [],
    viewCount: question.viewCount,
  }
}

export function rememberQuestions(
  progress: StudyProgress,
  questions: Question[],
  now = new Date().toISOString(),
): StudyProgress {
  if (questions.length === 0) {
    return progress
  }
  const nextSnapshots = { ...progress.questionSnapshots }
  for (const question of questions) {
    nextSnapshots[question.id] = toQuestionSnapshot(question)
  }
  return {
    ...progress,
    questionSnapshots: nextSnapshots,
    updatedAt: now,
  }
}

export function buildDailyPlan(progress: StudyProgress, candidates: Question[], limit = 5): number[] {
  const known = new Set(progress.dailyPlan)
  const ranked = [...candidates]
    .filter(q => !known.has(q.id) || getQuestionState(progress, q.id).status !== 'mastered')
    .sort((a, b) => rankQuestion(progress, a) - rankQuestion(progress, b))
    .map(q => q.id)
  return [...new Set([...progress.dailyPlan, ...ranked])].slice(0, limit)
}

export function resolvePlanQuestions(
  progress: StudyProgress,
  candidates: Question[],
  limit = 5,
): QuestionSnapshot[] {
  const candidateSnapshots = Object.fromEntries(
    candidates.map(question => [question.id, toQuestionSnapshot(question)]),
  ) as Record<number, QuestionSnapshot>
  const snapshots = {
    ...progress.questionSnapshots,
    ...candidateSnapshots,
  }
  return buildDailyPlan(progress, candidates, limit)
    .map(id => snapshots[id])
    .filter((question): question is QuestionSnapshot => Boolean(question))
}

function rankQuestion(progress: StudyProgress, question: Question): number {
  const state = getQuestionState(progress, question.id)
  if (state.status === 'weak') {
    return 0
  }
  if (state.status === 'learning') {
    return 1
  }
  if (state.status === 'new') {
    return 2
  }
  return 3
}

export function buildReviewQueue(progress: StudyProgress, limit = 8): ReviewQueueItem[] {
  return Object.entries(progress.questionStates)
    .map(([id, state]) => {
      const questionId = Number(id)
      const snapshot = progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)
      return {
        ...snapshot,
        status: state.status,
        lastReviewedAt: state.lastReviewedAt,
        reviewCount: state.reviewCount,
        reason: state.status === 'weak' ? '薄弱优先' : '继续巩固',
      }
    })
    .filter(item => item.status === 'weak' || item.status === 'learning')
    .sort((a, b) => {
      const statusRank = reviewStatusRank(a.status) - reviewStatusRank(b.status)
      if (statusRank !== 0) {
        return statusRank
      }
      return (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? '')
    })
    .slice(0, limit)
}

export function buildPracticeQueue(
  progress: StudyProgress,
  candidates: Question[],
  limit = 10,
): PracticeQueueItem[] {
  const candidateSnapshots = Object.fromEntries(
    candidates.map(question => [question.id, toQuestionSnapshot(question)]),
  ) as Record<number, QuestionSnapshot>
  const snapshots = {
    ...progress.questionSnapshots,
    ...candidateSnapshots,
  }
  const queue: PracticeQueueItem[] = []
  const used = new Set<number>()

  for (const item of buildReviewQueue(progress, limit)) {
    if (item.status === 'learning' && item.reviewCount === 0) {
      continue
    }
    pushPracticeItem(queue, used, item, item.status, 'review')
  }

  const planItems = progress.dailyPlan
    .map(id => snapshots[id])
    .filter((question): question is QuestionSnapshot => Boolean(question))

  for (const item of planItems) {
    const state = getQuestionState(progress, item.id)
    pushPracticeItem(queue, used, item, state.status, 'plan')
  }

  const candidateIds = new Set(candidates.map(question => question.id))
  const freshItems = [
    ...candidates.map(question => snapshots[question.id]),
    ...Object.values(progress.questionSnapshots).filter(snapshot => !candidateIds.has(snapshot.id)),
  ].filter((question): question is QuestionSnapshot => Boolean(question))

  for (const question of freshItems) {
    const state = getQuestionState(progress, question.id)
    if (state.status === 'mastered') {
      continue
    }
    pushPracticeItem(queue, used, question, state.status, 'new')
  }

  return queue.slice(0, limit)
}

export function buildFocusedPracticeQueue(
  progress: StudyProgress,
  candidates: Question[],
  focusQuestionId: number | null,
  limit = 10,
): PracticeQueueItem[] {
  const queue = buildPracticeQueue(progress, candidates, limit)
  if (!focusQuestionId) {
    return queue
  }

  const existingIndex = queue.findIndex(item => item.id === focusQuestionId)
  if (existingIndex >= 0) {
    const focused = queue[existingIndex]
    return [
      focused,
      ...queue.filter(item => item.id !== focusQuestionId),
    ].slice(0, limit)
  }

  const focusedQuestion = candidates.find(question => question.id === focusQuestionId)
  const snapshot = focusedQuestion
    ? toQuestionSnapshot(focusedQuestion)
    : progress.questionSnapshots[focusQuestionId]
  if (!snapshot) {
    return queue
  }

  const state = getQuestionState(progress, focusQuestionId)
  const source: PracticeQueueItem['source'] = state.addedToPlan ? 'plan' : 'new'
  return [
    {
      ...snapshot,
      status: state.status,
      source,
    },
    ...queue.filter(item => item.id !== focusQuestionId),
  ].slice(0, limit)
}

export function buildScopedPracticeQueue(
  progress: StudyProgress,
  candidates: Question[],
  scopedQuestionIds: number[],
  focusQuestionId: number | null,
  limit = 10,
): PracticeQueueItem[] {
  const baseQueue = buildFocusedPracticeQueue(progress, candidates, focusQuestionId, limit)
  const scopedIds = [...new Set(scopedQuestionIds.filter(id => typeof id === 'number'))]
  if (scopedIds.length === 0) {
    return baseQueue
  }

  const candidateSnapshots = Object.fromEntries(
    candidates.map(question => [question.id, toQuestionSnapshot(question)]),
  ) as Record<number, QuestionSnapshot>
  const snapshots = {
    ...progress.questionSnapshots,
    ...candidateSnapshots,
  }
  const scopedItems = scopedIds
    .map(id => snapshots[id])
    .filter((question): question is QuestionSnapshot => Boolean(question))
    .map(question => ({
      ...question,
      status: getQuestionState(progress, question.id).status,
      source: 'page' as const,
    }))

  if (scopedItems.length === 0) {
    return baseQueue
  }

  const scopedSet = new Set(scopedItems.map(item => item.id))
  const queue = [
    ...scopedItems,
    ...baseQueue.filter(item => !scopedSet.has(item.id)),
  ]

  if (focusQuestionId) {
    const focusIndex = queue.findIndex(item => item.id === focusQuestionId)
    if (focusIndex > 0) {
      const focused = queue[focusIndex]
      return [
        focused,
        ...queue.filter(item => item.id !== focusQuestionId),
      ].slice(0, limit)
    }
  }

  return queue.slice(0, limit)
}

function pushPracticeItem(
  queue: PracticeQueueItem[],
  used: Set<number>,
  snapshot: QuestionSnapshot,
  status: StudyQuestionStatus,
  source: PracticeQueueItem['source'],
): void {
  if (used.has(snapshot.id)) {
    return
  }
  used.add(snapshot.id)
  queue.push({
    ...snapshot,
    status,
    source,
  })
}

function reviewStatusRank(status: StudyQuestionStatus): number {
  if (status === 'weak') {
    return 0
  }
  if (status === 'learning') {
    return 1
  }
  return 2
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

export function summarizeProgress(progress: StudyProgress): StudySummary {
  const states = Object.values(progress.questionStates)
  const mastered = states.filter(s => s.status === 'mastered').length
  const weak = states.filter(s => s.status === 'weak').length
  const learning = states.filter(s => s.status === 'learning').length
  const totalTracked = states.length
  return {
    totalTracked,
    mastered,
    weak,
    learning,
    masteryRate: totalTracked === 0 ? 0 : Math.round((mastered / totalTracked) * 100),
  }
}

export function weakAreasFromQuestions(progress: StudyProgress, questions: Question[]): WeakArea[] {
  const buckets = new Map<string, WeakArea>()
  for (const question of questions) {
    const state = getQuestionState(progress, question.id)
    if (state.status === 'new') {
      continue
    }
    const key = question.categoryName || `分类 ${question.categoryId ?? '未分组'}`
    const current = buckets.get(key) ?? {
      categoryId: question.categoryId,
      categoryName: key,
      score: 0,
      weakCount: 0,
      learningCount: 0,
      masteredCount: 0,
    }
    if (state.status === 'weak') {
      current.weakCount += 1
      current.score += 3
    }
    if (state.status === 'learning') {
      current.learningCount += 1
      current.score += 2
    }
    if (state.status === 'mastered') {
      current.masteredCount += 1
      current.score -= 1
    }
    buckets.set(key, current)
  }
  return [...buckets.values()]
    .filter(area => area.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
