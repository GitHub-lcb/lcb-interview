import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, InputNumber, Progress, Row, Segmented, Space, Statistic, Tag,
} from 'antd'
import { ExperimentOutlined } from '@ant-design/icons'
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

const WINDOW_OPTIONS = [10, 50, 100, 200, 500, 1000]

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

function parseHitDistribution(value: string | undefined, evaluatedCount: number) {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as Record<string, number>
    const total = evaluatedCount || Object.values(parsed).reduce((sum, count) => sum + count, 0)
    return Object.entries(parsed)
      .map(([hits, count]) => ({
        hits: Number(hits),
        count,
        rate: total > 0 ? (count * 100) / total : 0,
      }))
      .sort((left, right) => left.hits - right.hits)
  } catch {
    return []
  }
}

const TYPE_LABELS: Record<string, string> = {
  KL8: '快乐8 选4×2组',
  SSQ: '双色球 7+1',
  DLT: '大乐透 5+3',
}

// 双色球奖级标签：0未中奖 1六 2五 3四 4三 5二 6一
const SSQ_TIER_LABELS: Record<number, string> = {
  0: '未中奖',
  1: '六等奖',
  2: '五等奖',
  3: '四等奖',
  4: '三等奖',
  5: '二等奖',
  6: '一等奖',
}

// 大乐透奖级标签：0未中奖 1七 2六 3五 4四 5三 6二 7一
const DLT_TIER_LABELS: Record<number, string> = {
  0: '未中奖',
  1: '七等奖',
  2: '六等奖',
  3: '五等奖',
  4: '四等奖',
  5: '三等奖',
  6: '二等奖',
  7: '一等奖',
}

/** 命中/奖级分布项的展示文案：KL8 为命中个数，SSQ/DLT 为中奖奖级。 */
function tierLabel(type: string, key: number): string {
  if (type === 'SSQ') {
    return SSQ_TIER_LABELS[key] ?? `奖级${key}`
  }
  if (type === 'DLT') {
    return DLT_TIER_LABELS[key] ?? `奖级${key}`
  }
  return `中${key}个`
}

export default function SimulationPanel() {
  const [history, setHistory] = useState<LotterySimulation[]>([])
  const [current, setCurrent] = useState<LotterySimulation | null>(null)
  const [lotteryType, setLotteryType] = useState<string>('SSQ')
  const [windowSize, setWindowSize] = useState<number | null>(200)
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
  const hitDistribution = useMemo(
    () => parseHitDistribution(latest?.hitDistribution, latest?.evaluatedCount ?? 0),
    [latest],
  )
  const hitRateLabel = latest?.lotteryType === 'KL8' ? '中2个及以上' : '中奖率'

  const handleRun = async () => {
    const safeWindow = Math.max(10, Math.min(1000, windowSize ?? 100))
    setWindowSize(safeWindow)
    setRunning(true)
    try {
      const result = await runLotterySimulation(lotteryType, safeWindow)
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
            <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>模拟最近期数（10-1000；每一步使用与每日推荐相同的最近 100 期）</div>
            <Space wrap size={8}>
              <Space.Compact>
                <InputNumber
                  min={10}
                  max={1000}
                  value={windowSize}
                  onChange={value => setWindowSize(value)}
                />
                <Button disabled>期</Button>
              </Space.Compact>
              {WINDOW_OPTIONS.map(size => (
                <Button
                  key={size}
                  size="small"
                  type={windowSize === size ? 'primary' : 'default'}
                  onClick={() => setWindowSize(size)}
                >
                  {size}期
                </Button>
              ))}
            </Space>
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
              <Statistic title={`${hitRateLabel}比例`} value={latest.hitRate} suffix="%" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="单期最高命中" value={latest.maxHits} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title={latest.lotteryType === 'KL8' ? '全不中期数' : '未中奖期数'} value={latest.zeroHitCount} valueStyle={{ color: latest.zeroHitCount > 0 ? '#DC2626' : undefined }} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title={latest.lotteryType === 'KL8' ? '两组平均总命中' : latest.lotteryType === 'SSQ' ? '蓝球平均命中' : '后区平均命中'}
                value={latest.secondaryAvg}
                precision={2}
              />
            </Col>
            {latest.lotteryType === 'KL8' && (
              <Col xs={12} md={6}>
                <Statistic title="中4个期数" value={latest.hit4Count} suffix="期" />
              </Col>
            )}
          </Row>
          <div style={{ marginTop: 12 }}>
            <Progress percent={Math.min(100, latest.hitRate)} format={() => `${latest.hitRate}%`} strokeColor="#0F8A8F" />
            <span style={{ color: '#586069', fontSize: 12 }}>{hitRateLabel}比例</span>
          </div>
          <div className="simulation-hit-distribution" aria-label="命中数分布">
            <div className="simulation-hit-distribution-title">{latest.lotteryType === 'KL8' ? '命中数分布' : '奖级分布'}</div>
            <div className="simulation-hit-distribution-grid">
              {hitDistribution.map(item => (
                <div className="simulation-hit-distribution-item" key={item.hits}>
                  <strong>{tierLabel(latest.lotteryType, item.hits)}</strong>
                  <span>{item.count}期</span>
                  <em>{item.rate.toFixed(1)}%</em>
                </div>
              ))}
            </div>
          </div>
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="不同窗口请比较概率，不要只看中4的绝对期数"
            description="100期只代表最近一段历史，500期覆盖更长周期，低表现阶段会稀释概率。模拟与每日推荐共用同一个预测内核，每一步都只传入此前最近100期，因此不会读取未来开奖。"
          />
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
                  {item.evaluatedCount} 期结算 · {item.lotteryType === 'KL8' ? '命中率' : '中奖率'} {item.hitRate}% · 最高 {item.maxHits} 个
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
