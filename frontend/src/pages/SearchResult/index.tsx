import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Spin, Empty, Alert, Button } from 'antd'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function SearchResult() {
  const [searchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const doSearch = () => {
    if (!keyword) return
    setLoading(true)
    setError(false)
    getQuestions({ keyword, page: 0, size: 20 })
      .then(res => {
        setQuestions(res.content)
        setLoading(false)
      }).catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { doSearch() }, [keyword])

  return (
    <div>
      <h1 className="section-title" style={{ fontSize: 24 }}>搜索结果</h1>
      <p className="section-subtitle">
        关于 "<strong style={{ color: '#18181B' }}>{keyword}</strong>" 的搜索结果
      </p>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      )}

      {error && (
        <Alert type="error" message="搜索失败" showIcon
          action={<Button onClick={doSearch} size="small">重试</Button>}
        />
      )}

      {!loading && !error && questions.length === 0 && (
        <Empty description={`未找到与"${keyword}"相关的题目`}>
          <Button type="primary" ghost onClick={() => navigate('/banks')}>浏览全部题目</Button>
        </Empty>
      )}

      {!loading && !error && questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`magazine-card fade-in-up`}
              style={{
                padding: '18px 24px',
                cursor: 'pointer',
                animationDelay: `${i * 0.04}s`,
              }}
              onClick={() => navigate(`/question/${q.id}`)}
            >
              <div style={{
                fontSize: 16,
                fontWeight: 500,
                color: '#18181B',
                lineHeight: 1.4,
              }}>
                {q.title}
              </div>
              <div style={{ fontSize: 13, color: '#A1A1AA', marginTop: 4 }}>
                {q.categoryName}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
