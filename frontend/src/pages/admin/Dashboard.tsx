import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col } from 'antd'
import { listDrafts } from '../../api/admin'

export default function AdminDashboard() {
  const [draftCount, setDraftCount] = useState(0)

  useEffect(() => {
    listDrafts(0, 1).then(res => setDraftCount(res.total)).catch(() => {})
  }, [])

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card><Statistic title="草稿题目" value={draftCount} /></Card>
      </Col>
    </Row>
  )
}
