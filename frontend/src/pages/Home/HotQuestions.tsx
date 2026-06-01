import { useEffect, useState } from 'react'
import { Skeleton, Empty, Alert, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getHotQuestions } from '../../api/question'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

export default function HotQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const fetch = () => {
    setLoading(true)
    setError(false)
    getHotQuestions(10).then(data => {
      setQuestions(data)
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetch() }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="magazine-card" style={{ padding: 20 }}>
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
        </div>
      ))}
    </div>
  )

  if (error) return (
    <Alert type="error" message="加载失败" showIcon
      action={<Button onClick={fetch} size="small">重试</Button>}
    />
  )

  if (questions.length === 0) return <Empty description="暂无热门题目" />

  const top3Colors = ['#DC2626', '#D97706', '#2563EB']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {questions.map((q, index) => (
        <div
          key={q.id}
          className="fade-in-up"
          style={{
            animationDelay: `${0.1 + index * 0.05}s`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '14px 20px',
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
          onClick={() => navigate(`/question/${q.id}`)}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <div style={{
            width: 32,
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'DM Serif Display', serif",
            fontSize: index < 3 ? 18 : 15,
            fontWeight: 700,
            color: index < 3 ? '#fff' : '#A1A1AA',
            background: index < 3 ? top3Colors[index] : '#F4F4F5',
            transition: 'all 0.2s',
          }}>
            {index + 1}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 500,
              color: '#18181B',
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {q.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                {difficultyLabels[q.difficulty] || q.difficulty}
              </span>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>{q.categoryName}</span>
              <span style={{ fontSize: 12, color: '#D4D4D8' }}>·</span>
              <span style={{ fontSize: 12, color: '#A1A1AA' }}>{q.viewCount} 次浏览</span>
            </div>
          </div>

          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ minWidth: 16 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      ))}
    </div>
  )
}
