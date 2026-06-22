import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Button, Empty, Input, Progress, Spin } from 'antd'
import {
  ArrowRightOutlined,
  BookOutlined,
  CheckOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnswerGapPanel from '../../components/AnswerGapPanel'
import FollowUpDrillPanel from '../../components/FollowUpDrillPanel'
import InterviewReviewPanel from '../../components/InterviewReviewPanel'
import PracticeAnswerReadinessPanel from '../../components/PracticeAnswerReadinessPanel'
import PracticeAnswerScaffoldPanel from '../../components/PracticeAnswerScaffoldPanel'
import PracticeAttemptDeltaPanel from '../../components/PracticeAttemptDeltaPanel'
import PracticeFeedbackClosurePanel from '../../components/PracticeFeedbackClosurePanel'
import PracticeInterviewerScriptPanel from '../../components/PracticeInterviewerScriptPanel'
import PracticePostScoreNextStepPanel from '../../components/PracticePostScoreNextStepPanel'
import PracticeScriptAnswerAcceptancePanel from '../../components/PracticeScriptAnswerAcceptancePanel'
import PracticeSessionReportPanel from '../../components/PracticeSessionReportPanel'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { evaluateInterviewAnswerRemote } from '../../api/interview'
import { getHotQuestions, getQuestionById } from '../../api/question'
import type { InterviewFeedback, PracticeQueueItem, PracticeSessionRepairAction, Question } from '../../types'
import { evaluateInterviewAnswer } from '../../utils/interviewCoach'
import {
  clearPracticeAnswerDraft,
  readPracticeAnswerDraft,
  writePracticeAnswerDraft,
} from '../../utils/practiceAnswerDraftStore'
import { buildExperiencePressureQueue } from '../../utils/experiencePlaybook'
import { buildPracticeSessionRepairDraft } from '../../utils/practiceSessionReport'
import { buildScopedPracticeQueue, describeInterviewStatusSync, summarizeProgress } from '../../utils/studyProgress'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const sourceLabels: Record<PracticeQueueItem['source'], string> = {
  review: '复习优先',
  plan: '今日计划',
  page: '当前筛选',
  'active-recall': '主动回忆',
  new: '新题训练',
}

const feedbackLevelLabels: Record<InterviewFeedback['level'], string> = {
  strong: '强',
  pass: '可通过',
  'needs-work': '需补强',
}

const feedbackSourceLabels: Record<NonNullable<InterviewFeedback['source']>, string> = {
  AI: 'AI评分',
  RULE_BASED: '后端规则',
  LOCAL_RULE_BASED: '本地规则',
}

const scopedQuestionDetailCache = new Map<number, Promise<Question>>()
const SCOPED_SESSION_BASELINE_STORAGE_PREFIX = 'lcb-first-run-scoped-baseline:'

function getScopedQuestionById(questionId: number): Promise<Question> {
  const cached = scopedQuestionDetailCache.get(questionId)
  if (cached) {
    return cached
  }

  const request = getQuestionById(questionId, { silentGlobalError: true }).catch(error => {
    scopedQuestionDetailCache.delete(questionId)
    throw error
  })
  scopedQuestionDetailCache.set(questionId, request)
  return request
}

function resolveScoreTone(score?: number) {
  if (score === undefined) {
    return 'empty'
  }
  if (score >= 80) {
    return 'strong'
  }
  if (score >= 60) {
    return 'pass'
  }
  return 'weak'
}

function resolveScoreHint(score?: number) {
  if (score === undefined) {
    return '本题暂无记录'
  }
  if (score >= 80) {
    return '表达稳定'
  }
  if (score >= 60) {
    return '可进入追问'
  }
  return '需要补强'
}

function resolveNextPracticeIndex(
  queue: PracticeQueueItem[],
  currentIndex: number,
  answeredQuestionIds: Set<number>,
): number {
  if (queue.length <= 1) {
    return 0
  }

  for (let offset = 1; offset < queue.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % queue.length
    if (!answeredQuestionIds.has(queue[nextIndex].id)) {
      return nextIndex
    }
  }

  return (currentIndex + 1) % queue.length
}

function readScopedSessionAttemptBaseline(sessionKey: string, questionIds: number[]): Map<number, number> | null {
  try {
    const raw = window.sessionStorage.getItem(`${SCOPED_SESSION_BASELINE_STORAGE_PREFIX}${sessionKey}`)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as { counts?: Record<string, number> }
    if (!parsed.counts || typeof parsed.counts !== 'object') {
      return null
    }
    return new Map(questionIds.map(questionId => {
      const count = parsed.counts?.[String(questionId)]
      return [questionId, typeof count === 'number' && count >= 0 ? count : 0]
    }))
  } catch {
    return null
  }
}

function writeScopedSessionAttemptBaseline(sessionKey: string, counts: Map<number, number>): void {
  try {
    window.sessionStorage.setItem(
      `${SCOPED_SESSION_BASELINE_STORAGE_PREFIX}${sessionKey}`,
      JSON.stringify({ counts: Object.fromEntries(counts) }),
    )
  } catch {
    // sessionStorage 不可用时仍保留内存基线，避免阻断练习主流程。
  }
}

export default function Practice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    getState,
    progress,
    recordInterviewAttempt,
    rememberQuestion,
    rememberQuestions,
    setInPlan,
    setStatus,
  } = useStudyProgress()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answerDraft, setAnswerDraft] = useState('')
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [scopedQuestions, setScopedQuestions] = useState<Question[]>([])
  const [focusedQuestion, setFocusedQuestion] = useState<Question | null>(null)
  const [appliedFocusId, setAppliedFocusId] = useState<number | null>(null)
  const [isLoadingSeeds, setIsLoadingSeeds] = useState(true)
  const [isLoadingScope, setIsLoadingScope] = useState(false)
  const [isLoadingFocus, setIsLoadingFocus] = useState(false)
  const scopedRequestIdsRef = useRef<Set<number>>(new Set())
  const latestQueueParamRef = useRef<string | null>(null)
  const pendingSessionRepairDraftRef = useRef<{ questionId: number; draft: string } | null>(null)
  const answerPanelRef = useRef<HTMLElement | null>(null)
  const activeRecallSessionRef = useRef<{ key: string; value: boolean }>({ key: '', value: false })
  const scopedSessionAttemptBaselineRef = useRef<{ key: string; counts: Map<number, number> }>({
    key: '',
    counts: new Map(),
  })
  const searchParamKey = searchParams.toString()
  const focusQuestionParam = searchParams.get('question')
  const queueParam = searchParams.get('queue')
  const practiceHandoffSource = searchParams.get('from')
  latestQueueParamRef.current = queueParam
  const focusQuestionId = useMemo(() => {
    const value = Number(focusQuestionParam)
    return Number.isInteger(value) && value > 0 ? value : null
  }, [focusQuestionParam])
  const scopedQuestionIds = useMemo(() => {
    if (!queueParam) {
      return []
    }
    return [...new Set(queueParam
      .split(',')
      .map(value => Number(value))
      .filter(value => Number.isInteger(value) && value > 0))]
      .slice(0, 30)
  }, [queueParam])
  const isFirstRunHandoffSource = practiceHandoffSource === 'first-run' && scopedQuestionIds.length > 0
  const isFirstRunRepairHandoffSource = practiceHandoffSource === 'first-run-repair' && scopedQuestionIds.length > 0
  const isFirstRunRehearsalHandoffSource = practiceHandoffSource === 'first-run-rehearsal'
    && scopedQuestionIds.length > 0
  const isReviewDueHandoffSource = practiceHandoffSource === 'review-due' && scopedQuestionIds.length > 0
  const isDailyPlanHandoffSource = practiceHandoffSource === 'daily-plan' && scopedQuestionIds.length > 0
  const isResumeDraftHandoffSource = practiceHandoffSource === 'resume-draft' && scopedQuestionIds.length > 0
  const isAbilityGapHandoffSource = practiceHandoffSource === 'ability-gap' && scopedQuestionIds.length > 0
  const isExperiencePlaybookHandoffSource = practiceHandoffSource === 'experience-playbook' && scopedQuestionIds.length > 0
  const isNextTrainingHandoffSource = practiceHandoffSource === 'next-training' && scopedQuestionIds.length > 0
  const isInterviewRetrospectiveHandoffSource = practiceHandoffSource === 'interview-retrospective'
    && scopedQuestionIds.length > 0
  const isInterviewBriefHandoffSource = practiceHandoffSource === 'interview-brief' && scopedQuestionIds.length > 0
  const isPaceCoachHandoffSource = practiceHandoffSource === 'pace-coach' && scopedQuestionIds.length > 0
  const isFilteredListHandoffSource = practiceHandoffSource === 'filtered-list' && scopedQuestionIds.length > 0
  const activeRecallScopedCount = useMemo(() => {
    if (!isReviewDueHandoffSource) {
      return 0
    }
    return scopedQuestionIds.filter(questionId => {
      const state = progress.questionStates[questionId]
      return state?.status === 'new' && state.reviewCount === 0 && (state.encounterCount ?? 0) >= 2
    }).length
  }, [isReviewDueHandoffSource, progress.questionStates, scopedQuestionIds])
  const isActiveRecallHandoffCandidate = isReviewDueHandoffSource
    && activeRecallScopedCount > 0
    && activeRecallScopedCount === scopedQuestionIds.length
  const isFirstRunScopedHandoffSource = isFirstRunHandoffSource
    || isFirstRunRepairHandoffSource
    || isFirstRunRehearsalHandoffSource
  const isScopedSessionBaselineHandoffSource = isFirstRunRepairHandoffSource
    || isFirstRunRehearsalHandoffSource
    || isReviewDueHandoffSource
    || isDailyPlanHandoffSource
    || isResumeDraftHandoffSource
    || isAbilityGapHandoffSource
    || isExperiencePlaybookHandoffSource
    || isNextTrainingHandoffSource
    || isInterviewRetrospectiveHandoffSource
    || isInterviewBriefHandoffSource
    || isPaceCoachHandoffSource
    || isFilteredListHandoffSource
  const scopedSessionKey = isScopedSessionBaselineHandoffSource
    ? `${practiceHandoffSource}:${scopedQuestionIds.join(',')}`
    : ''
  if (activeRecallSessionRef.current.key !== scopedSessionKey) {
    activeRecallSessionRef.current = {
      key: scopedSessionKey,
      value: isActiveRecallHandoffCandidate,
    }
  }
  const isActiveRecallHandoffSource = isReviewDueHandoffSource && activeRecallSessionRef.current.value
  if (scopedSessionAttemptBaselineRef.current.key !== scopedSessionKey) {
    const storedBaseline = scopedSessionKey
      ? readScopedSessionAttemptBaseline(scopedSessionKey, scopedQuestionIds)
      : null
    const counts = storedBaseline ?? new Map(
      scopedQuestionIds.map(questionId => [
        questionId,
        progress.interviewAttempts[questionId]?.length ?? 0,
      ]),
    )
    scopedSessionAttemptBaselineRef.current = {
      key: scopedSessionKey,
      counts,
    }
    if (scopedSessionKey && !storedBaseline) {
      writeScopedSessionAttemptBaseline(scopedSessionKey, counts)
    }
  }
  const practiceQueueLimit = (
    isFirstRunScopedHandoffSource
    || isReviewDueHandoffSource
    || isDailyPlanHandoffSource
    || isResumeDraftHandoffSource
    || isAbilityGapHandoffSource
    || isExperiencePlaybookHandoffSource
    || isNextTrainingHandoffSource
    || isInterviewRetrospectiveHandoffSource
    || isInterviewBriefHandoffSource
    || isPaceCoachHandoffSource
    || isFilteredListHandoffSource
  )
    ? scopedQuestionIds.length
    : 12
  const candidateQuestions = useMemo(() => {
    const candidates = [
      ...(focusedQuestion ? [focusedQuestion] : []),
      ...scopedQuestions,
      ...hotQuestions,
    ]
    const seen = new Set<number>()
    return candidates.filter(question => {
      if (seen.has(question.id)) {
        return false
      }
      seen.add(question.id)
      return true
    })
  }, [focusedQuestion, hotQuestions, scopedQuestions])

  const missingScopedQuestionIds = useMemo(() => {
    const loadedIds = new Set([
      ...Object.keys(progress.questionSnapshots).map(Number),
      ...scopedQuestions.map(question => question.id),
    ])
    return scopedQuestionIds
      .filter(questionId => !loadedIds.has(questionId))
      .slice(0, 12)
  }, [progress.questionSnapshots, scopedQuestionIds, scopedQuestions])

  useEffect(() => {
    scopedRequestIdsRef.current.clear()
    const scopedSet = new Set(scopedQuestionIds)
    setScopedQuestions(currentQuestions => {
      const nextQuestions = currentQuestions.filter(question => scopedSet.has(question.id))
      return nextQuestions.length === currentQuestions.length ? currentQuestions : nextQuestions
    })
  }, [queueParam, scopedQuestionIds])

  const queue = useMemo(
    () => buildScopedPracticeQueue(progress, candidateQuestions, scopedQuestionIds, focusQuestionId, practiceQueueLimit),
    [candidateQuestions, focusQuestionId, practiceQueueLimit, progress, scopedQuestionIds],
  )
  const summary = useMemo(() => summarizeProgress(progress), [progress])

  useEffect(() => {
    let ignore = false

    getHotQuestions(12, { silentGlobalError: true })
      .then(questions => {
        if (ignore) {
          return
        }
        setHotQuestions(questions)
        rememberQuestions(questions)
      })
      .catch(() => {
        if (!ignore) {
          setHotQuestions([])
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingSeeds(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [rememberQuestions])

  useEffect(() => {
    const requestIds = missingScopedQuestionIds.filter(
      questionId => !scopedRequestIdsRef.current.has(questionId),
    )

    if (requestIds.length === 0) {
      setIsLoadingScope(false)
      return
    }

    const requestQueueParam = queueParam
    setIsLoadingScope(true)
    requestIds.forEach(questionId => scopedRequestIdsRef.current.add(questionId))

    Promise.allSettled(requestIds.map(questionId => getScopedQuestionById(questionId)))
      .then(results => {
        if (requestQueueParam !== latestQueueParamRef.current) {
          return
        }
        const loadedQuestions = results
          .filter((result): result is PromiseFulfilledResult<Question> => result.status === 'fulfilled')
          .map(result => result.value)
        if (loadedQuestions.length === 0) {
          return
        }
        setScopedQuestions(currentQuestions => {
          const currentIds = new Set(currentQuestions.map(question => question.id))
          return [
            ...currentQuestions,
            ...loadedQuestions.filter(question => !currentIds.has(question.id)),
          ]
        })
        rememberQuestions(loadedQuestions)
      })
      .finally(() => {
        if (requestQueueParam === latestQueueParamRef.current) {
          setIsLoadingScope(false)
        }
      })
  }, [missingScopedQuestionIds, queueParam, rememberQuestions])

  useEffect(() => {
    setAppliedFocusId(null)
    setFocusedQuestion(null)
    setIsLoadingFocus(false)
  }, [focusQuestionId])

  useEffect(() => {
    setCurrentIndex(0)
  }, [searchParamKey])

  useEffect(() => {
    if (!focusQuestionId || progress.questionSnapshots[focusQuestionId]) {
      return
    }

    let ignore = false
    setIsLoadingFocus(true)

    getQuestionById(focusQuestionId, { silentGlobalError: true })
      .then(question => {
        if (ignore) {
          return
        }
        setFocusedQuestion(question)
        rememberQuestion(question)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!ignore) {
          setIsLoadingFocus(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [focusQuestionId, progress.questionSnapshots, rememberQuestion])

  useEffect(() => {
    if (!focusQuestionId || appliedFocusId === focusQuestionId || queue.length === 0) {
      return
    }

    const targetIndex = queue.findIndex(item => item.id === focusQuestionId)
    if (targetIndex >= 0) {
      setCurrentIndex(targetIndex)
      setAppliedFocusId(focusQuestionId)
    }
  }, [appliedFocusId, focusQuestionId, queue])

  useEffect(() => {
    if (queue.length === 0 && currentIndex !== 0) {
      setCurrentIndex(0)
    }
    if (queue.length > 0 && currentIndex >= queue.length) {
      setCurrentIndex(queue.length - 1)
    }
  }, [currentIndex, queue.length])

  const current = queue[currentIndex]
  const currentQuestionDetail = current
    ? candidateQuestions.find(question => question.id === current.id)
    : undefined
  const currentState = current ? getState(current.id) : null
  const latestAttempt = current ? progress.interviewAttempts[current.id]?.[0] : undefined
  const currentAttempts = current ? progress.interviewAttempts[current.id] ?? [] : []
  const progressPercent = queue.length === 0 ? 0 : Math.round(((currentIndex + 1) / queue.length) * 100)
  const currentQuestionId = current?.id
  const hasCurrentFeedback = feedback !== null && currentQuestionId !== undefined
  const answeredQuestionIds = useMemo(() => {
    if (isScopedSessionBaselineHandoffSource) {
      const questionIds = new Set(
        scopedQuestionIds.filter(questionId => {
          const baselineCount = scopedSessionAttemptBaselineRef.current.counts.get(questionId) ?? 0
          return (progress.interviewAttempts[questionId]?.length ?? 0) > baselineCount
        }),
      )
      if (hasCurrentFeedback && currentQuestionId !== undefined) {
        questionIds.add(currentQuestionId)
      }
      return questionIds
    }

    const questionIds = new Set(
      Object.entries(progress.interviewAttempts)
        .filter(([, attempts]) => attempts.length > 0)
        .map(([questionId]) => Number(questionId)),
    )
    if (hasCurrentFeedback && currentQuestionId !== undefined) {
      questionIds.add(currentQuestionId)
    }
    return questionIds
  }, [
    currentQuestionId,
    hasCurrentFeedback,
    isScopedSessionBaselineHandoffSource,
    progress.interviewAttempts,
    scopedQuestionIds,
  ])
  const answeredInQueue = queue.filter(item => answeredQuestionIds.has(item.id)).length
  const latestScore = feedback?.score ?? latestAttempt?.feedback.score
  const latestScoreTone = resolveScoreTone(latestScore)
  const latestScoreText = latestScore === undefined ? '待评分' : `${latestScore} 分`
  const feedbackStatusSync = feedback ? describeInterviewStatusSync(feedback.score) : null
  const isFocusedQuestionPractice = focusQuestionId === currentQuestionId
  const isScriptHandoffPractice = isFocusedQuestionPractice && practiceHandoffSource === 'script'
  const isQuestionDetailHandoffPractice = isFocusedQuestionPractice && practiceHandoffSource === 'question-detail'
  const isFirstRunLaunchpadPractice = !focusQuestionId && isFirstRunHandoffSource
  const isFirstRunRepairPractice = !focusQuestionId && isFirstRunRepairHandoffSource
  const isFirstRunRehearsalPractice = !focusQuestionId && isFirstRunRehearsalHandoffSource
  const isDailyPlanPractice = !focusQuestionId && isDailyPlanHandoffSource
  const isResumeDraftPractice = !focusQuestionId && isResumeDraftHandoffSource
  const isAbilityGapPractice = !focusQuestionId && isAbilityGapHandoffSource
  const isExperiencePlaybookPractice = !focusQuestionId && isExperiencePlaybookHandoffSource
  const isNextTrainingPractice = !focusQuestionId && isNextTrainingHandoffSource
  const isInterviewRetrospectivePractice = !focusQuestionId && isInterviewRetrospectiveHandoffSource
  const isInterviewBriefPractice = !focusQuestionId && isInterviewBriefHandoffSource
  const isPaceCoachPractice = !focusQuestionId && isPaceCoachHandoffSource
  const isFilteredListPractice = !focusQuestionId && isFilteredListHandoffSource
  const experiencePressureQueue = useMemo(
    () => isExperiencePlaybookPractice ? buildExperiencePressureQueue(progress) : null,
    [isExperiencePlaybookPractice, progress],
  )
  const currentExperiencePressureItem = current && experiencePressureQueue
    ? experiencePressureQueue.items.find(item => item.questionId === current.id)
    : undefined
  const currentQuestionDetailPath = current
    ? `/question/${current.id}${isScriptHandoffPractice ? '?from=practice-calibration#answer-script' : ''}`
    : ''
  const scopedQueueSourceLabel = isFirstRunRepairPractice
    ? '首练补弱'
    : isFirstRunRehearsalPractice
      ? '首练复述'
      : isFirstRunLaunchpadPractice
        ? '首练队列'
          : isReviewDueHandoffSource
            ? isActiveRecallHandoffSource ? '主动回忆' : '到期复习'
          : isDailyPlanPractice
            ? '今日计划'
          : isResumeDraftPractice
            ? '草稿恢复'
          : isAbilityGapPractice
            ? '能力短板'
            : isExperiencePlaybookPractice
              ? '真实面试'
              : isNextTrainingPractice
                ? '下一轮训练'
                : isInterviewRetrospectivePractice
                  ? '面试复盘'
                  : isInterviewBriefPractice
                    ? '面试简报'
                    : isPaceCoachPractice
                      ? '配速训练'
                    : isFilteredListPractice ? '当前筛选' : undefined
  const focusedQuestionSourceLabel = isScriptHandoffPractice
    ? '口径盲练'
    : isQuestionDetailHandoffPractice
      ? '题目详情校准'
      : undefined
  const currentSourceLabel = current ? scopedQueueSourceLabel ?? focusedQuestionSourceLabel ?? sourceLabels[current.source] : ''
  const sessionReportContext = scopedQueueSourceLabel
    ? {
      sourceLabel: isExperiencePlaybookPractice ? '真实面试押题' : scopedQueueSourceLabel,
      queuePath: `/practice?queue=${scopedQuestionIds.join(',')}&from=${practiceHandoffSource}`,
      pressureItems: isExperiencePlaybookPractice
        ? experiencePressureQueue?.items.map(item => ({
          questionId: item.questionId,
          signal: item.signal,
          detail: item.detail,
          interviewerProbe: item.interviewerProbe,
          passCriteria: item.passCriteria,
        }))
        : undefined,
    }
    : undefined
  const hasSavedDraft = !feedback && answerDraft.trim().length > 0

  const updateAnswerDraft = useCallback((nextDraft: string) => {
    setAnswerDraft(nextDraft)
    if (currentQuestionId) {
      writePracticeAnswerDraft(currentQuestionId, nextDraft)
    }
  }, [currentQuestionId])

  const focusAnswerEditor = useCallback(() => {
    window.setTimeout(() => {
      answerPanelRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      answerPanelRef.current?.querySelector('textarea')?.focus()
    }, 0)
  }, [])

  const useDraftTemplate = useCallback((template: string) => {
    updateAnswerDraft(template)
    setFeedback(null)
    focusAnswerEditor()
  }, [focusAnswerEditor, updateAnswerDraft])

  useEffect(() => {
    const pendingDraft = pendingSessionRepairDraftRef.current
    if (currentQuestionId && pendingDraft?.questionId === currentQuestionId) {
      setAnswerDraft(pendingDraft.draft)
      writePracticeAnswerDraft(currentQuestionId, pendingDraft.draft)
      pendingSessionRepairDraftRef.current = null
      focusAnswerEditor()
    } else if (currentQuestionId) {
      setAnswerDraft(readPracticeAnswerDraft(currentQuestionId) ?? '')
    } else {
      setAnswerDraft('')
    }
    setFeedback(null)
  }, [currentQuestionId, focusAnswerEditor])

  useEffect(() => {
    if (
      isScriptHandoffPractice
      || isQuestionDetailHandoffPractice
      || isFirstRunLaunchpadPractice
      || isFirstRunRepairPractice
      || isFirstRunRehearsalPractice
      || isDailyPlanPractice
      || isResumeDraftPractice
      || isAbilityGapPractice
      || isExperiencePlaybookPractice
      || isNextTrainingPractice
      || isInterviewRetrospectivePractice
      || isInterviewBriefPractice
      || isFilteredListPractice
    ) {
      focusAnswerEditor()
    }
  }, [
    focusAnswerEditor,
    isAbilityGapPractice,
    isDailyPlanPractice,
    isExperiencePlaybookPractice,
    isFilteredListPractice,
    isFirstRunLaunchpadPractice,
    isFirstRunRehearsalPractice,
    isFirstRunRepairPractice,
    isInterviewBriefPractice,
    isInterviewRetrospectivePractice,
    isNextTrainingPractice,
    isQuestionDetailHandoffPractice,
    isResumeDraftPractice,
    isScriptHandoffPractice,
  ])

  const moveNext = () => {
    setCurrentIndex(index => {
      return resolveNextPracticeIndex(queue, index, answeredQuestionIds)
    })
  }

  const scopedQueueProgress = (() => {
    if (
      (
        !isFirstRunLaunchpadPractice
        && !isFirstRunRepairPractice
        && !isFirstRunRehearsalPractice
        && !isReviewDueHandoffSource
        && !isDailyPlanPractice
        && !isResumeDraftPractice
        && !isAbilityGapPractice
        && !isExperiencePlaybookPractice
                && !isNextTrainingPractice
                && !isInterviewRetrospectivePractice
                && !isInterviewBriefPractice
                && !isPaceCoachPractice
                && !isFilteredListPractice
      )
      || queue.length === 0
    ) {
      return undefined
    }

    const nextIndex = resolveNextPracticeIndex(queue, currentIndex, answeredQuestionIds)
    const nextQuestion = queue[nextIndex]
    const variant = isFirstRunRepairPractice
      ? 'repair' as const
      : isFirstRunRehearsalPractice
        ? 'rehearsal' as const
        : isReviewDueHandoffSource
          ? isActiveRecallHandoffSource ? 'active-recall' as const : 'review-due' as const
          : isDailyPlanPractice
            ? 'daily-plan' as const
          : isResumeDraftPractice
            ? 'resume-draft' as const
          : isAbilityGapPractice
            ? 'ability-gap' as const
            : isExperiencePlaybookPractice
              ? 'experience-playbook' as const
              : isNextTrainingPractice
                ? 'next-training' as const
                : isInterviewRetrospectivePractice
                  ? 'interview-retrospective' as const
                  : isInterviewBriefPractice
                    ? 'interview-brief' as const
                    : isPaceCoachPractice
                      ? 'pace-coach' as const
                    : isFilteredListPractice ? 'filtered-list' as const : 'launchpad' as const
    return {
      answeredCount: answeredInQueue,
      totalCount: queue.length,
      nextQuestionTitle: nextQuestion?.id !== currentQuestionId ? nextQuestion?.title : undefined,
      onContinue: moveNext,
      variant,
    }
  })()

  const markWeak = () => {
    if (!current) {
      return
    }
    setStatus(current.id, 'weak')
    moveNext()
  }

  const markMastered = () => {
    if (!current) {
      return
    }
    setStatus(current.id, 'mastered')
    moveNext()
  }

  const submitAnswer = async () => {
    if (!current || !answerDraft.trim() || isEvaluating) {
      return
    }
    setIsEvaluating(true)
    try {
      const remoteFeedback = await evaluateInterviewAnswerRemote(current, answerDraft.trim(), progress.targetRole)
      persistFeedback(remoteFeedback)
    } catch {
      const localFeedback = {
        ...evaluateInterviewAnswer(current, answerDraft.trim()),
        source: 'LOCAL_RULE_BASED' as const,
      }
      persistFeedback(localFeedback)
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleAnswerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
      return
    }

    event.preventDefault()
    if (!answerDraft.trim() || isEvaluating) {
      return
    }

    void submitAnswer()
  }

  const persistFeedback = (nextFeedback: InterviewFeedback) => {
    if (!current) {
      return
    }
    setFeedback(nextFeedback)
    recordInterviewAttempt({
      questionId: current.id,
      answer: answerDraft.trim(),
      feedback: nextFeedback,
      createdAt: new Date().toISOString(),
    })
    clearPracticeAnswerDraft(current.id)
  }

  const startFollowUpAnswer = (prompt: string) => {
    useDraftTemplate(`追问：${prompt}\n\n我的回答：`)
  }

  const startClosureAnswer = (prompt: string) => {
    useDraftTemplate(`${prompt}\n\n我的回答：`)
  }

  const useAnswerScaffold = (template: string) => {
    useDraftTemplate(template)
  }

  const useRepairTemplate = (template: string) => {
    useDraftTemplate(template)
  }

  const startAttemptDeltaAnswer = (prompt: string) => {
    useDraftTemplate(`${prompt}\n\n我的回答：`)
  }

  const startInterviewerScriptAnswer = (prompt: string) => {
    useDraftTemplate(`追问：${prompt}\n\n我的回答：`)
  }

  const startSessionRepairAnswer = (action: PracticeSessionRepairAction) => {
    const draft = buildPracticeSessionRepairDraft(action)
    const targetIndex = queue.findIndex(item => item.id === action.questionId)
    pendingSessionRepairDraftRef.current = { questionId: action.questionId, draft }
    setFeedback(null)

    if (targetIndex >= 0) {
      if (targetIndex === currentIndex) {
        useDraftTemplate(draft)
        pendingSessionRepairDraftRef.current = null
        return
      }
      setCurrentIndex(targetIndex)
      return
    }

    navigate(action.to)
  }

  if (!current || !currentState) {
    return (
      <div className="practice-empty-page">
        {isLoadingSeeds || isLoadingScope || isLoadingFocus ? (
          <div className="practice-empty-loading">
            <Spin />
            <span>正在准备热门训练题</span>
          </div>
        ) : (
          <Empty description="还没有可训练题目">
            <Button type="primary" icon={<BookOutlined />} onClick={() => navigate('/')}>
              先浏览题目
            </Button>
          </Empty>
        )}
      </div>
    )
  }

  return (
    <div className="practice-shell">
      <section className="practice-main">
        <div className="practice-header">
          <div className="practice-title-block">
            <div className="dashboard-kicker">今日面试训练</div>
            <h1>{progress.targetRole} · 第 {currentIndex + 1} 题</h1>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => setCurrentIndex(0)}>
            重开
          </Button>
        </div>

        <div className="practice-progress-row">
          <Progress percent={progressPercent} showInfo={false} strokeColor="#2563EB" />
          <span>{currentIndex + 1} / {queue.length}</span>
        </div>

        <div className="practice-session-strip" aria-label="本轮训练状态">
          <div>
            <span>已评分</span>
            <strong>{answeredInQueue} / {queue.length}</strong>
            <small>本轮队列</small>
          </div>
          <div>
            <span>当前来源</span>
            <strong>{currentSourceLabel}</strong>
            <small>{current.categoryName}</small>
          </div>
          <div className={`score-${latestScoreTone}`}>
            <span>最近表现</span>
            <strong>{latestScoreText}</strong>
            <small>{resolveScoreHint(latestScore)}</small>
          </div>
        </div>

        <article className="practice-question">
          <div className="practice-question-top">
            <div className={`practice-source source-${current.source}`}>{currentSourceLabel}</div>
            <span>{focusQuestionId === current.id ? '当前题' : `Q${currentIndex + 1}`}</span>
          </div>
          {isFirstRunLaunchpadPractice ? (
            <div className="practice-question-focus-context" aria-label="首练队列上下文">
              <div>
                <span>首练队列</span>
                <strong>先完成这 {queue.length} 道高频题</strong>
                <small>不用再选题，提交评分后系统会生成补弱和复习队列。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/')}
              >
                回到启动台
              </Button>
            </div>
          ) : null}
          {isReviewDueHandoffSource ? (
            <div
              className="practice-question-focus-context"
              aria-label={isActiveRecallHandoffSource ? '主动回忆队列上下文' : '到期复习队列上下文'}
            >
              <div>
                <span>{isActiveRecallHandoffSource ? '主动回忆队列' : '到期复习队列'}</span>
                <strong>
                  {isActiveRecallHandoffSource
                    ? `先脱稿回忆这 ${queue.length} 道多次遇见题`
                    : `先补回这 ${queue.length} 道到期题`}
                </strong>
                <small>
                  {isActiveRecallHandoffSource
                    ? '这轮训练来自多次遇见题，还没完成复习前先做一次无提示主动回忆。'
                    : '这轮训练来自智能复习排期，优先处理已经逾期或今天到期的记忆窗口。'}
                </small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到复习计划
              </Button>
            </div>
          ) : null}
          {isDailyPlanPractice ? (
            <div className="practice-question-focus-context" aria-label="今日计划队列上下文">
              <div>
                <span>今日计划队列</span>
                <strong>先完成这 {queue.length} 道今日计划题</strong>
                <small>来自学习计划页，按今天已经排好的题单训练，评分后再决定补弱或收口。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习计划
              </Button>
            </div>
          ) : null}
          {isFilteredListPractice ? (
            <div className="practice-question-focus-context" aria-label="当前筛选题单上下文">
              <div>
                <span>当前筛选题单</span>
                <strong>先完成这 {queue.length} 道筛选题</strong>
                <small>来自题库或搜索结果页，按你刚筛出的题单完成一轮评分，避免只浏览不训练。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/banks')}
              >
                回到题库
              </Button>
            </div>
          ) : null}
          {isInterviewBriefPractice ? (
            <div className="practice-question-focus-context" aria-label="面试简报热身队列上下文">
              <div>
                <span>面试简报热身</span>
                <strong>先完成这 {queue.length} 道面试前热身题</strong>
                <small>来自面试前冲刺简报，先把可主动表达的高价值题讲一轮，再回到学习中心收口风险。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习中心
              </Button>
            </div>
          ) : null}
          {isPaceCoachPractice ? (
            <div className="practice-question-focus-context" aria-label="配速训练队列上下文">
              <div>
                <span>配速训练队列</span>
                <strong>先收口这 {queue.length} 道今日配速题</strong>
                <small>来自备考配速教练，按今日计划未完成题收口，避免节奏诊断停在建议层。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习中心
              </Button>
            </div>
          ) : null}
          {isNextTrainingPractice ? (
            <div className="practice-question-focus-context" aria-label="下一轮训练队列上下文">
              <div>
                <span>下一轮训练队列</span>
                <strong>按系统排好的 {queue.length} 道风险题继续训练</strong>
                <small>来自评分影响、薄弱题、学习中题和面试错因，先按队列补强，不再重新选题。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习中心
              </Button>
            </div>
          ) : null}
          {isInterviewRetrospectivePractice ? (
            <div className="practice-question-focus-context" aria-label="面试复盘队列上下文">
              <div>
                <span>面试复盘队列</span>
                <strong>先重答这 {queue.length} 道低分面试题</strong>
                <small>来自今日冲刺任务，按最近模拟评分里的薄弱题重练，先把表达补到可过线。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习中心
              </Button>
            </div>
          ) : null}
          {isResumeDraftPractice ? (
            <div className="practice-question-focus-context" aria-label="未提交回答恢复上下文">
              <div>
                <span>未提交回答恢复</span>
                <strong>先补完这 {queue.length} 份未提交回答</strong>
                <small>来自本地草稿恢复，优先把已经开始的回答提交评分，避免训练样本断档。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/study')}
              >
                回到学习计划
              </Button>
            </div>
          ) : null}
          {isAbilityGapPractice ? (
            <div className="practice-question-focus-context" aria-label="能力短板队列上下文">
              <div>
                <span>能力短板训练</span>
                <strong>先突破这 {queue.length} 道短板题</strong>
                <small>来自岗位能力地图和备考路线，把薄弱、学习中和未过线题集中成一轮闭环训练。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/routes')}
              >
                回到路线图
              </Button>
            </div>
          ) : null}
          {isExperiencePlaybookPractice ? (
            <div className="practice-question-focus-context" aria-label="真实面试押题队列上下文">
              <div>
                <span>真实面试押题</span>
                <strong>先压测这 {queue.length} 道高压题</strong>
                <small>来自面经场景和个人低分/薄弱轨迹，把容易被追问的题先放到一轮里拆解。</small>
                {currentExperiencePressureItem ? (
                  <div className="practice-pressure-reason" aria-label="本题押题理由">
                    <span>{currentExperiencePressureItem.signal}</span>
                    <small>{currentExperiencePressureItem.detail}</small>
                  </div>
                ) : null}
                {currentExperiencePressureItem ? (
                  <div className="practice-pressure-probe" aria-label="本题押题追问">
                    <span>面试官追问</span>
                    <small>{currentExperiencePressureItem.interviewerProbe}</small>
                    <span>通过口径</span>
                    <small>{currentExperiencePressureItem.passCriteria}</small>
                  </div>
                ) : null}
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/experiences')}
              >
                回到面经场景
              </Button>
            </div>
          ) : null}
          {isFirstRunRepairPractice ? (
            <div className="practice-question-focus-context" aria-label="首练补弱队列上下文">
              <div>
                <span>首练补弱队列</span>
                <strong>先修复这 {queue.length} 道首练风险题</strong>
                <small>来自首练战报，按最低分和复习债重新作答，不再重新选题。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/')}
              >
                回到启动台
              </Button>
            </div>
          ) : null}
          {isFirstRunRehearsalPractice ? (
            <div className="practice-question-focus-context" aria-label="首练过线复述上下文">
              <div>
                <span>首练过线复述</span>
                <strong>先复述这 {queue.length} 道已过线题</strong>
                <small>来自首页低分优先队列，目标是脱稿验证，不是重新刷题。</small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => navigate('/')}
              >
                回到启动台
              </Button>
            </div>
          ) : null}
          {isFocusedQuestionPractice ? (
            <div
              className="practice-question-focus-context"
              aria-label={isQuestionDetailHandoffPractice ? '题目详情校准上下文' : '同题模拟面试上下文'}
            >
              <div>
                <span>
                  {isScriptHandoffPractice
                    ? '口径盲练完成'
                    : isQuestionDetailHandoffPractice
                      ? '题目详情校准'
                      : '同题模拟'}
                </span>
                <strong>
                  {isScriptHandoffPractice
                    ? '现在进入无提示模拟'
                    : isQuestionDetailHandoffPractice
                      ? '把阅读理解转成可评分回答'
                      : '先脱稿回答这道题'}
                </strong>
                <small>
                  {isScriptHandoffPractice
                    ? '刚完成 60 秒口径盲练，现在按面试节奏无提示作答。'
                    : isQuestionDetailHandoffPractice
                      ? '刚从题目详情进入，先把阅读理解转成一轮无提示回答。'
                      : '刚从题目详情进入，先按当前题完成一轮无提示回答。'}
                </small>
              </div>
              <Button
                size="small"
                icon={<BookOutlined />}
                aria-label="回到题目详情"
                onClick={() => navigate(currentQuestionDetailPath)}
              >
                回到题目详情
              </Button>
            </div>
          ) : null}
          <h2>{current.title}</h2>
          <div className="practice-meta">
            <span>{current.categoryName}</span>
            <span className={`difficulty-tag ${current.difficulty.toLowerCase()}`}>
              {difficultyLabels[current.difficulty] || current.difficulty}
            </span>
            <StudyStatusBadge status={currentState.status} addedToPlan={currentState.addedToPlan} />
          </div>
          {current.tags.length > 0 && (
            <div className="practice-tags">
              {current.tags.slice(0, 6).map(tag => <span key={tag}>{tag}</span>)}
            </div>
          )}
        </article>

        <PracticeAnswerScaffoldPanel
          question={current}
          targetRole={progress.targetRole}
          onUseTemplate={useAnswerScaffold}
        />

        <section className="practice-answer-panel" ref={answerPanelRef}>
          <div className="practice-answer-title">
            <span>模拟面试回答</span>
            <div className="practice-answer-title-meta">
              {hasSavedDraft && <small className="practice-draft-saved" aria-live="polite">草稿已本地保存</small>}
              {latestAttempt && (
                <small className={`practice-latest-score score-${resolveScoreTone(latestAttempt.feedback.score)}`}>
                  最近 {latestAttempt.feedback.score} 分
                  {latestAttempt.feedback.source ? ` · ${feedbackSourceLabels[latestAttempt.feedback.source]}` : ''}
                </small>
              )}
            </div>
          </div>
          <Input.TextArea
            aria-label="模拟面试回答"
            value={answerDraft}
            onChange={(event) => updateAnswerDraft(event.target.value)}
            onKeyDown={handleAnswerKeyDown}
            placeholder="写下你会在面试中说出的答案..."
            autoSize={{ minRows: 5, maxRows: 9 }}
            maxLength={1600}
            showCount
          />
          <PracticeAnswerReadinessPanel
            question={current}
            answer={answerDraft}
            onUseRepairTemplate={useRepairTemplate}
          />
          <PracticeScriptAnswerAcceptancePanel
            question={current}
            attempts={currentAttempts}
            answer={answerDraft}
            onUseRepairTemplate={useRepairTemplate}
          />
          <div className="practice-answer-actions">
            <Button
              type="primary"
              icon={<SendOutlined />}
              aria-label="提交评分"
              loading={isEvaluating}
              disabled={!answerDraft.trim()}
              onClick={submitAnswer}
            >
              提交评分
            </Button>
          </div>
        </section>

        {feedback && (
          <>
            <section className={`practice-feedback-panel level-${feedback.level}`}>
              <div className={`practice-feedback-score score-${resolveScoreTone(feedback.score)}`}>
                <span>面试官评分</span>
                <strong>{feedback.score}</strong>
                <small>{feedbackLevelLabels[feedback.level]}</small>
                {feedback.source && (
                  <em>{feedbackSourceLabels[feedback.source]}</em>
                )}
                {feedbackStatusSync && (
                  <p className={`practice-feedback-status-sync status-${feedbackStatusSync.status}`}>
                    {feedbackStatusSync.message}
                  </p>
                )}
              </div>
              <div className="practice-feedback-body">
                <div className="practice-criteria-grid">
                  {feedback.criteria.map(item => (
                    <div key={item.key} className={`score-${resolveScoreTone(item.score)}`}>
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.score}</strong>
                      </div>
                      <Progress percent={item.score} showInfo={false} strokeColor={item.score >= 70 ? '#059669' : '#D97706'} />
                      <small>{item.summary}</small>
                    </div>
                  ))}
                </div>
                <div className="practice-feedback-lists">
                  {feedback.advice.length > 0 && (
                    <div className="practice-feedback-list">
                      <span>改进点</span>
                      {feedback.advice.map(item => <p key={item}>{item}</p>)}
                    </div>
                  )}
                  <div className="practice-feedback-list">
                    <span>追问</span>
                    {feedback.followUps.map(item => <p key={item}>{item}</p>)}
                  </div>
                </div>
              </div>
            </section>
            <PracticePostScoreNextStepPanel
              queue={queue}
              progress={progress}
              scopedQueueProgress={scopedQueueProgress}
              onNavigate={navigate}
            />
            <PracticeFeedbackClosurePanel
              question={current}
              answer={answerDraft}
              feedback={feedback}
              onUsePrompt={startClosureAnswer}
              onMarkWeak={markWeak}
              onMarkMastered={markMastered}
              onOpenAnswer={() => navigate(currentQuestionDetailPath)}
              answerActionLabel={isScriptHandoffPractice ? '回到口径校准' : undefined}
              onNext={moveNext}
            />
            <FollowUpDrillPanel
              question={current}
              answer={answerDraft}
              feedback={feedback}
              onPickPrompt={startFollowUpAnswer}
            />
            {currentQuestionDetail && (
              <AnswerGapPanel question={currentQuestionDetail} answer={answerDraft} />
            )}
          </>
        )}

        <div className="practice-actions">
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            aria-label="打开答案"
            onClick={() => navigate(`/question/${current.id}`)}
          >
            打开答案
          </Button>
          <Button
            icon={<WarningOutlined />}
            danger
            aria-label="标记薄弱"
            aria-pressed={currentState.status === 'weak'}
            onClick={markWeak}
          >
            标记薄弱
          </Button>
          <Button
            icon={<CheckOutlined />}
            aria-label="已掌握"
            aria-pressed={currentState.status === 'mastered'}
            onClick={markMastered}
          >
            已掌握
          </Button>
          <Button
            icon={<PlusOutlined />}
            aria-label={currentState.addedToPlan ? '移出计划' : '加入计划'}
            aria-pressed={currentState.addedToPlan}
            onClick={() => setInPlan(current.id, !currentState.addedToPlan)}
          >
            {currentState.addedToPlan ? '移出计划' : '加入计划'}
          </Button>
          <Button onClick={moveNext}>
            下一题
          </Button>
        </div>
      </section>

      <aside className="practice-side">
        <div className="practice-stat-panel">
          <div className="practice-side-title-row">
            <div className="practice-side-title">本轮概览</div>
            <small>{queue.length} 题</small>
          </div>
          <div className="practice-stat-score">
            <span>掌握度</span>
            <strong>{summary.masteryRate}%</strong>
            <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
          </div>
          <div className="practice-side-metrics">
            <div>
              <span>已评分</span>
              <strong>{answeredInQueue}</strong>
            </div>
            <div>
              <span>薄弱</span>
              <strong>{summary.weak}</strong>
            </div>
          </div>
          {latestAttempt && <small className="practice-side-footnote">本题最近评分 {latestAttempt.feedback.score}</small>}
        </div>
        <PracticeAttemptDeltaPanel
          question={current}
          attempts={currentAttempts}
          onUsePrompt={startAttemptDeltaAnswer}
        />
        <PracticeInterviewerScriptPanel
          question={current}
          attempts={currentAttempts}
          onUsePrompt={startInterviewerScriptAnswer}
        />
        <PracticeSessionReportPanel
          queue={queue}
          progress={progress}
          queueContext={sessionReportContext}
          onNavigate={navigate}
          onUseRepairAction={startSessionRepairAnswer}
        />
        <InterviewReviewPanel progress={progress} compact />
        <div className="practice-queue-panel">
          <div className="practice-side-title-row">
            <div className="practice-side-title">训练队列</div>
            <small>{currentIndex + 1} / {queue.length}</small>
          </div>
          {queue.map((item, index) => (
            <button
              type="button"
              key={`${item.source}-${item.id}`}
              className={item.id === current.id ? 'active' : ''}
              aria-current={item.id === current.id ? 'step' : undefined}
              onClick={() => setCurrentIndex(index)}
            >
              <span className={`queue-index source-${item.source}`}>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{scopedQueueSourceLabel ?? sourceLabels[item.source]} · {item.categoryName}</small>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
