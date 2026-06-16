import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { getQuestionById } from '../../api/question'
import AnswerQualityPanel from '../../components/AnswerQualityPanel'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import ContentView from './ContentView'
import Skeleton from './Skeleton'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

export default function QuestionDetail() {
  const { id } = useParams()
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const { getState, rememberQuestion, setInPlan, setStatus } = useStudyProgress()

  const fetchQuestion = () => {
    if (!id) {
      return
    }
    setLoading(true)
    setError(false)
    getQuestionById(Number(id))
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
  }, [id])

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

  return (
    <article className="question-detail-page">
      <button className="detail-back-button" onClick={() => window.history.back()}>
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
          </header>

          <div className="content-card">
            <ContentView question={q} />
          </div>
        </main>

        <AnswerQualityPanel question={q} />
      </div>
    </article>
  )
}
