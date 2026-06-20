import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { getQuestionById } from '../../api/question'
import AnswerQualityPanel from '../../components/AnswerQualityPanel'
import InterviewAnswerScriptPanel from '../../components/InterviewAnswerScriptPanel'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import ContentView from './ContentView'
import Skeleton from './Skeleton'
import type { InterviewAttempt, InterviewCriterion, Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

function parseQuestionRouteId(id?: string): number | null {
  const questionId = Number(id)
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return null
  }
  return questionId
}

interface PracticeCalibrationSummary {
  score: number
  weakestLabel?: string
}

function resolveWeakestCriterion(criteria: InterviewCriterion[]): InterviewCriterion | undefined {
  return criteria.reduce<InterviewCriterion | undefined>((weakest, item) => {
    if (!weakest || item.score < weakest.score) {
      return item
    }

    return weakest
  }, undefined)
}

function resolvePracticeCalibrationSummary(attempt?: InterviewAttempt): PracticeCalibrationSummary | undefined {
  if (!attempt) {
    return undefined
  }

  const weakest = resolveWeakestCriterion(attempt.feedback.criteria)

  return {
    score: attempt.feedback.score,
    weakestLabel: weakest?.label,
  }
}

export default function QuestionDetail() {
  const { id } = useParams()
  const questionId = parseQuestionRouteId(id)
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { progress, getState, rememberQuestion, setInPlan, setStatus } = useStudyProgress()
  const isPracticeCalibrationReturn = new URLSearchParams(location.search).get('from') === 'practice-calibration'

  const fetchQuestion = () => {
    if (questionId === null) {
      setQ(null)
      setError(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    getQuestionById(questionId, { silentGlobalError: true })
      .then(data => {
        setQ(data)
        rememberQuestion(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchQuestion()
  }, [questionId])

  useEffect(() => {
    if (!q || location.hash !== '#answer-script') {
      return undefined
    }

    const scrollTimer = window.setTimeout(() => {
      const scriptPanel = document.getElementById('answer-script')
      scriptPanel?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      scriptPanel?.focus({ preventScroll: true })
    }, 0)

    return () => window.clearTimeout(scrollTimer)
  }, [location.hash, q])

  if (questionId === null) {
    return (
      <div className="detail-state-card">
        <Alert
          type="error"
          message="题目地址无效"
          showIcon
          action={<Button onClick={() => navigate('/banks')} size="small">返回题库</Button>}
        />
      </div>
    )
  }

  if (loading) {
    return <Skeleton />
  }

  if (error) {
    return (
      <div className="detail-state-card">
        <Alert
          type="error"
          message="题目加载失败"
          showIcon
          action={<Button onClick={fetchQuestion} size="small">重试</Button>}
        />
      </div>
    )
  }

  if (!q) {
    return (
      <div className="detail-state-card">
        <Alert type="warning" message="题目不存在" showIcon />
      </div>
    )
  }

  const studyState = getState(q.id)
  const latestPracticeAttempt = progress.interviewAttempts[q.id]?.[0]
  const practiceCalibrationSummary = isPracticeCalibrationReturn
    ? resolvePracticeCalibrationSummary(latestPracticeAttempt)
    : undefined

  return (
    <article className="question-detail-page">
      <button type="button" className="detail-back-button" onClick={() => window.history.back()}>
        <ArrowLeftOutlined />
        返回
      </button>

      <div className="question-detail-shell">
        <main className="question-detail-main">
          <header className="question-detail-header">
            <div className="dashboard-kicker">题目详情</div>
            <h1>{q.title}</h1>
            <div className="question-meta-row">
              <span className="question-category-pill">{q.categoryName}</span>
              <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                {difficultyLabels[q.difficulty] || q.difficulty}
              </span>
              <StudyStatusBadge status={studyState.status} addedToPlan={studyState.addedToPlan} />
              {q.tags?.map(tag => (
                <span key={tag} className="question-tag-pill">{tag}</span>
              ))}
              <span className="question-view-count">{q.viewCount} 次浏览</span>
            </div>
            <div className="question-detail-actions">
              <StudyActionButtons
                questionId={q.id}
                state={studyState}
                onPlanChange={setInPlan}
                onMarkWeak={(questionId) => setStatus(questionId, 'weak')}
                onMarkMastered={(questionId) => setStatus(questionId, 'mastered')}
              />
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => navigate(`/practice?question=${q.id}`)}
              >
                模拟面试
              </Button>
            </div>
            <div className="detail-free-cue">本题答案、追问、质量评分和模拟面试均免费开放。</div>
          </header>

          <InterviewAnswerScriptPanel
            question={q}
            isPracticeCalibrationReturn={isPracticeCalibrationReturn}
            practiceCalibrationSummary={practiceCalibrationSummary}
          />

          <div className="content-card">
            <ContentView question={q} />
          </div>
        </main>

        <AnswerQualityPanel question={q} />
      </div>
    </article>
  )
}
