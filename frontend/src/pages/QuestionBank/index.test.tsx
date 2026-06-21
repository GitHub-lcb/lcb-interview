import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import { getCategories } from '../../api/category'
import QuestionBank from './index'

const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

const fixtures = vi.hoisted(() => ({
  categories: [
    {
      id: 1,
      name: 'Java 基础',
      icon: 'java',
      description: 'Java 语言基础与常见面试题',
      sortOrder: 1,
    },
  ],
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

vi.mock('../../api/category', () => ({
  getCategories: vi.fn().mockResolvedValue(fixtures.categories),
}))

function setProgress(progress: StudyProgress) {
  window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

function heroPrimaryButton(): HTMLButtonElement {
  const button = document.querySelector('.bank-hero-actions .ant-btn-primary')
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Question bank primary action was not rendered')
  }
  return button
}

describe('QuestionBank', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.clear()
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

  it('loads categories silently because the bank page owns its inline failure state', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getCategories)).toHaveBeenCalledWith({ silentGlobalError: true })
    })
  })

  it('shows an empty filter state and lets users return to all tracks', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: /Java/ })).toBeInTheDocument()

    await user.click(screen.getByText('AI'))

    expect(screen.getByText('该方向暂无题库')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /查看全部方向/ }))

    expect(screen.getByRole('link', { name: /Java/ })).toBeInTheDocument()
  })

  it('labels the track filter for assistive technology', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('radiogroup', { name: '岗位方向筛选' })).toBeInTheDocument()
  })

  it('uses clean hero action names without icon noise', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '继续训练' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '学习计划' })).toBeInTheDocument()
  })

  it('continues from the unfinished daily plan queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionStates: {
        1: { status: 'mastered', addedToPlan: true, reviewCount: 2 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        3: { status: 'new', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1))
    await userEvent.click(heroPrimaryButton())

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2,3&from=daily-plan')
  })

  it('falls back to the general practice queue without unfinished plan items', async () => {
    setProgress(createDefaultProgress('2026-06-21T00:00:00.000Z'))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getCategories).toHaveBeenCalledTimes(1))
    await userEvent.click(heroPrimaryButton())

    expect(navigate).toHaveBeenCalledWith('/practice')
  })

  it('keeps decorative card arrows out of category link names', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: /Java 基础/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /arrow-right/ })).not.toBeInTheDocument()
  })

  it('uses a clean category card link without decorative icon text', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QuestionBank />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('link', {
        name: '后端 Java 基础 Java 语言基础与常见面试题 进入专项',
      }),
    ).toHaveAttribute('href', '/bank/1')
  })
})
