import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Empty, InputNumber, Spin, Tabs, Tag,
} from 'antd'
import {
  AuditOutlined, BulbOutlined, CopyOutlined, HistoryOutlined, LineChartOutlined,
  ReloadOutlined, ThunderboltOutlined, WarningOutlined,
} from '@ant-design/icons'
import {
  getKl8SyncStatus,
  listKl8Draws,
  listKl8Recommendations,
  syncKl8Draws,
  createKl8Recommendation,
  evaluateKl8Recommendations,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type {
  LotteryKl8Draw, LotteryKl8Recommendation,
} from '../types'

const RECOMMENDATION_HISTORY_SIZE = 20
const KL8_MIN_NUMBER = 1
const KL8_MAX_NUMBER = 80
const KL8_NUMBER_RANGE = Array.from({ length: KL8_MAX_NUMBER }, (_, index) => index + 1)

const DISCLAIMER = '彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。'

async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function isTimeoutError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ECONNABORTED'
}

/** 号码补 0 对齐：7 → 07，用于复制和展示。 */
function formatTrendNumber(number: number): string {
  return String(number).padStart(2, '0')
}

function parseJson<T>(value?: string): T | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

interface LotteryAnalysisPayload {
  confidenceLabel?: string
  aiFallback?: LotteryAiFallback
  analysis?: {
    overview?: string
    featureSignals?: string[]
    combinationLogic?: string[]
    riskWarnings?: string[]
  }
  backtestSummary?: LotteryBacktestSummary
  optimizedPortfolio?: LotteryOptimizedPortfolio
  analysisSections?: string[]
}

interface LotteryAiFallback {
  code?: string
  message?: string
  detail?: string
}

interface LotteryBacktestFactorWeights {
  hotWeight: number
  missingWeight: number
  trendWeight: number
  decayWeight: number
  pairWeight: number
  balanceWeight: number
}

interface LotteryBacktestSummary {
  evaluatedIssueCount: number
  averageHitCount: number
  maxHitCount: number
  hitDistribution?: Record<string, number>
  factorWeights?: LotteryBacktestFactorWeights
  weightProfileName?: string
  hitAtLeastThreeRate?: number
  topFactorNames?: string[]
  summary: string
}

interface LotteryOptimizedGroup {
  numbers: number[]
  score: number
  reason: string
  evidence: string[]
}

interface LotteryOptimizedPortfolio {
  groups: LotteryOptimizedGroup[]
  summary: string
  diagnostics?: Record<string, string>
  pairRecommendations?: LotteryPairRecommendation[]
  neighborRecommendations?: LotteryNeighborRecommendation[]
}

interface LotteryPairRecommendation {
  leftNumber: number
  rightNumber: number
  count: number
  lift: number
  score: number
  selected: boolean
  reason: string
  evidence: string[]
}

interface LotteryNeighborRecommendation {
  number: number
  anchorNumbers: number[]
  directions: string[]
  score: number
  selected: boolean
  reason: string
  evidence: string[]
}

interface LotteryCandidateNumber {
  number: number
  score: number
  roles: string[]
  evidence: string
}

interface LotteryCalibrationSnapshot {
  hotMultiplier: number
  coldMultiplier: number
  missingMultiplier: number
  trendMultiplier: number
  balanceMultiplier: number
  pairMultiplier?: number
  evaluatedCount: number
  summary: string
}

interface LotteryHitGroup {
  groupIndex: number
  numbers: number[]
  hitNumbers: number[]
  hitCount: number
}

interface LotteryHitSummary {
  issueNo: string
  drawDate: string
  drawNumbers: number[]
  totalHitCount: number
  maxHitCount: number
  pairs?: Array<{ pairIndex: number; numbers: number[]; hitNumbers: number[]; hitCount: number; fullHit: boolean }>
  groups: LotteryHitGroup[]
}

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

/**
 * 推断推荐的待开奖期号：最新已开期 + 1，解析失败返回空字符串。
 */
function nextIssueNo(latestIssueNo?: string): string {
  if (!latestIssueNo) {
    return ''
  }
  const parsed = Number(latestIssueNo)
  if (!Number.isFinite(parsed)) {
    return ''
  }
  return String(parsed + 1)
}

/**
 * 根据预测开奖日期与当前日期，准确显示「今晚开 / 明天开 / X月X日开」。
 */
function drawLabel(predictedDrawDate?: string): string {
  if (!predictedDrawDate) {
    return '开奖日'
  }
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const diffDays = Math.round(
    (new Date(`${predictedDrawDate}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000,
  )
  if (diffDays <= 0) {
    return '今晚开'
  }
  if (diffDays === 1) {
    return '明天开'
  }
  const date = new Date(`${predictedDrawDate}T00:00:00`)
  return `${date.getMonth() + 1}月${date.getDate()}日开`
}

/**
 * 推荐状态徽标：一眼区分「今晚开」（等开奖）与「已开 · 命中 X」。
 * 这是本面板的签名元素，青绿=待开奖，墨色=已开。
 */
function LotteryStatusBadge({ recommendation }: { recommendation: LotteryKl8Recommendation }) {
  const evaluated = Boolean(recommendation.evaluatedIssueNo)
  if (evaluated) {
    const hit = recommendation.totalHitCount ?? 0
    return (
      <span className={`lottery-status-badge ${hit > 0 ? 'is-hit' : 'is-miss'}`}>
        <i className="lottery-status-dot" />
        已开 · 命中 {hit}
      </span>
    )
  }
  const issue = nextIssueNo(recommendation.latestIssueNo)
  return (
    <span className="lottery-status-badge is-pending">
      <i className="lottery-status-dot" />
      {drawLabel(recommendation.predictedDrawDate)}{issue ? ` · 预测 ${issue}` : ''}
    </span>
  )
}

interface NumberStructure {
  ranges: Record<string, number>
  odd: number
  even: number
  sum: number
  longestRun: number
  tailGroups: number
}

/**
 * 计算单组号码的结构画像：区间分布、奇偶比、和值、最长连号、不同尾数个数。
 * 结构只用于「形态是否偏离常态」的复核，不代表命中概率变化——
 * 快乐8 每期随机开出 20 个号，任意 5 号码组合的期望命中数完全相同。
 */
function numberStructure(numbers: number[]): NumberStructure {
  const ranges: Record<string, number> = { '1-20': 0, '21-40': 0, '41-60': 0, '61-80': 0 }
  const tails = new Set<number>()
  let odd = 0
  let sum = 0
  for (const number of numbers) {
    const rangeKey = `${Math.floor((number - 1) / 20) * 20 + 1}-${Math.floor((number - 1) / 20) * 20 + 20}`
    ranges[rangeKey] = (ranges[rangeKey] ?? 0) + 1
    if (number % 2 !== 0) {
      odd += 1
    }
    sum += number
    tails.add(number % 10)
  }
  return {
    ranges,
    odd,
    even: numbers.length - odd,
    sum,
    longestRun: longestConsecutiveRun(numbers),
    tailGroups: tails.size,
  }
}

/** 最长连续号码长度，用于展示连号结构。 */
function longestConsecutiveRun(numbers: number[]): number {
  const numberSet = new Set(numbers)
  let longest = numbers.length === 0 ? 0 : 1
  for (const number of numberSet) {
    if (numberSet.has(number - 1)) {
      continue
    }
    let length = 1
    let next = number + 1
    while (numberSet.has(next)) {
      length += 1
      next += 1
    }
    longest = Math.max(longest, length)
  }
  return longest
}

function formatHitDistribution(distribution?: Record<string, number>): string {
  if (!distribution) {
    return '暂无'
  }
  return Object.entries(distribution)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([hit, count]) => `${hit}中:${count}`)
    .join(' / ')
}

export default function LotteryKl8Panel() {
  const [status, setStatus] = useState<import('../types').LotteryKl8SyncStatus | null>(null)
  const [draws, setDraws] = useState<LotteryKl8Draw[]>([])
  const [history, setHistory] = useState<LotteryKl8Recommendation[]>([])
  const [current, setCurrent] = useState<LotteryKl8Recommendation | null>(null)
  const [baseIssueCount, setBaseIssueCount] = useState(20)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])
  const currentPickSize = latest?.pickSize ?? 5
  const analysis = useMemo(() => parseJson<LotteryAnalysisPayload>(latest?.analysisJson), [latest])
  const backtestSummary = analysis?.backtestSummary
  const optimizedPortfolio = analysis?.optimizedPortfolio
  const optimizedGroups = optimizedPortfolio?.groups ?? []
  const neighborRecommendations = optimizedPortfolio?.neighborRecommendations ?? []
  const candidates = useMemo(() => parseJson<LotteryCandidateNumber[]>(latest?.candidatePoolJson) ?? [], [latest])
  const calibration = useMemo(
    () => parseJson<LotteryCalibrationSnapshot>(latest?.calibrationSnapshotJson),
    [latest],
  )
  const hitSummary = useMemo(() => parseJson<LotteryHitSummary>(latest?.hitSummaryJson), [latest])
  const hitByGroup = useMemo(() => {
    if (!hitSummary) {
      return new Map<number, number[]>()
    }
    const map = new Map<number, number[]>()
    for (const group of hitSummary.groups) {
      map.set(group.groupIndex, group.hitNumbers)
    }
    return map
  }, [hitSummary])
  const structure = useMemo(
    () => (latest ? numberStructure(latest.groups.flatMap(group => group.numbers)) : null),
    [latest],
  )
  /**
   * 历史推荐的真实战绩：只用已结算记录，未开奖的不计入，避免把「等开奖」当成命中率分子。
   */
  const trackRecord = useMemo(() => {
    const settled = history.filter(item => item.evaluatedIssueNo)
    if (settled.length === 0) {
      return null
    }
    const totalHits = settled.reduce((sum, item) => sum + (item.totalHitCount ?? 0), 0)
    const atLeastThree = settled.filter(item => (item.totalHitCount ?? 0) >= 3).length
    return {
      settledCount: settled.length,
      averageHit: totalHits / settled.length,
      atLeastThree,
      atLeastThreeRate: (atLeastThree * 100) / settled.length,
    }
  }, [history])

  const load = async () => {
    setLoading(true)
    try {
      const [nextStatus, drawPage, recommendationPage] = await Promise.all([
        getKl8SyncStatus(),
        listKl8Draws(0, 30),
        listKl8Recommendations(0, RECOMMENDATION_HISTORY_SIZE),
      ])
      setStatus(nextStatus)
      setDraws(drawPage.content)
      setHistory(recommendationPage.content)
    } catch {
      // 全局 Axios 拦截器已经负责错误提示，这里兜住 Promise，避免 React 事件外产生未捕获异常。
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncKl8Draws()
      emitFeedbackSuccess(`同步完成，新增 ${result.insertedCount} 期`)
      await load()
    } catch {
      // 同步失败时保留按钮状态恢复，错误反馈交给全局请求拦截器。
    } finally {
      setSyncing(false)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      // 结算返回 0 有两种可能：全部已结算，或有待结算但下一期开奖尚未同步入库。
      // 用点击时的 history 区分，避免把「等今晚开奖」误报成「已全部结算」。
      const hasPending = history.some(item => !item.evaluatedIssueNo)
      const count = await evaluateKl8Recommendations()
      await load()
      if (count > 0) {
        emitFeedbackSuccess(`结算完成，更新 ${count} 条推荐命中`)
      } else if (hasPending) {
        emitFeedbackWarning('下一期开奖尚未同步，暂无法结算')
      } else {
        emitFeedbackWarning('已全部结算，没有待结算的推荐')
      }
    } catch {
      // 结算失败时保留按钮状态恢复，错误反馈交给全局请求拦截器。
    } finally {
      setEvaluating(false)
    }
  }

  const handleRecommend = async () => {
    if ((status?.drawCount ?? 0) < 20) {
      emitFeedbackWarning('历史开奖不足 20 期，请先同步开奖数据')
      return
    }
    setRecommending(true)
    try {
      const result = await createKl8Recommendation(baseIssueCount)
      setCurrent(result)
      await load()
      emitFeedbackSuccess('Java 推荐已生成')
    } catch (error) {
      if (isTimeoutError(error)) {
        emitFeedbackWarning('Java 推荐生成耗时较长，请稍后刷新推荐历史查看结果')
      }
    } finally {
      setRecommending(false)
    }
  }

  const handleCopyGroups = async () => {
    if (!latest || latest.groups.length === 0) {
      return
    }
    // 每天只推荐 1 组：复制为单组投注格式；旧的多组历史记录仍按通用格式逐行复制。
    let text: string
    let message: string
    if (latest.groups.length === 1) {
      const first = latest.groups[0].numbers.map(formatTrendNumber).join(' ')
      text = `选${latest.pickSize} ${first} 1倍`
      message = `已复制精选号码（选${latest.pickSize}×1组）`
    } else if (latest.pickSize === 4 && latest.groups.length === 2) {
      // 兼容旧的双组历史记录：第 1 组选4 2倍 + 第 2 组选4 2倍 + 两组合并的选8 1倍。
      const first = latest.groups[0].numbers.map(formatTrendNumber).join(' ')
      const second = latest.groups[1].numbers.map(formatTrendNumber).join(' ')
      const merged = [...latest.groups[0].numbers, ...latest.groups[1].numbers]
        .sort((a, b) => a - b)
        .map(formatTrendNumber).join(' ')
      text = [
        `选4 ${first} 2倍`,
        `选4 ${second} 2倍`,
        `选8 ${merged} 1倍`,
      ].join('\n')
      message = '已复制 10 元组合（选4×2倍 + 选4×2倍 + 选8×1倍）'
    } else {
      // 历史多组记录回退为通用格式：每组一行、空格分隔、个位补 0
      text = latest.groups
        .map(group => group.numbers.map(formatTrendNumber).join(' '))
        .join('\n')
      message = '已复制推荐号码'
    }
    const copied = await copyToClipboard(text)
    if (copied) {
      emitFeedbackSuccess(message)
    } else {
      emitFeedbackWarning('复制失败，请手动选择号码复制')
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label={`快乐8选${currentPickSize}`}>
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">快乐8选5</div>
          <h2>Java 历史数据回测推荐</h2>
          <p>每天同步开奖后自动生成 1 组选5号码，开奖后自动结算；因子权重由走查前推回测择优，命中与否一眼可见。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<AuditOutlined />} loading={evaluating} onClick={handleEvaluate}>
            手动结算
          </Button>
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} onClick={handleRecommend}>
            Java 推荐选5
          </Button>
        </div>
      </div>

      <Alert className="lottery-disclaimer" type="warning" showIcon message={DISCLAIMER} />

      {loading ? (
        <div className="tool-empty-panel"><Spin /></div>
      ) : (
        <>
          <div className="lottery-dashboard-grid">
            <div className="lottery-main-column">
              <div className="lottery-status-grid">
                <article>
                  <span>最新期号</span>
                  <strong>{status?.latestIssueNo || '暂无'}</strong>
                  <small>{status?.latestDrawDate || '等待同步'}</small>
                </article>
                <article>
                  <span>历史期数</span>
                  <strong>{status?.drawCount ?? 0}</strong>
                  <small>{status?.message || '暂无状态'}</small>
                </article>
                <article>
                  <span>推荐基准</span>
                  <InputNumber min={20} max={2000} value={baseIssueCount} onChange={value => setBaseIssueCount(value ?? 20)} />
                  <small>历史期数，默认尽量取满</small>
                </article>
              </div>

              {latest ? (
                <div className="lottery-recommendation">
                  <div className="lottery-recommendation-head">
                    <div>
                      <LotteryStatusBadge recommendation={latest} />
                      {analysis?.confidenceLabel && <Tag color="geekblue">参考强度 {analysis.confidenceLabel}</Tag>}
                      {latest.strategyVersion && <Tag>{latest.strategyVersion}</Tag>}
                      {typeof latest.maxHitCount === 'number' && latest.evaluatedIssueNo && (
                        <Tag color={latest.maxHitCount > 0 ? 'green' : 'default'}>单组最高 {latest.maxHitCount}/{currentPickSize}</Tag>
                      )}
                      {calibration && calibration.evaluatedCount > 0 && <Tag color="purple">反馈校准 {calibration.evaluatedCount} 条</Tag>}
                      <strong>基于近 {latest.baseIssueCount} 期，最新期号 {latest.latestIssueNo}</strong>
                    </div>
                    <div className="lottery-recommendation-head-actions">
                      <Button size="small" icon={<CopyOutlined />} onClick={handleCopyGroups}>
                        一键复制
                      </Button>
                      <small>{formatDateTime(latest.createdAt)}</small>
                    </div>
                  </div>

                  {analysis?.aiFallback && (
                    <Alert
                      className="lottery-ai-fallback"
                      type="info"
                      showIcon
                      message="历史 AI 降级原因"
                      description={analysis.aiFallback.detail
                        ? `${analysis.aiFallback.message || analysis.aiFallback.code || 'AI 推荐失败'}：${analysis.aiFallback.detail}`
                        : (analysis.aiFallback.message || analysis.aiFallback.code || 'AI 推荐失败')}
                    />
                  )}

                  <div className={`lottery-group-grid${latest.groups.length === 1 ? ' is-single' : ''}`}>
                    {latest.groups.map((group, index) => {
                      const hitNumbers = hitByGroup.get(index + 1) ?? []
                      const evaluated = Boolean(latest.evaluatedIssueNo)
                      return (
                        <article key={`${latest.id}-${index}`} className="lottery-group-card">
                          <div className="lottery-group-card-head">
                            <span>{latest.groups.length === 1 ? '精选号码' : `第 ${index + 1} 组`}</span>
                            {evaluated && (
                              <em className={`lottery-group-hit-count ${hitNumbers.length > 0 ? 'is-hit' : 'is-miss'}`}>
                                命中 {hitNumbers.length}/{group.numbers.length}
                              </em>
                            )}
                          </div>
                          <div className="lottery-number-row">
                            {group.numbers.map(number => (
                              <em key={number} className={hitNumbers.includes(number) ? 'is-hit' : undefined}>{number}</em>
                            ))}
                          </div>
                          {!evaluated && <p>等今晚开奖，开奖后自动结算</p>}
                        </article>
                      )
                    })}
                  </div>

                  {structure && (
                    <section className="lottery-backtest-card" aria-label="本组结构画像">
                      <h4>结构画像</h4>
                      <div className="lottery-metric-row">
                        <span>和值 {structure.sum}</span>
                        <span>奇偶 {structure.odd}:{structure.even}</span>
                        <span>最长连号 {structure.longestRun}</span>
                        <span>不同尾数 {structure.tailGroups}</span>
                      </div>
                      <div className="lottery-weight-row">
                        {Object.entries(structure.ranges).map(([range, count]) => (
                          <span key={range}>{range} 区 {count} 个</span>
                        ))}
                      </div>
                      <p>结构只描述形态是否偏离常态；快乐8 每期随机开出 20 个号，任意 5 号码组合的期望命中数完全相同，结构约束不改变命中概率。</p>
                    </section>
                  )}

                  <Tabs
                    className="lottery-detail-tabs"
                    size="small"
                    items={[
                      {
                        key: 'analysis',
                        label: <span><BulbOutlined /> 深度分析</span>,
                        children: analysis?.analysis ? (
                          <div className="lottery-analysis-panel">
                            <section>
                              <h4>整体判断</h4>
                              <p>{analysis.analysis.overview || latest.featureSummary}</p>
                            </section>
                            {(analysis.analysis.featureSignals?.length ?? 0) > 0 && (
                              <section>
                                <h4>特征信号</h4>
                                <ul>{analysis.analysis.featureSignals?.map(item => <li key={item}>{item}</li>)}</ul>
                              </section>
                            )}
                            {(analysis.analysis.combinationLogic?.length ?? 0) > 0 && (
                              <section>
                                <h4>组合逻辑</h4>
                                <ul>{analysis.analysis.combinationLogic?.map(item => <li key={item}>{item}</li>)}</ul>
                              </section>
                            )}
                            {(analysis.analysisSections?.length ?? 0) > 0 && (
                              <section>
                                <h4>分层结论</h4>
                                <ul>{analysis.analysisSections?.map(item => <li key={item}>{item}</li>)}</ul>
                              </section>
                            )}
                            {backtestSummary && (
                              <section className="lottery-backtest-card">
                                <h4>走查前推回测</h4>
                                <p>{backtestSummary.summary}</p>
                                <div className="lottery-metric-row">
                                  <span>样本 {backtestSummary.evaluatedIssueCount}</span>
                                  <span>均值 {backtestSummary.averageHitCount.toFixed(2)}</span>
                                  <span>最高 {backtestSummary.maxHitCount}/{currentPickSize}</span>
                                  {typeof backtestSummary.hitAtLeastThreeRate === 'number' && (
                                    <span>中3个及以上 {(backtestSummary.hitAtLeastThreeRate * 100).toFixed(1)}%</span>
                                  )}
                                  {backtestSummary.weightProfileName && <span>择优配置 {backtestSummary.weightProfileName}</span>}
                                </div>
                                {backtestSummary.factorWeights && (
                                  <div className="lottery-weight-row">
                                    <span>热 {backtestSummary.factorWeights.hotWeight.toFixed(2)}</span>
                                    <span>漏 {backtestSummary.factorWeights.missingWeight.toFixed(2)}</span>
                                    <span>势 {backtestSummary.factorWeights.trendWeight.toFixed(2)}</span>
                                    <span>衰 {backtestSummary.factorWeights.decayWeight.toFixed(2)}</span>
                                    <span>共 {backtestSummary.factorWeights.pairWeight.toFixed(2)}</span>
                                    <span>衡 {backtestSummary.factorWeights.balanceWeight.toFixed(2)}</span>
                                  </div>
                                )}
                                <p>命中分布 {formatHitDistribution(backtestSummary.hitDistribution)}</p>
                              </section>
                            )}
                            {optimizedPortfolio && optimizedGroups.length > 0 && (
                              <section className="lottery-portfolio-card">
                                <h4>组合优化</h4>
                                <p>{optimizedPortfolio.summary}</p>
                                <div className="lottery-portfolio-list">
                                  {optimizedGroups.map((group, index) => (
                                    <article key={`${group.numbers.join('-')}-${index}`}>
                                      <div>
                                        <strong>第 {index + 1} 组 · {group.score.toFixed(2)}</strong>
                                        <span>{group.numbers.join(' ')}</span>
                                      </div>
                                      <p>{group.evidence.slice(0, 3).join('；')}</p>
                                    </article>
                                  ))}
                                </div>
                              </section>
                            )}
                            {neighborRecommendations.length > 0 && (
                              <section className="lottery-portfolio-card">
                                <h4>邻位策略</h4>
                                <div className="lottery-portfolio-list">
                                  {neighborRecommendations.slice(0, 8).map(candidate => (
                                    <article key={`neighbor-strategy-${candidate.number}`}>
                                      <div>
                                        <strong>{candidate.selected ? '入选' : '候选'} · {candidate.number}</strong>
                                        <span>{candidate.score.toFixed(2)}</span>
                                      </div>
                                      <p>{candidate.evidence?.[0] || candidate.reason}</p>
                                    </article>
                                  ))}
                                </div>
                              </section>
                            )}
                            {(optimizedPortfolio?.pairRecommendations?.length ?? 0) > 0 && (
                              <section className="lottery-portfolio-card">
                                <h4>共现参考</h4>
                                <div className="lottery-portfolio-list">
                                  {optimizedPortfolio?.pairRecommendations?.slice(0, 6).map(pair => (
                                    <article key={`strategy-${pair.leftNumber}-${pair.rightNumber}`}>
                                      <div>
                                        <strong>参考 · {Math.min(pair.leftNumber, pair.rightNumber)}-{Math.max(pair.leftNumber, pair.rightNumber)}</strong>
                                        <span>{pair.score.toFixed(2)}</span>
                                      </div>
                                      <p>{pair.evidence?.[0] || pair.reason}</p>
                                    </article>
                                  ))}
                                </div>
                              </section>
                            )}
                            <section>
                              <h4><WarningOutlined /> 风险提示</h4>
                              <ul>{(analysis.analysis.riskWarnings ?? [DISCLAIMER]).map(item => <li key={item}>{item}</li>)}</ul>
                            </section>
                          </div>
                        ) : (
                          <p className="lottery-legacy-summary">{latest.featureSummary}</p>
                        ),
                      },
                      {
                        key: 'trend',
                        label: <span><LineChartOutlined /> 走势分析</span>,
                        forceRender: true,
                        children: (
                          <LotteryTrendPanel
                            draws={draws}
                            latest={latest}
                            candidates={candidates}
                            neighborRecommendations={neighborRecommendations}
                            optimizedPortfolio={optimizedPortfolio}
                          />
                        ),
                      },
                      {
                        key: 'candidates',
                        label: '候选池',
                        children: candidates.length > 0 ? (
                          <div className="lottery-candidate-grid">
                            {candidates.slice(0, 16).map(candidate => (
                              <article key={candidate.number}>
                                <div>
                                  <em>{candidate.number}</em>
                                  <strong>{candidate.score.toFixed(2)}</strong>
                                </div>
                                <p>{candidate.evidence}</p>
                                <span>{candidate.roles.join(' / ')}</span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="lottery-legacy-summary">旧推荐记录暂无候选池明细。</p>
                        ),
                      },
                      {
                        key: 'feedback',
                        label: '命中反馈',
                        children: (
                          <div className="lottery-feedback-panel">
                            {calibration ? (
                              <section className="lottery-calibration-panel">
                                <h4>策略校准</h4>
                                <p>{calibration.summary}</p>
                                <div>
                                  <span>热号 {calibration.hotMultiplier.toFixed(2)}</span>
                                  <span>冷号 {calibration.coldMultiplier.toFixed(2)}</span>
                                  <span>高遗漏 {calibration.missingMultiplier.toFixed(2)}</span>
                                  <span>趋势 {calibration.trendMultiplier.toFixed(2)}</span>
                                  <span>均衡 {calibration.balanceMultiplier.toFixed(2)}</span>
                                </div>
                              </section>
                            ) : (
                              <p className="lottery-legacy-summary">暂无策略校准快照，新推荐会在命中反馈足够后自动记录。</p>
                            )}
                            {hitSummary ? (
                              <section className="lottery-hit-panel">
                                <div>
                                  <h4>结算期号 {hitSummary.issueNo}</h4>
                                  <small>{hitSummary.drawDate}</small>
                                </div>
                                <p>推荐累计命中 {hitSummary.totalHitCount} 个，单组最高命中 {hitSummary.maxHitCount} 个。选5 的中 3 是首个有奖级别；反馈只用于调整权重，不代表下次必然命中。</p>
                                <div className="lottery-hit-grid">
                                  {hitSummary.groups.map(group => (
                                    <article key={group.groupIndex}>
                                      <strong>第 {group.groupIndex} 组 · 命中 {group.hitCount}/{currentPickSize}</strong>
                                      <div>
                                        {group.numbers.map(number => (
                                          <em key={number} className={group.hitNumbers.includes(number) ? 'is-hit' : undefined}>
                                            {number}
                                          </em>
                                        ))}
                                      </div>
                                    </article>
                                  ))}
                                </div>
                                {(hitSummary.pairs?.length ?? 0) > 0 && (
                                  <>
                                    <h4>共现命中反馈</h4>
                                    <div className="lottery-hit-grid is-pairs">
                                      {hitSummary.pairs?.map(pair => (
                                        <article key={pair.pairIndex}>
                                          <strong>第 {pair.pairIndex} 个共现 · {pair.fullHit ? '双中' : `命中 ${pair.hitCount}/2`}</strong>
                                          <div>
                                            {pair.numbers.map(number => (
                                              <em key={number} className={pair.hitNumbers.includes(number) ? 'is-hit' : undefined}>
                                                {number}
                                              </em>
                                            ))}
                                          </div>
                                        </article>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </section>
                            ) : (
                              <p className="lottery-legacy-summary">等待下一期开奖同步后，系统会自动回填本次推荐的命中结果。</p>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              ) : (
                <div className="tool-empty-panel lottery-empty-panel">
                  <Empty description="还没有推荐记录">
                    <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={handleRecommend}>
                      生成第一组推荐
                    </Button>
                  </Empty>
                </div>
              )}
            </div>

            <aside className="lottery-side-column">
              {trackRecord && (
                <section>
                  <h3>近 {history.length} 次推荐表现</h3>
                  <div className="lottery-metric-row">
                    <span>已结算 {trackRecord.settledCount} 次</span>
                    <span>平均命中 {trackRecord.averageHit.toFixed(2)}</span>
                    <span>中3个及以上 {trackRecord.atLeastThree} 次</span>
                    <span>占比 {trackRecord.atLeastThreeRate.toFixed(1)}%</span>
                  </div>
                  <p>只统计已开奖并结算的记录；选5 的中 3 是首个有奖级别，样本越多越接近随机基线。</p>
                </section>
              )}
              <section>
                <h3><HistoryOutlined /> 推荐历史</h3>
                <div className="lottery-history-list">
                  {history.map(item => {
                    const itemHit = parseJson<LotteryHitSummary>(item.hitSummaryJson)
                    const itemHitByGroup = new Map<number, number[]>()
                    if (itemHit) {
                      for (const group of itemHit.groups) {
                        itemHitByGroup.set(group.groupIndex, group.hitNumbers)
                      }
                    }
                    return (
                      <button key={item.id} type="button" onClick={() => {
                        setCurrent(item)
                      }}>
                        <strong>
                          <i className={`lottery-status-dot ${item.evaluatedIssueNo ? (item.totalHitCount ?? 0) > 0 ? 'is-hit' : 'is-miss' : 'is-pending'}`} />
                          {item.evaluatedIssueNo ? `已开 · 命中 ${item.totalHitCount ?? 0}` : `${drawLabel(item.predictedDrawDate)} · 预测 ${nextIssueNo(item.latestIssueNo)}`}
                        </strong>
                        <small>选{item.pickSize} · {item.latestIssueNo} · {formatDateTime(item.createdAt)}</small>
                        <span className="lottery-history-numbers">
                          {item.groups.map((group, groupIndex) => (
                            group.numbers.map(number => (
                              <em
                                key={`${item.id}-${groupIndex}-${number}`}
                                className={itemHitByGroup.get(groupIndex + 1)?.includes(number) ? 'is-hit' : undefined}
                              >
                                {formatTrendNumber(number)}
                              </em>
                            ))
                          ))}
                        </span>
                      </button>
                    )
                  })}
                  {history.length === 0 && <p>暂无推荐历史。</p>}
                </div>
              </section>
              <section>
                <h3>近期开奖</h3>
                <div className="lottery-draw-list">
                  {draws.slice(0, 10).map(draw => (
                    <article key={draw.issueNo}>
                      <div>
                        <strong>{draw.issueNo}</strong>
                        <small>{draw.drawDate}</small>
                      </div>
                      <p>{draw.numbers.join(' ')}</p>
                    </article>
                  ))}
                  {draws.length === 0 && <p>暂无开奖数据，先点击同步开奖。</p>}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}

interface LotteryTrendPanelProps {
  draws: LotteryKl8Draw[]
  latest: LotteryKl8Recommendation
  candidates: LotteryCandidateNumber[]
  neighborRecommendations: LotteryNeighborRecommendation[]
  optimizedPortfolio?: LotteryOptimizedPortfolio
}

interface LotteryTrendModel {
  rows: LotteryKl8Draw[]
  anchorDraw: LotteryKl8Draw | null
  anchorNumbers: Set<number>
  rowNumberSets: Record<string, Set<number>>
  recommendedNumbers: Set<number>
  neighborNumbers: Set<number>
  consecutiveNumbers: Set<number>
  consecutiveRuns: number[][]
  longestRunLength: number
}

interface LotteryNumberInsight {
  number: number
  windowSize: number
  appearedCount: number
  latestIssueNo?: string
  currentMissing: number
  tags: string[]
  neighborSources: string[]
  candidate?: LotteryCandidateNumber
}

/**
 * 走势分析：近 30 期 80 号码矩阵，高亮上一期号码、邻位候选、当前推荐和连号结构。
 * 点击任意号码可查看该号码在当前窗口内的开出次数、遗漏和信号来源。
 */
function LotteryTrendPanel({ draws, latest, candidates, neighborRecommendations, optimizedPortfolio }: LotteryTrendPanelProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const model = useMemo(
    () => buildTrendModel(draws, latest, neighborRecommendations, optimizedPortfolio),
    [draws, latest, neighborRecommendations, optimizedPortfolio],
  )
  const selectedInsight = useMemo(
    () => selectedNumber === null
      ? null
      : buildNumberInsight(selectedNumber, model, neighborRecommendations, candidates),
    [candidates, model, neighborRecommendations, selectedNumber],
  )

  if (model.rows.length === 0) {
    return <p className="lottery-legacy-summary">暂无开奖数据，先同步开奖后再查看走势。</p>
  }

  return (
    <div className="lottery-trend-panel">
      <div className="lottery-trend-head">
        <div>
          <h4>近 {model.rows.length} 期号码走势</h4>
          <p>高亮上一期左右邻位、当前推荐号和推荐组里的连号结构，用来复核号码是不是顺着历史方向走。</p>
        </div>
        <div className="lottery-trend-summary">
          <span>上一期 {model.anchorDraw?.issueNo ?? latest.latestIssueNo}</span>
          <span>邻位候选 {model.neighborNumbers.size} 个</span>
          <span>推荐号码 {model.recommendedNumbers.size} 个</span>
          <span>{model.longestRunLength > 1 ? `最长连号 ${model.longestRunLength} 连` : '暂无连号'}</span>
        </div>
      </div>

      <div className="lottery-trend-legend" aria-label="走势标记说明">
        <span><i className="is-hit" /> 开出</span>
        <span><i className="is-anchor" /> 上一期</span>
        <span><i className="is-neighbor" /> 邻位候选</span>
        <span><i className="is-recommended" /> 推荐</span>
        <span><i className="is-consecutive" /> 连号</span>
      </div>

      {model.consecutiveRuns.length > 0 && (
        <div className="lottery-trend-runs" aria-label="推荐连号结构">
          {model.consecutiveRuns.map(run => (
            <span key={run.join('-')}>{run.map(formatTrendNumber).join('-')}</span>
          ))}
        </div>
      )}

      {selectedInsight && <LotteryNumberInsightCard insight={selectedInsight} />}

      <div className="lottery-trend-scroll">
        <div className="lottery-trend-matrix" role="grid" aria-label="快乐8近期开奖走势">
          <div className="lottery-trend-row is-header" role="row">
            <span role="columnheader">期号</span>
            {KL8_NUMBER_RANGE.map(number => (
              <span key={number} role="columnheader">{formatTrendNumber(number)}</span>
            ))}
          </div>
          {model.rows.map(draw => (
            <div key={draw.issueNo} className="lottery-trend-row" role="row">
              <span className="lottery-trend-issue" role="rowheader">
                <strong>{draw.issueNo}</strong>
                <small>{draw.drawDate}</small>
              </span>
              {KL8_NUMBER_RANGE.map(number => (
                <button
                  key={`${draw.issueNo}-${number}`}
                  type="button"
                  role="gridcell"
                  aria-label={trendCellLabel(draw, number, model)}
                  className={trendCellClassName(draw, number, model)}
                  title={trendCellLabel(draw, number, model)}
                  onClick={() => setSelectedNumber(number)}
                >
                  {formatTrendNumber(number)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LotteryNumberInsightCard({ insight }: { insight: LotteryNumberInsight }) {
  return (
    <section className="lottery-number-insight" aria-label={`号码 ${formatTrendNumber(insight.number)} 详情`}>
      <div className="lottery-number-insight-head">
        <div>
          <h4>号码 {formatTrendNumber(insight.number)} 详情</h4>
          <p>
            近 {insight.windowSize} 期视图里开出 {insight.appearedCount} 次，
            当前遗漏 {insight.currentMissing} 期。
          </p>
        </div>
        <strong>{formatTrendNumber(insight.number)}</strong>
      </div>
      <div className="lottery-number-insight-metrics">
        <span>近 {insight.windowSize} 期开出 {insight.appearedCount} 次</span>
        <span>{insight.latestIssueNo ? `最近出现 ${insight.latestIssueNo}` : '近期开奖未出现'}</span>
        {insight.candidate && <span>候选分 {insight.candidate.score.toFixed(2)}</span>}
      </div>
      {insight.tags.length > 0 && (
        <div className="lottery-number-insight-tags">
          {insight.tags.map(tag => <span key={tag}>{tag}</span>)}
        </div>
      )}
      {insight.neighborSources.length > 0 && (
        <div className="lottery-number-insight-sources">
          {insight.neighborSources.map(source => <span key={source}>{source}</span>)}
        </div>
      )}
      {insight.candidate?.evidence && <p>{insight.candidate.evidence}</p>}
    </section>
  )
}

function buildNumberInsight(
  number: number,
  model: LotteryTrendModel,
  neighborRecommendations: LotteryNeighborRecommendation[],
  candidates: LotteryCandidateNumber[],
): LotteryNumberInsight {
  const appearedRows = model.rows.filter(draw => model.rowNumberSets[draw.issueNo]?.has(number))
  const latestAppearanceIndex = model.rows.findIndex(draw => model.rowNumberSets[draw.issueNo]?.has(number))
  const neighbor = neighborRecommendations.find(candidate => candidate.number === number)
  const candidate = candidates.find(item => item.number === number)
  const tags = [
    model.recommendedNumbers.has(number) ? '当前推荐' : null,
    model.neighborNumbers.has(number) ? '邻位候选' : null,
    model.consecutiveNumbers.has(number) ? '连号结构' : null,
    candidate ? '候选池' : null,
  ].filter((tag): tag is string => Boolean(tag))

  return {
    number,
    windowSize: model.rows.length,
    appearedCount: appearedRows.length,
    latestIssueNo: appearedRows[0]?.issueNo,
    currentMissing: latestAppearanceIndex >= 0 ? latestAppearanceIndex : model.rows.length,
    tags,
    neighborSources: neighbor
      ? neighbor.anchorNumbers.flatMap(anchor => neighbor.directions.map(direction => `上一期 ${anchor} ${direction}`))
      : [],
    candidate,
  }
}

function buildTrendModel(
  draws: LotteryKl8Draw[],
  latest: LotteryKl8Recommendation,
  neighborRecommendations: LotteryNeighborRecommendation[],
  optimizedPortfolio?: LotteryOptimizedPortfolio,
): LotteryTrendModel {
  const rows = draws.slice(0, 30)
  const anchorDraw = rows.find(draw => draw.issueNo === latest.latestIssueNo) ?? rows[0] ?? null
  const anchorNumbers = new Set(anchorDraw?.numbers ?? [])
  const rowNumberSets = rows.reduce<Record<string, Set<number>>>((result, draw) => {
    result[draw.issueNo] = new Set(draw.numbers)
    return result
  }, {})
  const recommendedNumbers = new Set(
    latest.groups
      .flatMap(group => group.numbers)
      .filter(isKl8Number),
  )
  const neighborNumbers = new Set(
    (neighborRecommendations.length > 0
      ? neighborRecommendations.map(candidate => candidate.number)
      : anchorDraw?.numbers.flatMap(number => [number - 1, number + 1]) ?? []
    ).filter(isKl8Number),
  )
  const consecutiveRuns = consecutiveNumberRuns([...recommendedNumbers])
  const consecutiveNumbers = new Set(consecutiveRuns.flat())
  const diagnosticRun = Number(optimizedPortfolio?.diagnostics?.longestConsecutiveRun ?? 0)
  const longestRunLength = Math.max(diagnosticRun, 0, ...consecutiveRuns.map(run => run.length))

  return {
    rows,
    anchorDraw,
    anchorNumbers,
    rowNumberSets,
    recommendedNumbers,
    neighborNumbers,
    consecutiveNumbers,
    consecutiveRuns,
    longestRunLength,
  }
}

function trendCellClassName(draw: LotteryKl8Draw, number: number, model: LotteryTrendModel): string {
  const classNames = ['lottery-trend-cell']
  const drawNumbers = model.rowNumberSets[draw.issueNo]

  if (drawNumbers?.has(number)) {
    classNames.push('is-hit')
  }
  if (draw.issueNo === model.anchorDraw?.issueNo && model.anchorNumbers.has(number)) {
    classNames.push('is-anchor')
  }
  if (model.neighborNumbers.has(number)) {
    classNames.push('is-neighbor')
  }
  if (model.recommendedNumbers.has(number)) {
    classNames.push('is-recommended')
  }
  if (model.consecutiveNumbers.has(number)) {
    classNames.push('is-consecutive')
  }

  return classNames.join(' ')
}

function trendCellLabel(draw: LotteryKl8Draw, number: number, model: LotteryTrendModel): string {
  const labels: string[] = []
  const drawNumbers = model.rowNumberSets[draw.issueNo]

  if (drawNumbers?.has(number)) {
    labels.push('命中')
  }
  if (draw.issueNo === model.anchorDraw?.issueNo && model.anchorNumbers.has(number)) {
    labels.push('上一期号码')
  }
  if (model.recommendedNumbers.has(number)) {
    labels.push('推荐')
  }
  if (model.neighborNumbers.has(number)) {
    labels.push('邻位候选')
  }
  if (model.consecutiveNumbers.has(number)) {
    labels.push('连号')
  }

  return `号码 ${number} 在期号 ${draw.issueNo}${labels.length > 0 ? `，${labels.join('，')}` : '，未出现'}`
}

function consecutiveNumberRuns(numbers: number[]): number[][] {
  const sorted = [...new Set(numbers.filter(isKl8Number))].sort((left, right) => left - right)
  const runs: number[][] = []
  let currentRun: number[] = []

  for (const number of sorted) {
    const previous = currentRun[currentRun.length - 1]
    if (currentRun.length === 0 || number === previous + 1) {
      currentRun.push(number)
      continue
    }
    if (currentRun.length >= 2) {
      runs.push(currentRun)
    }
    currentRun = [number]
  }
  if (currentRun.length >= 2) {
    runs.push(currentRun)
  }

  return runs
}

function isKl8Number(number: number): boolean {
  return Number.isInteger(number) && number >= KL8_MIN_NUMBER && number <= KL8_MAX_NUMBER
}
