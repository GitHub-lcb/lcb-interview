import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { evaluateInterviewAnswerRemote } from '../../api/interview'
import { getHotQuestions, getQuestionById } from '../../api/question'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import { readPracticeAnswerDraft, writePracticeAnswerDraft } from '../../utils/practiceAnswerDraftStore'
import Practice from './index'

const mocks = vi.hoisted(() => {
  const feedback = {
    score: 86,
    level: 'strong' as const,
    source: 'LOCAL_RULE_BASED' as const,
    criteria: [
      { key: 'coverage' as const, label: '知识覆盖', score: 86, summary: '覆盖完整' },
      { key: 'structure' as const, label: '表达结构', score: 86, summary: '结构清晰' },
      { key: 'specificity' as const, label: '场景细节', score: 86, summary: '场景具体' },
      { key: 'risk' as const, label: '边界风险', score: 86, summary: '风险完整' },
    ],
    advice: [],
    followUps: ['继续追问项目落地。'],
  }
  const question = {
    id: 2,
    title: 'Redis 缓存雪崩',
    content: 'answer',
    difficulty: 'MEDIUM',
    categoryName: 'Redis',
    tags: ['Redis'],
    viewCount: 240,
    createTime: '2026-06-20T00:00:00.000Z',
  }
  return { feedback, question }
})

vi.mock('../../api/question', () => ({
  getHotQuestions: vi.fn().mockResolvedValue([]),
  getQuestionById: vi.fn().mockResolvedValue(mocks.question),
}))

vi.mock('../../api/interview', () => ({
  evaluateInterviewAnswerRemote: vi.fn().mockResolvedValue(mocks.feedback),
}))

function setProgress(progress: StudyProgress) {
  window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

function QuestionDetailLocationProbe() {
  const location = useLocation()

  return <div>题目详情页 {location.pathname}{location.search}{location.hash}</div>
}

describe('Practice page answer draft lifecycle', () => {
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
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      value: 180,
    })
    Element.prototype.scrollIntoView = vi.fn()
    vi.mocked(evaluateInterviewAnswerRemote).mockClear()
    vi.mocked(evaluateInterviewAnswerRemote).mockResolvedValue(mocks.feedback)
    vi.mocked(getQuestionById).mockClear()
    vi.mocked(getQuestionById).mockResolvedValue(mocks.question)
    vi.mocked(getHotQuestions).mockClear()
    vi.mocked(getHotQuestions).mockResolvedValue([])

    const baseGetComputedStyle = window.getComputedStyle.bind(window)
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => {
        const style = baseGetComputedStyle(element)

        if (!(element instanceof HTMLTextAreaElement)) {
          return style
        }

        const getPropertyValue = style.getPropertyValue.bind(style)
        const textareaFallbackStyles: Record<string, string> = {
          'border-bottom-width': '1px',
          'border-top-width': '1px',
          'border-width': '1px',
          'box-sizing': 'border-box',
          'font-size': '14px',
          'letter-spacing': '0px',
          'line-height': '22px',
          'padding-bottom': '8px',
          'padding-left': '11px',
          'padding-right': '11px',
          'padding-top': '8px',
          'white-space': 'pre-wrap',
          'width': '640px',
        }

        return new Proxy(style, {
          get(target, property, receiver) {
            if (property === 'getPropertyValue') {
              return (name: string) => textareaFallbackStyles[name] ?? getPropertyValue(name)
            }

            return Reflect.get(target, property, receiver)
          },
        })
      },
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('clears the local answer draft after a successful score submission', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })
    writePracticeAnswerDraft(2, '结论：先预热缓存并给热点 key 加随机过期。', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByDisplayValue('结论：先预热缓存并给热点 key 加随机过期。')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    await waitFor(() => expect(screen.getByText('面试官评分')).toBeInTheDocument())
    expect(screen.queryByText('草稿已本地保存')).not.toBeInTheDocument()
    expect(readPracticeAnswerDraft(2)).toBeNull()
  })

  it('moves to the next unanswered question instead of cycling through already scored questions', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        3: {
          id: 3,
          title: 'MySQL 索引失效',
          difficulty: 'HARD',
          categoryName: 'MySQL',
          tags: ['MySQL'],
          viewCount: 360,
        },
      },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        3: { status: 'new', addedToPlan: true, reviewCount: 0 },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '结论：HashMap 并发写入会导致数据不一致。',
          feedback: { ...mocks.feedback, score: 78, level: 'pass' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '结论：缓存雪崩要用随机过期和限流降级。',
          feedback: { ...mocks.feedback, score: 82 },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2,3']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Java 后端 · 第 1 题' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '下一题' }))

    expect(await screen.findByRole('heading', { name: 'Java 后端 · 第 3 题' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'MySQL 索引失效' })).toBeInTheDocument()
  })

  it('keeps first-run launchpad context when a homepage queue starts practice', async () => {
    vi.mocked(getHotQuestions).mockResolvedValueOnce([
      {
        id: 1,
        title: 'HashMap 并发问题',
        content: 'answer',
        difficulty: 'HARD',
        categoryName: 'Java 基础',
        tags: ['HashMap'],
        viewCount: 500,
        createTime: '2026-06-20T00:00:00.000Z',
      },
      {
        id: 2,
        title: 'Redis 缓存雪崩',
        content: 'answer',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        tags: ['Redis'],
        viewCount: 240,
        createTime: '2026-06-20T00:00:00.000Z',
      },
      {
        id: 3,
        title: 'MySQL 索引失效',
        content: 'answer',
        difficulty: 'HARD',
        categoryName: 'MySQL',
        tags: ['MySQL'],
        viewCount: 360,
        createTime: '2026-06-20T00:00:00.000Z',
      },
      {
        id: 4,
        title: 'JVM GC 调优',
        content: 'answer',
        difficulty: 'HARD',
        categoryName: 'JVM',
        tags: ['JVM'],
        viewCount: 300,
        createTime: '2026-06-20T00:00:00.000Z',
      },
    ])
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        3: {
          id: 3,
          title: 'MySQL 索引失效',
          difficulty: 'HARD',
          categoryName: 'MySQL',
          tags: ['MySQL'],
          viewCount: 360,
        },
      },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 0 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
        3: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2,3&from=first-run']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    const context = screen.getByLabelText('首练队列上下文')
    expect(context).toHaveTextContent('首练队列')
    await waitFor(() => expect(context).toHaveTextContent('先完成这 3 道高频题'))
    expect(context).toHaveTextContent('提交评分后系统会生成补弱和复习队列。')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 3')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源首练队列')
    expect(screen.getByText('首练队列 · Java 基础')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('keeps first-run repair context when entering the post-report weak queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 1 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '结论：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 52, level: 'needs-work' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '结论：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 68, level: 'pass' },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=first-run-repair']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    const context = screen.getByLabelText('首练补弱队列上下文')
    expect(context).toHaveTextContent('首练补弱队列')
    expect(context).toHaveTextContent('先修复这 2 道首练风险题')
    expect(context).toHaveTextContent('来自首练战报，按最低分和复习债重新作答，不再重新选题。')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源首练补弱')
    expect(screen.getByText('首练补弱 · Java 基础')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('keeps first-run rehearsal context when reviewing completed launchpad questions', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [4, 2],
      questionSnapshots: {
        4: {
          id: 4,
          title: 'JVM GC 调优',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['JVM'],
          viewCount: 300,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        4: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:36:00.000Z' },
        2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:30:00.000Z' },
      },
      interviewAttempts: {
        4: [{
          questionId: 4,
          answer: '结论：JVM GC 调优需要结合日志、堆分布和停顿目标。',
          feedback: { ...mocks.feedback, score: 83, level: 'strong' },
          createdAt: '2026-06-20T09:36:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '结论：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 91, level: 'strong' },
          createdAt: '2026-06-20T09:30:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=4,2&from=first-run-rehearsal']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'JVM GC 调优' })).toBeInTheDocument()

    const context = screen.getByLabelText('首练过线复述上下文')
    expect(context).toHaveTextContent('首练过线复述')
    expect(context).toHaveTextContent('先复述这 2 道已过线题')
    expect(context).toHaveTextContent('目标是脱稿验证，不是重新刷题。')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源首练复述')
    expect(screen.getByText('首练复述 · JVM')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('continues the next first-run rehearsal question from the post-score next-step panel', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [4, 2],
      questionSnapshots: {
        4: {
          id: 4,
          title: 'JVM GC 调优',
          difficulty: 'HARD',
          categoryName: 'JVM',
          tags: ['JVM'],
          viewCount: 300,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        4: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:36:00.000Z' },
        2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T09:30:00.000Z' },
      },
      interviewAttempts: {
        4: [{
          questionId: 4,
          answer: '旧答案：JVM GC 调优需要结合日志和停顿目标。',
          feedback: { ...mocks.feedback, score: 83, level: 'strong' },
          createdAt: '2026-06-20T09:36:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 91, level: 'strong' },
          createdAt: '2026-06-20T09:30:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=4,2&from=first-run-rehearsal']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：JVM GC 调优要先看 GC 日志、堆分布和停顿目标，再决定参数。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续复述首练过线题')
    expect(panel).toHaveTextContent('已复述 1 / 2，下一题继续脱稿「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('复述进度1 / 2首练过线题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('首练过线复述上下文')).toHaveTextContent('先复述这 2 道已过线题')
  })

  it('continues the next first-run repair question from the post-score next-step panel', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 0 },
        2: { status: 'weak', addedToPlan: true, reviewCount: 0 },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入会有风险。',
          feedback: { ...mocks.feedback, score: 52, level: 'needs-work' },
          createdAt: '2026-06-20T08:30:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩要加随机过期。',
          feedback: { ...mocks.feedback, score: 48, level: 'needs-work' },
          createdAt: '2026-06-20T08:35:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=first-run-repair']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改并说明扩容风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续修复首练补弱队列')
    expect(panel).toHaveTextContent('已修复 1 / 2，下一题继续补弱「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('补弱进度1 / 2首练风险题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('首练补弱队列上下文')).toHaveTextContent('先修复这 2 道首练风险题')
  })

  it('keeps first-run repair progress after reopening the same repair queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 0 },
        2: { status: 'weak', addedToPlan: true, reviewCount: 0 },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入会有风险。',
          feedback: { ...mocks.feedback, score: 52, level: 'needs-work' },
          createdAt: '2026-06-20T08:30:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩要加随机过期。',
          feedback: { ...mocks.feedback, score: 48, level: 'needs-work' },
          createdAt: '2026-06-20T08:35:00.000Z',
        }],
      },
    })

    const initialView = render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=first-run-repair']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改并说明扩容风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))
    expect(await screen.findByLabelText('评分后下一步')).toHaveTextContent('补弱进度1 / 2首练风险题')

    initialView.unmount()

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=first-run-repair']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('1 / 2')
  })

  it('continues the next first-run question from the post-score next-step panel', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        3: {
          id: 3,
          title: 'MySQL 索引失效',
          difficulty: 'HARD',
          categoryName: 'MySQL',
          tags: ['MySQL'],
          viewCount: 360,
        },
      },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 0 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
        3: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2,3&from=first-run']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改并说明扩容风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续完成首练队列')
    expect(panel).toHaveTextContent('已完成 1 / 3，下一题继续回答「Redis 缓存雪崩」。')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('首练队列上下文')).toHaveTextContent('先完成这 3 道高频题')
  })

  it('shows first-run completion after the last queue question is scored', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [1, 2, 3],
      questionSnapshots: {
        1: {
          id: 1,
          title: 'HashMap 并发问题',
          difficulty: 'HARD',
          categoryName: 'Java 基础',
          tags: ['HashMap'],
          viewCount: 500,
        },
        2: {
          id: 2,
          title: 'Redis 缓存雪崩',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
        3: {
          id: 3,
          title: 'MySQL 索引失效',
          difficulty: 'HARD',
          categoryName: 'MySQL',
          tags: ['MySQL'],
          viewCount: 360,
        },
      },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        3: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '结论：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '结论：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 76, level: 'pass' },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2,3&from=first-run']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '下一题' }))

    expect(await screen.findByRole('heading', { name: 'MySQL 索引失效' })).toBeInTheDocument()

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：MySQL 索引失效需要看谓词、函数、隐式转换和执行计划。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('首练队列已完成')
    expect(panel).toHaveTextContent('已完成 3 / 3，先看本轮战报，再按风险题补弱。')
    expect(panel).toHaveTextContent('首练进度3 / 3本轮高频题')
  })

  it('shows same-question interview context when opened from a question detail page', async () => {
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
      questionStates: {
        2: { status: 'learning', addedToPlan: false, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?question=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/question/:id" element={<QuestionDetailLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('同题模拟面试上下文')
    expect(context).toHaveTextContent('同题模拟')
    expect(context).toHaveTextContent('刚从题目详情进入，先按当前题完成一轮无提示回答。')

    await userEvent.click(screen.getByRole('button', { name: '回到题目详情' }))

    expect(screen.getByText('题目详情页 /question/2')).toBeInTheDocument()
  })

  it('drops invalid queue ids before loading scoped practice questions', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      questionSnapshots: {
        2: {
          id: 2,
          title: 'Redis 缂撳瓨闆穿',
          difficulty: 'MEDIUM',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 240,
        },
      },
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2.5,2,0,-1,NaN,Infinity,2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缂撳瓨闆穿' })).toBeInTheDocument()
    await waitFor(() => expect(getHotQuestions).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))

    const requestedIds = vi.mocked(getQuestionById).mock.calls.map(([questionId]) => questionId)
    expect(requestedIds).toEqual([])
  })

  it('drops invalid focus question ids before loading detail handoff questions', async () => {
    setProgress(createDefaultProgress('2026-06-20T00:00:00.000Z'))

    render(
      <MemoryRouter
        initialEntries={['/practice?question=2.5&from=script']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    await waitFor(() => expect(getHotQuestions).toHaveBeenCalledTimes(1))
    await new Promise(resolve => setTimeout(resolve, 0))

    const requestedIds = vi.mocked(getQuestionById).mock.calls.map(([questionId]) => questionId)
    expect(requestedIds).toEqual([])
    expect(screen.queryByRole('heading', { name: 'Redis 缂撳瓨闆穿' })).not.toBeInTheDocument()
  })

  it('shows blind rehearsal handoff context when opened from the answer script', async () => {
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
      questionStates: {
        2: { status: 'learning', addedToPlan: false, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?question=2&from=script']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/question/:id" element={<QuestionDetailLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('同题模拟面试上下文')
    expect(context).toHaveTextContent('口径盲练完成')
    expect(context).toHaveTextContent('刚完成 60 秒口径盲练，现在按面试节奏无提示作答。')

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveFocus())
  })

  it('offers script calibration after a scored blind rehearsal handoff', async () => {
    vi.mocked(evaluateInterviewAnswerRemote).mockResolvedValueOnce({
      score: 52,
      level: 'needs-work',
      source: 'LOCAL_RULE_BASED',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 62, summary: '覆盖一般' },
        { key: 'structure', label: '结构化', score: 42, summary: '结构不足' },
        { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
        { key: 'risk', label: '风险意识', score: 58, summary: '风险不足' },
      ],
      advice: [],
      followUps: [],
    })
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
      questionStates: {
        2: { status: 'learning', addedToPlan: false, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?question=2&from=script']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/question/:id" element={<QuestionDetailLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：缓存雪崩需要随机过期、限流降级和热点预热。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    expect(await screen.findByRole('button', { name: /回到口径校准/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /回到口径校准/ }))

    expect(screen.getByText('题目详情页 /question/2?from=practice-calibration#answer-script')).toBeInTheDocument()
  })

  it('focuses the answer editor after using a post-score rewrite action', async () => {
    vi.mocked(evaluateInterviewAnswerRemote).mockResolvedValueOnce({
      score: 52,
      level: 'needs-work',
      source: 'LOCAL_RULE_BASED',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 62, summary: '覆盖一般' },
        { key: 'structure', label: '结构化', score: 42, summary: '结构不足' },
        { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
        { key: 'risk', label: '风险意识', score: 58, summary: '风险不足' },
      ],
      advice: [],
      followUps: [],
    })
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：Redis 缓存雪崩要用随机过期和限流兜底。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    await screen.findByText('先修复最低分维度')
    await userEvent.click(screen.getByRole('button', { name: /重答结构化/ }))

    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain('结构化')
      expect(editor).toHaveFocus()
    })
  })

  it('submits the answer from the editor with Ctrl+Enter', async () => {
    const user = userEvent.setup()
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    await user.click(editor)
    fireEvent.change(editor, { target: { value: '结论：Redis 缓存雪崩要用随机过期和限流兜底。' } })
    await user.keyboard('{Control>}{Enter}{/Control}')

    await waitFor(() => expect(evaluateInterviewAnswerRemote).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('面试官评分')).toBeInTheDocument()
  })

  it('names the answer editor for assistive technology', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('textbox', { name: '模拟面试回答' })).toBeInTheDocument()
  })

  it('uses clean accessible names for primary practice action buttons', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'weak', addedToPlan: true, reviewCount: 1 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: '提交评分' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开答案' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标记薄弱' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '已掌握' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '移出计划' })).toBeInTheDocument()
  })

  it('exposes current question practice actions as toggle controls', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2],
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
      questionStates: {
        2: { status: 'weak', addedToPlan: true, reviewCount: 1 },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /标记薄弱/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /已掌握/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /移出计划/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
