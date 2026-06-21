import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import Experiences from './index'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

describe('Experiences', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
      targetRole: 'Java 后端',
    }))
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

  it('copies the interview experience playbook markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Experiences />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制场景包/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 真实面试场景包')
    expect(markdown).toContain('## 场景题单')
    expect(markdown).toContain('大厂 Java 后端面试组')
    expect(markdown).toContain('/practice')
  })

  it('includes local weak questions in the copied personal pressure queue', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
      targetRole: 'Java 后端',
      questionStates: {
        20: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00.000Z' },
      },
      questionSnapshots: {
        20: {
          id: 20,
          title: 'ThreadLocal 内存泄漏怎么排查？',
          difficulty: 'HARD',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 220,
        },
      },
      dailyPlan: [20],
    }))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Experiences />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制场景包/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('## 个人押题队列')
    expect(markdown).toContain('ThreadLocal 内存泄漏怎么排查？')
    expect(markdown).toContain('/practice?queue=20&from=experience-playbook')
  })

  it('renders a personal pressure queue from local progress', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
      targetRole: 'Java 后端',
      questionStates: {
        20: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00.000Z' },
      },
      questionSnapshots: {
        20: {
          id: 20,
          title: 'ThreadLocal 内存泄漏怎么排查？',
          difficulty: 'HARD',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 220,
        },
      },
      dailyPlan: [20],
    }))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Experiences />
      </MemoryRouter>,
    )

    const pressureQueue = await screen.findByLabelText('个人押题队列')
    expect(pressureQueue).toHaveTextContent('个人押题队列')
    expect(pressureQueue).toHaveTextContent('ThreadLocal 内存泄漏怎么排查？')
    expect(pressureQueue).toHaveTextContent('薄弱题')
    expect(pressureQueue).toHaveTextContent('面试官追问')
    expect(pressureQueue).toHaveTextContent('请用一个真实项目说明「ThreadLocal 内存泄漏怎么排查？」的触发场景、排查证据和失败边界。')
    expect(pressureQueue).toHaveTextContent('通过口径')
    expect(pressureQueue).toHaveTextContent('能在 60 秒内讲清结论、项目证据、失败边界和下一步兜底。')
    expect(screen.getByRole('button', { name: /开始押题练习/ })).toBeInTheDocument()
  })

  it('opens a single pressure question directly in the experience practice flow', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify({
      ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
      targetRole: 'Java 后端',
      questionStates: {
        20: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00.000Z' },
      },
      questionSnapshots: {
        20: {
          id: 20,
          title: 'ThreadLocal 内存泄漏怎么排查？',
          difficulty: 'HARD',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 220,
        },
      },
      dailyPlan: [20],
    }))

    render(
      <MemoryRouter initialEntries={['/experiences']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Experiences />
        <LocationProbe />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /ThreadLocal 内存泄漏怎么排查/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/practice?queue=20&from=experience-playbook')
  })
})
