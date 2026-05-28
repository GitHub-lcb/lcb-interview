import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { List, Spin, Typography, Empty, Alert, Button } from 'antd'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

const { Title } = Typography

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
      <Title level={4}>搜索：{keyword}</Title>
      {loading && <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />}
      {error && <Alert type="error" message="搜索失败" action={<Button onClick={doSearch}>重试</Button>} />}
      {!loading && !error && questions.length === 0 && (
        <Empty description={`未找到与"${keyword}"相关的题目`}>
          <Button onClick={() => navigate('/banks')}>浏览全部题目</Button>
        </Empty>
      )}
      {!loading && !error && questions.length > 0 && (
        <List
          dataSource={questions}
          renderItem={q => (
            <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta title={q.title} description={q.categoryName} />
            </List.Item>
          )}
        />
      )}
    </div>
  )
}
