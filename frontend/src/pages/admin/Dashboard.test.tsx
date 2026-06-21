import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import * as adminApi from '../../api/admin'
import type { AdminQualitySummary } from '../../types'

vi.mock('../../api/admin', () => ({
  getAdminQualitySummary: vi.fn(),
}))

const summary: AdminQualitySummary = {
  totalQuestions: 120,
  publishedQuestions: 80,
  draftQuestions: 24,
  rejectedQuestions: 4,
  emptyAnswerQuestions: 6,
  qualityRiskQuestions: 18,
  completionRate: 85,
  categories: [
    {
      categoryId: 2,
      categoryName: 'Redis',
      total: 20,
      published: 8,
      draft: 9,
      rejected: 1,
      emptyAnswer: 3,
      shortAnswer: 4,
      missingPrinciple: 5,
      missingRisk: 6,
      missingProjectExp: 7,
      missingCodeExamples: 8,
      missingSummary: 1,
      missingComparison: 2,
      missingScenario: 3,
      missingContentSections: 4,
      invalidDifficulty: 1,
      completionRate: 60,
      riskScore: 71,
    },
  ],
  todos: [
    {
      type: 'EMPTY_ANSWER',
      title: '补齐空答案',
      detail: '空答案不能进入发布流程。',
      categoryId: null,
      categoryName: null,
      count: 6,
      tone: 'danger',
    },
  ],
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    const baseGetComputedStyle = window.getComputedStyle.bind(window)
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => baseGetComputedStyle(element),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders quality metrics, todo actions and risky category ranking', async () => {
    vi.mocked(adminApi.getAdminQualitySummary).mockResolvedValue(summary)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByText('质量风险')).toBeInTheDocument()
    expect(screen.getAllByText('空答案').length).toBeGreaterThan(0)
    expect(screen.getAllByText('完成率').length).toBeGreaterThan(0)

    const todo = screen.getByText('补齐空答案').closest('.ant-list-item')
    expect(todo).not.toBeNull()
    expect(within(todo as HTMLElement).getByText('6 项')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Redis')).toBeInTheDocument())
    const row = screen.getByText('Redis').closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('71')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('60%')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('首要缺口')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('缺代码 8')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('缺结构段 4')).toBeInTheDocument()
  })

  it('uses silent loading and recovers from inline quality summary failure', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.getAdminQualitySummary)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(summary)

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => expect(adminApi.getAdminQualitySummary).toHaveBeenCalledWith({ silentGlobalError: true }))
    expect(await screen.findByText('质量总览加载失败')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /重\s*试/ }))

    await waitFor(() => expect(adminApi.getAdminQualitySummary).toHaveBeenCalledTimes(2))
    expect(adminApi.getAdminQualitySummary).toHaveBeenLastCalledWith({ silentGlobalError: true })
    expect(await screen.findByText('Redis')).toBeInTheDocument()
    expect(screen.queryByText('质量总览加载失败')).not.toBeInTheDocument()
  })
})
