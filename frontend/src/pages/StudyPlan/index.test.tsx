import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import { getHotQuestions } from '../../api/question'
import StudyPlan from './index'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../api/question', () => ({
  getHotQuestions: vi.fn().mockResolvedValue([]),
}))

function progressWithReviewQueue(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-17T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 并发',
        categoryId: 1,
        tags: ['HashMap', '并发'],
        viewCount: 300,
      },
    },
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: '2026-06-16T09:00:00.000Z',
      },
    },
    dailyPlan: [1],
  }
}

function firstRunAttempt(
  questionId: number,
  score: number,
  answer: string,
  createdAt: string,
): InterviewAttempt {
  return {
    questionId,
    answer,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心结论' },
        { key: 'structure', label: '结构化', score, summary: '表达结构清晰' },
        { key: 'specificity', label: '具体性', score, summary: '包含项目化证据' },
        { key: 'risk', label: '风险意识', score, summary: '能说明边界' },
      ],
      advice: ['继续沉淀为可复述素材'],
      followUps: ['追问项目证据'],
      source: 'LOCAL_RULE_BASED',
    },
    createdAt,
  }
}

function progressWithCompletedFirstRun(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 并发',
        categoryId: 1,
        tags: ['HashMap', '并发'],
        viewCount: 300,
      },
      2: {
        id: 2,
        title: 'Redis 缓存雪崩怎么治理？',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        categoryId: 2,
        tags: ['Redis', '缓存'],
        viewCount: 260,
      },
    },
    questionStates: {
      1: {
        status: 'mastered',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: '2026-06-20T09:20:00.000Z',
      },
      2: {
        status: 'mastered',
        addedToPlan: true,
        reviewCount: 2,
        lastReviewedAt: '2026-06-20T09:28:00.000Z',
      },
    },
    interviewAttempts: {
      1: [
        firstRunAttempt(
          1,
          88,
          '结论：HashMap 并发写入会破坏桶链结构，项目里要用 ConcurrentHashMap 或外部锁保护。',
          '2026-06-20T09:20:00.000Z',
        ),
      ],
      2: [
        firstRunAttempt(
          2,
          84,
          '结论：缓存雪崩要用随机过期、预热和限流熔断组合治理，核心是削峰和兜底。',
          '2026-06-20T09:28:00.000Z',
        ),
      ],
    },
    dailyPlan: [1, 2],
  }
}

describe('StudyPlan', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithReviewQueue()))
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

  it('copies review schedule markdown from the study plan page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制队列/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 智能复习队列')
    expect(markdown).toContain('## 排期概览')
    expect(markdown).toContain('## 复习队列')
    expect(markdown).toContain('HashMap 为什么线程不安全')
    expect(markdown).toContain('入口：/question/1')
  })

  it('refreshes seed questions silently so local study plans are not interrupted by backend misses', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getHotQuestions)).toHaveBeenCalledWith(12, { silentGlobalError: true })
    })
  })

  it('opens a daily plan question with the keyboard', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    const titles = await screen.findAllByText('HashMap 为什么线程不安全？')
    const title = titles.find(element => element.tagName === 'H3') as HTMLElement
    const item = title.closest('article') as HTMLElement
    item.focus()
    await user.keyboard('{Enter}')

    expect(navigateMock).toHaveBeenCalledWith('/question/1')
  })

  it('surfaces first-run completion materials on the study report', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithCompletedFirstRun()))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    const report = await screen.findByLabelText('首练成果沉淀')
    expect(report).toHaveTextContent('今日首练已过线')
    expect(report).toHaveTextContent('2 道首练已过线')
    expect(report).toHaveTextContent('平均 86 分')
    expect(report).toHaveTextContent('HashMap 为什么线程不安全？')
    expect(report).toHaveTextContent('结论：HashMap 并发写入会破坏桶链结构')
    expect(report).toHaveTextContent('Redis 缓存雪崩怎么治理？')
    expect(report).toHaveTextContent('回看首练素材')
  })

  it('copies the first-run completion report as markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithCompletedFirstRun()))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    await userEvent.click(await screen.findByRole('button', { name: /复制首练战报/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const markdown = writeText.mock.calls[0][0]
    expect(markdown).toContain('# Java 后端 首练成果战报')
    expect(markdown).toContain('- 完成题数：2')
    expect(markdown).toContain('- 平均分：86')
    expect(markdown).toContain('- 最高分：88')
    expect(markdown).toContain('## 复述优先题')
    expect(markdown).toContain('- 题目：Redis 缓存雪崩怎么治理？')
    expect(markdown).toContain('- 分数：84')
    expect(markdown).toContain('## 可复述素材')
    expect(markdown).toContain('### HashMap 为什么线程不安全？')
    expect(markdown).toContain('分数：88')
    expect(markdown).toContain('结论：HashMap 并发写入会破坏桶链结构')
    expect(markdown).toContain('入口：/question/1')
    expect(markdown).toContain('### Redis 缓存雪崩怎么治理？')
    expect(markdown).toContain('- 抽查复述：从复述优先题开始，按低分到高分完成脱稿验证。')
  })

  it('prioritizes the lowest scoring first-run answer for rehearsal', async () => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progressWithCompletedFirstRun()))

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPlan />
      </MemoryRouter>,
    )

    const priority = await screen.findByLabelText('首练复述优先题')
    expect(priority).toHaveTextContent('Redis 缓存雪崩怎么治理？')
    expect(priority).toHaveTextContent('84 分')

    await userEvent.click(within(priority).getByRole('button', { name: /优先复述/ }))

    expect(navigateMock).toHaveBeenCalledWith('/practice?queue=2,1')
  })
})
