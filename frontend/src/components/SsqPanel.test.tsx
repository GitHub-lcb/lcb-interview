import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createSsqRecommendation,
  evaluateSsqRecommendations,
  getSsqSyncStatus,
  listSsqDraws,
  listSsqRecommendations,
  syncSsqDraws,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { PageResult, SsqRecommendation } from '../types'
import SsqPanel from './SsqPanel'

vi.mock('../api/tools', () => ({
  getSsqSyncStatus: vi.fn(),
  listSsqDraws: vi.fn(),
  listSsqRecommendations: vi.fn(),
  syncSsqDraws: vi.fn(),
  createSsqRecommendation: vi.fn(),
  evaluateSsqRecommendations: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

function pageOf<T>(content: T[], total: number): PageResult<T> {
  return { content, page: 0, size: 20, total, totalPages: Math.ceil(total / 20) }
}

function recommendation(overrides: Partial<SsqRecommendation> = {}): SsqRecommendation {
  return {
    id: 1,
    source: 'RULE_BASED',
    redNumbers: [1, 3, 19, 24, 26, 28, 29],
    blueNumber: 4,
    baseIssueCount: 100,
    latestIssueNo: '2026094',
    featureSummary: '测试摘要',
    disclaimer: '测试免责声明',
    createdAt: '2026-08-16T10:00:00',
    ...overrides,
  }
}

describe('SsqPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSsqSyncStatus).mockResolvedValue({
      latestIssueNo: '2026094',
      latestDrawDate: '2026-08-16',
      drawCount: 3000,
      stale: false,
      message: 'ok',
    })
    vi.mocked(listSsqDraws).mockResolvedValue(pageOf([], 0))
    vi.mocked(listSsqRecommendations).mockResolvedValue(pageOf([], 0))
  })

  it('marks unsettled recommendation as tonight draw', async () => {
    vi.mocked(listSsqRecommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<SsqPanel />)

    expect((await screen.findAllByText('今晚开 · 预测 2026095')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('等今晚开奖，开奖后自动结算').length).toBeGreaterThan(0)
  })

  it('marks settled recommendation with hit count and highlights hit reds', async () => {
    const settled = recommendation({
      evaluatedIssueNo: '2026095',
      totalHitCount: 3,
      maxHitCount: 3,
      hitSummaryJson: JSON.stringify({
        issueNo: '2026095',
        redHitCount: 3,
        blueHit: false,
        totalHitCount: 3,
        hitReds: [1, 3, 19],
      }),
    })
    vi.mocked(listSsqRecommendations).mockResolvedValue(pageOf([settled], 1))

    render(<SsqPanel />)

    expect((await screen.findAllByText('已开 · 命中 3')).length).toBeGreaterThan(0)
    expect(screen.getByText('命中 3/7')).toBeInTheDocument()
    expect(screen.getByText('红球命中 3/7')).toBeInTheDocument()
  })

  it('copies 7+1 compound format', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.mocked(listSsqRecommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<SsqPanel />)

    await screen.findAllByText('今晚开 · 预测 2026095')
    await userEvent.click(screen.getByRole('button', { name: /一键复制/ }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('红 01 03 19 24 26 28 29\n蓝 04（7+1 复式，7 注 14 元）')
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('已复制 7+1 复式组合（7 注 14 元）')
  })

  it('generates a recommendation', async () => {
    vi.mocked(createSsqRecommendation).mockResolvedValue(recommendation())

    render(<SsqPanel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /推荐 7\+1/ }))

    await waitFor(() => {
      expect(createSsqRecommendation).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('双色球推荐已生成（7 红 + 1 蓝）')
  })

  it('settles pending recommendations manually with success feedback', async () => {
    vi.mocked(evaluateSsqRecommendations).mockResolvedValue(2)

    render(<SsqPanel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateSsqRecommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('结算完成，更新 2 条推荐命中')
  })

  it('explains pending recommendations await draw when evaluate returns zero', async () => {
    vi.mocked(listSsqRecommendations).mockResolvedValue(pageOf([recommendation()], 1))
    vi.mocked(evaluateSsqRecommendations).mockResolvedValue(0)

    render(<SsqPanel />)

    await screen.findAllByText('今晚开 · 预测 2026095')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateSsqRecommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('下一期开奖尚未同步，暂无法结算')
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(getSsqSyncStatus).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<SsqPanel />)

    await waitFor(() => {
      expect(screen.getByText('暂无开奖数据，先点击同步开奖。')).toBeInTheDocument()
    })
  })
})
