import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Empty } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { listQuestionsByIds } from '../../api/question'
import { difficultyLabels } from './index'
import type { Question } from '../../types'

interface Props {
  question: Question
}

interface RelatedQuestionLite {
  id: number
  title: string
  difficulty: string
  categoryName: string
}

/**
 * 关联题目模块：解析 question.relatedIds JSON 数组，调 /questions/list 批量取回轻量信息并渲染。
 *
 * 之所以独立组件而非并入 ContentView，是因为关联题目需要异步请求且涉及跨页跳转，
 * 与纯渲染的答案分区解耦便于懒加载和生命周期隔离。
 */
export default function RelatedQuestions({ question }: Props) {
  const navigate = useNavigate()
  const [related, setRelated] = useState<RelatedQuestionLite[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!question.relatedIds) {
      setRelated([])
      return
    }
    let ids: number[] = []
    try {
      const parsed = JSON.parse(question.relatedIds)
      if (Array.isArray(parsed)) {
        ids = parsed
          .filter((x): x is number => typeof x === 'number' && x > 0)
          .slice(0, 10)
      }
    } catch {
      // relatedIds 为脏字符串时静默置空，避免阻塞详情页主流程。
      setRelated([])
      return
    }
    if (ids.length === 0) {
      setRelated([])
      return
    }
    setLoading(true)
    let cancelled = false
    listQuestionsByIds(ids)
      .then((list) => {
        if (cancelled) {
          return
        }
        setRelated(list.map(q => ({
          id: q.id,
          title: q.title,
          difficulty: q.difficulty,
          categoryName: q.categoryName ?? '',
        })))
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setRelated([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [question.id, question.relatedIds])

  // 既无 relatedIds 也无查询结果，则不渲染整块，保持详情页简洁。
  if ((!question.relatedIds || related.length === 0) && !loading) {
    return null
  }

  return (
    <div className="content-card related-questions-card">
      <div className="related-questions-header">
        <span className="related-questions-title">关联题目</span>
        <small>横向扩展理解</small>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="small" />
        </div>
      ) : related.length === 0 ? (
        <Empty description="暂无关联题目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <ul className="related-questions-list">
          {related.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className="related-question-item"
                onClick={() => navigate(`/question/${q.id}`)}
              >
                <span className="related-question-title">{q.title}</span>
                {q.categoryName && (
                  <span className="related-question-meta">{q.categoryName}</span>
                )}
                <span className={`related-question-difficulty ${q.difficulty.toLowerCase()}`}>
                  {difficultyLabels[q.difficulty] || q.difficulty}
                </span>
                <RightOutlined className="related-question-arrow" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}