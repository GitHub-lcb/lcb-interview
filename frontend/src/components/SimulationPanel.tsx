import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, Progress, Row, Segmented, Space, Statistic, Tag,
} from 'antd'
import { ExperimentOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  listLotterySimulations, runLotterySimulation,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { LotterySimulation } from '../types'

const DISCLAIMER = '模拟战场用历史开奖数据回放预测算法，统计结果不代表未来命中，仅供参考。'

const TYPE_OPTIONS = [
  { label: '快乐8 选4×2组', value: 'KL8' },
  { label: '双色球 7+1', value: 'SSQ' },
  { label: '大乐透 5+3', value: 'DLT' },
]

const WINDOW_OPTIONS = [100, 200, 500, 1000]

function formatDateTime(value?: string): string {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const TYPE_LABELS: Record<string, string> = {
  KL8: '快乐8 选4×2组',
  SSQ: '双色球 7+1',
  DLT: '大乐透 5+3',
}

export default function SimulationPanel() {
  const [history, setHistory] = useState<LotterySimulation[]>([])
  const [current, setCurrent] = useState<LotterySimulation | null>(null)
  const [lotteryType, setLotteryType] = useState<string>('SSQ')
  const [windowSize, setWindowSize] = useState<number>(200)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const page = await listLotterySimulations(0, 20)
      setHistory(page.content)
    } catch {
      // 全局拦截器已提示，这里兜住 Promise
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])

  const handleRun = async () => {
    setRunning(true)
    try {
      const result = await runLotterySimulation(lotteryType, windowSize)
      setCurrent(result)
      await load()
      emitFeedbackSuccess(`模拟完成：${result.summary}`)
    } catch {
      // 模拟失败时保留按钮状态恢复，错误反馈交给全局请求拦截器。
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label="模拟战场">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">模拟战场</div>
          <h2>预测算法历史回放</h2>
          <p>选择玩法与最近期数，假设这些期还没开，逐期预测并结算，统计预测算法的真实命中表现。</p>
        </div>
        <div className="tool-actions">
          <Button type="primary" icon={<ExperimentOutlined />} loading={running} onClick={handleRun}>
            开始模拟
          </Button>
        </div>
      </div>

      <Alert className="lottery-disclaimer" type="info" showIcon message={DISCLAIMER} />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>模拟玩法</div>
            <Segmented
              options={TYPE_OPTIONS}
              value={lotteryType}
              onChange={value => setLotteryType(String(value))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>模拟最近期数（每期用前置 50 期历史预测）</div>
            <Segmented
              options={WINDOW_OPTIONS.map(size => ({ label: `${size} 期`, value: String(size) }))}
              value={String(windowSize)}
              onChange={value => setWindowSize(Number(value))}
            />
          </div>
        </Space>
      </Card>

      {latest && (
        <Card
          size="small"
          title={<Space><Tag color="cyan">{TYPE_LABELS[latest.lotteryType] ?? latest.lotteryType}</Tag><span>最近 {latest.windowSize} 期回放</span></Space>}
          style={{ marginBottom: 16 }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title="结算期数" value={latest.evaluatedCount} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="平均命中" value={latest.avgHits} precision={2} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="至少命中 1 个" value={latest.hitRate} suffix="%" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="单期最高命中" value={latest.maxHits} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="全不中期数" value={latest.zeroHitCount} valueStyle={{ color: latest.zeroHitCount > 0 ? '#DC2626' : undefined }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title={latest.lotteryType === 'KL8' ? '两组平均总命中' : latest.lotteryType === 'SSQ' ? '蓝球平均命中' : '后区平均命中'}
                value={latest.secondaryAvg}
                precision={2}
              />
            </Col>
          </Row>
          <div style={{ marginTop: 12 }}>
            <Progress percent={Math.min(100, latest.hitRate)} format={() => `${latest.hitRate}%`} strokeColor="#0F8A8F" />
            <span style={{ color: '#586069', fontSize: 12 }}>至少命中 1 个的比例</span>
          </div>
          <Alert type="success" showIcon style={{ marginTop: 12 }} message={latest.summary} />
        </Card>
      )}

      <div className="lottery-side-column" style={{ maxWidth: '100%' }}>
        <section>
          <h3>模拟历史</h3>
          <div className="lottery-history-list">
            {history.map(item => (
              <button key={item.id} type="button" onClick={() => setCurrent(item)}>
                <strong>
                  {TYPE_LABELS[item.lotteryType] ?? item.lotteryType} · {item.windowSize} 期
                  <Tag color="green" style={{ marginLeft: 8 }}>平均 {item.avgHits}</Tag>
                </strong>
                <small>{item.startIssueNo} ~ {item.endIssueNo} · {formatDateTime(item.createdAt)}</small>
                <span style={{ display: 'block', color: '#586069', fontSize: 12, marginTop: 4 }}>
                  {item.evaluatedCount} 期结算 · 命中率 {item.hitRate}% · 最高 {item.maxHits} 个
                </span>
              </button>
            ))}
            {history.length === 0 && <p>暂无模拟记录，选择参数后点击开始模拟。</p>}
          </div>
        </section>
      </div>
    </section>
  )
}
