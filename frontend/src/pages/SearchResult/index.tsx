import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { List, Spin, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

const { Title } = Typography

export default function SearchResult() {
  const [searchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!keyword) return
    setLoading(true)
    getQuestions({ keyword, page: 0, size: 20 }).then(res => {
      setQuestions(res.content)
      setLoading(false)
    })
  }, [keyword])

  return (
    <div>
      <Title level={4}>搜索：{keyword}</Title>
      <Spin spinning={loading}>
        <List
          dataSource={questions}
          renderItem={q => (
            <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta title={q.title} description={q.categoryName} />
            </List.Item>
          )}
          locale={{ emptyText: '未找到相关题目' }}
        />
      </Spin>
    </div>
  )
}
