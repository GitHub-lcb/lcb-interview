import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Question, StudyProgress } from '../types'
import { createDefaultProgress, rememberQuestions } from '../utils/studyProgress'
import DailyPlanBriefPanel from './DailyPlanBriefPanel'

const NOW = '2026-06-17T09:00:00.000Z'

function question(id: number): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    categoryId: 1,
    tags: ['Java'],
    viewCount: 100 + id,
    createTime: '2026-06-15T00:00:00',
  }
}

function progressWithPlan(): StudyProgress {
  let progress = createDefaultProgress(NOW)
  progress = rememberQuestions(progress, [question(1)], NOW)
  return {
    ...progress,
    dailyPlan: [1],
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 1,
        lastReviewedAt: NOW,
      },
    },
  }
}

describe('DailyPlanBriefPanel', () => {
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

  it('renders today plan metrics and question-level reasons', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DailyPlanBriefPanel progress={progressWithPlan()} candidates={[]} now={NOW} />
      </MemoryRouter>
    )

    expect(screen.getByText('今日作战简报')).toBeInTheDocument()
    expect(screen.getByText('计划题量')).toBeInTheDocument()
    expect(screen.getByText('Question 1')).toBeInTheDocument()
    expect(screen.getByText('讲清薄弱点')).toBeInTheDocument()
  })

  it('copies daily plan brief markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DailyPlanBriefPanel progress={progressWithPlan()} candidates={[]} now={NOW} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制简报/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 今日作战简报')
    expect(writeText.mock.calls[0][0]).toContain('Question 1')
  })
})
