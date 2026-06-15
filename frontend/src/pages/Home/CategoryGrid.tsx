import { useEffect, useState } from 'react'
import { Skeleton, Empty, Alert, Button, Row, Col } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import { getCategoryIcon } from '../../utils/categoryIcons'
import type { Category } from '../../types'

export default function CategoryGrid() {
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
    }).catch(() => {
      setError(true)
      setLoading(false)
    })
  }

  useEffect(() => {
    fetch()
  }, [])

  if (loading) {
    return (
      <Row gutter={[14, 14]} className="category-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={index}>
            <div className="category-card category-card-skeleton">
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          </Col>
        ))}
      </Row>
    )
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="分类加载失败"
        showIcon
        action={<Button onClick={fetch} size="small">重试</Button>}
      />
    )
  }

  if (categories.length === 0) {
    return <Empty description="暂无分类" />
  }

  return (
    <Row gutter={[14, 14]} className="category-grid">
      {categories.map((cat, index) => (
        <Col xs={24} sm={12} lg={8} xl={6} key={cat.id}>
          <button
            type="button"
            className={`category-card fade-in-up stagger-${(index % 6) + 1}`}
            onClick={() => navigate(`/bank/${cat.id}`)}
          >
            <div className="category-card-main">
              <div className="category-card-icon">
                {getCategoryIcon(cat.icon, 40)}
              </div>
              <div>
                <strong>{cat.name}</strong>
                <p>{cat.description}</p>
              </div>
            </div>

            <div className="category-card-footer">
              <span>浏览题库</span>
              <ArrowRightOutlined />
            </div>
          </button>
        </Col>
      ))}
    </Row>
  )
}
