import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, Question, StudyProgress } from '../types'
import { createDefaultProgress, rememberQuestions, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import { writePracticeAnswerDraft } from '../utils/practiceAnswerDraftStore'
import FirstRunLaunchpad from './FirstRunLaunchpad'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

const hotQuestions: Question[] = [
  { id: 1, title: 'HashMap 并发问题', content: 'answer', difficulty: 'HARD', categoryName: 'Java 集合', tags: ['Java'], viewCount: 300, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 2, title: 'Redis 缓存雪崩', content: 'answer', difficulty: 'MEDIUM', categoryName: 'Redis', tags: ['Redis'], viewCount: 240, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 3, title: 'MySQL 索引优化', content: 'answer', difficulty: 'MEDIUM', categoryName: 'MySQL', tags: ['MySQL'], viewCount: 220, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 4, title: 'JVM GC 调优', content: 'answer', difficulty: 'HARD', categoryName: 'JVM', tags: ['JVM'], viewCount: 210, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 5, title: 'Spring 事务传播', content: 'answer', difficulty: 'MEDIUM', categoryName: 'Spring', tags: ['Spring'], viewCount: 200, createTime: '2026-06-20T00:00:00.000Z' },
]

function setProgress(progress: StudyProgress) {
  window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

function directSimulateButton(): HTMLButtonElement {
  const button = document.querySelector('.first-run-secondary-actions .ant-btn:last-child')
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Direct simulate action was not rendered')
  }
  return button
}

function scoredAttempt(questionId: number, score: number, createdAt: string): InterviewAttempt {
  return {
    questionId,
    answer: `Question ${questionId} answer`,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心结论' },
        { key: 'structure', label: '结构化', score, summary: '表达结构清晰' },
        { key: 'specificity', label: '具体性', score, summary: '包含项目化证据' },
        { key: 'risk', label: '风险意识', score, summary: '能说明边界' },
      ],
      advice: [],
      followUps: [],
      source: 'LOCAL_RULE_BASED',
    },
    createdAt,
  }
}

describe('FirstRunLaunchpad', () => {
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
  })

  it('shows the first-run action and creates a local practice queue', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Java 后端 岗位摸底' })).toBeInTheDocument()
    expect(screen.getByLabelText('本轮题单预览')).toHaveTextContent('HashMap 并发问题')
    expect(screen.getByLabelText('本轮题单预览')).toHaveTextContent('Java 集合 · HARD')
    await userEvent.click(screen.getByRole('button', { name: /开始 5 题摸底/ }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/practice?queue=1,2,3,4,5&from=first-run'))
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([1, 2, 3, 4, 5])
    expect(stored.questionSnapshots[1].title).toBe('HashMap 并发问题')
    expect(stored.questionSnapshots[1].categoryName).toBe('Java 集合')
    expect(stored.questionSnapshots[5].title).toBe('Spring 事务传播')
  })

  it('resumes unsubmitted practice drafts from the homepage launchpad', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
    })
    writePracticeAnswerDraft(2, '结论：先限流和预热缓存。', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '继续未提交回答' })).toBeInTheDocument()
    expect(screen.getByLabelText('本轮题单预览')).toHaveTextContent('Redis 缓存雪崩')
    await userEvent.click(screen.getByRole('button', { name: /恢复 1 份回答草稿/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2&from=resume-draft')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([2])
    expect(stored.questionStates[2].addedToPlan).toBe(true)
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
  })

  it('adds resumed drafts to the existing daily plan instead of replacing it', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [4],
      questionStates: {
        4: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        4: {
          id: 4,
          title: 'JVM GC 调优',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['JVM'],
          viewCount: 210,
        },
      },
    })
    writePracticeAnswerDraft(2, '结论：先保护已有计划，再恢复草稿。', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /恢复 1 份回答草稿/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2&from=resume-draft')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([4, 2])
    expect(stored.questionStates[4].addedToPlan).toBe(true)
    expect(stored.questionStates[2].addedToPlan).toBe(true)
    expect(stored.questionSnapshots[4].title).toBe('JVM GC 调优')
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
  })

  it('continues an existing plan without replacing it', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2, 4],
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        4: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /继续 2 题队列/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2,4&from=daily-plan')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([2, 4])
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
    expect(stored.questionSnapshots[4].title).toBe('JVM GC 调优')
  })

  it('promotes learning review items into the daily plan before continuing', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [],
      questionStates: {
        2: { status: 'learning', addedToPlan: false, reviewCount: 1 },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /继续 1 题队列/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2&from=daily-plan')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([2])
    expect(stored.questionStates[2].addedToPlan).toBe(true)
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
  })

  it('promotes weak repair items into the daily plan before repairing', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [],
      questionStates: {
        2: { status: 'weak', addedToPlan: false, reviewCount: 1 },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /修复 1 道风险题/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2&from=first-run-repair')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([2])
    expect(stored.questionStates[2].addedToPlan).toBe(true)
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
  })

  it('adds repair items to the existing daily plan instead of replacing it', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [4],
      questionStates: {
        2: { status: 'weak', addedToPlan: false, reviewCount: 1 },
        4: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        4: {
          id: 4,
          title: 'JVM GC 调优',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['JVM'],
          viewCount: 210,
        },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /修复 2 道风险题/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2,4&from=first-run-repair')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([4, 2])
    expect(stored.questionStates[4].addedToPlan).toBe(true)
    expect(stored.questionStates[2].addedToPlan).toBe(true)
    expect(stored.questionSnapshots[4].title).toBe('JVM GC 调优')
    expect(stored.questionSnapshots[2].title).toBe('Redis 缓存雪崩')
  })

  it('starts completed first-run rehearsal from the lowest scored mastered question', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2, 4],
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        4: {
          id: 4,
          title: 'JVM GC 调优',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['JVM'],
          viewCount: 210,
        },
      },
      questionStates: {
        2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:30:00.000Z' },
        4: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:36:00.000Z' },
      },
      interviewAttempts: {
        2: [scoredAttempt(2, 91, '2026-06-20T09:30:00.000Z')],
        4: [scoredAttempt(4, 83, '2026-06-20T09:36:00.000Z')],
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '本轮训练闭环已完成' })).toBeInTheDocument()
    expect(screen.getByText(/先按低分优先复述/)).toBeInTheDocument()
    expect(screen.getByLabelText('本轮题单预览')).toHaveTextContent('JVM GC 调优')
    expect(screen.getByText('已掌握')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /优先复述 2 道过线题/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=4,2&from=first-run-rehearsal')
    await userEvent.click(screen.getByRole('button', { name: /查看训练战报/ }))
    expect(navigate).toHaveBeenCalledWith('/study?view=today')
  })

  it('updates the target role from the launchpad', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'AI 大模型' }))

    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.targetRole).toBe('AI 大模型')
  })

  it('shows an explicit loading action while first-run questions are still loading', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={[]} loading />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '正在准备岗位摸底' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /正在准备摸底题/ })).toBeDisabled()
    expect(screen.queryByLabelText('本轮题单预览')).not.toBeInTheDocument()
  })

  it('creates a first-run queue from locally remembered questions when hot questions are unavailable', async () => {
    setProgress(rememberQuestions(
      createDefaultProgress('2026-06-20T00:00:00.000Z'),
      hotQuestions,
      '2026-06-20T00:01:00.000Z',
    ))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Java 后端 岗位摸底' })).toBeInTheDocument()
    expect(screen.getByLabelText('本轮题单预览')).toHaveTextContent('HashMap 并发问题')
    await userEvent.click(screen.getByRole('button', { name: /开始 5 题摸底/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=1,2,3,4,5&from=first-run')
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([1, 2, 3, 4, 5])
  })

  it('routes users to preparation routes when no first-run questions are available', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={[]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '先选择一条备考路线' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^按岗位选路线$/ }))

    expect(navigate).toHaveBeenCalledWith('/routes')
  })

  it('shows distinct fallback actions when no first-run questions are available', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={[]} />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('按岗位选路线')).toHaveLength(1)
    expect(screen.getByText('打开学习计划')).toBeInTheDocument()
    expect(screen.getByText('直接模拟')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^打开学习计划$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^直接模拟$/ })).toBeInTheDocument()
  })

  it('routes direct simulation to the unfinished daily plan when one exists', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={[]} />
      </MemoryRouter>,
    )

    await userEvent.click(directSimulateButton())

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2&from=daily-plan')
  })
})
