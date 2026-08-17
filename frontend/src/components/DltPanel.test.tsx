import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createDltRecommendation,
  evaluateDltRecommendations,
  getDltSyncStatus,
  listDltDraws,
  listDltRecommendations,
  syncDltDraws,
} from '../api/tools'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import type { DltRecommendation, PageResult } from '../types'
import DltPanel from './DltPanel'

vi.mock('../api/tools', () => ({
  getDltSyncStatus: vi.fn(),
  listDltDraws: vi.fn(),
  listDltRecommendations: vi.fn(),
  syncDltDraws: vi.fn(),
  createDltRecommendation: vi.fn(),
  evaluateDltRecommendations: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

function pageOf<T>(content: T[], total: number): PageResult<T> {
  return { content, page: 0, size: 20, total, totalPages: Math.ceil(total / 20) }
}

function recommendation(overrides: Partial<DltRecommendation> = {}): DltRecommendation {
  return {
    id: 1,
    source: 'RULE_BASED',
    frontNumbers: [13, 15, 20, 21, 26],
    backNumbers: [5, 8, 12],
    baseIssueCount: 100,
    latestIssueNo: '26092',
    featureSummary: '测试摘要',
    disclaimer: '测试免责声明',
    createdAt: '2026-08-15T10:00:00',
    ...overrides,
  }
}

describe('DltPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDltSyncStatus).mockResolvedValue({
      latestIssueNo: '26092',
      latestDrawDate: '2026-08-15',
      drawCount: 2910,
      stale: false,
      message: 'ok',
    })
    vi.mocked(listDltDraws).mockResolvedValue(pageOf([], 0))
    vi.mocked(listDltRecommendations).mockResolvedValue(pageOf([], 0))
  })

  it('marks unsettled recommendation as tonight draw', async () => {
    vi.mocked(listDltRecommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<DltPanel />)

    expect((await screen.findAllByText('今晚开 · 预测 26093')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('等今晚开奖，开奖后自动结算').length).toBeGreaterThan(0)
  })

  it('marks settled recommendation with hit counts', async () => {
    const settled = recommendation({
      evaluatedIssueNo: '26093',
      totalHitCount: 5,
      maxHitCount: 3,
      hitSummaryJson: JSON.stringify({
        issueNo: '26093',
        frontHitCount: 3,
        backHitCount: 2,
        totalHitCount: 5,
        hitFronts: [13, 15, 20],
        hitBacks: [5, 8],
      }),
    })
    vi.mocked(listDltRecommendations).mockResolvedValue(pageOf([settled], 1))

    render(<DltPanel />)

    expect((await screen.findAllByText('已开 · 命中 5')).length).toBeGreaterThan(0)
    expect(screen.getByText('命中 3/5')).toBeInTheDocument()
    expect(screen.getByText('命中 2/3')).toBeInTheDocument()
  })

  it('copies 5+3 compound format', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    vi.mocked(listDltRecommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<DltPanel />)

    await screen.findAllByText('今晚开 · 预测 26093')
    await userEvent.click(screen.getByRole('button', { name: /一键复制/ }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('前区 13 15 20 21 26\n后区 05 08 12（5+3 复式，3 注 6 元）')
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('已复制 5+3 复式组合（3 注 6 元）')
  })

  it('generates a recommendation', async () => {
    vi.mocked(createDltRecommendation).mockResolvedValue(recommendation())

    render(<DltPanel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /推荐 5\+3/ }))

    await waitFor(() => {
      expect(createDltRecommendation).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('大乐透推荐已生成（5 前区 + 3 后区）')
  })

  it('settles pending recommendations manually with success feedback', async () => {
    vi.mocked(evaluateDltRecommendations).mockResolvedValue(2)

    render(<DltPanel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateDltRecommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('结算完成，更新 2 条推荐命中')
  })

  it('explains pending recommendations await draw when evaluate returns zero', async () => {
    vi.mocked(listDltRecommendations).mockResolvedValue(pageOf([recommendation()], 1))
    vi.mocked(evaluateDltRecommendations).mockResolvedValue(0)

    render(<DltPanel />)

    await screen.findAllByText('今晚开 · 预测 26093')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateDltRecommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('下一期开奖尚未同步，暂无法结算')
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(getDltSyncStatus).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<DltPanel />)

    await waitFor(() => {
      expect(screen.getByText('暂无开奖数据，先点击同步开奖。')).toBeInTheDocument()
    })
  })
})
