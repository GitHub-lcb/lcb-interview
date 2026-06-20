import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewFeedback, StudyProgress } from '../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import { writePracticeAnswerDraft } from '../utils/practiceAnswerDraftStore'
import StudyCommandCenter from './StudyCommandCenter'

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

function attempt(score: number): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [],
    advice: [],
    followUps: [],
    source: 'LOCAL_RULE_BASED',
  }
}

function progress(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {
      1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
    },
    questionSnapshots: {
      1: { id: 1, title: 'JVM 调优题', difficulty: 'MEDIUM', categoryName: 'JVM', tags: ['JVM'], viewCount: 120 },
      2: { id: 2, title: 'MySQL 索引题', difficulty: 'MEDIUM', categoryName: 'MySQL', tags: ['MySQL'], viewCount: 99 },
      3: { id: 3, title: 'Java 并发题', difficulty: 'HARD', categoryName: 'Java 并发', tags: ['并发'], viewCount: 88 },
    },
    dailyPlan: [2, 3],
    interviewAttempts: {
      1: [{ questionId: 1, answer: '结构化回答', feedback: attempt(86), createdAt: '2026-06-18T00:00:00.000Z' }],
    },
  }
}

describe('StudyCommandCenter', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress()))
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

  it('renders next training queue inside the command center', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyCommandCenter />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '下一轮训练' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /开始下一轮训练/ })).toBeInTheDocument()
    expect(screen.getByText('Java 并发题')).toBeInTheDocument()
    expect(screen.getByText(/薄弱题/)).toBeInTheDocument()
  })

  it('prioritizes unsubmitted answer drafts inside the command center', async () => {
    writePracticeAnswerDraft(2, 'MySQL 索引草稿回答', '2026-06-18T09:30:00.000Z')

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyCommandCenter />
      </MemoryRouter>,
    )

    const recovery = screen.getByLabelText('备考指挥未提交回答')
    expect(within(recovery).getByRole('heading', { name: '先恢复未提交回答' })).toBeInTheDocument()
    expect(within(recovery).getByText('MySQL 索引题')).toBeInTheDocument()
    expect(within(recovery).getByText('1 份草稿待评分')).toBeInTheDocument()

    await userEvent.click(within(recovery).getByRole('button', { name: /恢复 1 份草稿/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2')
  })

  it('copies study command center markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyCommandCenter />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制指挥/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 备考指挥中心')
    expect(writeText.mock.calls[0][0]).toContain('## 指挥概览')
    expect(writeText.mock.calls[0][0]).toContain('## 就绪因子')
    expect(writeText.mock.calls[0][0]).toContain('## 下一轮训练队列')
    expect(writeText.mock.calls[0][0]).toContain('## 下一步行动')
  })
})
