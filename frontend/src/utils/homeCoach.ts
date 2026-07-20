import type {
  InterviewAttempt,
  Question,
  QuestionSnapshot,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'
import type { PracticeAnswerDraft } from './practiceAnswerDraftStore'
import { buildFirstRunLaunchpad, type FirstRunLaunchpadModel } from './firstRunLaunchpad'
import { getQuestionState, summarizeProgress } from './studyProgress'
import { isQuestionRelevantToRole } from './roleFocus'

export interface HomeCoachQuestion {
  id: number
  title: string
  categoryName: string
  difficulty: string
  status: StudyQuestionStatus
  score?: number
}

export interface HomeCoachWeakArea {
  categoryName: string
  questionCount: number
  averageScore?: number
  priority: number
  questionIds: number[]
}

export interface HomeCoachModel {
  launchpad: FirstRunLaunchpadModel
  phase: 'diagnostic' | 'training' | 'repair' | 'ready'
  phaseLabel: string
  readinessScore: number
  assessedCount: number
  averageScore?: number
  focusQuestions: HomeCoachQuestion[]
  focusCompleted: number
  focusProgress: number
  weakAreas: HomeCoachWeakArea[]
  recommendations: HomeCoachQuestion[]
}

export interface HomeCoachOptions {
  loading?: boolean
  answerDrafts?: PracticeAnswerDraft[]
}

/**
 * 构建首页唯一的面试教练视图模型。
 *
 * @param progress 当前学习进度
 * @param candidates 首页已加载的热门题候选
 * @param options 加载状态和回答草稿
 * @return 首页阶段、主行动、能力摘要和推荐题单
 */
export function buildHomeCoach(
  progress: StudyProgress,
  candidates: Question[],
  options: HomeCoachOptions = {},
): HomeCoachModel {
  const launchpad = buildFirstRunLaunchpad(progress, candidates, options)
  const snapshots = mergeSnapshots(progress, candidates)
  const latestAttempts = latestAttemptsByQuestion(progress)
  const attempts = [...latestAttempts.values()]
  const averageScore = attempts.length > 0
    ? Math.round(attempts.reduce((total, attempt) => total + attempt.feedback.score, 0) / attempts.length)
    : undefined
  const summary = summarizeProgress(progress)
  const weakAreas = buildWeakAreas(progress, snapshots, latestAttempts)
  const focusQuestions = launchpad.recommendedQuestionIds
    .map(questionId => toCoachQuestion(progress, snapshots[questionId], latestAttempts.get(questionId)))
    .filter((question): question is HomeCoachQuestion => Boolean(question))
  const focusCompleted = focusQuestions.filter(question => question.score !== undefined).length
  const recommendations = buildRecommendations(progress, snapshots, latestAttempts, 6)
  const phase = resolvePhase(launchpad.mode, attempts.length)

  return {
    launchpad,
    phase,
    phaseLabel: phaseLabel(phase),
    readinessScore: calculateReadinessScore(summary.masteryRate, averageScore, attempts.length),
    assessedCount: attempts.length,
    averageScore,
    focusQuestions,
    focusCompleted,
    focusProgress: focusQuestions.length === 0 ? 0 : Math.round((focusCompleted / focusQuestions.length) * 100),
    weakAreas,
    recommendations,
  }
}

function mergeSnapshots(
  progress: StudyProgress,
  candidates: Question[],
): Record<number, QuestionSnapshot> {
  const next = { ...progress.questionSnapshots }
  for (const question of candidates) {
    next[question.id] = {
      id: question.id,
      title: question.title,
      difficulty: question.difficulty,
      categoryName: question.categoryName,
      categoryId: question.categoryId,
      tags: question.tags ?? [],
      viewCount: question.viewCount,
    }
  }
  return next
}

function latestAttemptsByQuestion(progress: StudyProgress): Map<number, InterviewAttempt> {
  const attempts = new Map<number, InterviewAttempt>()
  for (const [questionId, questionAttempts] of Object.entries(progress.interviewAttempts)) {
    const latest = [...questionAttempts]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    if (latest) {
      attempts.set(Number(questionId), latest)
    }
  }
  return attempts
}

function buildWeakAreas(
  progress: StudyProgress,
  snapshots: Record<number, QuestionSnapshot>,
  attempts: Map<number, InterviewAttempt>,
): HomeCoachWeakArea[] {
  const buckets = new Map<string, {
    scores: number[]
    priority: number
    questionIds: number[]
  }>()

  for (const [questionIdText, state] of Object.entries(progress.questionStates)) {
    if (state.status !== 'weak' && state.status !== 'learning') {
      continue
    }
    const questionId = Number(questionIdText)
    const snapshot = snapshots[questionId]
    const categoryName = snapshot?.categoryName || '未分组'
    const bucket = buckets.get(categoryName) ?? { scores: [], priority: 0, questionIds: [] }
    const score = attempts.get(questionId)?.feedback.score
    if (score !== undefined) {
      bucket.scores.push(score)
    }
    bucket.priority += state.status === 'weak' ? 3 : 1
    bucket.questionIds.push(questionId)
    buckets.set(categoryName, bucket)
  }

  return [...buckets.entries()]
    .map(([categoryName, bucket]) => ({
      categoryName,
      questionCount: bucket.questionIds.length,
      averageScore: bucket.scores.length > 0
        ? Math.round(bucket.scores.reduce((total, score) => total + score, 0) / bucket.scores.length)
        : undefined,
      priority: bucket.priority,
      questionIds: bucket.questionIds,
    }))
    .sort((left, right) => right.priority - left.priority || (left.averageScore ?? 100) - (right.averageScore ?? 100))
    .slice(0, 3)
}

function buildRecommendations(
  progress: StudyProgress,
  snapshots: Record<number, QuestionSnapshot>,
  attempts: Map<number, InterviewAttempt>,
  limit: number,
): HomeCoachQuestion[] {
  return Object.values(snapshots)
    .filter(snapshot => getQuestionState(progress, snapshot.id).status !== 'mastered')
    .sort((left, right) => {
      const stateDiff = statusRank(getQuestionState(progress, left.id).status)
        - statusRank(getQuestionState(progress, right.id).status)
      if (stateDiff !== 0) {
        return stateDiff
      }
      const roleDiff = Number(isQuestionRelevantToRole(progress.targetRole, right))
        - Number(isQuestionRelevantToRole(progress.targetRole, left))
      if (roleDiff !== 0) {
        return roleDiff
      }
      return right.viewCount - left.viewCount
    })
    .slice(0, limit)
    .map(snapshot => toCoachQuestion(progress, snapshot, attempts.get(snapshot.id)))
    .filter((question): question is HomeCoachQuestion => Boolean(question))
}

function toCoachQuestion(
  progress: StudyProgress,
  snapshot: QuestionSnapshot | undefined,
  attempt?: InterviewAttempt,
): HomeCoachQuestion | undefined {
  if (!snapshot) {
    return undefined
  }
  return {
    id: snapshot.id,
    title: snapshot.title,
    categoryName: snapshot.categoryName,
    difficulty: snapshot.difficulty,
    status: getQuestionState(progress, snapshot.id).status,
    score: attempt?.feedback.score,
  }
}

function resolvePhase(mode: FirstRunLaunchpadModel['mode'], attemptCount: number): HomeCoachModel['phase'] {
  if (mode === 'first-run' || mode === 'loading' || mode === 'empty') {
    return attemptCount === 0 ? 'diagnostic' : 'training'
  }
  if (mode === 'repair' || mode === 'resume-draft') {
    return 'repair'
  }
  if (mode === 'complete') {
    return 'ready'
  }
  return 'training'
}

function phaseLabel(phase: HomeCoachModel['phase']): string {
  if (phase === 'diagnostic') {
    return '岗位摸底'
  }
  if (phase === 'repair') {
    return '短板修复'
  }
  if (phase === 'ready') {
    return '复述验收'
  }
  return '今日训练'
}

function calculateReadinessScore(masteryRate: number, averageScore: number | undefined, attemptCount: number): number {
  if (attemptCount === 0) {
    return 0
  }
  const score = Math.round((averageScore ?? 0) * 0.7 + masteryRate * 0.3)
  return Math.min(100, Math.max(0, score))
}

function statusRank(status: StudyQuestionStatus): number {
  if (status === 'weak') {
    return 0
  }
  if (status === 'learning') {
    return 1
  }
  if (status === 'new') {
    return 2
  }
  return 3
}
