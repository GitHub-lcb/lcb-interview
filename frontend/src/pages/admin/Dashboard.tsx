import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { getAdminQualitySummary } from '../../api/admin'
import type { AdminCategoryQuality, AdminQualitySummary, AdminQualityTodo } from '../../types'
import { buildCategoryRiskBreakdown, draftRiskPath } from './qualityRisk'

const { Text, Title } = Typography

const metricCardStyle: React.CSSProperties = {
  minHeight: 138,
}

const compactMetaStyle: React.CSSProperties = {
  color: '#71717A',
  fontSize: 12,
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AdminQualitySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    getAdminQualitySummary({ silentGlobalError: true })
      .then(setSummary)
      .catch(() => {
        setError(true)
        setSummary(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const columns = useMemo<ColumnsType<AdminCategoryQuality>>(() => [
    {
      title: '分类',
      dataIndex: 'categoryName',
      width: 180,
      fixed: 'left',
      render: (value: string, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text style={compactMetaStyle}>{row.total} 题</Text>
        </Space>
      ),
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      width: 160,
      render: (value: number) => (
        <Progress
          percent={value}
          size="small"
          strokeColor={value < 70 ? '#DC2626' : value < 90 ? '#D97706' : '#16A34A'}
        />
      ),
    },
    {
      title: '风险分',
      dataIndex: 'riskScore',
      width: 90,
      sorter: (a, b) => a.riskScore - b.riskScore,
      render: (value: number) => <Tag color={value > 50 ? 'error' : value > 20 ? 'warning' : 'default'}>{value}</Tag>,
    },
    {
      title: '发布/草稿',
      width: 120,
      render: (_, row) => (
        <Space split={<Text type="secondary">/</Text>}>
          <Text>{row.published}</Text>
          <Text type={row.draft > 0 ? 'warning' : 'secondary'}>{row.draft}</Text>
        </Space>
      ),
    },
    {
      title: '空答案',
      dataIndex: 'emptyAnswer',
      width: 90,
      render: (value: number) => value > 0 ? <Tag color="error">{value}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: '短答案',
      dataIndex: 'shortAnswer',
      width: 90,
      render: (value: number) => value > 0 ? <Tag color="warning">{value}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: '首要处理',
      width: 150,
      render: (_, row) => {
        const primaryRisk = buildCategoryRiskBreakdown(row)[0]
        if (!primaryRisk) {
          return <Tag color="success">质量稳定</Tag>
        }
        return (
          <Space direction="vertical" size={2}>
            <Text style={compactMetaStyle}>首要缺口</Text>
            <Button
              size="small"
              onClick={() => navigate(draftRiskPath(row, primaryRisk.riskType))}
            >
              处理{primaryRisk.label}
            </Button>
          </Space>
        )
      },
    },
    {
      title: '风险拆解',
      width: 300,
      render: (_, row) => (
        <Space wrap size={[4, 4]}>
          {renderRiskTags(row)}
        </Space>
      ),
    },
  ], [navigate])

  const topCategories = summary?.categories.slice(0, 8) || []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <Title level={3} style={{ margin: 0, letterSpacing: 0 }}>运营总览</Title>
          <Text type="secondary">题库质量、审核压力、内容缺口</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>刷新</Button>
      </div>

      {error && (
        <Alert type="error" showIcon message="质量总览加载失败" action={<Button size="small" onClick={load}>重试</Button>} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading && !summary} style={metricCardStyle}>
            <Statistic
              title="题目总数"
              value={summary?.totalQuestions || 0}
              prefix={<DatabaseOutlined />}
            />
            <Text style={compactMetaStyle}>已发布 {summary?.publishedQuestions || 0}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading && !summary} style={metricCardStyle}>
            <Statistic
              title="质量风险"
              value={summary?.qualityRiskQuestions || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: (summary?.qualityRiskQuestions || 0) > 0 ? '#DC2626' : '#16A34A' }}
            />
            <Text style={compactMetaStyle}>空答案 {summary?.emptyAnswerQuestions || 0}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading && !summary} style={metricCardStyle}>
            <Statistic
              title="草稿待审"
              value={summary?.draftQuestions || 0}
              prefix={<FileSearchOutlined />}
            />
            <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => navigate('/admin/draft-review')}>
              进入审核
            </Button>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading && !summary} style={metricCardStyle}>
            <Statistic
              title="完成率"
              value={summary?.completionRate || 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: (summary?.completionRate || 0) >= 90 ? '#16A34A' : '#D97706' }}
            />
            <Text style={compactMetaStyle}>驳回 {summary?.rejectedQuestions || 0}</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card
            title="质量待办"
            extra={<Tag color={summary?.todos?.length ? 'processing' : 'success'}>{summary?.todos?.length || 0}</Tag>}
            styles={{ body: { paddingBlock: 8 } }}
          >
            <List
              loading={loading && !summary}
              dataSource={summary?.todos || []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待办" /> }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="action"
                      size="small"
                      type={item.tone === 'danger' ? 'primary' : 'default'}
                      danger={item.tone === 'danger'}
                      onClick={() => navigate(todoPath(item))}
                    >
                      处理
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<AlertOutlined style={{ color: todoColor(item), fontSize: 18, marginTop: 4 }} />}
                    title={(
                      <Space>
                        <Text strong>{item.title}</Text>
                        <Tag color={todoTagColor(item)}>{item.count} 项</Tag>
                      </Space>
                    )}
                    description={<Text type="secondary">{item.detail}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={16}>
          <Card title="分类风险排行" styles={{ body: { padding: 0 } }}>
            <Table
              rowKey={(row) => String(row.categoryId ?? row.categoryName)}
              columns={columns}
              dataSource={topCategories}
              loading={loading && !summary}
              pagination={false}
              size="middle"
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  )
}

function renderRiskTags(row: AdminCategoryQuality) {
  const risks = buildCategoryRiskBreakdown(row)
  if (risks.length === 0) {
    return <Tag color="success">无结构风险</Tag>
  }
  return risks.slice(0, 8).map(risk => (
    <Tag key={risk.riskType} color={risk.tone}>{risk.label} {risk.value}</Tag>
  ))
}

function todoTagColor(todo: AdminQualityTodo) {
  if (todo.tone === 'danger') {
    return 'error'
  }
  if (todo.tone === 'warning') {
    return 'warning'
  }
  if (todo.tone === 'success') {
    return 'success'
  }
  return 'default'
}

function todoColor(todo: AdminQualityTodo) {
  if (todo.tone === 'danger') {
    return '#DC2626'
  }
  if (todo.tone === 'warning') {
    return '#D97706'
  }
  if (todo.tone === 'success') {
    return '#16A34A'
  }
  return '#2563EB'
}

function todoPath(todo: AdminQualityTodo) {
  if (todo.type === 'QUALITY_HEALTHY') {
    return '/admin/ai-generate'
  }
  if (todo.type === 'EMPTY_ANSWER') {
    return '/admin/draft-review?risk=EMPTY_ANSWER'
  }
  if (todo.type === 'QUALITY_RISK' && todo.categoryId) {
    return `/admin/draft-review?categoryId=${todo.categoryId}`
  }
  return '/admin/draft-review'
}
