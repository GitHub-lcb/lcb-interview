import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import Training from './index'

vi.mock('../../components/NextTrainingQueuePanel', () => ({
  default: () => <div data-testid="next-training-queue-panel" />,
}))

function buildProgress(dailyPlan: number[]): StudyProgress {
  const progress = createDefaultProgress('2026-10-20T00:00:00.000Z')
  return {
    ...progress,
    dailyPlan,
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 集合',
        tags: ['HashMap'],
        viewCount: 300,
      },
      2: {
        id: 2,
        title: 'MySQL 索引失效场景',
        difficulty: 'MEDIUM',
        categoryName: 'MySQL',
        tags: ['索引'],
        viewCount: 200,
      },
    },
    questionStates: {
      1: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      2: { status: 'weak', addedToPlan: true, reviewCount: 1 },
    },
  }
}

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderTraining(initialEntry = '/training') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/training" element={<Training />} />
        <Route path="/practice" element={<LocationProbe />} />
        <Route path="/recall" element={<LocationProbe />} />
        <Route path="/experiences" element={<LocationProbe />} />
        <Route path="/banks" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Training page', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
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

  it('starts the unfinished daily plan as the primary action', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(buildProgress([1, 2])))

    renderTraining()

    await userEvent.click(screen.getByRole('button', { name: /开始今日训练（2 题）/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/practice?queue=1,2&from=daily-plan')
  })

  it('falls back to the question bank when there is no daily plan', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(buildProgress([])))

    renderTraining()

    await userEvent.click(screen.getByRole('button', { name: /从题库选一组题/ }))

    expect(screen.getByTestId('location')).toHaveTextContent('/banks')
  })

  it('keeps the three training modes wired to their dedicated pages', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(buildProgress([1])))

    renderTraining()

    expect(screen.getByRole('heading', { name: '选择训练方式' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /进入模拟面试/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始主动回忆/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /进入面经场景/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /开始主动回忆/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('/recall')
  })

  it('renders the training loop and the shared next-round queue', () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(buildProgress([1])))

    renderTraining()

    expect(screen.getByLabelText('训练闭环')).toBeInTheDocument()
    expect(screen.getByText('选题')).toBeInTheDocument()
    expect(screen.getByText('复盘')).toBeInTheDocument()
    expect(screen.getByTestId('next-training-queue-panel')).toBeInTheDocument()
  })
})
