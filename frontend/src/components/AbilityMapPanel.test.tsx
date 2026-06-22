import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { StudyProgress } from '../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import AbilityMapPanel from './AbilityMapPanel'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

function progressWithAbilityGap(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionStates: {
      2: { status: 'weak', addedToPlan: true, reviewCount: 1 },
      5: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    },
    questionSnapshots: {
      2: {
        id: 2,
        title: 'Java 并发可见性怎么保证？',
        difficulty: 'HARD',
        categoryName: 'Java 并发',
        tags: ['volatile'],
        viewCount: 120,
      },
      5: {
        id: 5,
        title: 'Redis 缓存雪崩怎么处理？',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        tags: ['Redis'],
        viewCount: 90,
      },
    },
  }
}

describe('AbilityMapPanel', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithAbilityGap()))
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
  })

  it('starts ability-gap practice with the ability map context', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AbilityMapPanel />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /训练短板能力/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2,5&from=ability-gap')
  })
})
