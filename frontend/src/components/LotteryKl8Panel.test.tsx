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
    pickSize: 5,
    baseIssueCount: 20,
    latestIssueNo: '2026213',
    groups: [
      { numbers: [2, 11, 12, 73, 74], reason: '精选组' },
    ],
    featureSummary: '测试摘要',
    disclaimer: '测试免责声明',
    predictedDrawDate: '2026-08-18',
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
    expect(screen.getAllByText('等今晚开奖，开奖后自动结算').length).toBe(1)
  })

  it('marks settled recommendation with hit count and highlights hit numbers', async () => {
    const settled = recommendation({
      evaluatedIssueNo: '2026214',
      evaluatedDrawDate: '2026-08-12',
      totalHitCount: 2,
      maxHitCount: 2,
      hitSummaryJson: JSON.stringify({
        issueNo: '2026214',
        drawDate: '2026-08-12',
        drawNumbers: [6, 7, 11, 12, 21, 33, 42, 56, 60, 80],
        totalHitCount: 2,
        maxHitCount: 2,
        groups: [
          { groupIndex: 1, numbers: [2, 11, 12, 73, 74], hitNumbers: [11, 12], hitCount: 2 },
        ],
      }),
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([settled], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('已开 · 命中 2')).length).toBeGreaterThan(0)
    expect(screen.getByText('命中 2/5')).toBeInTheDocument()
    expect(screen.getByText('单组最高 2/5')).toBeInTheDocument()
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
          { groupIndex: 1, numbers: [2, 11, 12, 73, 74], hitNumbers: [], hitCount: 0 },
        ],
      }),
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([missed], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('已开 · 命中 0')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('命中 0/5').length).toBe(1)
  })

  it('falls back to plain label when issue number cannot be incremented', async () => {
    const pending = recommendation({ latestIssueNo: 'NEXT-PENDING' })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([pending], 1))

    render(<LotteryKl8Panel />)

    expect((await screen.findAllByText('今晚开')).length).toBeGreaterThan(0)
  })

  it('copies the single pick-5 group in betting format', async () => {
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
      expect(writeText).toHaveBeenCalledWith('选5 02 11 12 73 74 1倍')
    })
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('已复制精选号码（选5×1组）')
  })

  it('handles Java recommendation timeout with controlled feedback', async () => {
    vi.mocked(createKl8Recommendation).mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
    )

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐选5/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledWith(20)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('Java 推荐生成耗时较长，请稍后刷新推荐历史查看结果')
    expect(emitFeedbackSuccess).not.toHaveBeenCalled()
  })

  it('generates a pick-5 recommendation', async () => {
    vi.mocked(createKl8Recommendation).mockImplementation(async (baseIssueCount = 20) => recommendation({
      baseIssueCount,
    }))

    render(<LotteryKl8Panel />)

    await screen.findByText('暂无推荐历史。')
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐选5/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledTimes(1)
    })
    expect(createKl8Recommendation).toHaveBeenCalledWith(20)
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

  it('explains pending recommendations await tonight draw when evaluate returns zero', async () => {
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation()], 1))
    vi.mocked(evaluateKl8Recommendations).mockResolvedValue(0)

    render(<LotteryKl8Panel />)

    await screen.findAllByText('今晚开 · 预测 2026214')
    await userEvent.click(screen.getByRole('button', { name: /手动结算/ }))

    await waitFor(() => {
      expect(evaluateKl8Recommendations).toHaveBeenCalledTimes(1)
    })
    expect(emitFeedbackWarning).toHaveBeenCalledWith('下一期开奖尚未同步，暂无法结算')
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

  it('shows the structure profile of the recommended numbers', async () => {
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation()], 1))

    render(<LotteryKl8Panel />)

    await screen.findAllByText('今晚开 · 预测 2026214')
    expect(screen.getByText('结构画像')).toBeInTheDocument()
    expect(screen.getByText('和值 172')).toBeInTheDocument()
    expect(screen.getByText('奇偶 2:3')).toBeInTheDocument()
    expect(screen.getByText('最长连号 2')).toBeInTheDocument()
    expect(screen.getByText('不同尾数 4')).toBeInTheDocument()
  })

  it('warns when the shown record still uses the legacy pick size', async () => {
    const legacy = recommendation({
      pickSize: 4,
      groups: [{ numbers: [2, 11, 12, 73], reason: '旧选4 记录' }],
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([legacy], 1))

    render(<LotteryKl8Panel />)

    expect(await screen.findByText('这条记录是旧口径（选4）')).toBeInTheDocument()
    expect(screen.getByText(/点右上角「Java 推荐选5」/)).toBeInTheDocument()
  })

  it('summarizes settled recommendation track record', async () => {
    const settled = (id: number, hits: number) => recommendation({
      id,
      evaluatedIssueNo: `20262${id}`,
      totalHitCount: hits,
      maxHitCount: hits,
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(
      pageOf([settled(1, 3), settled(2, 1), recommendation()], 3),
    )

    render(<LotteryKl8Panel />)

    expect(await screen.findByText('近 3 次推荐表现')).toBeInTheDocument()
    expect(screen.getByText('已结算 2 次')).toBeInTheDocument()
    expect(screen.getByText('平均命中 2.00')).toBeInTheDocument()
    expect(screen.getByText('中3个及以上 1 次')).toBeInTheDocument()
    expect(screen.getByText('占比 50.0%')).toBeInTheDocument()
  })

  it('renders walk-forward backtest and candidate pool tabs from analysis json', async () => {
    vi.mocked(listKl8Draws).mockResolvedValue(pageOf([
      {
        issueNo: '2026213',
        drawDate: '2026-08-11',
        numbers: [6, 7, 8, 11, 12, 13, 18, 21, 33, 36, 37, 42, 44, 56, 57, 58, 60, 66, 71, 80],
        sourceName: 'test',
      },
    ], 1))
    const withAnalysis = recommendation({
      analysisJson: JSON.stringify({
        confidenceLabel: '低',
        analysis: {
          overview: '综合算法基于走查前推回测择优后的权重选出唯一一组选5号码。',
          featureSignals: ['热度因子近期表现靠前'],
          combinationLogic: ['四策略加权投票 + 连号种子 + 结构均衡'],
          riskWarnings: ['彩票开奖结果具有独立随机性，历史统计不能保证命中。'],
        },
        backtestSummary: {
          evaluatedIssueCount: 180,
          averageHitCount: 1.31,
          maxHitCount: 4,
          hitDistribution: { 0: 20, 1: 80, 2: 50, 3: 20, 4: 10, 5: 0 },
          factorWeights: {
            hotWeight: 1.35,
            missingWeight: 0.85,
            trendWeight: 0.95,
            decayWeight: 1.15,
            pairWeight: 0.95,
            balanceWeight: 0.85,
          },
          weightProfileName: '热度优先',
          hitAtLeastThreeRate: 0.1667,
          topFactorNames: ['热度 1.40'],
          summary: '滚动回测 180 期（走查前推，不含未来信息）',
        },
        optimizedPortfolio: {
          groups: [{ numbers: [2, 11, 12, 73, 74], score: 61.2, reason: '组合优化', evidence: ['结构均衡修复 0 次'] }],
          summary: '组合优化完成',
          diagnostics: { longestConsecutiveRun: '2' },
          neighborRecommendations: [
            { number: 12, anchorNumbers: [11], directions: ['右邻'], score: 9.5, selected: true, reason: '邻位', evidence: ['上一期邻位来源 [11]'] },
          ],
          pairRecommendations: [
            { leftNumber: 11, rightNumber: 12, count: 30, lift: 1.2, score: 36, selected: false, reason: '共现参考', evidence: ['样本内共现 30 次'] },
          ],
        },
        analysisSections: ['回测层：走查前推'],
      }),
      candidatePoolJson: JSON.stringify([
        { number: 11, score: 70.5, roles: ['热号'], evidence: '综合分 70.50' },
      ]),
    })
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([withAnalysis], 1))

    render(<LotteryKl8Panel />)

    await screen.findAllByText('今晚开 · 预测 2026214')
    await userEvent.click(screen.getByRole('tab', { name: /深度分析/ }))
    expect(await screen.findByText(/择优配置 热度优先/)).toBeInTheDocument()
    expect(screen.getByText(/中3个及以上 16.7%/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /候选池/ }))
    expect(await screen.findByText('综合分 70.50')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /走势分析/ }))
    expect(await screen.findByRole('grid', { name: '快乐8近期开奖走势' })).toBeInTheDocument()
  })
})
