import { useEffect, useState } from 'react'
import { List, Tag, Select, Space, Spin, Pagination } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function QuestionList() {
  const { id } = useParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState<string>()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getQuestions({ category: Number(id), difficulty, page: page - 1, size: 20 }).then(res => {
      setQuestions(res.content)
      setTotal(res.total)
      setLoading(false)
    })
  }, [id, difficulty, page])

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 120 }}
          onChange={(v) => { setDifficulty(v); setPage(1) }}
          options={[
            { value: 'EASY', label: '简单' },
            { value: 'MEDIUM', label: '中等' },
            { value: 'HARD', label: '困难' },
          ]}
        />
      </Space>
      <Spin spinning={loading}>
        <List
          dataSource={questions}
          renderItem={q => (
            <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta
                title={q.title}
                description={
                  <>
                    <Tag color={q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red'}>
                      {q.difficulty === 'EASY' ? '简单' : q.difficulty === 'MEDIUM' ? '中等' : '困难'}
                    </Tag>
                    {q.tags.map(t => <Tag key={t}>{t}</Tag>)}
                    <span style={{ marginLeft: 8 }}>👁 {q.viewCount}</span>
                  </>
                }
              />
            </List.Item>
          )}
        />
        <Pagination
          current={page}
          total={total}
          pageSize={20}
          onChange={p => setPage(p)}
          showTotal={t => `共 ${t} 条`}
        />
      </Spin>
    </div>
  )
}
