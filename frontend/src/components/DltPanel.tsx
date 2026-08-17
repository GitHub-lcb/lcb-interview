import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Empty, InputNumber, Spin, Tag,
} from 'antd'
import {
  AuditOutlined, CopyOutlined, HistoryOutlined, ReloadOutlined, ThunderboltOutlined,
} from '@ant-design/icons'
import {
  getDltSyncStatus,
  listDltDraws,
  listDltRecommendations,
  syncDltDraws,
  createDltRecommendation,
  evaluateDltRecommendations,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { DltDraw, DltRecommendation } from '../types'

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

function formatNumber(number: number): string {
  return String(number).padStart(2, '0')
}

function DltStatusBadge({ recommendation }: { recommendation: DltRecommendation }) {
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
      今晚开{issue ? ` · 预测 ${issue}` : ''}
    </span>
  )
}

interface DltHitSummary {
  issueNo: string
  frontHitCount: number
  backHitCount: number
  totalHitCount: number
  hitFronts: number[]
  hitBacks: number[]
}

function parseHitSummary(value?: string): DltHitSummary | null {
  if (!value) {
    return null
  }
  try {
    return JSON.parse(value) as DltHitSummary
  } catch {
    return null
  }
}

export default function DltPanel() {
  const [status, setStatus] = useState<import('../types').DltSyncStatus | null>(null)
  const [draws, setDraws] = useState<DltDraw[]>([])
  const [history, setHistory] = useState<DltRecommendation[]>([])
  const [current, setCurrent] = useState<DltRecommendation | null>(null)
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
        getDltSyncStatus(),
        listDltDraws(0, 30),
        listDltRecommendations(0, RECOMMENDATION_HISTORY_SIZE),
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
      const result = await syncDltDraws()
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
      const result = await createDltRecommendation(baseIssueCount)
      setCurrent(result)
      await load()
      emitFeedbackSuccess('大乐透推荐已生成（5 前区 + 3 后区）')
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
      const count = await evaluateDltRecommendations()
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
    if (!latest || latest.frontNumbers.length === 0) {
      return
    }
    // 5 前区 + 3 后区复式（后区 3 选 2 = 3 注共 6 元），直接粘贴到投注站或官方 APP
    const fronts = latest.frontNumbers.map(formatNumber).join(' ')
    const backs = latest.backNumbers.map(formatNumber).join(' ')
    const text = `前区 ${fronts}\n后区 ${backs}（5+3 复式，3 注 6 元）`
    const copied = await navigator.clipboard?.writeText?.(text).then(() => true).catch(() => false) ?? false
    if (copied) {
      emitFeedbackSuccess('已复制 5+3 复式组合（3 注 6 元）')
    } else {
      emitFeedbackWarning('复制失败，请手动选择号码复制')
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label="大乐透5加3">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">大乐透 5+3</div>
          <h2>Java 历史数据回测推荐</h2>
          <p>每周一三六开奖后自动生成 5 前区 + 3 后区复式组合，开奖后自动结算命中。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<AuditOutlined />} loading={evaluating} onClick={handleEvaluate}>
            手动结算
          </Button>
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} onClick={handleRecommend}>
            推荐 5+3
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
                      <DltStatusBadge recommendation={latest} />
                      {typeof latest.maxHitCount === 'number' && latest.evaluatedIssueNo && (
                        <Tag color={latest.maxHitCount > 0 ? 'green' : 'default'}>前区命中 {latest.maxHitCount}/5</Tag>
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
                        <span>前区 5 个</span>
                        {hitSummary && (
                          <em className={`lottery-group-hit-count ${hitSummary.frontHitCount > 0 ? 'is-hit' : 'is-miss'}`}>
                            命中 {hitSummary.frontHitCount}/5
                          </em>
                        )}
                      </div>
                      <div className="lottery-number-row">
                        {latest.frontNumbers.map(number => (
                          <em key={number} className={hitSummary?.hitFronts?.includes(number) ? 'is-hit' : undefined}>
                            {formatNumber(number)}
                          </em>
                        ))}
                      </div>
                      {!hitSummary && <p>等今晚开奖，开奖后自动结算</p>}
                    </article>
                    <article className="lottery-group-card">
                      <div className="lottery-group-card-head">
                        <span>后区 3 个</span>
                        {hitSummary && (
                          <em className={`lottery-group-hit-count ${hitSummary.backHitCount > 0 ? 'is-hit' : 'is-miss'}`}>
                            命中 {hitSummary.backHitCount}/3
                          </em>
                        )}
                      </div>
                      <div className="lottery-number-row">
                        {latest.backNumbers.map(number => (
                          <em key={number} className={hitSummary?.hitBacks?.includes(number) ? 'is-hit' : undefined}>
                            {formatNumber(number)}
                          </em>
                        ))}
                      </div>
                      <p>5+3 复式（后区 3 选 2），3 注共 6 元</p>
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
                          {item.evaluatedIssueNo ? `已开 · 命中 ${item.totalHitCount ?? 0}` : `今晚开 · 预测 ${nextIssueNo(item.latestIssueNo)}`}
                        </strong>
                        <small>{item.latestIssueNo} · {formatDateTime(item.createdAt)}</small>
                        <span className="lottery-history-numbers">
                          {item.frontNumbers.map(number => (
                            <em key={`${item.id}-f-${number}`} className={itemHit?.hitFronts?.includes(number) ? 'is-hit' : undefined}>
                              {formatNumber(number)}
                            </em>
                          ))}
                          {item.backNumbers.map(number => (
                            <em key={`${item.id}-b-${number}`} className={itemHit?.hitBacks?.includes(number) ? 'is-hit' : undefined}>
                              {formatNumber(number)}
                            </em>
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
                      <p>
                        <span className="ssq-red-numbers">{draw.frontNumbers.map(formatNumber).join(' ')}</span>
                        <span className="ssq-blue-number">{draw.backNumbers.map(formatNumber).join(' ')}</span>
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
