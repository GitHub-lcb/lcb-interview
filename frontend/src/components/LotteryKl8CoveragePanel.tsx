import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, InputNumber, Row, Segmented, Space, Statistic, Table, Tag, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { CalculatorOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { getKl8Coverage } from '../api/tools'
import { emitFeedbackSuccess } from '../utils/feedbackMessage'
import type { LotteryKl8CoverageCurveRow, LotteryKl8CoverageReport, LotteryKl8CoverageTargetRow } from '../types'

/** 达标口径：选4 首个有奖级别为「中 2 个」 */
const MIN_HIT_OPTIONS = [
  { label: '中2个及以上', value: 2 },
  { label: '中3个及以上', value: 3 },
  { label: '全中4个', value: 4 },
]

const BUDGET_OPTIONS = [0, 10, 20, 50, 100]

/**
 * 概率格式化。
 *
 * 概率接近饱和时（20 注覆盖全部 80 个号时为 99.99997%），
 * 固定两位小数会直接显示成 100%，把「仍未达到必然」这个关键事实抹掉。
 * 因此越接近 100% 就展示越多小数位。
 */
function percent(value: number): string {
  const scaled = value * 100
  if (scaled >= 99.99) {
    return `${scaled.toFixed(5)}%`
  }
  if (scaled >= 99.9) {
    return `${scaled.toFixed(3)}%`
  }
  return `${scaled.toFixed(2)}%`
}

function yuan(value: number): string {
  return `${value.toFixed(0)} 元`
}

/**
 * 目标概率反查行：把「我想达到 X% 中奖率」翻译成注数与成本。
 */
function TargetTag({ value }: { value: string }) {
  const numeric = Number.parseFloat(value)
  return <Tag color="cyan">{percent(numeric)}</Tag>
}

export default function LotteryKl8CoveragePanel() {
  const [report, setReport] = useState<LotteryKl8CoverageReport | null>(null)
  const [minHitLevel, setMinHitLevel] = useState<number>(2)
  const [budget, setBudget] = useState<number>(20)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await getKl8Coverage({
          pickSize: 4,
          minHitLevel,
          maxTickets: 20,
          budgetYuan: budget,
        })
        if (!cancelled) {
          setReport(result)
        }
      } catch {
        // 全局拦截器已提示，这里兜住 Promise 避免未捕获异常
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [minHitLevel, budget])

  const curveColumns: ColumnsType<LotteryKl8CoverageCurveRow> = useMemo(() => [
    {
      title: '注数',
      dataIndex: 'ticketCount',
      key: 'ticketCount',
      render: (value: number, record) => (
        <Space size={4}>
          <strong>{value} 注</strong>
          {value === report?.bestValueTicketCount && <Tag color="green">性价比最高</Tag>}
          {budget > 0 && value === report?.budgetTicketCount && <Tag color="gold">预算内</Tag>}
        </Space>
      ),
    },
    {
      title: '覆盖号码',
      dataIndex: 'coveredNumbers',
      key: 'coveredNumbers',
      align: 'right',
      render: (value: number) => `${value} 个`,
    },
    {
      title: '成本',
      dataIndex: 'costYuan',
      key: 'costYuan',
      align: 'right',
      render: (value: number) => yuan(value),
    },
    {
      title: '至少一注达标',
      dataIndex: 'atLeastMinHitRate',
      key: 'atLeastMinHitRate',
      align: 'right',
      render: (value: number) => <strong style={{ color: '#0F8A8F' }}>{percent(value)}</strong>,
    },
    {
      title: '本注提升',
      dataIndex: 'marginalLift',
      key: 'marginalLift',
      align: 'right',
      render: (value: number, record) => (
        <Tooltip title={record.costPerPercentPoint > 0
          ? `每提升 1 个百分点概率约需 ${record.costPerPercentPoint.toFixed(1)} 元`
          : '首注无对比基准'}>
          <span style={{ color: value > 0 ? '#586069' : '#B8BFC7' }}>
            {value > 0 ? `+${(value * 100).toFixed(2)}pp` : '—'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '至少一注中3',
      dataIndex: 'atLeastThreeRate',
      key: 'atLeastThreeRate',
      align: 'right',
      render: (value: number) => percent(value),
    },
    {
      title: '至少一注全中',
      dataIndex: 'fullHitRate',
      key: 'fullHitRate',
      align: 'right',
      render: (value: number) => percent(value),
    },
    {
      title: '期望回报',
      dataIndex: 'expectedReturnYuan',
      key: 'expectedReturnYuan',
      align: 'right',
      render: (value: number, record) => (
        <Tooltip title={`返奖率 ${percent(record.payoutRate)}，与注数无关`}>
          <span style={{ color: '#DC2626' }}>
            {value.toFixed(2)} 元 <span style={{ fontSize: 12 }}>(亏 {(record.costYuan - value).toFixed(2)})</span>
          </span>
        </Tooltip>
      ),
    },
  ], [budget, report])

  const targetColumns: ColumnsType<LotteryKl8CoverageTargetRow> = [
    {
      title: '目标中奖率',
      dataIndex: 'targetRate',
      key: 'targetRate',
      render: (value: number) => <TargetTag value={String(value)} />,
    },
    {
      title: '需要注数',
      dataIndex: 'requiredTickets',
      key: 'requiredTickets',
      align: 'right',
      render: (value: number) => (value > 0 ? `${value} 注` : '无法达到'),
    },
    {
      title: '覆盖号码',
      dataIndex: 'coveredNumbers',
      key: 'coveredNumbers',
      align: 'right',
      render: (value: number) => `${value} 个`,
    },
    {
      title: '成本',
      dataIndex: 'costYuan',
      key: 'costYuan',
      align: 'right',
      render: (value: number) => yuan(value),
    },
    {
      title: '实际达到',
      dataIndex: 'achievedRate',
      key: 'achievedRate',
      align: 'right',
      render: (value: number) => <strong>{percent(value)}</strong>,
    },
    {
      title: '期望回报',
      dataIndex: 'expectedReturnYuan',
      key: 'expectedReturnYuan',
      align: 'right',
      render: (value: number) => <span style={{ color: '#DC2626' }}>{value.toFixed(2)} 元</span>,
    },
  ]

  return (
    <section className="tool-section lottery-tool" aria-label="覆盖优化">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">覆盖优化 · 快乐8选4</div>
          <h2>花多少钱，能买到多少中奖概率</h2>
          <p>选号策略改不动概率，只有注数能改。这条曲线是组合数学精确解，不是模拟估算。</p>
        </div>
        <div className="tool-actions">
          {loading ? <Button loading>计算中</Button> : <Button icon={<CalculatorOutlined />} disabled>精确解，无需等待</Button>}
        </div>
      </div>

      <Alert
        className="lottery-disclaimer"
        type="info"
        showIcon
        message="先认清唯一有效的杠杆：买更多互不重复的号"
        description="快乐8 每期从 80 个号里开出 20 个，单注「中 2 个及以上」的概率恒为 25.89%，是超几何分布决定的数学常量，任何选号策略都改不了。但「至少中一注」的概率只取决于覆盖了多少个互不重复的号码——2 注完全不重复是 45.78%，有 1 个重号就掉到 42.32%。所以在预算内买尽可能多互不重复的号，就是理论最优解。"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>达标口径（至少一注命中几个算中奖）</div>
            <Segmented
              options={MIN_HIT_OPTIONS}
              value={minHitLevel}
              onChange={value => setMinHitLevel(Number(value))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>预算上限</div>
            <Segmented
              options={BUDGET_OPTIONS.map(value => ({
                label: value === 0 ? '不设预算' : `${value} 元`,
                value,
              }))}
              value={budget}
              onChange={value => setBudget(Number(value))}
            />
          </div>
        </Space>
      </Card>

      {!report ? (
        <div className="tool-empty-panel lottery-empty-panel">
          <Empty description="正在计算精确解" />
        </div>
      ) : (
        <>
          <Card size="small" title="不变量：无论怎么买都改不了的数字" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic
                  title="单注中奖率"
                  value={report.singleTicketRate * 100}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: '#B8BFC7' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="返奖率"
                  value={report.payoutRate * 100}
                  precision={2}
                  suffix="%"
                  valueStyle={{ color: '#DC2626' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="单注期望回报"
                  value={report.expectedReturnPerTicket}
                  precision={3}
                  suffix="元"
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="单注期望亏损"
                  value={report.netLossPerTicketYuan}
                  precision={3}
                  suffix="元"
                  valueStyle={{ color: '#DC2626' }}
                />
              </Col>
            </Row>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="返奖率与注数无关，这是期望的线性性，不是近似"
              description="各注之间虽然相关，但期望可加：N 注的期望回报恒为 N 倍单注期望回报。所以加注只让亏损来得更快更均匀，长期亏损总额完全不变。任何声称「多买能提高收益率」的说法都是错的。"
            />
          </Card>

          <Card
            size="small"
            title={(
              <Space>
                <span>预算 → 概率曲线</span>
                <Tooltip title="每行都是组合数学精确解：给定注数，覆盖 4×注数 个互不重复号码后至少一注达标的概率">
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
              scroll={{ y: 420 }}
              columns={curveColumns}
              dataSource={report.curve}
            />
          </Card>

          <Card
            size="small"
            title="目标概率反查：想达到某个中奖率要花多少"
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="targetRate"
              size="small"
              pagination={false}
              columns={targetColumns}
              dataSource={report.targets}
            />
          </Card>

          {budget > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`预算 ${budget} 元 = ${report.budgetTicketCount} 注，可把中奖率提到 ${percent(report.budgetAchievableRate)}`}
              description={`这 ${report.budgetTicketCount} 注应覆盖 ${report.budgetTicketCount * report.pickSize} 个互不重复的号码。号码一旦重复，概率就会掉下来——同样的钱会买到更差的概率，这是覆盖优化唯一需要盯住的执行细节。`}
            />
          )}

          <Alert type="success" showIcon message="结论" description={report.conclusion} />
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            message={report.disclaimer}
            description={`在 80 个号码的池子里，最多 ${report.maxDisjointTickets} 注互不重复即覆盖全部号码，超过这个注数必然出现重号，只会拉低概率。`}
          />
        </>
      )}
    </section>
  )
}
