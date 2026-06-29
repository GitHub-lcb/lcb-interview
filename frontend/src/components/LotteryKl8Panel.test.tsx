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
import type { PageResult } from '../types'

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
      expect(createKl8Recommendation).toHaveBeenCalledWith(100)
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
})
