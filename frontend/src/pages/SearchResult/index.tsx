import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Input, Select, Pagination, Skeleton, Empty, Alert, Button } from 'antd'
import { FilterOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { getQuestions } from '../../api/question'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { summarizeQuestionSetProgress } from '../../utils/studyProgress'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
const { Search } = Input

function previewQuestion(question: Question): string {
  return (question.summary || question.content || question.answer || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .trim()
    .slice(0, 120)
}

export default function SearchResult() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const [questions, setQuestions] = useState<Question[]>([])
  const [searchDraft, setSearchDraft] = useState(keyword)
  const [difficulty, setDifficulty] = useState<string>()
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const requestSeq = useRef(0)
  const navigate = useNavigate()
  const { getState, progress, rememberQuestions, addDailyPlanQuestions, setInPlan, setStatus } = useStudyProgress()

  const doSearch = () => {
    const requestId = requestSeq.current + 1
    requestSeq.current = requestId
    if (!keyword) {
      setQuestions([])
      setTotal(0)
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    getQuestions({ keyword, difficulty, page: page - 1, size: 20 }, { silentGlobalError: true })
      .then(res => {
        if (requestId !== requestSeq.current) {
          return
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
    doSearch()
  }, [keyword, difficulty, page])

  useEffect(() => {
    setSearchDraft(keyword)
    setPage(1)
  }, [keyword])

  const submitSearch = (value: string) => {
    const nextKeyword = value.trim()
    if (nextKeyword) {
      setSearchParams({ q: nextKeyword })
      return
    }
    setSearchParams({})
    setQuestions([])
    setTotal(0)
    setError(false)
    setLoading(false)
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
    <div className="search-page">
      <header className="search-hero">
        <div>
          <div className="dashboard-kicker">全站搜索</div>
          <h1>{keyword ? `搜索：${keyword}` : '搜索题目'}</h1>
          <p>按关键词定位题目，再直接加入计划、标记薄弱或进入模拟面试。</p>
          <Search
            className="search-hero-input"
            prefix={<SearchOutlined />}
            placeholder="输入技术点、场景或题目关键词"
            value={searchDraft}
            allowClear
            onChange={event => setSearchDraft(event.target.value)}
            onSearch={submitSearch}
          />
        </div>
        <div className="search-hero-stats">
          <div>
            <span>结果数</span>
            <strong>{total}</strong>
          </div>
          <div>
            <span>本页已跟踪</span>
            <strong>{trackedOnPage}</strong>
          </div>
        </div>
      </header>

      <div className="search-toolbar">
        <div>
          <FilterOutlined />
          <span>{difficulty ? `已筛选：${difficultyLabels[difficulty] || difficulty}` : '全部难度'}</span>
        </div>
        <div className="search-toolbar-actions">
          <Select
            placeholder="难度"
            allowClear
            value={difficulty}
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

      {error && (
        <Alert
          type="error"
          message="搜索失败"
          showIcon
          action={<Button onClick={doSearch} size="small">重试</Button>}
        />
      )}

      {loading && (
        <div className="search-result-stack">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="search-result-card" key={index}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && keyword && questions.length === 0 && (
        <div className="search-result-empty" role="status" aria-live="polite">
          {difficulty ? (
            <Empty description="当前筛选暂无题目">
              <Button
                type="primary"
                onClick={() => {
                  setDifficulty(undefined)
                  setPage(1)
                }}
              >
                清除难度筛选
              </Button>
            </Empty>
          ) : (
            <Empty description={`未找到与 "${keyword}" 相关的题目`}>
              <Button type="primary" ghost onClick={() => navigate('/banks')}>浏览全部题目</Button>
            </Empty>
          )}
        </div>
      )}

      {!loading && !error && !keyword && (
        <Empty description="输入关键词开始搜索">
          <Button type="primary" ghost onClick={() => navigate('/banks')}>浏览全部题库</Button>
        </Empty>
      )}

      {!loading && !error && questions.length > 0 && (
        <>
        <div className="search-result-stack">
          {questions.map((q) => {
            const studyState = getState(q.id)
            const preview = previewQuestion(q)
            return (
              <article
                key={q.id}
                className="search-result-card"
                tabIndex={0}
                onClick={() => navigate(`/question/${q.id}`)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || event.key !== 'Enter') {
                    return
                  }
                  navigate(`/question/${q.id}`)
                }}
              >
                <div className="search-result-main">
                  <h2>
                    <Link
                      className="search-result-title-link"
                      to={`/question/${q.id}`}
                      aria-label={`打开题目 ${q.title}`}
                      onClick={event => event.stopPropagation()}
                    >
                      {q.title}
                    </Link>
                  </h2>
                  {preview && <p>{preview}</p>}
                  <div className="search-card-meta">
                    <span>{q.categoryName}</span>
                    <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                      {difficultyLabels[q.difficulty] || q.difficulty}
                    </span>
                    <StudyStatusBadge status={studyState.status} addedToPlan={studyState.addedToPlan} />
                    <span>{q.viewCount.toLocaleString()} 次浏览</span>
                    {q.tags?.slice(0, 4).map(tag => (
                      <span key={tag} className="question-tag-pill">{tag}</span>
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
