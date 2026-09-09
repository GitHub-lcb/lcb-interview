import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { runKl8Lab } from '../api/tools'
import { emitFeedbackSuccess } from '../utils/feedbackMessage'
import type { LotteryKl8LabReport } from '../types'
import LotteryKl8LabPanel from './LotteryKl8LabPanel'

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
  runKl8Lab: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

function labReport(overrides: Partial<LotteryKl8LabReport> = {}): LotteryKl8LabReport {
  return {
    pickSize: 5,
    baseIssueCount: 2000,
    windowSize: 100,
    evaluatedIssueCount: 180,
    baselineExpectedHits: 1.25,
    baselineAtLeastThreeRate: 0.0967,
    baselineAtLeastFourRate: 0.0127,
    baselineFullHitRate: 0.000645,
    requiredSampleSizeForOnePointLift: 7039,
    variants: [
      {
        name: 'hot',
        label: '热度优先',
        selected: true,
        evaluatedIssueCount: 180,
        averageHitCount: 1.28,
        atLeastThreeRate: 0.1,
        ciLow: 0.063,
        ciHigh: 0.155,
        lift: 0.0033,
        zScore: 0.16,
        significant: false,
        verdict: '与基线无显著差异',
        hitDistribution: { 0: 40, 1: 70, 2: 50, 3: 15, 4: 4, 5: 1 },
      },
      {
        name: 'decay',
        label: '衰减热度优先',
        selected: false,
        evaluatedIssueCount: 180,
        averageHitCount: 1.2,
        atLeastThreeRate: 0.089,
        ciLow: 0.055,
        ciHigh: 0.14,
        lift: -0.0077,
        zScore: -0.35,
        significant: false,
        verdict: '与基线无显著差异',
        hitDistribution: { 0: 45, 1: 72, 2: 47, 3: 13, 4: 3, 5: 0 },
      },
    ],
    portfolios: [
      {
        ticketCount: 1,
        disjointRate: 0.09,
        disjointCiLow: 0.05,
        disjointCiHigh: 0.15,
        repeatedRate: 0.09,
        liftOverRepeated: 0,
        liftOverSingle: 0,
        evaluatedIssueCount: 100,
      },
      {
        ticketCount: 3,
        disjointRate: 0.24,
        disjointCiLow: 0.17,
        disjointCiHigh: 0.33,
        repeatedRate: 0.09,
        liftOverRepeated: 0.15,
        liftOverSingle: 0.15,
        evaluatedIssueCount: 100,
      },
    ],
    conclusion: '单注「中 3 个及以上」的理论概率固定为 9.67%（超几何分布），任何选号策略都无法改变它。',
    disclaimer: '彩票结果具有随机性，本实验室只做统计检验，不构成投注建议。',
    ...overrides,
  }
}

function statisticValue(title: string): string {
  const content = screen.getByText(title).closest('.ant-statistic')?.querySelector('.ant-statistic-content')
  return content?.textContent ?? ''
}

describe('LotteryKl8LabPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the empty state before the first experiment', () => {
    render(<LotteryKl8LabPanel />)

    expect(screen.getByText('还没有实验数据')).toBeInTheDocument()
    expect(screen.getByText(/单注概率是常量/)).toBeInTheDocument()
  })

  it('runs the lab and renders baseline, variants and portfolio results', async () => {
    vi.mocked(runKl8Lab).mockResolvedValue(labReport())

    render(<LotteryKl8LabPanel />)

    await userEvent.click(screen.getByRole('button', { name: /运行第一次概率实验/ }))

    await waitFor(() => {
      expect(runKl8Lab).toHaveBeenCalledWith({ baseIssueCount: 2000, windowSize: 100, maxTicketCount: 3 })
    })
    expect(await screen.findByText(/理论基线（选5）/)).toBeInTheDocument()
    // antd Statistic 会把整数位和小数位拆成两个 span，这里读取整块内容
    expect(statisticValue('中3个及以上概率')).toBe('9.67%')
    expect(statisticValue('期望命中')).toBe('1.25')
    expect(screen.getByText(/需要约 7039 期样本/)).toBeInTheDocument()
    expect(screen.getByText('热度优先')).toBeInTheDocument()
    expect(screen.getByText('当前生产配置')).toBeInTheDocument()
    expect(screen.getAllByText('与基线无显著差异').length).toBe(2)
    expect(screen.getByText('10.00%')).toBeInTheDocument()
    expect(screen.getAllByText('3 注').length).toBeGreaterThan(0)
    expect(screen.getByText('24.00%')).toBeInTheDocument()
    expect(screen.getAllByText('+15.00%').length).toBeGreaterThan(0)
    expect(screen.getByText(labReport().conclusion)).toBeInTheDocument()
    expect(emitFeedbackSuccess).toHaveBeenCalledWith('概率实验完成，结论已更新')
  })

  it('clamps experiment parameters before calling the api', async () => {
    vi.mocked(runKl8Lab).mockResolvedValue(labReport())

    render(<LotteryKl8LabPanel />)

    await userEvent.click(screen.getByRole('button', { name: /运行第一次概率实验/ }))
    await waitFor(() => expect(runKl8Lab).toHaveBeenCalledTimes(1))

    // antd Segmented 的 radio input 是 pointer-events:none，点击可见文案触发切换
    await userEvent.click(screen.getByText('200 期'))
    await userEvent.click(screen.getByText('5 注'))
    await userEvent.click(screen.getByRole('button', { name: /运行概率实验/ }))

    await waitFor(() => {
      expect(runKl8Lab).toHaveBeenLastCalledWith({ baseIssueCount: 2000, windowSize: 200, maxTicketCount: 5 })
    })
  })

  it('contains api failures without an unhandled rejection', async () => {
    vi.mocked(runKl8Lab).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<LotteryKl8LabPanel />)

    await userEvent.click(screen.getByRole('button', { name: /运行第一次概率实验/ }))

    await waitFor(() => {
      expect(screen.getByText('还没有实验数据')).toBeInTheDocument()
    })
  })
})
