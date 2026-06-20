import { Skeleton, Empty, Alert, Button } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

interface Props {
  questions: Question[]
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export default function HotQuestions({ questions, loading = false, error = false, onRetry }: Props) {
  const { getState } = useStudyProgress()

  if (loading) {
    return (
      <div className="hot-question-list">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="hot-question-skeleton">
            <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="加载失败"
        showIcon
        action={onRetry ? <Button onClick={onRetry} size="small">重试</Button> : undefined}
      />
    )
  }

  if (questions.length === 0) {
    return <Empty description="暂无热门题目" />
  }

  return (
    <div className="hot-question-list">
      {questions.map((q, index) => {
        const state = getState(q.id)
        return (
          <Link
            key={q.id}
            className="hot-question-row fade-in-up"
            style={{ animationDelay: `${0.1 + index * 0.05}s` }}
            to={`/question/${q.id}`}
            aria-label={`打开热门题目 ${q.title}`}
          >
            <div
              className={`hot-question-rank ${index < 3 ? `rank-${index + 1}` : ''}`}
            >
              {index + 1}
            </div>

            <div className="hot-question-main">
              <div className="hot-question-title">{q.title}</div>
              <div className="hot-question-meta">
                <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                  {difficultyLabels[q.difficulty] || q.difficulty}
                </span>
                <StudyStatusBadge status={state.status} addedToPlan={state.addedToPlan} />
                <span>{q.categoryName}</span>
                <span>{q.viewCount.toLocaleString()} 次浏览</span>
              </div>
            </div>

            <RightOutlined className="hot-question-arrow" aria-hidden="true" />
          </Link>
        )
      })}
    </div>
  )
}
