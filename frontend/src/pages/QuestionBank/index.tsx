import { useEffect, useState } from 'react'
import { Card, Row, Col, Skeleton, Empty, Alert, Button } from 'antd'
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

  if (loading) return <Row gutter={[16, 16]}>{Array.from({ length: 4 }).map((_, i) => (
    <Col xs={24} sm={12} md={8} key={i}>
      <Card><Skeleton active /></Card>
    </Col>
  ))}</Row>

  if (error) return <Alert type="error" message="分类加载失败" action={<Button onClick={fetch}>重试</Button>} />

  if (categories.length === 0) return <Empty description="暂无分类" />

  return (
    <Row gutter={[16, 16]}>
      {categories.map(cat => (
        <Col xs={24} sm={12} md={8} key={cat.id}>
          <Card hoverable onClick={() => navigate(`/bank/${cat.id}`)}>
            <Card.Meta avatar={getCategoryIcon(cat.icon)} title={cat.name} description={cat.description} />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
