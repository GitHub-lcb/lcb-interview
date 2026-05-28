import { useEffect, useState } from 'react'
import { List, Spin, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getHotQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function HotQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getHotQuestions(10).then(res => {
      setQuestions(res.content)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spin />

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
