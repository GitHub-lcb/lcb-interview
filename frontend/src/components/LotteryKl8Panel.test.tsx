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

  it('handles AI recommendation timeout with controlled feedback', async () => {
    vi.mocked(createKl8Recommendation).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
    )

    render(<LotteryKl8Panel />)

    await screen.findByText('20260629001')
    await userEvent.click(screen.getByRole('button', { name: /AI 推荐 5 组/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledWith(1000)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('AI 推荐生成耗时较长，请稍后刷新推荐历史查看结果')
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
        { numbers: [6, 7, 8, 9, 10], reason: '规则推荐' },
        { numbers: [11, 12, 13, 14, 15], reason: '规则推荐' },
        { numbers: [16, 17, 18, 19, 20], reason: '规则推荐' },
        { numbers: [21, 22, 23, 24, 25], reason: '规则推荐' },
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

    expect(await screen.findByText('AI 降级原因')).toBeInTheDocument()
    expect(screen.getByText(/HTTP 401/)).toBeInTheDocument()
  })
})
