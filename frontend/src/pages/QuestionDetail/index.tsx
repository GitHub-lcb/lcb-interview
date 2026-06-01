import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Alert, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getQuestionById } from '../../api/question'
import ContentView from './ContentView'
import Skeleton from './Skeleton'
import type { Question } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

export default function QuestionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchQuestion = () => {
    if (!id) return
    setLoading(true)
    setError(false)
    getQuestionById(Number(id))
      .then(data => { setQ(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetchQuestion() }, [id])

  if (loading) return <Skeleton />
  if (error) return (
    <div className="magazine-card" style={{ padding: 24 }}>
      <Alert
        type="error"
        message="题目加载失败"
        showIcon
        action={<Button onClick={fetchQuestion} size="small">重试</Button>}
      />
    </div>
  )
  if (!q) return (
    <div className="magazine-card" style={{ padding: 24 }}>
      <Alert type="warning" message="题目不存在" showIcon />
    </div>
  )

  return (
    <article>
      <button
        onClick={() => window.history.back()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          padding: '6px 14px',
          borderRadius: 8,
          border: 'none',
          background: '#F4F4F5',
          color: '#52525B',
          fontSize: 13,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <ArrowLeftOutlined />
        返回
      </button>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 24,
          fontWeight: 700,
          color: '#18181B',
          lineHeight: 1.35,
          letterSpacing: '-0.03em',
          margin: '0 0 12px 0',
          scrollMarginTop: 72,
        }}>
          {q.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12,
            color: '#52525B',
            background: '#F4F4F5',
            padding: '2px 8px',
            borderRadius: 4,
          }}>
            {q.categoryName}
          </span>
          <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
            {difficultyLabels[q.difficulty] || q.difficulty}
          </span>
          {q.tags?.map(t => (
            <span key={t} style={{
              fontSize: 11,
              color: '#71717A',
              background: '#F4F4F5',
              padding: '2px 8px',
              borderRadius: 4,
            }}>
              {t}
            </span>
          ))}
          <span style={{ fontSize: 12, color: '#A1A1AA', marginLeft: 'auto' }}>
            {q.viewCount} 次浏览
          </span>
        </div>
      </header>

      <div className="magazine-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ContentView question={q} />
      </div>
    </article>
  )
}
