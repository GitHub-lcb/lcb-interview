import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, InputNumber, Spin, Tabs, Tag } from 'antd'
import { BulbOutlined, HistoryOutlined, ReloadOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons'
import {
  createKl8Recommendation,
  getKl8SyncStatus,
  listKl8Draws,
  listKl8Recommendations,
  syncKl8Draws,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { LotteryKl8Draw, LotteryKl8Recommendation, LotteryKl8SyncStatus } from '../types'

const DISCLAIMER = '彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。'

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
  hitDistribution: Record<string, number>
  factorWeights: LotteryBacktestFactorWeights
  topFactorNames: string[]
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
  diagnostics: Record<string, string>
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
  evaluatedCount: number
  summary: string
}

interface LotteryHitGroup {
  groupIndex: number
  numbers: number[]
  hitNumbers: number[]
  hitCount: number
}

interface LotteryHitPair {
  pairIndex: number
  numbers: number[]
  hitNumbers: number[]
  hitCount: number
  fullHit: boolean
}

interface LotteryHitSummary {
  issueNo: string
  drawDate: string
  drawNumbers: number[]
  totalHitCount: number
  maxHitCount: number
  pairs?: LotteryHitPair[]
  groups: LotteryHitGroup[]
}

export default function LotteryKl8Panel() {
  const [status, setStatus] = useState<LotteryKl8SyncStatus | null>(null)
  const [draws, setDraws] = useState<LotteryKl8Draw[]>([])
  const [history, setHistory] = useState<LotteryKl8Recommendation[]>([])
  const [current, setCurrent] = useState<LotteryKl8Recommendation | null>(null)
  const [baseIssueCount, setBaseIssueCount] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recommending, setRecommending] = useState(false)

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])
  const analysis = useMemo(() => parseJson<LotteryAnalysisPayload>(latest?.analysisJson), [latest])
  const aiFallback = analysis?.aiFallback
  const backtestSummary = analysis?.backtestSummary
  const backtestWeights = backtestSummary?.factorWeights
  const optimizedPortfolio = analysis?.optimizedPortfolio
  const optimizedGroups = optimizedPortfolio?.groups ?? []
  const pairRecommendations = optimizedPortfolio?.pairRecommendations ?? []
  const neighborRecommendations = optimizedPortfolio?.neighborRecommendations ?? []
  const selectedNeighbors = neighborRecommendations.filter(candidate => candidate.selected).slice(0, 5)
  const candidates = useMemo(() => parseJson<LotteryCandidateNumber[]>(latest?.candidatePoolJson) ?? [], [latest])
  const calibration = useMemo(
    () => parseJson<LotteryCalibrationSnapshot>(latest?.calibrationSnapshotJson),
    [latest],
  )
  const hitSummary = useMemo(() => parseJson<LotteryHitSummary>(latest?.hitSummaryJson), [latest])

  const load = async () => {
    setLoading(true)
    try {
      const [nextStatus, drawPage, recommendationPage] = await Promise.all([
        getKl8SyncStatus(),
        listKl8Draws(0, 30),
        listKl8Recommendations(0, 8),
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

  return (
    <section className="tool-section lottery-tool" aria-label="快乐8选5">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">快乐8选5</div>
          <h2>Java 历史数据回测推荐</h2>
          <p>后端同步公开开奖数据，使用纯 Java 提取冷热、遗漏、区间、上一期邻位、连号结构和回测特征，生成 1 组精选号码。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} onClick={handleRecommend}>
            Java 推荐 1 组
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
                  <InputNumber min={20} max={2000} value={baseIssueCount} onChange={value => setBaseIssueCount(value ?? 2000)} />
                  <small>历史期数，默认尽量取满</small>
                </article>
              </div>

              {latest ? (
                <div className="lottery-recommendation">
                  <div className="lottery-recommendation-head">
                    <div>
                      <Tag color={latest.source === 'AI' ? 'blue' : 'orange'}>{latest.source === 'AI' ? '历史 AI 推荐' : 'Java 推荐'}</Tag>
                      {analysis?.confidenceLabel && <Tag color="geekblue">参考强度 {analysis.confidenceLabel}</Tag>}
                      {latest.strategyVersion && <Tag>{latest.strategyVersion}</Tag>}
                      {latest.evaluatedIssueNo && <Tag color="cyan">已结算 {latest.evaluatedIssueNo}</Tag>}
                      {typeof latest.maxHitCount === 'number' && <Tag color="green">最高命中 {latest.maxHitCount}/5</Tag>}
                      {calibration && calibration.evaluatedCount > 0 && <Tag color="purple">反馈校准 {calibration.evaluatedCount} 条</Tag>}
                      <strong>基于近 {latest.baseIssueCount} 期，最新期号 {latest.latestIssueNo}</strong>
                    </div>
                    <small>{formatDateTime(latest.createdAt)}</small>
                  </div>
                  <p>{latest.featureSummary}</p>
                  {aiFallback && (
                    <Alert
                      className="lottery-ai-fallback"
                      type="info"
                      showIcon
                      message="历史 AI 降级原因"
                      description={aiFallbackDescription(aiFallback)}
                    />
                  )}
                  <div className={`lottery-group-grid${latest.groups.length === 1 ? ' is-single' : ''}`}>
                    {latest.groups.map((group, index) => (
                      <article key={`${latest.id}-${index}`} className="lottery-group-card">
                        <span>{latest.groups.length === 1 ? '精选号码' : `第 ${index + 1} 组`}</span>
                        <div className="lottery-number-row">
                          {group.numbers.map(number => <em key={number}>{number}</em>)}
                        </div>
                        <p>{group.reason}</p>
                      </article>
                    ))}
                  </div>
                  {selectedNeighbors.length > 0 && (
                    <section className="lottery-pair-card">
                      <div>
                        <h4>邻位候选</h4>
                        <span>从上一期号码左右邻位中筛选，优先保留连号结构</span>
                      </div>
                      <div className="lottery-pair-list">
                        {selectedNeighbors.map(candidate => (
                          <article key={`neighbor-${candidate.number}`}>
                            <strong>{candidate.number}</strong>
                            <span>分 {candidate.score.toFixed(2)} · 来源 {candidate.anchorNumbers.join('、')} · {candidate.directions.join('/')}</span>
                            <p>{candidate.evidence?.[0] || candidate.reason}</p>
                          </article>
                        ))}
                      </div>
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
                            <section>
                              <h4>特征信号</h4>
                              <ul>{(analysis.analysis.featureSignals ?? []).map(item => <li key={item}>{item}</li>)}</ul>
                            </section>
                            <section>
                              <h4>组合逻辑</h4>
                              <ul>{(analysis.analysis.combinationLogic ?? []).map(item => <li key={item}>{item}</li>)}</ul>
                            </section>
                            {backtestSummary && (
                              <section className="lottery-backtest-card">
                                <h4>滚动回测</h4>
                                <p>{backtestSummary.summary}</p>
                                <div className="lottery-metric-row">
                                  <span>样本 {backtestSummary.evaluatedIssueCount}</span>
                                  <span>均值 {backtestSummary.averageHitCount.toFixed(2)}</span>
                                  <span>最高 {backtestSummary.maxHitCount}/5</span>
                                </div>
                                {backtestWeights && (
                                  <div className="lottery-weight-row">
                                    <span>热 {backtestWeights.hotWeight.toFixed(2)}</span>
                                    <span>漏 {backtestWeights.missingWeight.toFixed(2)}</span>
                                    <span>势 {backtestWeights.trendWeight.toFixed(2)}</span>
                                    <span>衰 {backtestWeights.decayWeight.toFixed(2)}</span>
                                    <span>共 {backtestWeights.pairWeight.toFixed(2)}</span>
                                    <span>衡 {backtestWeights.balanceWeight.toFixed(2)}</span>
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
                                      <p>{group.evidence.slice(0, 2).join('；')}</p>
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
                            {pairRecommendations.length > 0 && (
                              <section className="lottery-portfolio-card">
                                <h4>共现参考</h4>
                                <div className="lottery-portfolio-list">
                                  {pairRecommendations.slice(0, 6).map(pair => (
                                    <article key={`strategy-${pair.leftNumber}-${pair.rightNumber}`}>
                                      <div>
                                        <strong>参考 · {formatPair(pair.leftNumber, pair.rightNumber)}</strong>
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
                                <p>推荐累计命中 {hitSummary.totalHitCount} 个，单组最高命中 {hitSummary.maxHitCount} 个。随机基线约为单号 25%，反馈只用于调整权重，不代表下次必然命中。</p>
                                <div className="lottery-hit-grid">
                                  {hitSummary.groups.map(group => (
                                    <article key={group.groupIndex}>
                                      <strong>第 {group.groupIndex} 组 · 命中 {group.hitCount}/5</strong>
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
              <section>
                <h3><HistoryOutlined /> 推荐历史</h3>
                <div className="lottery-history-list">
                  {history.map(item => (
                    <button key={item.id} type="button" onClick={() => setCurrent(item)}>
                      <strong>{item.source === 'AI' ? '历史 AI 推荐' : 'Java 推荐'} · {item.latestIssueNo}</strong>
                      <small>{formatDateTime(item.createdAt)}</small>
                    </button>
                  ))}
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

function formatHitDistribution(distribution?: Record<string, number>): string {
  if (!distribution) {
    return '暂无'
  }
  return Object.entries(distribution)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([hit, count]) => `${hit}中:${count}`)
    .join(' / ')
}

function formatPair(left: number, right: number): string {
  return `${Math.min(left, right)}-${Math.max(left, right)}`
}

function formatDateTime(value?: string): string {
  if (!value) {
    return '暂无时间'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '暂无时间'
  }
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isTimeoutError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ECONNABORTED'
}

function aiFallbackMessage(value: LotteryAiFallback): string {
  return value.message || value.code || 'AI 推荐失败'
}

function aiFallbackDescription(value: LotteryAiFallback): string {
  const message = aiFallbackMessage(value)
  return value.detail ? `${message}：${value.detail}` : message
}
