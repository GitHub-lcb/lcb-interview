import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Empty, List, Progress, Segmented, Skeleton, Space, Tag, Typography,
} from 'antd'
import { ArrowRightOutlined, FileTextOutlined, FireOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getCategories } from '../../api/category'
import { getHotKnowledgePoints, getKnowledgePointQuestions } from '../../api/knowledge'
import type { KnowledgePointVO } from '../../types'

const { Text, Title } = Typography

function scoreColor(score: number): string {
  if (score >= 80) return '#0F8A8F'
  if (score >= 50) return '#2E7D32'
  if (score >= 25) return '#D97706'
  return '#8A919B'
}

function HotPointList({ points }: { points: KnowledgePointVO[] }) {
  const navigate = useNavigate()
  if (points.length === 0) {
    return <Empty description="暂无考点数据，请先在管理后台运行考点管道" />
  }
  return (
    <List
      dataSource={points}
      renderItem={(point, index) => (
        <List.Item
          className="knowledge-point-row"
          style={{
            padding: '16px 18px',
            background: '#FFFFFF',
            border: '1px solid #D3D9DF',
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              fontSize: 15, fontWeight: 700,
              color: index < 3 ? '#FFFFFF' : '#1A1E23',
              background: index < 3 ? '#0F8A8F' : '#E9ECEF',
            }}>
              {index + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space size={8} wrap>
                <Text strong style={{ fontSize: 15 }}>{point.name}</Text>
                <Tag color="cyan" style={{ marginInlineEnd: 0 }}>{point.categoryName}</Tag>
              </Space>
              <div style={{ marginTop: 8, maxWidth: 520 }}>
                <Progress
                  percent={point.hotScore}
                  size="small"
                  strokeColor={scoreColor(point.hotScore)}
                  format={percent => <Text style={{ fontSize: 12, color: '#586069' }}>{percent}</Text>}
                />
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                提及 {point.mentionTotal} 次 / {point.docCount} 篇面经
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                关联 {point.questionCount} 题
              </Text>
            </div>
            <Button
              type="primary"
              ghost
              size="small"
              icon={<ArrowRightOutlined />}
              onClick={() => navigate(`/knowledge/${point.id}`)}
            >
              看题
            </Button>
          </div>
        </List.Item>
      )}
    />
  )
}

export default function Knowledge() {
  const { pointId } = useParams<{ pointId: string }>()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined)
  const [points, setPoints] = useState<KnowledgePointVO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [questions, setQuestions] = useState<{ id: number; title: string; categoryName: string }[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)

  useEffect(() => {
    getCategories({ silentGlobalError: true }).then(data => {
      setCategories(data.map(item => ({ id: item.id, name: item.name })))
    }).catch(() => { /* 分类加载失败不阻塞考点列表 */ })
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(false)
    getHotKnowledgePoints(categoryId, 100)
      .then(data => {
        setPoints(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [categoryId])

  useEffect(() => {
    if (!pointId) {
      setQuestions([])
      return
    }
    setQuestionsLoading(true)
    getKnowledgePointQuestions(Number(pointId), 0, 50)
      .then(data => {
        setQuestions(data.content)
        setQuestionsLoading(false)
      })
      .catch(() => {
        setQuestions([])
        setQuestionsLoading(false)
      })
  }, [pointId])

  const selectedPoint = useMemo(() => points.find(item => String(item.id) === pointId), [points, pointId])

  if (pointId && !questionsLoading) {
    return (
      <div className="bank-page">
        <div className="bank-hero">
          <div>
            <div className="dashboard-kicker">高频考点</div>
            <h1>{selectedPoint?.name ?? '考点题目'}</h1>
            <p>
              {selectedPoint
                ? `${selectedPoint.categoryName} · 权重 ${selectedPoint.hotScore} · ${selectedPoint.mentionTotal} 次提及`
                : '该考点关联的面试题目'}
            </p>
          </div>
        </div>
        <Space style={{ marginBottom: 14 }}>
          <Button onClick={() => navigate('/knowledge')}>返回考点排行</Button>
        </Space>
        <List
          loading={questionsLoading}
          dataSource={questions}
          locale={{ emptyText: <Empty description="该考点暂无已发布题目" /> }}
          renderItem={question => (
            <List.Item style={{ background: '#FFFFFF', border: '1px solid #D3D9DF', borderRadius: 10, marginBottom: 8, padding: '12px 16px' }}>
              <Space>
                <FileTextOutlined style={{ color: '#0F8A8F' }} />
                <Link to={`/question/${question.id}`}>
                  <Text strong style={{ fontSize: 14 }}>{question.title}</Text>
                </Link>
                <Tag color="cyan">{question.categoryName}</Tag>
              </Space>
            </List.Item>
          )}
        />
      </div>
    )
  }

  const options = [
    { label: '全部', value: 'ALL' },
    ...categories.map(item => ({ label: item.name, value: String(item.id) })),
  ]

  return (
    <div className="bank-page">
      <div className="bank-hero">
        <div>
          <div className="dashboard-kicker">高频考点</div>
          <h1><FireOutlined style={{ color: '#0F8A8F', marginRight: 8 }} />面试官最常问什么</h1>
          <p>基于真实面经语料统计的考点热度排行，帮你把有限时间花在最高频的问题上。</p>
        </div>
      </div>
      {error ? (
        <Alert type="error" showIcon message="考点排行加载失败" description="请稍后重试" style={{ marginBottom: 14 }} />
      ) : null}
      <Segmented
        options={options}
        value={categoryId === undefined ? 'ALL' : String(categoryId)}
        onChange={value => setCategoryId(value === 'ALL' ? undefined : Number(value))}
        style={{ marginBottom: 16 }}
      />
      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <HotPointList points={points} />
      )}
    </div>
  )
}
