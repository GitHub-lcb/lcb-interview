import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../types'
import NextTrainingQueuePanel from './NextTrainingQueuePanel'
import { createDefaultProgress } from '../utils/studyProgress'
import { writePracticeAnswerDraft } from '../utils/practiceAnswerDraftStore'

const NOW = '2026-06-18T09:00:00.000Z'
const { navigate } = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

function progressWithScoreImpact(): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    targetRole: 'Java 后端',
    dailyPlan: [1],
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全',
        difficulty: 'MEDIUM',
        categoryName: 'Java 集合',
        tags: ['Java'],
        viewCount: 120,
      },
    },
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: NOW,
      },
    },
    interviewAttempts: {
      1: [interviewAttempt(1, 55)],
    },
  }
}

function interviewAttempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt: NOW,
    feedback: {
      score,
      level: 'needs-work',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('NextTrainingQueuePanel', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    localStorage.clear()
    navigate.mockReset()

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

  it('renders the next training queue and its one-click actions', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NextTrainingQueuePanel progress={progressWithScoreImpact()} now={NOW} />
      </MemoryRouter>
    )

    expect(screen.getByLabelText('下一轮训练队列')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '下一轮训练队列' })).toBeInTheDocument()
    expect(screen.getByText('HashMap 为什么线程不安全')).toBeInTheDocument()
    expect(screen.getByText('评分影响 · 薄弱')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始下一轮训练/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重答补强/ })).toBeInTheDocument()
  })

  it('surfaces unsubmitted answer drafts before the next queue', async () => {
    writePracticeAnswerDraft(1, 'HashMap 草稿回答', '2026-06-18T09:30:00.000Z')

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NextTrainingQueuePanel progress={progressWithScoreImpact()} now={NOW} />
      </MemoryRouter>
    )

    const recovery = screen.getByLabelText('未提交回答草稿')
    expect(within(recovery).getByRole('heading', { name: '继续未提交回答' })).toBeInTheDocument()
    expect(within(recovery).getByText('1 份草稿待评分')).toBeInTheDocument()
    expect(within(recovery).getByText('HashMap 为什么线程不安全')).toBeInTheDocument()

    await userEvent.click(within(recovery).getByRole('button', { name: /恢复 1 份草稿/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=1')
  })

  it('copies next training queue markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <NextTrainingQueuePanel progress={progressWithScoreImpact()} now={NOW} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制训练队列/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 下一轮训练队列')
    expect(writeText.mock.calls[0][0]).toContain('行动：重答补强')
  })
})
