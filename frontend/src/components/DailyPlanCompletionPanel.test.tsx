import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../types'
import { createDefaultProgress } from '../utils/studyProgress'
import DailyPlanCompletionPanel from './DailyPlanCompletionPanel'

const NOW = '2026-06-17T09:00:00.000Z'

function interviewAttempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt: NOW,
    feedback: {
      score: 88,
      level: 'strong',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score: 88, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score: 88, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: 88, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score: 88, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function completedProgress(): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    dailyPlan: [1],
    questionStates: {
      1: {
        status: 'mastered',
        addedToPlan: true,
        reviewCount: 3,
        lastReviewedAt: NOW,
      },
    },
    interviewAttempts: {
      1: [interviewAttempt(1)],
    },
  }
}

describe('DailyPlanCompletionPanel', () => {
  afterEach(() => {
    cleanup()
  })

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
  })

  it('renders completion metrics and primary action', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DailyPlanCompletionPanel progress={completedProgress()} now={NOW} />
      </MemoryRouter>
    )

    expect(screen.getByText('今日闭环验收')).toBeInTheDocument()
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0)
    expect(screen.getByText('今日闭环已加强')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /查看冲刺报告/ })).toBeInTheDocument()
  })

  it('copies daily completion markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DailyPlanCompletionPanel progress={completedProgress()} now={NOW} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制验收/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 今日闭环验收')
    expect(writeText.mock.calls[0][0]).toContain('今日闭环已加强')
  })
})
