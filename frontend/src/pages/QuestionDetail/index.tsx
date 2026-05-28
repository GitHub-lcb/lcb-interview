import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Spin, Collapse, Tag, Typography } from 'antd'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { getQuestionById } from '../../api/question'
import type { Question } from '../../types'

const { Title } = Typography

export default function QuestionDetail() {
  const { id } = useParams()
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getQuestionById(Number(id)).then(data => {
      setQ(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!q) return <div>题目不存在</div>

  return (
    <Card>
      <Title level={4}>{q.title}</Title>
      <div style={{ marginBottom: 16 }}>
        <Tag>{q.categoryName}</Tag>
        <Tag color={q.difficulty === 'EASY' ? 'green' : 'orange'}>{q.difficulty}</Tag>
        {q.tags.map(t => <Tag key={t}>{t}</Tag>)}
        <span style={{ marginLeft: 8, color: '#999' }}>浏览 {q.viewCount} 次</span>
      </div>
      <div style={{ marginBottom: 24 }}>
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {q.content}
        </Markdown>
      </div>
      <Collapse
        items={[{
          key: 'answer',
          label: '查看答案',
          children: (
            <div style={{ padding: 16, background: '#f6f8fa', borderRadius: 8 }}>
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {q.answer}
              </Markdown>
            </div>
          ),
        }]}
      />
    </Card>
  )
}
