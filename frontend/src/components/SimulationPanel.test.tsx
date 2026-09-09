import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  listLotterySimulations, runLotterySimulation,
} from '../api/tools'
import { emitFeedbackSuccess } from '../utils/feedbackMessage'
import type { LotterySimulation, PageResult } from '../types'
import SimulationPanel from './SimulationPanel'

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
  listLotterySimulations: vi.fn(),
  runLotterySimulation: vi.fn(),
  runKl8Lab: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

function pageOf<T>(content: T[], total: number): PageResult<T> {
  return { content, page: 0, size: 20, total, totalPages: Math.ceil(total / 20) }
}

function simulation(overrides: Partial<LotterySimulation> = {}): LotterySimulation {
  return {
    id: 1,
    lotteryType: 'KL8',
    windowSize: 200,
    leadHistory: 100,
    startIssueNo: '2026090',
    endIssueNo: '2026094',
    evaluatedCount: 200,
    totalHits: 250,
    avgHits: 1.25,
    hitRate: 43,
    zeroHitCount: 20,
    maxHits: 4,
    secondaryAvg: 1.25,
    hit4Count: 10,
    hitDistribution: '{"0":20,"1":94,"2":60,"3":16,"4":10}',
    summary: '快乐8 选5×1组 模拟 200 期：平均命中 1.25 个，中 2 个及以上占比 43.0%，中 3 个及以上 26 期',
    createdAt: '2026-08-18T10:00:00',
    ...overrides,
  }
}

describe('SimulationPanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listLotterySimulations).mockResolvedValue(pageOf([], 0))
  })

  it('runs a KL8 pick-5 simulation and shows stats', async () => {
    vi.mocked(runLotterySimulation).mockResolvedValue(simulation())

    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')
    await userEvent.click(screen.getByRole('button', { name: /开始模拟/ }))

    await waitFor(() => {
      expect(runLotterySimulation).toHaveBeenCalledWith('KL8', 200)
    })
    expect(await screen.findByText(/快乐8 选5×1组 模拟 200 期/)).toBeInTheDocument()
    expect(screen.getByText('中3个及以上比例')).toBeInTheDocument()
    // 命中分布 {0:20,1:94,2:60,3:16,4:10} → 中3个及以上 = (16+10)/200 = 13%
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('中4个')).toBeInTheDocument()
    expect(emitFeedbackSuccess).toHaveBeenCalled()
  })

  it('runs with the selected window', async () => {
    vi.mocked(runLotterySimulation).mockResolvedValue(simulation({ windowSize: 500 }))

    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')
    await userEvent.click(screen.getByRole('button', { name: '500期' }))
    await userEvent.click(screen.getByRole('button', { name: /开始模拟/ }))

    await waitFor(() => {
      expect(runLotterySimulation).toHaveBeenCalledWith('KL8', 500)
    })
  })

  it('accepts a custom window from 10 to 1000', async () => {
    vi.mocked(runLotterySimulation).mockResolvedValue(simulation({ windowSize: 10, evaluatedCount: 10 }))

    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')
    const input = screen.getByRole('spinbutton')
    await userEvent.clear(input)
    await userEvent.type(input, '10')
    await userEvent.click(screen.getByRole('button', { name: /开始模拟/ }))

    await waitFor(() => {
      expect(runLotterySimulation).toHaveBeenCalledWith('KL8', 10)
    })
  })

  it('shows simulation history items', async () => {
    vi.mocked(listLotterySimulations).mockResolvedValue(pageOf([simulation()], 1))

    render(<SimulationPanel />)

    expect(await screen.findByText(/快乐8 选5×1组 · 200 期/)).toBeInTheDocument()
    expect(screen.getByText(/2026090 ~ 2026094/)).toBeInTheDocument()
    expect(screen.getByText(/200 期结算 · 命中率 43% · 最高 4 个/)).toBeInTheDocument()
  })

  it('switches between replay and probability lab modes', async () => {
    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')

    await userEvent.click(screen.getByText('概率实验室'))
    expect(await screen.findByText('还没有实验数据')).toBeInTheDocument()
    expect(screen.queryByText('暂无模拟记录，选择参数后点击开始模拟。')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('历史回放'))
    expect(await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')).toBeInTheDocument()
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(listLotterySimulations).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<SimulationPanel />)

    await waitFor(() => {
      expect(screen.getByText('暂无模拟记录，选择参数后点击开始模拟。')).toBeInTheDocument()
    })
  })
})
