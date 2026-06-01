import { useEffect, useState } from 'react'
import { Row, Col, Skeleton, Empty, Alert, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import { getCategoryIcon } from '../../utils/categoryIcons'
import type { Category } from '../../types'

export default function QuestionBank() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const fetch = () => {
    setLoading(true)
    setError(false)
    getCategories().then(data => {
      setCategories(data)
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetch() }, [])

  if (loading) return (
    <Row gutter={[20, 20]}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Col xs={24} sm={12} md={8} key={i}>
          <div className="magazine-card" style={{ padding: 24 }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        </Col>
      ))}
    </Row>
  )

  if (error) return (
    <Alert type="error" message="分类加载失败" showIcon
      action={<Button onClick={fetch} size="small">重试</Button>}
    />
  )

  if (categories.length === 0) return <Empty description="暂无分类" />

  return (
    <div>
      <h1 className="section-title" style={{ fontSize: 28 }}>全部题库</h1>
      <p className="section-subtitle">浏览所有技术分类的面试题</p>
      <Row gutter={[20, 20]}>
        {categories.map((cat, i) => (
          <Col xs={24} sm={12} md={8} key={cat.id}>
            <div
              className={`magazine-card fade-in-up stagger-${(i % 6) + 1}`}
              onClick={() => navigate(`/bank/${cat.id}`)}
              style={{
                padding: 24,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                height: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {getCategoryIcon(cat.icon, 40)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#18181B',
                    lineHeight: 1.3,
                  }}>
                    {cat.name}
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#71717A',
                    marginTop: 4,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {cat.description}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#A1A1AA' }}>浏览题库</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  )
}
