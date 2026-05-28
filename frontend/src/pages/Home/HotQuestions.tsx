import { useEffect, useState } from 'react'
import { List, Tag, Skeleton, Empty, Alert, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getHotQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function HotQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const fetch = () => {
    setLoading(true)
    setError(false)
    getHotQuestions(10).then(res => {
      setQuestions(res.content)
      setLoading(false)
    }).catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetch() }, [])

  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />
  if (error) return <Alert type="error" message="加载失败" action={<Button onClick={fetch}>重试</Button>} />
  if (questions.length === 0) return <Empty description="暂无热门题目" />

  return (
    <List
      dataSource={questions}
      renderItem={(q, index) => (
        <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
          <List.Item.Meta
            title={<>{index + 1}. {q.title}</>}
            description={
              <>
                <Tag>{q.difficulty}</Tag>
                <Tag>{q.categoryName}</Tag>
                <span style={{ marginLeft: 8 }}>👁 {q.viewCount}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  )
}
