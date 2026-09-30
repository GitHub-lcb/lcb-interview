import { useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, InputNumber, Row, Segmented, Space, Statistic, Table, Tag, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ExperimentOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { runKl8Lab } from '../api/tools'
import { emitFeedbackSuccess } from '../utils/feedbackMessage'
import type { LotteryKl8LabPortfolioRow, LotteryKl8LabReport, LotteryKl8LabVariant } from '../types'

const WINDOW_OPTIONS = [60, 100, 200]
/** 注数上限 20 = 80 / 选4，即互不重复时能覆盖全部号码的上限 */
const TICKET_OPTIONS = [2, 3, 5, 10, 20]

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

/**
 * 判定徽标：显著高于/低于基线的配置才值得关注，其余都落在随机噪声范围内。
 */
function VerdictTag({ variant }: { variant: LotteryKl8LabVariant }) {
  if (variant.verdict === '显著高于基线') {
    return <Tag color="green">{variant.verdict}</Tag>
  }
  if (variant.verdict === '显著低于基线') {
    return <Tag color="red">{variant.verdict}</Tag>
  }
  return <Tag>{variant.verdict}</Tag>
}

export default function LotteryKl8LabPanel() {
  const [report, setReport] = useState<LotteryKl8LabReport | null>(null)
  const [windowSize, setWindowSize] = useState<number>(100)
  const [maxTicketCount, setMaxTicketCount] = useState<number>(3)
  const [baseIssueCount, setBaseIssueCount] = useState<number>(2000)
  const [running, setRunning] = useState(false)

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await runKl8Lab({
        baseIssueCount: Math.max(20, Math.min(2000, baseIssueCount)),
        windowSize: Math.max(10, Math.min(300, windowSize)),
        maxTicketCount: Math.max(1, Math.min(20, maxTicketCount)),
      })
      setReport(result)
      emitFeedbackSuccess('概率实验完成，结论已更新')
    } catch {
      // 全局拦截器已提示，这里兜住 Promise 避免未捕获异常
    } finally {
      setRunning(false)
    }
  }

  const variantColumns: ColumnsType<LotteryKl8LabVariant> = [
    {
      title: '选号配置',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, record) => (
        <Space size={4}>
          <strong>{label}</strong>
          {record.selected && <Tag color="cyan">当前生产配置</Tag>}
        </Space>
      ),
    },
    { title: '样本期数', dataIndex: 'evaluatedIssueCount', key: 'evaluatedIssueCount', align: 'right' },
    {
      title: '平均命中',
      dataIndex: 'averageHitCount',
      key: 'averageHitCount',
      align: 'right',
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '中2个及以上',
      dataIndex: 'atLeastThreeRate',
      key: 'atLeastThreeRate',
      align: 'right',
      render: (value: number) => <strong>{percent(value)}</strong>,
    },
    {
      title: '95% 置信区间',
      key: 'ci',
      align: 'right',
      render: (_, record) => `${percent(record.ciLow)} ~ ${percent(record.ciHigh)}`,
    },
    {
      title: '相对基线',
      dataIndex: 'lift',
      key: 'lift',
      align: 'right',
      render: (value: number, record) => (
        <Tooltip title={`z = ${record.zScore.toFixed(2)}`}>
          <span style={{ color: value > 0 ? '#0F8A8F' : value < 0 ? '#DC2626' : undefined }}>
            {signedPercent(value)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '判定',
      key: 'verdict',
      render: (_, record) => <VerdictTag variant={record} />,
    },
  ]

  const portfolioColumns: ColumnsType<LotteryKl8LabPortfolioRow> = [
    {
      title: '每期注数',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      render: (value: number) => `${value} 注`,
    },
    {
      title: '号码不重复拆分',
      dataIndex: 'disjointRate',
      key: 'disjointRate',
      align: 'right',
      render: (value: number, record) => (
        <Tooltip title={`95% 区间 ${percent(record.disjointCiLow)} ~ ${percent(record.disjointCiHigh)}`}>
          <strong>{percent(value)}</strong>
        </Tooltip>
      ),
    },
    {
      title: '重复买同一注',
      dataIndex: 'repeatedRate',
      key: 'repeatedRate',
      align: 'right',
      render: (value: number) => percent(value),
    },
    {
      title: '不重复带来的提升',
      dataIndex: 'liftOverRepeated',
      key: 'liftOverRepeated',
      align: 'right',
      render: (value: number) => (
        <span style={{ color: value > 0 ? '#0F8A8F' : undefined }}>{signedPercent(value)}</span>
      ),
    },
    {
      title: '相对单注提升',
      dataIndex: 'liftOverSingle',
      key: 'liftOverSingle',
      align: 'right',
      render: (value: number) => signedPercent(value),
    },
  ]

  return (
    <section className="tool-section lottery-tool" aria-label="概率实验室">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">概率实验室 · 快乐8选4</div>
          <h2>用战场数据检验「概率能不能提升」</h2>
          <p>同一段历史、同一套选号函数，只改权重配置做走查前推对比，并同时回放多注投注方案。</p>
        </div>
        <div className="tool-actions">
          <Button type="primary" icon={<ExperimentOutlined />} loading={running} onClick={handleRun}>
            运行概率实验
          </Button>
        </div>
      </div>

      <Alert
        className="lottery-disclaimer"
        type="info"
        showIcon
        message="先看清数学边界：单注概率是常量，能提升的是「多注至少中一注」"
        description="快乐8 每期从 80 个号里开出 20 个，任意固定 4 号码组合的命中数服从超几何分布，期望命中恒为 1.00 个，中 2 个及以上的概率恒为 25.89%。所以任何选号策略都无法提高单注概率；实验室真正能做的是：用置信区间判断某个配置的「提升」是不是噪声，以及量化多注不重复带来的真实概率提升。"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>权重寻优基准期数（走查前推最多评估最近 180 期）</div>
            <Space.Compact>
              <InputNumber
                min={20}
                max={2000}
                value={baseIssueCount}
                onChange={value => setBaseIssueCount(value ?? 2000)}
              />
              <Button disabled>期</Button>
            </Space.Compact>
          </div>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>投注组合回放期数</div>
            <Segmented
              options={WINDOW_OPTIONS.map(size => ({ label: `${size} 期`, value: size }))}
              value={windowSize}
              onChange={value => setWindowSize(Number(value))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>最大投注注数</div>
            <Segmented
              options={TICKET_OPTIONS.map(count => ({ label: `${count} 注`, value: count }))}
              value={maxTicketCount}
              onChange={value => setMaxTicketCount(Number(value))}
            />
          </div>
        </Space>
      </Card>

      {!report ? (
        <div className="tool-empty-panel lottery-empty-panel">
          <Empty description="还没有实验数据">
            <Button type="primary" ghost icon={<ExperimentOutlined />} onClick={handleRun}>
              运行第一次概率实验
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <Card size="small" title={`理论基线（选${report.pickSize}）`} style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic title="期望命中" value={report.baselineExpectedHits} precision={2} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="中2个及以上概率" value={report.baselineAtLeastThreeRate * 100} precision={2} suffix="%" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="中4个及以上概率" value={report.baselineAtLeastFourRate * 100} precision={2} suffix="%" />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="中4个概率" value={report.baselineFullHitRate * 100} precision={3} suffix="%" />
              </Col>
            </Row>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message={`要确认「中2个及以上提升 1 个百分点」，需要约 ${report.requiredSampleSizeForOnePointLift} 期样本`}
              description="快乐8 每天一期，这个样本量相当于十几年。这解释了为什么历史上看到的「命中率提升」几乎都落在噪声范围内：真实优势为零时，再多的策略调参也只会得到上下抖动的曲线。"
            />
          </Card>

          <Card
            size="small"
            title={(
              <Space>
                <span>选号配置寻优</span>
                <Tooltip title="每个配置在同一批历史、同一套选号函数下走查前推，差异可归因到权重本身">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            )}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              columns={variantColumns}
              dataSource={report.variants}
              locale={{ emptyText: '样本不足，请先同步更多开奖数据' }}
            />
          </Card>

          <Card
            size="small"
            title={(
              <Space>
                <span>投注组合实验</span>
                <Tooltip title="第 1 注用当日生产推荐，其余注从候选排名里取不重复号码；重复买同一注的达成率与单注相同">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            )}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="ticketCount"
              size="small"
              pagination={false}
              columns={portfolioColumns}
              dataSource={report.portfolios}
              locale={{ emptyText: '回放样本不足，请先同步更多开奖数据' }}
            />
          </Card>

          <Alert type="success" showIcon message="实验结论" description={report.conclusion} />
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message={report.disclaimer}
            description={`本次权重寻优评估 ${report.evaluatedIssueCount} 期，投注组合回放 ${report.portfolios[0]?.evaluatedIssueCount ?? 0} 期。`}
          />
        </>
      )}
    </section>
  )
}
