import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getKl8Coverage } from '../api/tools'
import type { LotteryKl8CoverageReport } from '../types'
import LotteryKl8CoveragePanel from './LotteryKl8CoveragePanel'

// antd 响应式组件（Row/Col）依赖 matchMedia，jsdom 未实现需要打桩
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* 兼容旧 API */ },
    removeListener: () => { /* 兼容旧 API */ },
    addEventListener: () => { /* noop */ },
    removeEventListener: () => { /* noop */ },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

vi.mock('../api/tools', () => ({
  getKl8Coverage: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

const mockedGetKl8Coverage = vi.mocked(getKl8Coverage)

/**
 * 构造覆盖优化报告。数值取自后端精确解，便于断言「概率只能靠注数买」这一口径。
 */
function coverageReport(overrides: Partial<LotteryKl8CoverageReport> = {}): LotteryKl8CoverageReport {
  return {
    pickSize: 4,
    minHitLevel: 2,
    ticketPriceYuan: 2,
    maxDisjointTickets: 20,
    singleTicketRate: 0.258947,
    expectedReturnPerTicket: 1.139,
    payoutRate: 0.56952,
    netLossPerTicketYuan: 0.861,
    curve: [
      {
        ticketCount: 1,
        coveredNumbers: 4,
        costYuan: 2,
        atLeastMinHitRate: 0.258947,
        atLeastThreeRate: 0.046311,
        fullHitRate: 0.003063,
        marginalLift: 0.258947,
        costPerPercentPoint: 0,
        expectedReturnYuan: 1.139,
        payoutRate: 0.56952,
      },
      {
        ticketCount: 2,
        coveredNumbers: 8,
        costYuan: 4,
        atLeastMinHitRate: 0.457758,
        atLeastThreeRate: 0.091105,
        fullHitRate: 0.006122,
        marginalLift: 0.198811,
        costPerPercentPoint: 10.06,
        expectedReturnYuan: 2.278,
        payoutRate: 0.56952,
      },
    ],
    targets: [
      {
        targetRate: 0.5,
        requiredTickets: 3,
        coveredNumbers: 12,
        costYuan: 6,
        achievedRate: 0.608707,
        expectedReturnYuan: 3.417,
      },
    ],
    bestValueTicketCount: 2,
    bestValueCostPerPercentPoint: 10.06,
    budgetYuan: 20,
    budgetTicketCount: 10,
    budgetAchievableRate: 0.976926,
    conclusion: '单注概率恒为 25.89%，唯一能提高的是买更多互不重复的号，返奖率恒为 56.95%。',
    disclaimer: '本页面所有概率均为组合数学精确解，不构成投注建议。',
    ...overrides,
  }
}

describe('LotteryKl8CoveragePanel', () => {
  beforeEach(() => {
    mockedGetKl8Coverage.mockReset()
    mockedGetKl8Coverage.mockResolvedValue(coverageReport())
  })

  afterEach(() => {
    cleanup()
  })

  it('挂载后自动拉取覆盖优化报告', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(mockedGetKl8Coverage).toHaveBeenCalledWith({
      pickSize: 4,
      minHitLevel: 2,
      maxTickets: 20,
      budgetYuan: 20,
    })
    expect(await screen.findByText('花多少钱，能买到多少中奖概率')).toBeInTheDocument()
  })

  it('展示成本—概率曲线行与覆盖号码数', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(await screen.findByText('2 注')).toBeInTheDocument()
    expect(await screen.findByText('8 个')).toBeInTheDocument()
    expect(await screen.findByText('45.78%')).toBeInTheDocument()
  })

  it('把「返奖率恒定、不随注数变化」作为不变量明确展示', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(await screen.findByText('不变量：无论怎么买都改不了的数字')).toBeInTheDocument()
    expect(await screen.findByText('返奖率')).toBeInTheDocument()
    expect(await screen.findByText('返奖率与注数无关，这是期望的线性性，不是近似')).toBeInTheDocument()
  })

  it('展示目标概率反查：达到 50% 需要多少注多少钱', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(await screen.findByText('目标概率反查：想达到某个中奖率要花多少')).toBeInTheDocument()
    expect(await screen.findByText('3 注')).toBeInTheDocument()
    expect(await screen.findByText('12 个')).toBeInTheDocument()
  })

  it('展示结论与风险提示', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(await screen.findByText('结论')).toBeInTheDocument()
    expect(await screen.findByText(/返奖率恒为 56.95%/)).toBeInTheDocument()
    expect(await screen.findByText(/最多 20 注互不重复/)).toBeInTheDocument()
  })

  it('切换达标口径后按新口径重新请求', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText('全中4个'))
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalledTimes(2))
    expect(mockedGetKl8Coverage).toHaveBeenLastCalledWith(expect.objectContaining({ minHitLevel: 4 }))
  })

  it('切换预算后按新预算重新请求', async () => {
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText('50 元'))
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalledTimes(2))
    expect(mockedGetKl8Coverage).toHaveBeenLastCalledWith(expect.objectContaining({ budgetYuan: 50 }))
  })

  it('不设预算时隐藏预算提示', async () => {
    mockedGetKl8Coverage.mockResolvedValue(coverageReport({ budgetYuan: 0, budgetTicketCount: 0, budgetAchievableRate: 0 }))
    render(<LotteryKl8CoveragePanel />)
    await userEvent.click(await screen.findByText('不设预算'))
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenLastCalledWith(expect.objectContaining({ budgetYuan: 0 })))
    expect(screen.queryByText(/预算 0 元/)).not.toBeInTheDocument()
  })

  it('接口失败时不渲染陈旧数据，交给全局拦截器提示', async () => {
    mockedGetKl8Coverage.mockRejectedValue(new Error('network down'))
    render(<LotteryKl8CoveragePanel />)
    await waitFor(() => expect(mockedGetKl8Coverage).toHaveBeenCalled())
    expect(screen.queryByText('成本 → 概率曲线')).not.toBeInTheDocument()
    expect(await screen.findByText('正在计算精确解')).toBeInTheDocument()
  })
})
