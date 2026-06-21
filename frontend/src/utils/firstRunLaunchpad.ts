import type { InterviewAttempt, Question, QuestionSnapshot, StudyProgress } from '../types'
import type { PracticeAnswerDraft } from './practiceAnswerDraftStore'
import { buildDailyPlan, buildReviewQueue, getQuestionState } from './studyProgress'

export type FirstRunLaunchpadMode = 'first-run' | 'continue-plan' | 'repair' | 'resume-draft' | 'complete' | 'loading' | 'empty'

export interface LaunchpadAction {
  label: string
  description: string
  to: string
  kind: 'plan' | 'append-plan' | 'practice' | 'route' | 'study'
}

export interface LaunchpadMetric {
  label: string
  value: string
}

export interface LaunchpadPreviewItem {
  id: number
  title: string
  meta: string
}

export interface FirstRunLaunchpadModel {
  mode: FirstRunLaunchpadMode
  title: string
  summary: string
  primaryAction: LaunchpadAction
  secondaryActions: LaunchpadAction[]
  metrics: LaunchpadMetric[]
  previewItems: LaunchpadPreviewItem[]
  recommendedQuestionIds: number[]
}

export interface FirstRunLaunchpadOptions {
  loading?: boolean
  answerDrafts?: PracticeAnswerDraft[]
}

type PracticeQueueSource = 'first-run' | 'first-run-repair' | 'first-run-rehearsal' | 'daily-plan' | 'resume-draft'

const FIRST_RUN_LIMIT = 5
const CONTINUE_LIMIT = 12
const FIRST_RUN_REHEARSAL_MIN_SCORE = 80

export function buildFirstRunLaunchpad(
  progress: StudyProgress,
  hotQuestions: Question[],
  options: FirstRunLaunchpadOptions = {},
): FirstRunLaunchpadModel {
  const draftIds = buildDraftQuestionIds(options.answerDrafts ?? [], FIRST_RUN_LIMIT)
  if (draftIds.length > 0) {
    return {
      mode: 'resume-draft',
      title: '继续未提交回答',
      summary: '检测到你有未提交的模拟回答草稿，先把已经开始的训练补完，比重新开一轮更容易形成有效样本。',
      primaryAction: {
        label: `恢复 ${draftIds.length} 份回答草稿`,
        description: '回到未提交回答继续评分',
        to: buildPracticeQueuePath(draftIds, 'resume-draft'),
        kind: 'append-plan',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '未提交', value: String(draftIds.length) },
        { label: '今日计划', value: String(progress.dailyPlan.length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: buildPreviewItems(progress, hotQuestions, draftIds),
      recommendedQuestionIds: draftIds,
    }
  }

  const reviewQueue = buildReviewQueue(progress, CONTINUE_LIMIT)
  const hasWeakQuestion = reviewQueue.some(item => item.status === 'weak')
  const repairIds = hasWeakQuestion
    ? reviewQueue
      .filter(item => item.status === 'weak' || item.status === 'learning')
      .map(item => item.id)
      .slice(0, FIRST_RUN_LIMIT)
    : []

  if (repairIds.length > 0) {
    return {
      mode: 'repair',
      title: '先修复最影响面试的薄弱题',
      summary: '系统已经发现薄弱或学习中的题，先把这些题拉回可复述状态，比继续乱刷更有效。',
      primaryAction: {
        label: `修复 ${repairIds.length} 道风险题`,
        description: '直接进入薄弱题训练队列',
        to: buildPracticeQueuePath(repairIds, 'first-run-repair'),
        kind: 'append-plan',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '风险题', value: String(repairIds.length) },
        { label: '今日计划', value: String(progress.dailyPlan.length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: buildPreviewItems(progress, hotQuestions, repairIds),
      recommendedQuestionIds: repairIds,
    }
  }

  const dailyPlanIds = uniquePositiveIds(progress.dailyPlan).slice(0, CONTINUE_LIMIT)
  const unfinishedDailyPlanIds = dailyPlanIds.filter(questionId => !isFirstRunQuestionComplete(progress, questionId))
  if (dailyPlanIds.length > 0 && unfinishedDailyPlanIds.length === 0) {
    const rehearsalIds = buildCompletedPlanRehearsalIds(progress, dailyPlanIds)
    return {
      mode: 'complete',
      title: '今日首练闭环已完成',
      summary: '本轮计划题已经全部过线，先按低分优先复述，确认最低分题也能脱稿，再去战报沉淀可复述证据。',
      primaryAction: {
        label: `优先复述 ${rehearsalIds.length} 道过线题`,
        description: '从最低分已过线题开始脱稿验证',
        to: buildPracticeQueuePath(rehearsalIds, 'first-run-rehearsal'),
        kind: 'practice',
      },
      secondaryActions: completedSecondaryActions(),
      metrics: [
        { label: '已掌握', value: String(dailyPlanIds.length) },
        { label: '待补弱', value: '0' },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: buildPreviewItems(progress, hotQuestions, rehearsalIds),
      recommendedQuestionIds: rehearsalIds,
    }
  }

  if (unfinishedDailyPlanIds.length > 0) {
    return {
      mode: 'continue-plan',
      title: '继续今日训练',
      summary: '今日计划已经就绪，继续完成队列，比重新选题更容易形成闭环。',
      primaryAction: {
        label: `继续 ${unfinishedDailyPlanIds.length} 题队列`,
        description: '从今日计划进入训练',
        to: buildPracticeQueuePath(unfinishedDailyPlanIds, 'daily-plan'),
        kind: 'practice',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '今日计划', value: String(unfinishedDailyPlanIds.length) },
        { label: '已跟踪', value: String(Object.keys(progress.questionStates).length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: buildPreviewItems(progress, hotQuestions, unfinishedDailyPlanIds),
      recommendedQuestionIds: unfinishedDailyPlanIds,
    }
  }

  const learningReviewIds = dailyPlanIds.length === 0
    ? reviewQueue
      .filter(item => item.status === 'learning')
      .map(item => item.id)
      .slice(0, FIRST_RUN_LIMIT)
    : []
  if (learningReviewIds.length > 0) {
    return {
      mode: 'continue-plan',
      title: '继续今日训练',
      summary: '已经有未过线的学习中题目，先把这批题补成有效开口样本，再开启新的首练队列。',
      primaryAction: {
        label: `继续 ${learningReviewIds.length} 题队列`,
        description: '从学习中题目继续训练',
        to: buildPracticeQueuePath(learningReviewIds, 'daily-plan'),
        kind: 'plan',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '学习中', value: String(learningReviewIds.length) },
        { label: '已跟踪', value: String(Object.keys(progress.questionStates).length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: buildPreviewItems(progress, hotQuestions, learningReviewIds),
      recommendedQuestionIds: learningReviewIds,
    }
  }

  if (options.loading) {
    return {
      mode: 'loading',
      title: '正在准备首练题',
      summary: '正在拉取高频题。题目到达前，路线和学习计划仍然可以先打开。',
      primaryAction: {
        label: '正在准备首练题',
        description: '等待热门题加载完成',
        to: '/routes',
        kind: 'route',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '首练题', value: '准备中' },
        { label: '目标', value: progress.targetRole },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: [],
      recommendedQuestionIds: [],
    }
  }

  const firstRunCandidates = buildFirstRunCandidates(progress, hotQuestions)
  const firstRunIds = buildDailyPlan(progress, firstRunCandidates, FIRST_RUN_LIMIT)
  if (firstRunIds.length === 0) {
    return {
      mode: 'empty',
      title: '先选择一条备考路线',
      summary: '当前还没有可生成首练的热门题，先按岗位路线进入题库，系统会在浏览题目后建立本地训练队列。',
      primaryAction: {
        label: '按岗位选路线',
        description: '从岗位路线进入题库训练',
        to: '/routes',
        kind: 'route',
      },
      secondaryActions: emptyFallbackSecondaryActions(),
      metrics: [
        { label: '首练题', value: '0' },
        { label: '目标', value: progress.targetRole },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      previewItems: [],
      recommendedQuestionIds: [],
    }
  }

  return {
    mode: 'first-run',
    title: '3 分钟开始首轮训练',
    summary: `不用先研究题库结构，先拿 ${firstRunIds.length} 道高频题开口训练，系统会根据结果生成复习和补弱队列。`,
    primaryAction: {
      label: `生成 ${firstRunIds.length} 题首练队列`,
      description: '把高频题加入今日训练并开始模拟',
      to: buildPracticeQueuePath(firstRunIds, 'first-run'),
      kind: 'plan',
    },
    secondaryActions: baseSecondaryActions(),
    metrics: [
      { label: '首练题', value: String(firstRunIds.length) },
      { label: '目标', value: progress.targetRole },
      { label: '冲刺天数', value: String(progress.sprintDays) },
    ],
    previewItems: buildPreviewItems(progress, firstRunCandidates, firstRunIds),
    recommendedQuestionIds: firstRunIds,
  }
}

export function buildPracticeQueuePath(questionIds: number[], source?: PracticeQueueSource): string {
  const ids = uniquePositiveIds(questionIds)
  const query = [
    ids.length > 0 ? `queue=${ids.join(',')}` : '',
    source ? `from=${source}` : '',
  ].filter(Boolean).join('&')

  return query ? `/practice?${query}` : '/practice'
}

function uniquePositiveIds(questionIds: number[]): number[] {
  return [
    ...new Set(
      questionIds.filter(questionId => Number.isInteger(questionId) && questionId > 0),
    ),
  ]
}

function baseSecondaryActions(): LaunchpadAction[] {
  return [
    {
      label: '按岗位选路线',
      description: '查看 Java、前端、AI、架构路线',
      to: '/routes',
      kind: 'route',
    },
    {
      label: '打开学习计划',
      description: '查看复习债和今日闭环',
      to: '/study',
      kind: 'study',
    },
  ]
}

function completedSecondaryActions(): LaunchpadAction[] {
  return [
    {
      label: '查看今日战报',
      description: '沉淀首练高分素材和复述证据',
      to: '/study',
      kind: 'study',
    },
    {
      label: '按岗位选路线',
      description: '查看 Java、前端、AI、架构路线',
      to: '/routes',
      kind: 'route',
    },
  ]
}

function emptyFallbackSecondaryActions(): LaunchpadAction[] {
  return [
    {
      label: '打开学习计划',
      description: '先建立今日计划和冲刺节奏',
      to: '/study',
      kind: 'study',
    },
  ]
}

function buildCompletedPlanRehearsalIds(progress: StudyProgress, questionIds: number[]): number[] {
  return [...questionIds]
    .sort((left, right) => {
      const scoreDiff = scoreForRehearsalPriority(latestAttemptScore(progress.interviewAttempts[left]))
        - scoreForRehearsalPriority(latestAttemptScore(progress.interviewAttempts[right]))
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      return questionIds.indexOf(left) - questionIds.indexOf(right)
    })
}

function isFirstRunQuestionComplete(progress: StudyProgress, questionId: number): boolean {
  const state = getQuestionState(progress, questionId)
  const latestScore = latestAttemptScore(progress.interviewAttempts[questionId])
  return state.status === 'mastered'
    && latestScore !== undefined
    && latestScore >= FIRST_RUN_REHEARSAL_MIN_SCORE
}

function latestAttemptScore(attempts?: InterviewAttempt[]): number | undefined {
  return [...(attempts ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0]
    ?.feedback.score
}

function scoreForRehearsalPriority(score?: number): number {
  return score === undefined ? Number.POSITIVE_INFINITY : score
}

function buildDraftQuestionIds(answerDrafts: PracticeAnswerDraft[], limit: number): number[] {
  const questionIds = [...answerDrafts]
    .sort(compareDraftUpdatedAtDesc)
    .map(draft => draft.questionId)

  return uniquePositiveIds(questionIds)
    .slice(0, limit)
}

function compareDraftUpdatedAtDesc(left: PracticeAnswerDraft, right: PracticeAnswerDraft): number {
  const leftTime = Date.parse(left.updatedAt)
  const rightTime = Date.parse(right.updatedAt)
  const timeDiff = (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0)
  if (timeDiff !== 0) {
    return timeDiff
  }
  return right.updatedAt.localeCompare(left.updatedAt) || right.questionId - left.questionId
}

function buildPreviewItems(
  progress: StudyProgress,
  hotQuestions: Question[],
  questionIds: number[],
): LaunchpadPreviewItem[] {
  const candidateSnapshots = Object.fromEntries(
    hotQuestions.map(question => [question.id, toPreviewSnapshot(question)]),
  ) as Record<number, QuestionSnapshot>
  const snapshots = {
    ...progress.questionSnapshots,
    ...candidateSnapshots,
  }

  return questionIds
    .slice(0, 3)
    .map(id => snapshots[id])
    .filter((snapshot): snapshot is QuestionSnapshot => Boolean(snapshot))
    .map(snapshot => ({
      id: snapshot.id,
      title: snapshot.title,
      meta: `${snapshot.categoryName || '未分组'} · ${snapshot.difficulty}`,
    }))
}

function buildFirstRunCandidates(progress: StudyProgress, hotQuestions: Question[]): Question[] {
  const candidates = new Map<number, Question>()
  for (const question of hotQuestions) {
    candidates.set(question.id, question)
  }
  for (const snapshot of Object.values(progress.questionSnapshots)) {
    if (!candidates.has(snapshot.id)) {
      candidates.set(snapshot.id, toQuestionCandidate(snapshot, progress.updatedAt))
    }
  }
  return [...candidates.values()]
    .filter(question => !isFirstRunQuestionComplete(progress, question.id))
}

function toPreviewSnapshot(question: Question): QuestionSnapshot {
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

function toQuestionCandidate(snapshot: QuestionSnapshot, updatedAt: string): Question {
  return {
    id: snapshot.id,
    title: snapshot.title,
    content: '',
    difficulty: snapshot.difficulty,
    categoryName: snapshot.categoryName,
    categoryId: snapshot.categoryId,
    tags: snapshot.tags,
    viewCount: snapshot.viewCount,
    createTime: updatedAt,
  }
}
