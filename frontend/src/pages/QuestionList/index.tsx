import { useEffect, useState } from 'react'
import { Select, Pagination, Skeleton, Empty, Alert, Button } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getQuestions } from '../../api/question'
import { getCategoryById } from '../../api/category'
import type { Question, Category } from '../../types'

const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }

export default function QuestionList() {
  const { id } = useParams()
  const [category, setCategory] = useState<Category | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState<string>()
  const navigate = useNavigate()

  const fetch = () => {
    if (!id) return
    setLoading(true)
    setError(false)
    Promise.all([
      getCategoryById(Number(id)).then(setCategory).catch(() => {}),
      getQuestions({ category: Number(id), difficulty, page: page - 1, size: 20 })
        .then(res => {
          setQuestions(res.content)
          setTotal(res.total)
        }),
    ]).catch(() => { setError(true) }).finally(() => setLoading(false))
  }

  useEffect(() => { fetch() }, [id, difficulty, page])

  if (error) return (
    <Alert type="error" message="加载失败" showIcon
      action={<Button onClick={fetch} size="small">重试</Button>}
    />
  )

  return (
    <div>
      <button
        onClick={() => navigate('/banks')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
          padding: '6px 14px',
          borderRadius: 8,
          border: 'none',
          background: '#F4F4F5',
          color: '#52525B',
          fontSize: 13,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        <ArrowLeftOutlined />
        全部题库
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 className="section-title" style={{ fontSize: 22, margin: 0 }}>
            {category?.name || '题目列表'}
          </h1>
          <p className="section-subtitle" style={{ margin: '2px 0 0 0' }}>共 {total} 道题目</p>
        </div>
        <Select
          placeholder="难度"
          allowClear
          size="small"
          style={{ width: 100 }}
          onChange={(v) => { setDifficulty(v); setPage(1) }}
          options={[
            { value: 'EASY', label: '简单' },
            { value: 'MEDIUM', label: '中等' },
            { value: 'HARD', label: '困难' },
          ]}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="magazine-card" style={{ padding: 16 }}>
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <Empty description="该分类暂无题目" />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {questions.map((q) => (
              <div
                key={q.id}
                className="magazine-card"
                onClick={() => navigate(`/question/${q.id}`)}
                style={{ padding: '14px 18px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 15, fontWeight: 500, color: '#18181B', lineHeight: 1.4 }}>
                  {q.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>
                    {difficultyLabels[q.difficulty] || q.difficulty}
                  </span>
                  {q.tags?.map(t => (
                    <span key={t} style={{
                      fontSize: 11, color: '#71717A', background: '#F4F4F5',
                      padding: '2px 6px', borderRadius: 4,
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <Pagination
              current={page}
              total={total}
              pageSize={20}
              onChange={p => setPage(p)}
              showSizeChanger={false}
              hideOnSinglePage
              showTotal={t => `共 ${t} 条`}
            />
          </div>
        </>
      )}
    </div>
  )
}
