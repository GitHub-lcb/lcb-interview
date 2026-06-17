import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import StudyPlan from './index'

vi.mock('../../api/question', () => ({
  getHotQuestions: vi.fn().mockResolvedValue([]),
}))

function progressWithReviewQueue(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-17T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 并发',
        categoryId: 1,
        tags: ['HashMap', '并发'],
        viewCount: 300,
      },
    },
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: '2026-06-16T09:00:00.000Z',
      },
    },
    dailyPlan: [1],
  }
}

describe('StudyPlan', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithReviewQueue()))
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

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    vi.clearAllMocks()
  })

  it('copies review schedule markdown from the study plan page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制队列/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 智能复习队列')
    expect(markdown).toContain('## 排期概览')
    expect(markdown).toContain('## 复习队列')
    expect(markdown).toContain('HashMap 为什么线程不安全')
    expect(markdown).toContain('入口：/question/1')
  })
})
