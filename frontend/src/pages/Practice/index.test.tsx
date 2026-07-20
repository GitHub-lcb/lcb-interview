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

  it('keeps resumed draft context and ignores historical scores for this scoped session', async () => {
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
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
      interviewAttempts: {
        2: [{
          questionId: 2,
          answer: '历史回答：只提到了随机过期。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T08:30:00.000Z',
        }],
      },
    })
    writePracticeAnswerDraft(2, '草稿回答：先恢复未提交内容，再补齐限流降级。', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2&from=resume-draft']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const context = await screen.findByLabelText('未提交回答恢复上下文')
    expect(context).toHaveTextContent('未提交回答恢复')
    expect(context).toHaveTextContent('先补完这 1 份未提交回答')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 1')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('草稿恢复')
    expect(screen.getByDisplayValue('草稿回答：先恢复未提交内容，再补齐限流降级。')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    await waitFor(() => expect(screen.getByText('面试官评分')).toBeInTheDocument())
    const panel = screen.getByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('未提交回答已恢复')
    expect(panel).toHaveTextContent('恢复进度1 / 1草稿题')
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

  it('keeps active recall context when practice starts from repeated encounters', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      questionSnapshots: {
        7: {
          id: 7,
          title: 'ThreadLocal 内存泄漏',
          difficulty: 'MEDIUM',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 180,
        },
      },
      questionStates: {
        7: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-20T20:00:00.000Z',
        },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=7&from=review-due']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'ThreadLocal 内存泄漏' })).toBeInTheDocument()

    const context = screen.getByLabelText('主动回忆队列上下文')
    expect(context).toHaveTextContent('主动回忆队列')
    expect(context).toHaveTextContent('先脱稿回忆这 1 道多次遇见题')
    expect(context).toHaveTextContent('还没完成复习')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源主动回忆')
    expect(screen.getByText('主动回忆 · Java 并发')).toBeInTheDocument()
  })

  it('continues active recall wording after scoring a repeated-encounter question', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      questionSnapshots: {
        7: {
          id: 7,
          title: 'ThreadLocal 内存泄漏',
          difficulty: 'MEDIUM',
          categoryName: 'Java 并发',
          tags: ['ThreadLocal'],
          viewCount: 180,
        },
        8: {
          id: 8,
          title: 'AQS 独占锁释放',
          difficulty: 'HARD',
          categoryName: 'Java 并发',
          tags: ['AQS'],
          viewCount: 220,
        },
      },
      questionStates: {
        7: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 2,
          lastEncounteredAt: '2026-06-20T20:00:00.000Z',
        },
        8: {
          status: 'new',
          addedToPlan: false,
          reviewCount: 0,
          encounterCount: 3,
          lastEncounteredAt: '2026-06-20T20:05:00.000Z',
        },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=7,8&from=review-due']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'ThreadLocal 内存泄漏' })).toBeInTheDocument()

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：ThreadLocal 要及时 remove，并说明线程池复用导致的引用滞留风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续主动回忆队列')
    expect(panel).toHaveTextContent('已回忆 1 / 2，下一题继续脱稿回忆「AQS 独占锁释放」。')
    expect(panel).toHaveTextContent('回忆进度1 / 2主动回忆题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'AQS 独占锁释放' })).toBeInTheDocument()
    expect(screen.getByLabelText('主动回忆队列上下文')).toHaveTextContent('先脱稿回忆这 2 道多次遇见题')
  })

  it('keeps due review context when practice starts from the review debt queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2020-01-01T00:00:00.000Z' },
        2: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2020-01-02T00:00:00.000Z' },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=review-due']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    const context = screen.getByLabelText('到期复习队列上下文')
    expect(context).toHaveTextContent('到期复习队列')
    expect(context).toHaveTextContent('先补回这 2 道到期题')
    expect(context).toHaveTextContent('这轮训练来自智能复习排期')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源到期复习')
    expect(screen.getByText('到期复习 · Java 基础')).toBeInTheDocument()
  })

  it('continues the next due review question from the post-score next-step panel', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2020-01-01T00:00:00.000Z' },
        2: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2020-01-02T00:00:00.000Z' },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 76, level: 'pass' },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=review-due']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const editor = await screen.findByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改，并说明扩容和数据一致性风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续清理到期复习队列')
    expect(panel).toHaveTextContent('已复习 1 / 2，下一题继续补回「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('复习进度1 / 2到期复习题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('到期复习队列上下文')).toHaveTextContent('先补回这 2 道到期题')
  })

  it('keeps daily plan context and ignores historical scores for this scoped session', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T09:00:00.000Z' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T09:10:00.000Z' },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 76, level: 'pass' },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=daily-plan']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    const context = screen.getByLabelText('今日计划队列上下文')
    expect(context).toHaveTextContent('今日计划队列')
    expect(context).toHaveTextContent('先完成这 2 道今日计划题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 2')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源今日计划')
    expect(screen.getByText('今日计划 · Java 基础')).toBeInTheDocument()

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改，并说明扩容和数据一致性风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续今日计划队列')
    expect(panel).toHaveTextContent('已完成 1 / 2，下一题继续回答「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('计划进度1 / 2今日计划题')
  })

  it('keeps next-training context when practice starts from the generic training queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      questionSnapshots: {
        1: {
          id: 1,
          title: 'Redis 热 key 怎么处理',
          difficulty: 'HARD',
          categoryName: 'Redis',
          tags: ['Redis'],
          viewCount: 320,
        },
        2: {
          id: 2,
          title: 'Spring 循环依赖怎么解决',
          difficulty: 'MEDIUM',
          categoryName: 'Spring',
          tags: ['Spring'],
          viewCount: 210,
        },
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-20T08:00:00.000Z' },
        2: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-20T08:30:00.000Z' },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=next-training']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 热 key 怎么处理' })).toBeInTheDocument()

    const context = screen.getByLabelText('下一轮训练队列上下文')
    expect(context).toHaveTextContent('下一轮训练队列')
    expect(context).toHaveTextContent('按系统排好的 2 道风险题继续训练')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源下一轮训练')
    expect(screen.getByText('下一轮训练 · Redis')).toBeInTheDocument()
  })

  it('keeps interview brief context when practice starts from the warmup queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T08:00:00.000Z' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T08:30:00.000Z' },
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=interview-brief']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'HashMap 并发问题' })).toBeInTheDocument()

    const context = screen.getByLabelText('面试简报热身队列上下文')
    expect(context).toHaveTextContent('面试简报热身')
    expect(context).toHaveTextContent('先完成这 2 道面试前热身题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源面试简报')
    expect(screen.getByText('面试简报 · Java 基础')).toBeInTheDocument()

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入需要避免共享修改，并说明扩容和数据一致性风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续面试简报热身队列')
    expect(panel).toHaveTextContent('已热身 1 / 2')
    expect(panel).toHaveTextContent('热身进度1 / 2面试简报题')
  })

  it('keeps interview retrospective context when practice starts from the daily mission', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
      interviewAttempts: {
        2: [{
          questionId: 2,
          answer: '旧答案：只说了随机过期。',
          feedback: { ...mocks.feedback, score: 58, level: 'needs-work' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2&from=interview-retrospective']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('面试复盘队列上下文')
    expect(context).toHaveTextContent('面试复盘队列')
    expect(context).toHaveTextContent('先重答这 1 道低分面试题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源面试复盘')
    expect(screen.getByText('面试复盘 · Redis')).toBeInTheDocument()
  })

  it('continues the next ability-gap question from the post-score next-step panel', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'weak', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T08:00:00.000Z' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T08:30:00.000Z' },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 52, level: 'needs-work' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
        2: [{
          questionId: 2,
          answer: '旧答案：缓存雪崩需要随机过期和限流兜底。',
          feedback: { ...mocks.feedback, score: 68, level: 'pass' },
          createdAt: '2026-06-20T09:10:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=ability-gap']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const context = await screen.findByLabelText('能力短板队列上下文')
    expect(context).toHaveTextContent('能力短板训练')
    expect(context).toHaveTextContent('先突破这 2 道短板题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源能力短板')

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改，并说明扩容和数据一致性风险。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续补齐能力短板')
    expect(panel).toHaveTextContent('已训练 1 / 2，下一题继续突破「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('能力进度1 / 2短板题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('能力短板队列上下文')).toHaveTextContent('先突破这 2 道短板题')
  })

  it('keeps real interview pressure context from the experience playbook queue', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
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
        1: { status: 'weak', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-20T08:00:00.000Z' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-20T08:30:00.000Z' },
      },
      interviewAttempts: {
        1: [{
          questionId: 1,
          answer: '旧答案：HashMap 并发写入需要规避共享修改。',
          feedback: { ...mocks.feedback, score: 52, level: 'needs-work' },
          createdAt: '2026-06-20T09:00:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=1,2&from=experience-playbook']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    const context = await screen.findByLabelText('真实面试押题队列上下文')
    expect(context).toHaveTextContent('真实面试押题')
    expect(context).toHaveTextContent('先压测这 2 道高压题')
    expect(context).toHaveTextContent('来自面经场景和个人低分/薄弱轨迹')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源真实面试')
    expect(screen.getByText('真实面试 · Java 基础')).toBeInTheDocument()
    expect(screen.getByLabelText('队列画像')).toHaveTextContent('真实面试押题 2 道')
    expect(screen.getByLabelText('本题押题理由')).toHaveTextContent('薄弱题、模拟 52 分')
    expect(screen.getByLabelText('本题押题理由')).toHaveTextContent('项目场景、失败边界')
    expect(screen.getByLabelText('本题押题追问')).toHaveTextContent('面试官追问')
    expect(screen.getByLabelText('本题押题追问')).toHaveTextContent('请用一个真实项目说明「HashMap 并发问题」的触发场景、排查证据和失败边界。')
    expect(screen.getByLabelText('本题押题追问')).toHaveTextContent('通过口径')
    expect(screen.getByLabelText('本题押题追问')).toHaveTextContent('能在 60 秒内讲清结论、项目证据、失败边界和下一步兜底。')

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：HashMap 并发写入要避免共享修改，并补充项目失败边界。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续真实面试押题队列')
    expect(panel).toHaveTextContent('已压测 1 / 2，下一题继续拆解「Redis 缓存雪崩」。')
    expect(panel).toHaveTextContent('押题进度1 / 2高压题')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('真实面试押题队列上下文')).toHaveTextContent('先压测这 2 道高压题')
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

    const context = screen.getByLabelText('岗位摸底上下文')
    expect(context).toHaveTextContent('岗位摸底')
    await waitFor(() => expect(context).toHaveTextContent('完成这 3 道岗位高频题'))
    expect(context).toHaveTextContent('首页会据此生成能力画像和补弱队列。')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 3')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源岗位摸底')
    expect(screen.getByText('岗位摸底 · Java 基础')).toBeInTheDocument()

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
    expect(panel).toHaveTextContent('继续完成岗位摸底')
    expect(panel).toHaveTextContent('已完成 1 / 3，下一题继续回答「Redis 缓存雪崩」。')

    await userEvent.click(screen.getByRole('button', { name: /继续第 2 题/ }))

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()
    expect(screen.getByLabelText('岗位摸底上下文')).toHaveTextContent('完成这 3 道岗位高频题')
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
    expect(panel).toHaveTextContent('岗位摸底已完成')
    expect(panel).toHaveTextContent('已完成 3 / 3，先看本轮战报，再按风险题补弱。')
    expect(panel).toHaveTextContent('摸底进度3 / 3岗位摸底题')
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

  it('labels explicit detail-page handoff as calibration practice', async () => {
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
        initialEntries={['/practice?question=2&from=question-detail']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/practice" element={<Practice />} />
          <Route path="/question/:id" element={<QuestionDetailLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('题目详情校准上下文')
    expect(context).toHaveTextContent('题目详情校准')
    expect(context).toHaveTextContent('刚从题目详情进入，先把阅读理解转成一轮无提示回答。')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源题目详情校准')
    await waitFor(() => expect(screen.getByRole('textbox', { name: '模拟面试回答' })).toHaveFocus())

    await userEvent.click(screen.getByRole('button', { name: '回到题目详情' }))

    expect(screen.getByText('题目详情页 /question/2')).toBeInTheDocument()
  })

  it('keeps filtered-list practice progress separate from historical attempts', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      questionSnapshots: {
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
        2: { status: 'learning', addedToPlan: false, reviewCount: 1 },
        3: { status: 'new', addedToPlan: false, reviewCount: 0 },
      },
      interviewAttempts: {
        2: [{
          questionId: 2,
          answer: '历史回答：只讲了随机过期。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T08:00:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2,3&from=filtered-list']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('当前筛选题单上下文')
    expect(context).toHaveTextContent('当前筛选题单')
    expect(context).toHaveTextContent('先完成这 2 道筛选题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 2')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源当前筛选')

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：缓存雪崩需要随机过期、预热、限流降级和多级缓存兜底。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续当前筛选题单')
    expect(panel).toHaveTextContent('已训练 1 / 2，下一题继续回答「MySQL 索引失效」。')
    expect(panel).toHaveTextContent('筛选进度1 / 2筛选题')
  })

  it('keeps pace-coach practice progress separate from historical attempts', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-21T00:00:00.000Z'),
      dailyPlan: [2, 3],
      questionSnapshots: {
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
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        3: { status: 'new', addedToPlan: true, reviewCount: 0 },
      },
      interviewAttempts: {
        2: [{
          questionId: 2,
          answer: '历史回答：只讲了随机过期。',
          feedback: { ...mocks.feedback, score: 72, level: 'pass' },
          createdAt: '2026-06-20T08:00:00.000Z',
        }],
      },
    })

    render(
      <MemoryRouter
        initialEntries={['/practice?queue=2,3&from=pace-coach']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Practice />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Redis 缓存雪崩' })).toBeInTheDocument()

    const context = screen.getByLabelText('配速训练队列上下文')
    expect(context).toHaveTextContent('配速训练队列')
    expect(context).toHaveTextContent('先收口这 2 道今日配速题')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('0 / 2')
    expect(screen.getByLabelText('本轮训练状态')).toHaveTextContent('当前来源配速训练')

    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '结论：缓存雪崩需要随机过期、预热、限流降级和多级缓存兜底。' } })
    await userEvent.click(screen.getByRole('button', { name: /提交评分/ }))

    const panel = await screen.findByLabelText('评分后下一步')
    expect(panel).toHaveTextContent('继续配速训练队列')
    expect(panel).toHaveTextContent('已收口 1 / 2，下一题继续完成今日配速「MySQL 索引失效」。')
    expect(panel).toHaveTextContent('配速进度1 / 2配速题')
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
