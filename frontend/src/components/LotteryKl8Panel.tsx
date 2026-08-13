import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Button, Empty, InputNumber, Spin, Tag,
} from 'antd'
import {
  CopyOutlined, HistoryOutlined, ReloadOutlined, ThunderboltOutlined, AuditOutlined,
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
      今晚开{issue ? ` · 预测 ${issue}` : ''}
    </span>
  )
}

export default function LotteryKl8Panel() {
  const [status, setStatus] = useState<import('../types').LotteryKl8SyncStatus | null>(null)
  const [draws, setDraws] = useState<LotteryKl8Draw[]>([])
  const [history, setHistory] = useState<LotteryKl8Recommendation[]>([])
  const [current, setCurrent] = useState<LotteryKl8Recommendation | null>(null)
  const [baseIssueCount, setBaseIssueCount] = useState(2000)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recommending, setRecommending] = useState(false)
  const [evaluating, setEvaluating] = useState(false)

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])
  const currentPickSize = latest?.pickSize ?? 4
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

  const handleRecommend = async () => {    if ((status?.drawCount ?? 0) < 20) {
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
    // 按 10 元投注组合复制：第 1 组选4 ×2倍 + 第 2 组选4 ×2倍 + 两组合并的选8 ×1倍。
    // 合计 2+2+1 注共 10 元，方便直接粘贴到投注站或官方 APP。
    let text: string
    if (latest.groups.length === 2) {
      const first = latest.groups[0].numbers.map(formatTrendNumber).join(' ')
      const second = latest.groups[1].numbers.map(formatTrendNumber).join(' ')
      const merged = [...latest.groups[0].numbers, ...latest.groups[1].numbers]
        .map(formatTrendNumber).join(' ')
      text = [
        `选4 ${first} ×2`,
        `选4 ${second} ×2`,
        `选8 ${merged} ×1`,
      ].join('\n')
    } else {
      // 单组或历史多组记录回退为通用格式：每组一行、空格分隔、个位补 0
      text = latest.groups
        .map(group => group.numbers.map(formatTrendNumber).join(' '))
        .join('\n')
    }
    const copied = await copyToClipboard(text)
    if (copied) {
      emitFeedbackSuccess('已复制 10 元组合（选4×2倍 + 选4×2倍 + 选8×1倍）')
    } else {
      emitFeedbackWarning('复制失败，请手动选择号码复制')
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label="快乐8选4">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">快乐8选4</div>
          <h2>Java 历史数据回测推荐</h2>
          <p>每天同步开奖后自动生成 2 组精选号码，开奖后自动结算，命中与否一眼可见。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<AuditOutlined />} loading={evaluating} disabled={recommending || syncing} onClick={handleEvaluate}>
            手动结算
          </Button>
          <Button icon={<ReloadOutlined />} loading={syncing} disabled={recommending || evaluating} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} disabled={syncing || evaluating} onClick={handleRecommend}>
            Java 推荐选4
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
                      <LotteryStatusBadge recommendation={latest} />
                      {latest.strategyVersion && <Tag>{latest.strategyVersion}</Tag>}
                      {typeof latest.maxHitCount === 'number' && latest.evaluatedIssueNo && (
                        <Tag color={latest.maxHitCount > 0 ? 'green' : 'default'}>单组最高 {latest.maxHitCount}/{currentPickSize}</Tag>
                      )}
                      <strong>基于近 {latest.baseIssueCount} 期，最新期号 {latest.latestIssueNo}</strong>
                    </div>
                    <div className="lottery-recommendation-head-actions">
                      <Button size="small" icon={<CopyOutlined />} onClick={handleCopyGroups}>
                        一键复制
                      </Button>
                      <small>{formatDateTime(latest.createdAt)}</small>
                    </div>
                  </div>

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
                    <button key={item.id} type="button" onClick={() => {
                      setCurrent(item)
                    }}>
                      <strong>
                        <i className={`lottery-status-dot ${item.evaluatedIssueNo ? (item.totalHitCount ?? 0) > 0 ? 'is-hit' : 'is-miss' : 'is-pending'}`} />
                        {item.evaluatedIssueNo ? `已开 · 命中 ${item.totalHitCount ?? 0}` : `今晚开 · 预测 ${nextIssueNo(item.latestIssueNo)}`}
                      </strong>
                      <small>{item.latestIssueNo} · {formatDateTime(item.createdAt)}</small>
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
