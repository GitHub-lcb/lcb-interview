import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Input, Select, Pagination, Skeleton, Empty, Alert, Button } from 'antd'
import { FilterOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { getQuestions } from '../../api/question'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import { summarizeQuestionSetProgress } from '../../utils/studyProgress'
import { buildContinuePracticePath } from '../../utils/practiceRoute'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
type SearchSortMode = 'relevance' | 'latest' | 'hot'

const sortLabels: Record<SearchSortMode, string> = {
  relevance: '按相关',
  latest: '按最新',
  hot: '按热度',
}

const { Search } = Input
const RECENT_SEARCH_STORAGE_KEY = 'lcb-recent-searches'
const RECENT_SEARCH_LIMIT = 6

function parseDifficulty(value: string | null): string | undefined {
  if (!value || !(value in difficultyLabels)) {
    return undefined
  }
  return value
}

function parseSort(value: string | null): SearchSortMode {
  if (value === 'latest' || value === 'hot' || value === 'relevance') {
    return value
  }
  return 'relevance'
}

function parsePage(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1
  }
  return parsed
}

function previewQuestion(question: Question): string {
  return (question.summary || question.content || question.answer || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .trim()
    .slice(0, 120)
}

function normalizeRecentKeyword(value: string): string {
  return value.trim().slice(0, 40)
}

function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeRecentKeyword)
      .filter(Boolean)
      .slice(0, RECENT_SEARCH_LIMIT)
  } catch {
    return []
  }
}

function buildRecentSearches(current: string[], keyword: string): string[] {
  const normalizedKeyword = normalizeRecentKeyword(keyword)
  if (!normalizedKeyword) {
    return current
  }

  const existing = current.filter(item => item.toLowerCase() !== normalizedKeyword.toLowerCase())
  return [normalizedKeyword, ...existing].slice(0, RECENT_SEARCH_LIMIT)
}

function writeRecentSearches(searches: string[]): void {
  if (searches.length === 0) {
    window.localStorage.removeItem(RECENT_SEARCH_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(searches))
}

export default function SearchResult() {
  const [searchParams, setSearchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const difficulty = parseDifficulty(searchParams.get('difficulty'))
  const sort = parseSort(searchParams.get('sort'))
  const page = parsePage(searchParams.get('page'))
  const [questions, setQuestions] = useState<Question[]>([])
  const [searchDraft, setSearchDraft] = useState(keyword)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches())
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
    getQuestions({ keyword, difficulty, page: page - 1, size: 20, sort }, { silentGlobalError: true })
      .then(res => {
        if (requestId !== requestSeq.current) {
          return
        }
        setQuestions(res.content)
        setTotal(res.total)
        rememberQuestions(res.content)
        setRecentSearches(current => {
          const next = buildRecentSearches(current, keyword)
          writeRecentSearches(next)
          return next
        })
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
  }, [keyword, difficulty, page, sort])

  useEffect(() => {
    setSearchDraft(keyword)
  }, [keyword])

  const updateSearchState = (next: {
    q?: string
    difficulty?: string
    sort?: SearchSortMode
    page?: number
    clear?: boolean
  }) => {
    if (next.clear) {
      setSearchParams({})
      return
    }
    const params = new URLSearchParams(searchParams)
    if ('q' in next) {
      if (next.q) {
        params.set('q', next.q)
      } else {
        params.delete('q')
      }
    }
    if ('difficulty' in next) {
      if (next.difficulty) {
        params.set('difficulty', next.difficulty)
      } else {
        params.delete('difficulty')
      }
    }
    if ('sort' in next) {
      if (next.sort === 'relevance') {
        params.delete('sort')
      } else if (next.sort) {
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

  const submitSearch = (value: string) => {
    const nextKeyword = value.trim()
    if (nextKeyword) {
      updateSearchState({ q: nextKeyword, page: 1 })
      return
    }
    updateSearchState({ clear: true })
    setQuestions([])
    setTotal(0)
    setError(false)
    setLoading(false)
  }

  const clearRecentSearches = () => {
    writeRecentSearches([])
    setRecentSearches([])
  }

  const pageQuestionIds = questions.map(question => question.id)
  const pageProgress = summarizeQuestionSetProgress(progress, pageQuestionIds)
  const trackedOnPage = pageProgress.tracked
  const hasPageQuestions = pageProgress.hasQuestions
  const canAddPageToPlan = hasPageQuestions && !pageProgress.allPlanned
  const addPageButtonText = pageProgress.allPlanned ? '本页已加入' : '本页入计划'
  const filterSummary = [
    difficulty ? `难度：${difficultyLabels[difficulty] || difficulty}` : '全部难度',
    `排序：${sortLabels[sort]}`,
  ].join(' · ')

  const addCurrentPageToPlan = () => {
    if (!canAddPageToPlan) {
      return
    }
    addDailyPlanQuestions(pageQuestionIds)
  }

  const startPagePractice = () => {
    if (pageQuestionIds.length === 0) {
      navigate(buildContinuePracticePath(progress))
      return
    }
    navigate(`/practice?queue=${pageQuestionIds.join(',')}&from=filtered-list`)
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
          {recentSearches.length > 0 && (
            <div className="search-recent-panel" aria-label="最近搜索">
              <div className="search-recent-head">
                <span>最近搜索</span>
                <Button size="small" type="text" onClick={clearRecentSearches}>清空最近搜索</Button>
              </div>
              <div className="search-recent-list">
                {recentSearches.map(item => (
                  <Button
                    key={item}
                    size="small"
                    onClick={() => updateSearchState({ q: item, page: 1 })}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          )}
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
          <span>{filterSummary}</span>
        </div>
        <div className="search-toolbar-actions">
          <Select
            aria-label="按难度筛选"
            placeholder="难度"
            allowClear
            value={difficulty}
            onChange={(value) => {
              updateSearchState({ difficulty: value, page: 1 })
            }}
            options={[
              { value: 'EASY', label: '简单' },
              { value: 'MEDIUM', label: '中等' },
              { value: 'HARD', label: '困难' },
            ]}
          />
          <Select
            aria-label="按排序方式选择"
            value={sort}
            onChange={(value: SearchSortMode) => {
              updateSearchState({ sort: value, page: 1 })
            }}
            options={[
              { value: 'relevance', label: sortLabels.relevance },
              { value: 'latest', label: sortLabels.latest },
              { value: 'hot', label: sortLabels.hot },
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
                  updateSearchState({ difficulty: '', page: 1 })
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
            onChange={paginationPage => updateSearchState({ page: paginationPage })}
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
