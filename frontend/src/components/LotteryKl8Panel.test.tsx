import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LotteryKl8Panel from './LotteryKl8Panel'
import {
  createKl8Recommendation,
  getKl8SyncStatus,
  listKl8Draws,
  listKl8Recommendations,
  syncKl8Draws,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { LotteryKl8Recommendation, PageResult } from '../types'

vi.mock('../api/tools', () => ({
  createKl8Recommendation: vi.fn(),
  getKl8SyncStatus: vi.fn(),
  listKl8Draws: vi.fn(),
  listKl8Recommendations: vi.fn(),
  syncKl8Draws: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

function pageOf<T>(content: T[], size: number): PageResult<T> {
  return {
    content,
    page: 0,
    size,
    total: content.length,
    totalPages: content.length === 0 ? 0 : 1,
  }
}

describe('LotteryKl8Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getKl8SyncStatus).mockResolvedValue({
      latestIssueNo: '20260629001',
      latestDrawDate: '2026-06-29',
      drawCount: 30,
      stale: false,
      message: 'ok',
    })
    vi.mocked(listKl8Draws).mockResolvedValue(pageOf([], 30))
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([], 8))
    vi.mocked(syncKl8Draws).mockResolvedValue({
      success: true,
      sourceName: 'test',
      fetchedCount: 0,
      insertedCount: 0,
      latestIssueNo: '20260629001',
      message: 'ok',
    })
  })

  it('handles Java recommendation timeout with controlled feedback', async () => {
    vi.mocked(createKl8Recommendation).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
    )

    render(<LotteryKl8Panel />)

    await screen.findByText('20260629001')
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐 1 组/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledWith(2000)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('Java 推荐生成耗时较长，请稍后刷新推荐历史查看结果')
    expect(emitFeedbackSuccess).not.toHaveBeenCalled()
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(getKl8SyncStatus).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<LotteryKl8Panel />)

    await waitFor(() => {
      expect(screen.getByText('暂无开奖数据，先点击同步开奖。')).toBeInTheDocument()
    })
  })

  it('shows AI fallback diagnostic detail from recommendation analysis', async () => {
    const recommendation: LotteryKl8Recommendation = {
      id: 1,
      source: 'RULE_BASED',
      baseIssueCount: 1000,
      latestIssueNo: '20260629001',
      groups: [
        { numbers: [1, 2, 3, 4, 5], reason: '规则推荐' },
      ],
      featureSummary: '测试摘要',
      analysisJson: JSON.stringify({
        confidenceLabel: '低',
        aiFallback: {
          code: 'HTTP_STATUS',
          message: 'AI 推荐接口返回 HTTP 401',
          detail: '上游鉴权失败，请检查 AI API Key 或接口地址。',
        },
        analysis: {
          overview: '规则降级',
          featureSignals: [],
          combinationLogic: [],
          riskWarnings: [],
        },
      }),
      disclaimer: '测试免责声明',
      createdAt: '2026-06-29T10:00:00',
    }
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation], 8))

    render(<LotteryKl8Panel />)

    expect(await screen.findByText('历史 AI 降级原因')).toBeInTheDocument()
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument()
  })

  it('shows selected pairs and pair hit feedback', async () => {
    const recommendation: LotteryKl8Recommendation = {
      id: 2,
      source: 'RULE_BASED',
      baseIssueCount: 2000,
      latestIssueNo: '20260629001',
      groups: [
        { numbers: [1, 23, 45, 67, 70], reason: '对子生成 5 码' },
      ],
      featureSummary: '测试摘要',
      analysisJson: JSON.stringify({
        confidenceLabel: '低',
        analysis: {
          overview: '规则推荐',
          featureSignals: [],
          combinationLogic: [],
          riskWarnings: [],
        },
        optimizedPortfolio: {
          pairRecommendations: [
            { leftNumber: 1, rightNumber: 23, count: 20, lift: 1.2, score: 98, selected: true, reason: '核心对子', evidence: ['共现 20 次'] },
            { leftNumber: 45, rightNumber: 67, count: 18, lift: 1.1, score: 88, selected: true, reason: '核心对子', evidence: ['共现 18 次'] },
          ],
        },
      }),
      hitSummaryJson: JSON.stringify({
        issueNo: '20260629002',
        drawDate: '2026-06-30',
        drawNumbers: [1, 2, 23, 45, 60],
        totalHitCount: 3,
        maxHitCount: 3,
        pairs: [
          { pairIndex: 1, numbers: [1, 23], hitNumbers: [1, 23], hitCount: 2, fullHit: true },
          { pairIndex: 2, numbers: [45, 67], hitNumbers: [45], hitCount: 1, fullHit: false },
        ],
        groups: [
          { groupIndex: 1, numbers: [1, 23, 45, 67, 70], hitNumbers: [1, 23, 45], hitCount: 3 },
        ],
      }),
      disclaimer: '测试免责声明',
      createdAt: '2026-06-29T10:00:00',
    }
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation], 8))

    render(<LotteryKl8Panel />)

    expect(await screen.findByText('核心对子')).toBeInTheDocument()
    expect(screen.getByText('1-23')).toBeInTheDocument()
    expect(screen.getByText('45-67')).toBeInTheDocument()
    const feedbackTabs = screen.getAllByRole('tab', { name: /命中反馈/ })
    await userEvent.click(feedbackTabs[feedbackTabs.length - 1])
    expect(screen.getByText('对子命中反馈')).toBeInTheDocument()
    expect(screen.getByText(/第 1 对 · 双中/)).toBeInTheDocument()
    expect(screen.getByText(/第 2 对 · 命中 1\/2/)).toBeInTheDocument()
  })
})
