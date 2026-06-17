import { useEffect, useMemo, useRef, useState } from 'react'
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
import PracticeFeedbackClosurePanel from '../../components/PracticeFeedbackClosurePanel'
import PracticeSessionReportPanel from '../../components/PracticeSessionReportPanel'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { evaluateInterviewAnswerRemote } from '../../api/interview'
import { getHotQuestions, getQuestionById } from '../../api/question'
import type { InterviewFeedback, PracticeQueueItem, Question } from '../../types'
import { evaluateInterviewAnswer } from '../../utils/interviewCoach'
import { buildScopedPracticeQueue, summarizeProgress } from '../../utils/studyProgress'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const sourceLabels: Record<PracticeQueueItem['source'], string> = {
  review: '复习优先',
  plan: '今日计划',
  page: '当前筛选',
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

function getScopedQuestionById(questionId: number): Promise<Question> {
  const cached = scopedQuestionDetailCache.get(questionId)
  if (cached) {
    return cached
  }

  const request = getQuestionById(questionId).catch(error => {
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
  const searchParamKey = searchParams.toString()
  const focusQuestionParam = searchParams.get('question')
  const queueParam = searchParams.get('queue')
  latestQueueParamRef.current = queueParam
  const focusQuestionId = useMemo(() => {
    const value = Number(focusQuestionParam)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [focusQuestionParam])
  const scopedQuestionIds = useMemo(() => {
    if (!queueParam) {
      return []
    }
    return queueParam
      .split(',')
      .map(value => Number(value))
      .filter(value => Number.isFinite(value) && value > 0)
      .slice(0, 30)
  }, [queueParam])
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
    () => buildScopedPracticeQueue(progress, candidateQuestions, scopedQuestionIds, focusQuestionId, 12),
    [candidateQuestions, focusQuestionId, progress, scopedQuestionIds],
  )
  const summary = useMemo(() => summarizeProgress(progress), [progress])

  useEffect(() => {
    let ignore = false

    getHotQuestions(12)
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

    getQuestionById(focusQuestionId)
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
  const progressPercent = queue.length === 0 ? 0 : Math.round(((currentIndex + 1) / queue.length) * 100)
  const answeredInQueue = queue.filter(item => (progress.interviewAttempts[item.id]?.length ?? 0) > 0).length
  const latestScore = feedback?.score ?? latestAttempt?.feedback.score
  const latestScoreTone = resolveScoreTone(latestScore)
  const latestScoreText = latestScore === undefined ? '待评分' : `${latestScore} 分`

  useEffect(() => {
    setAnswerDraft('')
    setFeedback(null)
  }, [current?.id])

  const moveNext = () => {
    setCurrentIndex(index => {
      if (queue.length <= 1) {
        return 0
      }
      return (index + 1) % queue.length
    })
  }

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
    if (!current || !answerDraft.trim()) {
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
  }

  const startFollowUpAnswer = (prompt: string) => {
    setAnswerDraft(`追问：${prompt}\n\n我的回答：`)
    setFeedback(null)
  }

  const startClosureAnswer = (prompt: string) => {
    setAnswerDraft(`${prompt}\n\n我的回答：`)
    setFeedback(null)
  }

  const useAnswerScaffold = (template: string) => {
    setAnswerDraft(template)
    setFeedback(null)
  }

  const useRepairTemplate = (template: string) => {
    setAnswerDraft(template)
    setFeedback(null)
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
            <strong>{sourceLabels[current.source]}</strong>
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
            <div className={`practice-source source-${current.source}`}>{sourceLabels[current.source]}</div>
            <span>{focusQuestionId === current.id ? '当前题' : `Q${currentIndex + 1}`}</span>
          </div>
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

        <section className="practice-answer-panel">
          <div className="practice-answer-title">
            <span>模拟面试回答</span>
            {latestAttempt && (
              <small className={`practice-latest-score score-${resolveScoreTone(latestAttempt.feedback.score)}`}>
                最近 {latestAttempt.feedback.score} 分
                {latestAttempt.feedback.source ? ` · ${feedbackSourceLabels[latestAttempt.feedback.source]}` : ''}
              </small>
            )}
          </div>
          <Input.TextArea
            value={answerDraft}
            onChange={(event) => setAnswerDraft(event.target.value)}
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
          <div className="practice-answer-actions">
            <Button
              type="primary"
              icon={<SendOutlined />}
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
            <PracticeFeedbackClosurePanel
              question={current}
              answer={answerDraft}
              feedback={feedback}
              onUsePrompt={startClosureAnswer}
              onMarkWeak={markWeak}
              onMarkMastered={markMastered}
              onOpenAnswer={() => navigate(`/question/${current.id}`)}
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
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(`/question/${current.id}`)}>
            打开答案
          </Button>
          <Button icon={<WarningOutlined />} danger onClick={markWeak}>
            标记薄弱
          </Button>
          <Button icon={<CheckOutlined />} onClick={markMastered}>
            已掌握
          </Button>
          <Button icon={<PlusOutlined />} onClick={() => setInPlan(current.id, !currentState.addedToPlan)}>
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
        <PracticeSessionReportPanel queue={queue} progress={progress} onNavigate={navigate} />
        <InterviewReviewPanel progress={progress} compact />
        <div className="practice-queue-panel">
          <div className="practice-side-title-row">
            <div className="practice-side-title">训练队列</div>
            <small>{currentIndex + 1} / {queue.length}</small>
          </div>
          {queue.map((item, index) => (
            <button
              key={`${item.source}-${item.id}`}
              className={item.id === current.id ? 'active' : ''}
              aria-current={item.id === current.id ? 'step' : undefined}
              onClick={() => setCurrentIndex(index)}
            >
              <span className={`queue-index source-${item.source}`}>{index + 1}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{sourceLabels[item.source]} · {item.categoryName}</small>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
