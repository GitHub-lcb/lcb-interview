import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Tag, Typography, Button, Alert } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getQuestionById } from '../../api/question'
import ContentView from './ContentView'
import Skeleton from './Skeleton'
import type { Question } from '../../types'

const { Title } = Typography

export default function QuestionDetail() {
  const { id } = useParams()
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
    <Card>
      <Alert
        type="error"
        message="题目加载失败"
        description="请检查网络连接后重试"
        action={<Button onClick={fetchQuestion}>重试</Button>}
      />
    </Card>
  )
  if (!q) return (
    <Card>
      <Alert type="warning" message="题目不存在" showIcon />
    </Card>
  )

  const diffColor: Record<string, string> = { EASY: 'green', MEDIUM: 'orange', HARD: 'red' }

  return (
    <Card>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}
              style={{ padding: 0, marginBottom: 8 }} />
      <Title level={4}>{q.title}</Title>
      <div style={{ marginBottom: 16 }}>
        <Tag>{q.categoryName}</Tag>
        <Tag color={diffColor[q.difficulty] || 'default'}>{q.difficulty}</Tag>
        {q.tags?.map(t => <Tag key={t}>{t}</Tag>)}
        <span style={{ marginLeft: 8, color: '#999' }}>浏览 {q.viewCount} 次</span>
      </div>
      <ContentView question={q} />
    </Card>
  )
}
