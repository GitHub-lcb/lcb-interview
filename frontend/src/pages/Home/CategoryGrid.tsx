import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import type { Category } from '../../types'

export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCategories().then(data => {
      setCategories(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spin />

  return (
    <Row gutter={[16, 16]}>
      {categories.map(cat => (
        <Col xs={24} sm={12} md={8} lg={6} key={cat.id}>
          <Card hoverable onClick={() => navigate(`/bank/${cat.id}`)}>
            <Card.Meta
              avatar={<img src={cat.icon} alt="" style={{ width: 48, height: 48 }} />}
              title={cat.name}
              description={cat.description}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
