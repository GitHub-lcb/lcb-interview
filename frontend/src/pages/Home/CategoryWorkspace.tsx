import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Skeleton } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import { toChineseNumeral } from '../../utils/chineseNumeral'
import type { Category, Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

/** 默认只展示前 12 个模块编号，对齐参考站的单排中文数字 Tab，点击「全部」再展开。 */
const COLLAPSED_MODULE_COUNT = 12
const WORKSPACE_PAGE_SIZE = 12

interface Props {
  categories: Category[]
  loading: boolean
  error: boolean
  onRetry: () => void
}

/**
 * 首页内嵌题目工作区：中文数字模块 Tab + 题目列表 + 答案预览，
 * 对标参考站「选中模块直接在首页加载实验工作区」的浏览方式。
 */
export default function CategoryWorkspace({ categories, loading, error, onRetry }: Props) {
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  )
  const [expanded, setExpanded] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsTotal, setQuestionsTotal] = useState(0)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsError, setQuestionsError] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 分类加载完成后默认选中第一个模块，让工作区首屏即有内容。
  useEffect(() => {
    if (activeId == null && sortedCategories.length > 0) {
      setActiveId(sortedCategories[0].id)
    }
  }, [activeId, sortedCategories])

  // 切换模块时重新拉取题目；用 cancelled 标记避免快速切换时旧响应覆盖新列表。
  useEffect(() => {
    if (activeId == null) {
      return
    }
    let cancelled = false
    setQuestionsLoading(true)
    setQuestionsError(false)
    getQuestions({ category: activeId, size: WORKSPACE_PAGE_SIZE }, { silentGlobalError: true })
      .then(page => {
        if (cancelled) {
          return
        }
        setQuestions(page.content)
        setQuestionsTotal(page.total)
        setSelectedId(page.content[0]?.id ?? null)
        setQuestionsLoading(false)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setQuestionsError(true)
        setQuestionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const activeCategory = sortedCategories.find(category => category.id === activeId)
  const selectedQuestion = questions.find(question => question.id === selectedId) ?? null
  const visibleCategories = expanded ? sortedCategories : sortedCategories.slice(0, COLLAPSED_MODULE_COUNT)

  if (loading) {
    return (
      <div className="lab-workspace lab-workspace-loading">
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="模块加载失败"
        showIcon
        action={<Button onClick={onRetry} size="small">重试</Button>}
      />
    )
  }

  if (sortedCategories.length === 0) {
    return <Empty description="暂无模块" />
  }

  return (
    <div className="lab-workspace-wrap">
      <div className="lab-module-tabs" role="tablist" aria-label="学习模块">
        {visibleCategories.map((category, index) => {
          const numeral = toChineseNumeral(index + 1)
          const active = category.id === activeId
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`模块${numeral} ${category.name}`}
              title={category.name}
              className={active ? 'lab-module-tab active' : 'lab-module-tab'}
              onClick={() => setActiveId(category.id)}
            >
              {numeral}
            </button>
          )
        })}
        {sortedCategories.length > COLLAPSED_MODULE_COUNT && (
          <button
            type="button"
            className="lab-module-toggle"
            onClick={() => setExpanded(value => !value)}
          >
            {expanded ? '收起' : `全部 ${sortedCategories.length} 个模块`}
          </button>
        )}
      </div>

      <div className="lab-workspace">
        <div className="lab-workspace-head">
          <div className="lab-workspace-heading">
            <span className="lab-workspace-numeral" aria-hidden="true">
              {activeCategory ? toChineseNumeral(sortedCategories.indexOf(activeCategory) + 1) : ''}
            </span>
            <div>
              <h3 className="lab-workspace-title">{activeCategory?.name}</h3>
              <p className="lab-workspace-sub">{activeCategory?.description}</p>
            </div>
          </div>
          <div className="lab-workspace-side">
            <span className="lab-workspace-count">{questionsTotal} 题</span>
            {activeCategory && (
              <Link to={`/bank/${activeCategory.id}`} className="lab-workspace-more">
                完整题库 <ArrowRightOutlined aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        <div className="lab-workspace-body">
          <div className="lab-question-list" aria-label="模块题目列表">
            {questionsLoading && (
              <div className="lab-question-list-state">
                <Skeleton active paragraph={{ rows: 5 }} title={false} />
              </div>
            )}
            {!questionsLoading && questionsError && (
              <div className="lab-question-list-state">
                <Alert type="warning" showIcon message="题目加载失败，请切换模块重试。" />
              </div>
            )}
            {!questionsLoading && !questionsError && questions.length === 0 && (
              <div className="lab-question-list-state">
                <Empty description="该模块暂无题目" />
              </div>
            )}
            {!questionsLoading && !questionsError && questions.map(question => (
              <button
                key={question.id}
                type="button"
                className={question.id === selectedId ? 'lab-question-row active' : 'lab-question-row'}
                aria-label={`在工作区预览 ${question.title}`}
                onClick={() => setSelectedId(question.id)}
              >
                <span className="lab-question-row-title">{question.title}</span>
                <span className="lab-question-row-meta">
                  <span className={`difficulty-tag ${question.difficulty.toLowerCase()}`}>
                    {difficultyLabels[question.difficulty] || question.difficulty}
                  </span>
                  <span>{question.viewCount.toLocaleString()} 次浏览</span>
                </span>
              </button>
            ))}
          </div>

          <div className="lab-preview" aria-label="题目预览">
            {selectedQuestion ? (
              <>
                <h4 className="lab-preview-title">{selectedQuestion.title}</h4>
                <div className="lab-preview-meta">
                  <span className={`difficulty-tag ${selectedQuestion.difficulty.toLowerCase()}`}>
                    {difficultyLabels[selectedQuestion.difficulty] || selectedQuestion.difficulty}
                  </span>
                  <span>{selectedQuestion.categoryName}</span>
                  <span>{selectedQuestion.viewCount.toLocaleString()} 次浏览</span>
                  {selectedQuestion.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="lab-preview-tag">{tag}</span>
                  ))}
                </div>
                <p className="lab-preview-excerpt">
                  {selectedQuestion.summary || selectedQuestion.content || selectedQuestion.answer || '暂无内容'}
                </p>
                <div className="lab-preview-actions">
                  <Link to={`/question/${selectedQuestion.id}`} className="lab-preview-cta">
                    打开完整解析 <ArrowRightOutlined aria-hidden="true" />
                  </Link>
                </div>
              </>
            ) : (
              !questionsLoading && <Empty description="选择左侧题目开始预览" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
