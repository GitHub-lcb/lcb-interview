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
    lotteryType: 'SSQ',
    windowSize: 200,
    leadHistory: 50,
    startIssueNo: '2026090',
    endIssueNo: '2026094',
    evaluatedCount: 200,
    totalHits: 274,
    avgHits: 1.37,
    hitRate: 80,
    zeroHitCount: 20,
    maxHits: 4,
    secondaryAvg: 0.08,
    hit4Count: 10,
    hitDistribution: '{"0":20,"1":60,"2":80,"3":30,"4":10}',
    summary: '双色球 7+1 模拟 200 期：平均命中 1.37 个，至少命中 1 个占比 80.0%',
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

  it('runs simulation and shows stats', async () => {
    vi.mocked(runLotterySimulation).mockResolvedValue(simulation())

    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')
    await userEvent.click(screen.getByRole('button', { name: /开始模拟/ }))

    await waitFor(() => {
      expect(runLotterySimulation).toHaveBeenCalledWith('SSQ', 200)
    })
    expect(await screen.findByText('双色球 7+1 模拟 200 期：平均命中 1.37 个，至少命中 1 个占比 80.0%')).toBeInTheDocument()
    expect(screen.getByText('中4个')).toBeInTheDocument()
    expect(screen.getByText('10期')).toBeInTheDocument()
    expect(screen.getByText('5.0%')).toBeInTheDocument()
    expect(emitFeedbackSuccess).toHaveBeenCalled()
  })

  it('runs with selected type and window', async () => {
    vi.mocked(runLotterySimulation).mockResolvedValue(simulation({ lotteryType: 'DLT', windowSize: 500 }))

    render(<SimulationPanel />)

    await screen.findByText('暂无模拟记录，选择参数后点击开始模拟。')
    await userEvent.click(screen.getByText('大乐透 5+3'))
    await userEvent.click(screen.getByText('500 期'))
    await userEvent.click(screen.getByRole('button', { name: /开始模拟/ }))

    await waitFor(() => {
      expect(runLotterySimulation).toHaveBeenCalledWith('DLT', 500)
    })
  })

  it('shows simulation history items', async () => {
    vi.mocked(listLotterySimulations).mockResolvedValue(pageOf([simulation()], 1))

    render(<SimulationPanel />)

    expect(await screen.findByText(/双色球 7\+1 · 200 期/)).toBeInTheDocument()
    expect(screen.getByText(/2026090 ~ 2026094/)).toBeInTheDocument()
    expect(screen.getByText(/200 期结算 · 命中率 80% · 最高 4 个/)).toBeInTheDocument()
  })

  it('contains protected load failures without an unhandled rejection', async () => {
    vi.mocked(listLotterySimulations).mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))

    render(<SimulationPanel />)

    await waitFor(() => {
      expect(screen.getByText('暂无模拟记录，选择参数后点击开始模拟。')).toBeInTheDocument()
    })
  })
})
