import { useEffect, useRef, useState } from 'react'
import { Select, Pagination, Skeleton, Empty, Alert, Button } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined, FilterOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { getQuestions } from '../../api/question'
import { getCategoryById } from '../../api/category'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { summarizeQuestionSetProgress } from '../../utils/studyProgress'
import type { Question, Category } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

export default function QuestionList() {
  const { id } = useParams()
  const [category, setCategory] = useState<Category | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState<string>()
  const requestSeq = useRef(0)
  const navigate = useNavigate()
  const { getState, progress, rememberQuestions, addDailyPlanQuestions, setInPlan, setStatus } = useStudyProgress()

  const fetch = () => {
    const requestId = requestSeq.current + 1
    requestSeq.current = requestId
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    Promise.all([
      getCategoryById(Number(id)).catch(() => undefined),
      getQuestions({ category: Number(id), difficulty, page: page - 1, size: 20 }),
    ]).then(([nextCategory, res]) => {
      if (requestId !== requestSeq.current) {
        return
      }
      if (nextCategory) {
        setCategory(nextCategory)
      }
      setQuestions(res.content)
      setTotal(res.total)
      rememberQuestions(res.content)
    }).catch(() => {
      if (requestId !== requestSeq.current) {
        return
      }
      setError(true)
    }).finally(() => {
      if (requestId === requestSeq.current) {
        setLoading(false)
      }
    })
  }

  useEffect(() => {
    fetch()
  }, [id, difficulty, page])

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        showIcon
        action={<Button onClick={fetch} size="small">重试</Button>}
      />
    )
  }

  const pageQuestionIds = questions.map(question => question.id)
  const pageProgress = summarizeQuestionSetProgress(progress, pageQuestionIds)
  const trackedOnPage = pageProgress.tracked
  const hasPageQuestions = pageProgress.hasQuestions
  const canAddPageToPlan = hasPageQuestions && !pageProgress.allPlanned
  const addPageButtonText = pageProgress.allPlanned ? '本页已加入' : '本页入计划'

  const addCurrentPageToPlan = () => {
    if (!canAddPageToPlan) {
      return
    }
    addDailyPlanQuestions(pageQuestionIds)
  }

  const startPagePractice = () => {
    if (pageQuestionIds.length === 0) {
      navigate('/practice')
      return
    }
    navigate(`/practice?queue=${pageQuestionIds.join(',')}`)
  }

  return (
    <div className="question-list-page">
      <button
        className="detail-back-button"
        onClick={() => navigate('/banks')}
      >
        <ArrowLeftOutlined />
        全部题库
      </button>

      <header className="question-list-hero">
        <div>
          <div className="dashboard-kicker">分类刷题</div>
          <h1>{category?.name || '题目列表'}</h1>
          <p>{category?.description || '按难度筛选题目，把重点题加入今日计划后进入训练。'}</p>
        </div>
        <div className="question-list-hero-stats">
          <div>
            <span>题目总数</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>本页已跟踪</span>
            <strong>{trackedOnPage}</strong>
          </div>
        </div>
      </header>

      <div className="question-list-toolbar">
        <div>
          <FilterOutlined />
          <span>{difficulty ? `已筛选：${difficultyLabels[difficulty] || difficulty}` : '全部难度'}</span>
        </div>
        <div className="question-list-toolbar-actions">
          <Select
            placeholder="难度"
            allowClear
            value={difficulty}
            style={{ width: 120 }}
            onChange={(value) => {
              setDifficulty(value)
              setPage(1)
            }}
            options={[
              { value: 'EASY', label: '简单' },
              { value: 'MEDIUM', label: '中等' },
              { value: 'HARD', label: '困难' },
            ]}
          />
          {hasPageQuestions && (
            <Button icon={<PlusOutlined />} disabled={!canAddPageToPlan} onClick={addCurrentPageToPlan}>
              {addPageButtonText}
            </Button>
          )}
          <Button icon={<PlayCircleOutlined />} type="primary" ghost onClick={startPagePractice}>
            {hasPageQuestions ? '练本页' : '开始训练'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="question-list-stack">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="question-list-card">
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <Empty description="该分类暂无题目" />
      ) : (
        <>
          <div className="question-list-stack">
            {questions.map((q) => {
              const studyState = getState(q.id)
              return (
                <article
                  key={q.id}
                  className="question-list-card"
                  onClick={() => navigate(`/question/${q.id}`)}
                >
                  <div className="question-list-card-main">
                    <h2>{q.title}</h2>
                    <div className="question-list-card-meta">
                      <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                        {difficultyLabels[q.difficulty] || q.difficulty}
                      </span>
                      <StudyStatusBadge status={studyState.status} addedToPlan={studyState.addedToPlan} />
                      <span>{q.viewCount.toLocaleString()} 次浏览</span>
                      {q.tags?.slice(0, 5).map(tag => (
                        <span key={tag} className="question-tag-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="question-card-actions">
                    <StudyActionButtons
                      compact
                      questionId={q.id}
                      state={studyState}
                      onPlanChange={setInPlan}
                      onMarkWeak={(questionId) => setStatus(questionId, 'weak')}
                      onMarkMastered={(questionId) => setStatus(questionId, 'mastered')}
                    />
                  </div>
                </article>
              )
            })}
          </div>
          <div className="question-list-pagination">
            <Pagination
              current={page}
              total={total}
              pageSize={20}
              onChange={paginationPage => setPage(paginationPage)}
              showSizeChanger={false}
              hideOnSinglePage
              showTotal={count => `共 ${count} 条`}
            />
          </div>
        </>
      )}
    </div>
  )
}
