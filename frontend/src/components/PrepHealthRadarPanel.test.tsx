import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import type { StudyProgress } from '../types'
import PrepHealthRadarPanel from './PrepHealthRadarPanel'

const NOW = '2026-06-17T00:00:00.000Z'

function progressWithHealthRisk(): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    targetRole: 'Java 后端',
    dailyPlan: [1, 2],
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 1,
        lastReviewedAt: '2026-06-13T00:00:00.000Z',
      },
      2: {
        status: 'mastered',
        addedToPlan: true,
        reviewCount: 3,
        lastReviewedAt: NOW,
      },
    },
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 并发',
        tags: ['Java'],
        viewCount: 120,
      },
      2: {
        id: 2,
        title: 'MySQL 索引为什么会失效？',
        difficulty: 'MEDIUM',
        categoryName: 'MySQL',
        tags: ['MySQL'],
        viewCount: 140,
      },
    },
  }
}

describe('PrepHealthRadarPanel', () => {
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
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithHealthRisk()))
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('copies prep health radar markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PrepHealthRadarPanel />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制雷达/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 备考健康雷达')
    expect(writeText.mock.calls[0][0]).toContain('## 健康概览')
    expect(writeText.mock.calls[0][0]).toContain('入口：/study')
  })
})
