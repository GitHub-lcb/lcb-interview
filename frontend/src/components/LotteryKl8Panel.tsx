import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, InputNumber, Spin, Tag } from 'antd'
import { HistoryOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
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

export default function LotteryKl8Panel() {
  const [status, setStatus] = useState<LotteryKl8SyncStatus | null>(null)
  const [draws, setDraws] = useState<LotteryKl8Draw[]>([])
  const [history, setHistory] = useState<LotteryKl8Recommendation[]>([])
  const [current, setCurrent] = useState<LotteryKl8Recommendation | null>(null)
  const [baseIssueCount, setBaseIssueCount] = useState(100)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [recommending, setRecommending] = useState(false)

  const latest = useMemo(() => current ?? history[0] ?? null, [current, history])

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
      emitFeedbackSuccess(result.source === 'AI' ? 'AI 推荐已生成' : 'AI 不可用，已生成规则推荐')
    } finally {
      setRecommending(false)
    }
  }

  return (
    <section className="tool-section lottery-tool" aria-label="快乐8选5">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">快乐8选5</div>
          <h2>AI 历史数据分析推荐</h2>
          <p>后端同步公开开奖数据，提取冷热、遗漏、区间和奇偶特征，再由 AI 生成 5 组号码。</p>
        </div>
        <div className="tool-actions">
          <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
            同步开奖
          </Button>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={recommending} onClick={handleRecommend}>
            AI 推荐 5 组
          </Button>
        </div>
      </div>

      <Alert className="lottery-disclaimer" type="warning" showIcon message={DISCLAIMER} />

      {loading ? (
        <div className="tool-empty-panel"><Spin /></div>
      ) : (
        <>
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
              <InputNumber min={20} max={500} value={baseIssueCount} onChange={value => setBaseIssueCount(value ?? 100)} />
              <small>历史期数</small>
            </article>
          </div>

          {latest ? (
            <div className="lottery-recommendation">
              <div className="lottery-recommendation-head">
                <div>
                  <Tag color={latest.source === 'AI' ? 'blue' : 'orange'}>{latest.source === 'AI' ? 'AI 推荐' : '规则推荐'}</Tag>
                  <strong>基于近 {latest.baseIssueCount} 期，最新期号 {latest.latestIssueNo}</strong>
                </div>
                <small>{formatDateTime(latest.createdAt)}</small>
              </div>
              <p>{latest.featureSummary}</p>
              <div className="lottery-group-grid">
                {latest.groups.map((group, index) => (
                  <article key={`${latest.id}-${index}`} className="lottery-group-card">
                    <span>第 {index + 1} 组</span>
                    <div className="lottery-number-row">
                      {group.numbers.map(number => <em key={number}>{number}</em>)}
                    </div>
                    <p>{group.reason}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="tool-empty-panel">
              <Empty description="还没有推荐记录">
                <Button type="primary" ghost icon={<ThunderboltOutlined />} onClick={handleRecommend}>
                  生成第一组推荐
                </Button>
              </Empty>
            </div>
          )}

          <div className="lottery-columns">
            <section>
              <h3><HistoryOutlined /> 推荐历史</h3>
              <div className="lottery-history-list">
                {history.map(item => (
                  <button key={item.id} type="button" onClick={() => setCurrent(item)}>
                    <strong>{item.source === 'AI' ? 'AI 推荐' : '规则推荐'} · {item.latestIssueNo}</strong>
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
          </div>
        </>
      )}
    </section>
  )
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
