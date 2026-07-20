import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import { getHotQuestions } from '../../api/question'
import { getCategories } from '../../api/category'
import Home from './index'

const fixtures = vi.hoisted(() => ({
  hotQuestions: [
    {
      id: 1,
      title: 'HashMap 为什么线程不安全？',
      content: '标准答案',
      difficulty: 'HARD',
      categoryName: 'Java 集合',
      categoryId: 1,
      tags: ['HashMap', '并发'],
      viewCount: 300,
      createTime: '2026-06-20T00:00:00.000Z',
    },
  ],
  categories: [
    {
      id: 1,
      name: 'Java 集合',
      icon: 'java',
      description: '集合框架与并发场景',
      sortOrder: 1,
    },
  ],
}))

vi.mock('../../api/question', () => ({
  getHotQuestions: vi.fn().mockResolvedValue(fixtures.hotQuestions),
}))

vi.mock('../../api/category', () => ({
  getCategories: vi.fn().mockResolvedValue(fixtures.categories),
}))

function completedPlanProgress(): StudyProgress {
  const now = new Date().toISOString()
  return {
    ...createDefaultProgress(now),
    dailyPlan: [1],
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 集合',
        tags: ['HashMap', '并发'],
        viewCount: 300,
      },
    },
    questionStates: {
      1: {
        status: 'mastered',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: now,
      },
    },
  }
}

describe('Home', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(completedPlanProgress()))
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
    window.sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('compresses completed progress into the coach action and ability summary', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText('个性化面试教练')).toBeInTheDocument()
    expect(screen.getByLabelText('今日训练与能力画像')).toBeInTheDocument()
    expect(screen.getByText('今日行动')).toBeInTheDocument()
    expect(screen.getByText('能力画像')).toBeInTheDocument()
    expect(screen.queryByLabelText('今日闭环验收')).not.toBeInTheDocument()
  })

  it('refreshes hot questions silently so homepage recovery content is not interrupted by backend misses', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getHotQuestions)).toHaveBeenCalledWith(20, { silentGlobalError: true })
    })
  })

  it('loads homepage categories silently because the grid owns its inline failure state', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getCategories)).toHaveBeenCalledWith({ silentGlobalError: true })
    })
  })

  it('exposes each hot question as a direct detail link', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('link', { name: `打开热门题目 ${fixtures.hotQuestions[0].title}` }),
    ).toHaveAttribute('href', '/question/1')
  })

  it('uses clean homepage category card links without decorative icon noise', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Home />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('link', {
        name: 'Java 集合 集合框架与并发场景 浏览题库',
      }),
    ).toHaveAttribute('href', '/bank/1')
  })
})
