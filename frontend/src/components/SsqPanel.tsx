import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Empty, InputNumber, Spin, Tag,
} from 'antd'
import {
  AuditOutlined, CopyOutlined, HistoryOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import {
  getSsqSyncStatus,
  listSsqDraws,
  listSsqRecommendations,
  syncSsqDraws,
  createSsqRecommendation,
  evaluateSsqRecommendations,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { SsqDraw, SsqRecommendation } from '../types'

const RECOMMENDATION_HISTORY_SIZE = 20

const DISCLAIMER = '彩票结果具有随机性，本推荐仅为娱乐统计参考，不保证命中，不构成投注建议。'

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

function formatNumber(number: number): string {
  return String(number).padStart(2, '0')
}

/**
 * 双色球推荐状态徽标：青绿圆点=今晚开（等开奖），墨色圆点=已开（含命中数）。
 */
function SsqStatusBadge({ recommendation }: { recommendation: SsqRecommendation }) {
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

interface SsqHitSummary {
  issueNo: string
  redHitCount: number
  blueHit: boolean
  totalHitCount: number
  hitReds: number[]
}

function parseHitSummary(value?: string): SsqHitSummary | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as SsqHitSummary
  } catch {
    return null
  }
}

export default function SsqPanel() {
  const [status, setStatus] = useState<import('../types').SsqSyncStatus | null>(null)
  const [draws, setDraws] = useState<SsqDraw[]>([])
  const [history, setHistory] = useState<SsqRecommendation[]>([])
  const [current, setCurrent] = useState<SsqRecommendation | null>(null)
  const [baseIssueCount, setBaseIssueCount] = useState(100)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])
  const hitSummary = useMemo(() => parseHitSummary(latest?.hitSummaryJson), [latest])

  const load = async () => {
    setLoading(true)
    try {
      const [nextStatus, drawPage, recommendationPage] = await Promise.all([
        getSsqSyncStatus(),
        listSsqDraws(0, 30),
        listSsqRecommendations(0, RECOMMENDATION_HISTORY_SIZE),
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
      const result = await syncSsqDraws()
      emitFeedbackSuccess(`同步完成，新增 ${result.insertedCount} 期${result.evaluatedCount > 0 ? `，结算 ${result.evaluatedCount} 条` : ''}`)
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
      const result = await createSsqRecommendation(baseIssueCount)
      setCurrent(result)
      await load()
      emitFeedbackSuccess('双色球推荐已生成（7 红 + 1 蓝）')
    } catch {
      // 推荐失败时保留按钮状态恢复，错误反馈交给全局请求拦截器。
    } finally {
      setRecommending(false)
    }
  }

  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      const hasPending = history.some(item => !item.evaluatedIssueNo)
      const count = await evaluateSsqRecommendations()
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

  const handleCopy = async () => {
    if (!latest || latest.redNumbers.length === 0) {
      return
    }
    // 7 红 + 1 蓝复式（7 注共 14 元）：第一行红球、第二行蓝球，直接粘贴到投注站或官方 APP
    const reds = latest.redNumbers.map(formatNumber).join(' ')
    const text = `红 ${reds}\n蓝 ${formatNumber(latest.blueNumber)}（7+1 复式，7 注 14 元）`
    const copied = await navigator.clipboard?.writeText?.(text).then(() => true).catch(() => false) ?? false
    if (copied) {
      emitFeedbackSuccess('已复制 7+1 复式组合（7 注 14 元）')
    } else {
      emitFeedbackWarning('复制失败，请手动选择号码复制')
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label="双色球7加1">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">双色球 7+1</div>
          <h2>Java 历史数据回测推荐</h2>
          <p>每周二四日开奖后自动生成 7 红 + 1 蓝复式组合，开奖后自动结算命中。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<AuditOutlined />} loading={evaluating} onClick={handleEvaluate}>
            手动结算
          </Button>
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} onClick={handleRecommend}>
            推荐 7+1
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
                  <InputNumber min={30} max={500} value={baseIssueCount} onChange={value => setBaseIssueCount(value ?? 100)} />
                  <small>历史期数，默认 100</small>
                </article>
              </div>

              {latest ? (
                <div className="lottery-recommendation">
                  <div className="lottery-recommendation-head">
                    <div>
                      <SsqStatusBadge recommendation={latest} />
                      {typeof latest.maxHitCount === 'number' && latest.evaluatedIssueNo && (
                        <Tag color={latest.maxHitCount > 0 ? 'green' : 'default'}>红球命中 {latest.maxHitCount}/7</Tag>
                      )}
                      <strong>基于近 {latest.baseIssueCount} 期，最新期号 {latest.latestIssueNo}</strong>
                    </div>
                    <div className="lottery-recommendation-head-actions">
                      <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                        一键复制
                      </Button>
                      <small>{formatDateTime(latest.createdAt)}</small>
                    </div>
                  </div>

                  <div className="lottery-group-grid is-single">
                    <article className="lottery-group-card">
                      <div className="lottery-group-card-head">
                        <span>红球 7 个</span>
                        {hitSummary && (
                          <em className={`lottery-group-hit-count ${hitSummary.redHitCount > 0 ? 'is-hit' : 'is-miss'}`}>
                            命中 {hitSummary.redHitCount}/7
                          </em>
                        )}
                      </div>
                      <div className="lottery-number-row">
                        {latest.redNumbers.map(number => (
                          <em key={number} className={hitSummary?.hitReds?.includes(number) ? 'is-hit' : undefined}>
                            {formatNumber(number)}
                          </em>
                        ))}
                      </div>
                      {!hitSummary && <p>等今晚开奖，开奖后自动结算</p>}
                    </article>
                    <article className="lottery-group-card">
                      <div className="lottery-group-card-head">
                        <span>蓝球</span>
                        {hitSummary && (
                          <em className={`lottery-group-hit-count ${hitSummary.blueHit ? 'is-hit' : 'is-miss'}`}>
                            {hitSummary.blueHit ? '命中' : '未中'}
                          </em>
                        )}
                      </div>
                      <div className="lottery-number-row">
                        <em className={hitSummary?.blueHit ? 'is-hit' : undefined}>{formatNumber(latest.blueNumber)}</em>
                      </div>
                      <p>7+1 复式，7 注共 14 元</p>
                    </article>
                  </div>
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
                  {history.map(item => {
                    const itemHit = parseHitSummary(item.hitSummaryJson)
                    return (
                      <button key={item.id} type="button" onClick={() => {
                        setCurrent(item)
                      }}>
                        <strong>
                          <i className={`lottery-status-dot ${item.evaluatedIssueNo ? (item.totalHitCount ?? 0) > 0 ? 'is-hit' : 'is-miss' : 'is-pending'}`} />
                          {item.evaluatedIssueNo ? `已开 · 命中 ${item.totalHitCount ?? 0}` : `${drawLabel(item.predictedDrawDate)} · 预测 ${nextIssueNo(item.latestIssueNo)}`}
                        </strong>
                        <small>{item.latestIssueNo} · {formatDateTime(item.createdAt)}</small>
                        <span className="lottery-history-numbers">
                          {item.redNumbers.map(number => (
                            <em key={`${item.id}-r-${number}`} className={itemHit?.hitReds?.includes(number) ? 'is-hit' : undefined}>
                              {formatNumber(number)}
                            </em>
                          ))}
                          <em key={`${item.id}-b-${item.blueNumber}`} className={itemHit?.blueHit ? 'is-hit' : undefined}>
                            {formatNumber(item.blueNumber)}
                          </em>
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
                      <p>
                        <span className="ssq-red-numbers">{draw.redNumbers.map(formatNumber).join(' ')}</span>
                        <span className="ssq-blue-number">{formatNumber(draw.blueNumber)}</span>
                      </p>
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
