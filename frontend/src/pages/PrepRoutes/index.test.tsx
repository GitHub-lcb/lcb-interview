import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import PrepRoutes from './index'

function LocationProbe() {
  const location = useLocation()

  return <div>当前位置 {location.pathname}{location.search}</div>
}

function progressWithJavaRoute(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: '线程池参数如何设置？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 基础',
        tags: ['Java'],
        viewCount: 100,
      },
      2: {
        id: 2,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 并发',
        tags: ['Java 并发'],
        viewCount: 240,
      },
    },
    questionStates: {
      1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      2: { status: 'weak', addedToPlan: true, reviewCount: 2 },
    },
    dailyPlan: [2],
  }
}

describe('PrepRoutes', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithJavaRoute()))
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

  it('copies the route playbook markdown from the routes page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PrepRoutes />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制路线包/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 备考路线战术包')
    expect(markdown).toContain('## 路线战术')
    expect(markdown).toContain('Java 后端冲刺路线')
    expect(markdown).toContain('/practice?queue=2&from=ability-gap')
  })

  it('starts route training with ability-gap practice context', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/routes" element={<PrepRoutes />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /路线训练/ }))

    expect(await screen.findByText('当前位置 /practice?queue=2&from=ability-gap')).toBeInTheDocument()
  })
})
