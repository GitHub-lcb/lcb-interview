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
import type { LotteryKl8Draw, LotteryKl8Recommendation, PageResult } from '../types'

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
    await userEvent.click(screen.getByRole('button', { name: /Java 推荐选5/ }))

    await waitFor(() => {
      expect(createKl8Recommendation).toHaveBeenCalledWith(2000, 5)
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
      pickSize: 5,
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

  it('shows latest-neighbor candidates instead of required pair strategy', async () => {
        const recommendation: LotteryKl8Recommendation = {
      id: 2,
      source: 'RULE_BASED',
      pickSize: 5,
      baseIssueCount: 2000,
      latestIssueNo: '20260629001',
      groups: [
        { numbers: [9, 10, 11, 33, 35], reason: '邻位连号生成 5 码' },
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
          summary: '基于上一期左右邻位候选和连号结构生成 1 组精选号码。',
          groups: [
            { numbers: [9, 10, 11, 33, 35], score: 91.5, reason: '邻位连号', evidence: ['来自上一期 10、34 的左右邻位', '形成 9、10、11 三连号'] },
          ],
          diagnostics: { selectedNeighborCount: '5' },
          neighborRecommendations: [
            { number: 9, anchorNumbers: [10], directions: ['左邻'], score: 93, selected: true, reason: '上一期 10 左邻', evidence: ['来自上一期 10、34 的左右邻位'] },
            { number: 10, anchorNumbers: [11], directions: ['左邻'], score: 92, selected: true, reason: '上一期 11 左邻', evidence: ['连号补位'] },
            { number: 11, anchorNumbers: [10, 12], directions: ['右邻', '左邻'], score: 91, selected: true, reason: '上一期 10/12 邻位', evidence: ['三连号结构'] },
          ],
          pairRecommendations: [
            { leftNumber: 1, rightNumber: 23, count: 20, lift: 1.2, score: 98, selected: false, reason: '共现参考', evidence: ['共现 20 次'] },
          ],
        },
      }),
      hitSummaryJson: JSON.stringify({
        issueNo: '20260629002',
        drawDate: '2026-06-30',
        drawNumbers: [9, 10, 23, 45, 60],
        totalHitCount: 3,
        maxHitCount: 3,
        pairs: [],
        groups: [
          { groupIndex: 1, numbers: [9, 10, 11, 33, 35], hitNumbers: [9, 10, 35], hitCount: 3 },
        ],
      }),
      disclaimer: '测试免责声明',
      createdAt: '2026-06-29T10:00:00',
    }
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation], 8))

    render(<LotteryKl8Panel />)

    expect(await screen.findByText('邻位候选')).toBeInTheDocument()
    expect(screen.getAllByText('来自上一期 10、34 的左右邻位').length).toBeGreaterThan(0)
    expect(screen.queryByText('核心对子')).not.toBeInTheDocument()
    const feedbackTabs = screen.getAllByRole('tab', { name: /命中反馈/ })
    await userEvent.click(feedbackTabs[feedbackTabs.length - 1])
    expect(screen.queryByText('对子命中反馈')).not.toBeInTheDocument()
  })

  it('shows trend matrix with latest neighbors recommended numbers and consecutive runs', async () => {
    const draws: LotteryKl8Draw[] = [
      {
        issueNo: '20260629003',
        drawDate: '2026-06-29',
        numbers: [9, 10, 11, 20, 21, 22, 34, 35, 50, 51, 60, 61, 62, 63, 64, 70, 71, 72, 73, 74],
        sourceName: 'test',
      },
      {
        issueNo: '20260629002',
        drawDate: '2026-06-28',
        numbers: [10, 34, 45, 46, 47, 48, 49, 52, 53, 54, 55, 56, 57, 58, 59, 65, 66, 67, 68, 69],
        sourceName: 'test',
      },
      {
        issueNo: '20260629001',
        drawDate: '2026-06-27',
        numbers: [1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 36, 37, 38, 39, 40],
        sourceName: 'test',
      },
    ]
        const recommendation: LotteryKl8Recommendation = {
      id: 3,
      source: 'RULE_BASED',
      pickSize: 5,
      baseIssueCount: 2000,
      latestIssueNo: '20260629002',
      groups: [
        { numbers: [9, 10, 11, 33, 35], reason: '邻位连号生成 5 码' },
      ],
      featureSummary: '测试摘要',
      analysisJson: JSON.stringify({
        confidenceLabel: '中',
        analysis: {
          overview: '规则推荐',
          featureSignals: [],
          combinationLogic: [],
          riskWarnings: [],
        },
        optimizedPortfolio: {
          summary: '基于上一期左右邻位候选和连号结构生成 1 组精选号码。',
          groups: [
            { numbers: [9, 10, 11, 33, 35], score: 91.5, reason: '邻位连号', evidence: ['形成 9、10、11 三连号'] },
          ],
          diagnostics: { selectedNeighborCount: '5', longestConsecutiveRun: '3' },
          neighborRecommendations: [
            { number: 9, anchorNumbers: [10], directions: ['左邻'], score: 93, selected: true, reason: '上一期 10 左邻', evidence: ['来自上一期 10 的左邻位'] },
            { number: 11, anchorNumbers: [10], directions: ['右邻'], score: 92, selected: true, reason: '上一期 10 右邻', evidence: ['来自上一期 10 的右邻位'] },
            { number: 33, anchorNumbers: [34], directions: ['左邻'], score: 91, selected: true, reason: '上一期 34 左邻', evidence: ['来自上一期 34 的左邻位'] },
            { number: 35, anchorNumbers: [34], directions: ['右邻'], score: 90, selected: true, reason: '上一期 34 右邻', evidence: ['来自上一期 34 的右邻位'] },
          ],
        },
      }),
      candidatePoolJson: JSON.stringify([
        { number: 9, score: 88.8, roles: ['邻位候选', '趋势回补'], evidence: '近期开奖邻位回补，走势仍在抬升' },
      ]),
      disclaimer: '测试免责声明',
      createdAt: '2026-06-29T10:00:00',
    }
    vi.mocked(listKl8Draws).mockResolvedValue(pageOf(draws, 30))
    vi.mocked(listKl8Recommendations).mockResolvedValue(pageOf([recommendation], 8))

    render(<LotteryKl8Panel />)

    const trendTabs = await screen.findAllByRole('tab', { name: /走势分析/ })
    await userEvent.click(trendTabs[trendTabs.length - 1])

    expect(screen.getByText('近 3 期号码走势')).toBeInTheDocument()
    expect(screen.getByText('上一期 20260629002')).toBeInTheDocument()
    expect(screen.getByText('邻位候选 4 个')).toBeInTheDocument()
    expect(screen.getByText('推荐号码 5 个')).toBeInTheDocument()
    expect(screen.getByText('最长连号 3 连')).toBeInTheDocument()
    const trendNumberCell = screen.getByLabelText('号码 9 在期号 20260629003，命中，推荐，邻位候选，连号')
    expect(trendNumberCell).toBeInTheDocument()
    expect(screen.getByText('09-10-11')).toBeInTheDocument()

    await userEvent.click(trendNumberCell)

    expect(screen.getByText('号码 09 详情')).toBeInTheDocument()
    expect(screen.getByText('近 3 期开出 1 次')).toBeInTheDocument()
    expect(screen.getByText('最近出现 20260629003')).toBeInTheDocument()
    expect(screen.getByText('当前推荐')).toBeInTheDocument()
    expect(screen.getAllByText('邻位候选').length).toBeGreaterThan(0)
    expect(screen.getByText('连号结构')).toBeInTheDocument()
    expect(screen.getByText('上一期 10 左邻')).toBeInTheDocument()
    expect(screen.getByText('候选分 88.80')).toBeInTheDocument()
    expect(screen.getByText('近期开奖邻位回补，走势仍在抬升')).toBeInTheDocument()
  })
})
