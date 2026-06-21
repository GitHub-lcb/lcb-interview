import { useEffect, useMemo, useRef, useState } from 'react'
import { Select, Pagination, Skeleton, Empty, Alert, Button } from 'antd'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeftOutlined, FilterOutlined, PlayCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { getQuestions } from '../../api/question'
import { getCategoryById } from '../../api/category'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { summarizeQuestionSetProgress } from '../../utils/studyProgress'
import { buildScheduledReviewQueue } from '../../utils/reviewSchedule'
import { buildContinuePracticePath } from '../../utils/practiceRoute'
import type { Question, Category, StudyQuestionStatus } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
type StudyStatusFilter = 'all' | 'plan' | 'reviewDue' | StudyQuestionStatus
type QuestionSortMode = 'latest' | 'hot'

const studyStatusFilterLabels: Record<StudyStatusFilter, string> = {
  all: '全部状态',
  plan: '今日计划',
  reviewDue: '到期复习',
  new: '未开始',
  learning: '学习中',
  weak: '薄弱题',
  mastered: '已掌握',
}

const sortLabels: Record<QuestionSortMode, string> = {
  latest: '按最新',
  hot: '按热度',
}

function parseCategoryRouteId(id?: string): number | null {
  const categoryId = Number(id)
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return null
  }
  return categoryId
}

function parseDifficulty(value: string | null): string | undefined {
  if (!value || !(value in difficultyLabels)) {
    return undefined
  }
  return value
}

function parseSort(value: string | null): QuestionSortMode {
  if (value === 'hot' || value === 'latest') {
    return value
  }
  return 'latest'
}

function parsePage(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1
  }
  return parsed
}

export default function QuestionList() {
  const { id } = useParams()
  const categoryId = parseCategoryRouteId(id)
  const [searchParams, setSearchParams] = useSearchParams()
  const difficulty = parseDifficulty(searchParams.get('difficulty'))
  const sort = parseSort(searchParams.get('sort'))
  const page = parsePage(searchParams.get('page'))
  const [category, setCategory] = useState<Category | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)
  const [studyStatusFilter, setStudyStatusFilter] = useState<StudyStatusFilter>('all')
  const requestSeq = useRef(0)
  const navigate = useNavigate()
  const { getState, progress, rememberQuestions, addDailyPlanQuestions, setInPlan, setStatus } = useStudyProgress()
  const reviewDebtQuestionIds = useMemo(() => new Set(
    buildScheduledReviewQueue(progress, new Date().toISOString(), Number.MAX_SAFE_INTEGER)
      .filter(item => item.dueStatus !== 'upcoming')
      .map(item => item.id),
  ), [progress])

  const fetch = () => {
    const requestId = requestSeq.current + 1
    requestSeq.current = requestId
    if (categoryId === null) {
      setCategory(null)
      setQuestions([])
      setTotal(0)
      setError(false)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    Promise.all([
      getCategoryById(categoryId, { silentGlobalError: true }).catch(() => undefined),
      getQuestions({ category: categoryId, difficulty, page: page - 1, size: 20, sort }, { silentGlobalError: true }),
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
  }, [categoryId, difficulty, page, sort])

  const updateListState = (next: {
    difficulty?: string
    sort?: QuestionSortMode
    page?: number
  }) => {
    const params = new URLSearchParams(searchParams)
    if ('difficulty' in next) {
      if (next.difficulty) {
        params.set('difficulty', next.difficulty)
      } else {
        params.delete('difficulty')
      }
    }
    if ('sort' in next) {
      if (next.sort === 'latest' || !next.sort) {
        params.delete('sort')
      } else {
        params.set('sort', next.sort)
      }
    }
    if ('page' in next) {
      const nextPage = next.page ?? 1
      if (nextPage <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(nextPage))
      }
    }
    setSearchParams(params)
  }

  if (categoryId === null) {
    return (
      <Alert
        type="error"
        message="分类地址无效"
        showIcon
        action={<Button onClick={() => navigate('/banks')} size="small">返回题库</Button>}
      />
    )
  }

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

  const visibleQuestions = questions.filter(question => {
    const state = getState(question.id)
    if (studyStatusFilter === 'all') {
      return true
    }
    if (studyStatusFilter === 'plan') {
      return state.addedToPlan
    }
    if (studyStatusFilter === 'reviewDue') {
      return reviewDebtQuestionIds.has(question.id)
    }
    return state.status === studyStatusFilter
  })
  const visibleQuestionIds = visibleQuestions.map(question => question.id)
  const pageQuestionIds = questions.map(question => question.id)
  const pageProgress = summarizeQuestionSetProgress(progress, pageQuestionIds)
  const trackedOnPage = pageProgress.tracked
  const visibleProgress = summarizeQuestionSetProgress(progress, visibleQuestionIds)
  const hasVisibleQuestions = visibleProgress.hasQuestions
  const canAddPageToPlan = hasVisibleQuestions && !visibleProgress.allPlanned
  const addPageButtonText = visibleProgress.allPlanned ? '本页已加入' : '本页入计划'
  const filterSummary = [
    difficulty ? `难度：${difficultyLabels[difficulty] || difficulty}` : '全部难度',
    studyStatusFilter === 'all' ? '全部状态' : `状态：${studyStatusFilterLabels[studyStatusFilter]}`,
    `排序：${sortLabels[sort]}`,
  ].join(' · ')

  const addCurrentPageToPlan = () => {
    if (!canAddPageToPlan) {
      return
    }
    addDailyPlanQuestions(visibleQuestionIds)
  }

  const startPagePractice = () => {
    if (visibleQuestionIds.length === 0) {
      navigate(buildContinuePracticePath(progress))
      return
    }
    const sourceParam = studyStatusFilter === 'reviewDue' ? '&from=review-due' : '&from=filtered-list'
    navigate(`/practice?queue=${visibleQuestionIds.join(',')}${sourceParam}`)
  }

  return (
    <div className="question-list-page">
      <button
        type="button"
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
          <span>{filterSummary}</span>
        </div>
        <div className="question-list-toolbar-actions">
          <Select
            aria-label="按难度筛选"
            placeholder="难度"
            allowClear
            value={difficulty}
            style={{ width: 120 }}
            onChange={(value) => {
              updateListState({ difficulty: value, page: 1 })
            }}
            options={[
              { value: 'EASY', label: '简单' },
              { value: 'MEDIUM', label: '中等' },
              { value: 'HARD', label: '困难' },
            ]}
          />
          <Select
            aria-label="按学习状态筛选"
            value={studyStatusFilter}
            style={{ width: 128 }}
            onChange={(value: StudyStatusFilter) => setStudyStatusFilter(value)}
            options={[
              { value: 'all', label: studyStatusFilterLabels.all },
              { value: 'plan', label: studyStatusFilterLabels.plan },
              { value: 'reviewDue', label: studyStatusFilterLabels.reviewDue },
              { value: 'weak', label: studyStatusFilterLabels.weak },
              { value: 'learning', label: studyStatusFilterLabels.learning },
              { value: 'mastered', label: studyStatusFilterLabels.mastered },
              { value: 'new', label: studyStatusFilterLabels.new },
            ]}
          />
          <Select
            aria-label="按排序方式选择"
            value={sort}
            style={{ width: 120 }}
            onChange={(value: QuestionSortMode) => {
              updateListState({ sort: value, page: 1 })
            }}
            options={[
              { value: 'latest', label: sortLabels.latest },
              { value: 'hot', label: sortLabels.hot },
            ]}
          />
          {hasVisibleQuestions && (
            <Button
              icon={<PlusOutlined />}
              aria-label={addPageButtonText}
              disabled={!canAddPageToPlan}
              onClick={addCurrentPageToPlan}
            >
              {addPageButtonText}
            </Button>
          )}
          <Button
            icon={<PlayCircleOutlined />}
            type="primary"
            ghost
            aria-label={hasVisibleQuestions ? '练本页' : '开始训练'}
            onClick={startPagePractice}
          >
            {hasVisibleQuestions ? '练本页' : '开始训练'}
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
        <div className="question-list-empty" role="status" aria-live="polite">
          {difficulty ? (
            <Empty description="当前筛选暂无题目">
              <Button
                type="primary"
                onClick={() => {
                  updateListState({ difficulty: '', page: 1 })
                }}
              >
                清除难度筛选
              </Button>
            </Empty>
          ) : (
            <Empty description="该分类暂无题目">
              <Button type="primary" ghost onClick={() => navigate('/banks')}>
                返回题库
              </Button>
            </Empty>
          )}
        </div>
      ) : visibleQuestions.length === 0 ? (
        <div className="question-list-empty" role="status" aria-live="polite">
          <Empty description="当前学习状态暂无题目">
            <Button
              type="primary"
              onClick={() => setStudyStatusFilter('all')}
            >
              清除状态筛选
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <div className="question-list-stack">
            {visibleQuestions.map((q) => {
              const studyState = getState(q.id)
              return (
                <article
                  key={q.id}
                  className="question-list-card"
                  tabIndex={0}
                  onClick={() => navigate(`/question/${q.id}`)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || event.key !== 'Enter') {
                      return
                    }
                    navigate(`/question/${q.id}`)
                  }}
                >
                  <div className="question-list-card-main">
                    <h2>
                      <Link
                        className="question-list-title-link"
                        to={`/question/${q.id}`}
                        aria-label={`打开题目 ${q.title}`}
                        onClick={event => event.stopPropagation()}
                      >
                        {q.title}
                      </Link>
                    </h2>
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
              onChange={paginationPage => updateListState({ page: paginationPage })}
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
