import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createKl8Recommendation,
  evaluateKl8Recommendations,
  getKl8SyncStatus,
  listKl8Draws,
  listKl8Recommendations,
  syncKl8Draws,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { LotteryKl8Draw, LotteryKl8Recommendation, PageResult } from '../types'
import LotteryKl8Panel from './LotteryKl8Panel'

vi.mock('../api/tools', () => ({
  getKl8SyncStatus: vi.fn(),
  listKl8Draws: vi.fn(),
  listKl8Recommendations: vi.fn(),
  syncKl8Draws: vi.fn(),
  createKl8Recommendation: vi.fn(),
  evaluateKl8Recommendations: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}))

function pageOf<T>(content: T[], total: number): PageResult<T> {
  return { content, page: 0, size: 20, total, totalPages: Math.ceil(total / 20) }
}

function recommendation(overrides: Partial<LotteryKl8Recommendation> = {}): LotteryKl8Recommendation {
  return {
    id: 1,
    source: 'RULE_BASED',
    pickSize: 4,
    baseIssueCount: 2000,
    latestIssueNo: '2026213',
    groups: [
      { numbers: [2, 11, 12, 73], reason: '第一组' },
      { numbers: [4, 7, 32, 51], reason: '第二组' },
    ],
    featureSummary: '测试摘要',
    disclaimer: '测试免责声明',
    createdAt: '2026-08-11T22:45:00',
    ...overrides,
  }
}

describe('LotteryKl8Panel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getKl8SyncStatus).mockResolvedValue({
      latestIssueNo: '2026213',
      latestDrawDate: '2026-08-11',
      drawCount: 2027,
      stale: false,
      message: 'ok',
    })
    vi.mocked(listKl8Draws).mockResolvedValue(pageOf([], 0))
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([], 0))
  })

  it('marks unsettled recommendation as tonight draw with predicted issue', async () => {
    const pending = recommendation()
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([pending], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('今晚开 · 预测 2026214')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('等今晚开奖，开奖后自动结算').length).toBe(2)
  })

  it('marks settled recommendation with hit count and highlights hit numbers', async () => {
    const settled = recommendation({
      evaluatedIssueNo: '2026214',
      evaluatedDrawDate: '2026-08-12',
      totalHitCount: 3,
      maxHitCount: 2,
      hitSummaryJson: JSON.stringify({
        issueNo: '2026214',
        drawDate: '2026-08-12',
        drawNumbers: [6, 7, 11, 12, 21, 33, 42, 56, 60, 80],
        totalHitCount: 3,
        maxHitCount: 2,
        groups: [
          { groupIndex: 1, numbers: [2, 11, 12, 73], hitNumbers: [11, 12], hitCount: 2 },
          { groupIndex: 2, numbers: [4, 7, 32, 51], hitNumbers: [7], hitCount: 1 },
        ],
      }),
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([settled], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('已开 · 命中 3')).length).toBeGreaterThan(0)
    expect(screen.getByText('命中 2/4')).toBeInTheDocument()
    expect(screen.getByText('命中 1/4')).toBeInTheDocument()
    expect(screen.getByText('单组最高 2/4')).toBeInTheDocument()
  })

  it('shows miss state when settled with zero hits', async () => {
    const missed = recommendation({
      evaluatedIssueNo: '2026214',
      totalHitCount: 0,
      maxHitCount: 0,
      hitSummaryJson: JSON.stringify({
        issueNo: '2026214',
        drawDate: '2026-08-12',
        drawNumbers: [1, 3, 5, 8, 9, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 76, 77, 78, 79, 80],
        totalHitCount: 0,
        maxHitCount: 0,
        groups: [
          { groupIndex: 1, numbers: [2, 11, 12, 73], hitNumbers: [], hitCount: 0 },
          { groupIndex: 2, numbers: [4, 7, 32, 51], hitNumbers: [], hitCount: 0 },
        ],
      }),
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([missed], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('已开 · 命中 0')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('命中 0/4').length).toBe(2)
  })

  it('falls back to plain label when issue number cannot be incremented', async () => {
    const pending = recommendation({ latestIssueNo: 'NEXT-PENDING' })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([pending], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('今晚开')).length).toBeGreaterThan(0)
  })

  it('copies all groups with one number per space and one group per line', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<LotteryKl8Panel />)

    await screen.findAllByText('今晚开 · 预测 2026214')
    await userEvent.click(screen.getByRole('button', { name: /一键复制/ }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('02 11 12 73\n04 07 32 51')
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('已复制 2 组号码')
  })

  it('handles Java recommendation timeout with controlled feedback', async () => {
    vi.mocked(createKl8Recommendation).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
    )

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐选4/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledWith(2000)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('Java 推荐生成耗时较长，请稍后刷新推荐历史查看结果')
    expect(emitFeedbackSuccess).not.toHaveBeenCalled()
  })

  it('generates a pick-4 recommendation', async () => {
    vi.mocked(createKl8Recommendation).mockImplementation(async (baseIssueCount = 2000) => recommendation({
      baseIssueCount,
    }))

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐选4/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledTimes(1)
    })
    expect(createKl8Recommendation).toHaveBeenCalledWith(2000)
    expect((await screen.findAllByText('今晚开 · 预测 2026214')).length).toBeGreaterThan(0)
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('Java 推荐已生成')
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(getKl8SyncStatus).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<LotteryKl8Panel />)

    await waitFor(() => {
      expect(screen.getByText('暂无开奖数据，先点击同步开奖。')).toBeInTheDocument()
    })
  })

  it('settles pending recommendations manually with success feedback', async () => {
    vi.mocked(evaluateKl8Recommendations).mockResolvedValue(3)

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateKl8Recommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('结算完成，更新 3 条推荐命中')
  })

  it('reminds user when everything is already settled', async () => {
    vi.mocked(evaluateKl8Recommendations).mockResolvedValue(0)

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateKl8Recommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('已全部结算，没有待结算的推荐')
  })

  it('shows recent draws in the side column', async () => {
    const draws: LotteryKl8Draw[] = [
      {
        issueNo: '2026213',
        drawDate: '2026-08-11',
        numbers: [6, 7, 8, 11, 12, 13, 18, 21, 33, 36, 37, 42, 44, 56, 57, 58, 60, 66, 71, 80],
        sourceName: 'test',
      },
    ]
    vi.mocked(listKl8Draws).mockResolvedValue(pageOf(draws, 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('2026213')).length).toBeGreaterThan(0)
  })
})
