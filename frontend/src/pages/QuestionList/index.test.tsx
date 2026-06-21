import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { getCategoryById } from '../../api/category'
import { getQuestions } from '../../api/question'
import QuestionList from './index'
import { STUDY_PROGRESS_STORAGE_KEY, createDefaultProgress } from '../../utils/studyProgress'

const fixtures = vi.hoisted(() => ({
  category: {
    id: 1,
    name: 'Java 基础',
    icon: 'java',
    description: 'Java 语言基础与常见面试题',
    sortOrder: 1,
  },
  questions: [
    {
      id: 11,
      title: 'Java 中的序列化是什么？',
      content: '标准答案',
      difficulty: 'MEDIUM',
      categoryName: 'Java 基础',
      categoryId: 1,
      tags: ['Java'],
      viewCount: 120,
      createTime: '2026-06-20T00:00:00.000Z',
    },
    {
      id: 12,
      title: 'HashMap 为什么线程不安全？',
      content: '标准答案',
      difficulty: 'HARD',
      categoryName: 'Java 基础',
      categoryId: 1,
      tags: ['Java', '集合'],
      viewCount: 240,
      createTime: '2026-06-20T00:00:00.000Z',
    },
  ],
}))

vi.mock('../../api/category', () => ({
  getCategoryById: vi.fn().mockResolvedValue(fixtures.category),
}))

vi.mock('../../api/question', () => ({
  getQuestions: vi.fn().mockResolvedValue({
    content: fixtures.questions,
    page: 0,
    size: 20,
    total: 1,
    totalPages: 1,
  }),
}))

function PracticeLocationProbe() {
  const location = useLocation()
  return (
    <div>
      <span>练习入口</span>
      <span>{location.search}</span>
    </div>
  )
}

function QuestionListLocationProbe() {
  const location = useLocation()
  return (
    <>
      <QuestionList />
      <span data-testid="bank-location">{location.search}</span>
    </>
  )
}

function toolbarPracticeButton(): HTMLButtonElement {
  const button = document.querySelector('.question-list-toolbar-actions .ant-btn-primary')
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Question list practice action was not rendered')
  }
  return button
}

describe('QuestionList', () => {
  beforeEach(() => {
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

  it('loads category metadata and questions silently because the page owns its inline failure state', async () => {
    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getCategoryById)).toHaveBeenCalledWith(1, { silentGlobalError: true })
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { category: 1, difficulty: undefined, page: 0, size: 20, sort: 'latest' },
        { silentGlobalError: true },
      )
    })
  })

  it('passes selected sort mode to the backend query', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { category: 1, difficulty: undefined, page: 0, size: 20, sort: 'latest' },
        { silentGlobalError: true },
      )
    })

    await user.click(screen.getByRole('combobox', { name: '按排序方式选择' }))
    await user.click(await screen.findByText('按热度'))

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
        { category: 1, difficulty: undefined, page: 0, size: 20, sort: 'hot' },
        { silentGlobalError: true },
      )
    })
  })

  it('loads difficulty sort and page from the URL state', async () => {
    render(
      <MemoryRouter initialEntries={['/bank/1?difficulty=HARD&sort=hot&page=2']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { category: 1, difficulty: 'HARD', page: 1, size: 20, sort: 'hot' },
        { silentGlobalError: true },
      )
    })
  })

  it('writes selected difficulty and sort to the URL for shareable category lists', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionListLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { category: 1, difficulty: undefined, page: 0, size: 20, sort: 'latest' },
        { silentGlobalError: true },
      )
    })

    await user.click(screen.getByRole('combobox', { name: '按难度筛选' }))
    const hardOptions = await screen.findAllByText('困难')
    await user.click(hardOptions[hardOptions.length - 1])
    await user.click(screen.getByRole('combobox', { name: '按排序方式选择' }))
    await user.click(await screen.findByText('按热度'))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('bank-location').textContent || '')
      expect(params.get('difficulty')).toBe('HARD')
      expect(params.get('sort')).toBe('hot')
      expect(params.get('page')).toBeNull()
    })
  })

  it('exposes each question title as a direct detail link', async () => {
    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('link', { name: `打开题目 ${fixtures.questions[0].title}` }),
    ).toHaveAttribute('href', '/question/11')
  })

  it('opens a question card with the keyboard', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
          <Route path="/question/:id" element={<div>题目详情页</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const title = await screen.findByText('Java 中的序列化是什么？')
    const card = title.closest('article') as HTMLElement
    card.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('题目详情页')).toBeInTheDocument()
  })

  it('shows a recoverable empty state when a difficulty filter has no questions', async () => {
    const user = userEvent.setup()
    vi.mocked(getQuestions).mockImplementation((params) => Promise.resolve({
      content: params.difficulty === 'HARD' ? [] : fixtures.questions,
      page: 0,
      size: 20,
      total: params.difficulty === 'HARD' ? 0 : fixtures.questions.length,
      totalPages: params.difficulty === 'HARD' ? 0 : 1,
    }))

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Java 中的序列化是什么？')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: '按难度筛选' }))
    const hardOptions = await screen.findAllByText('困难')
    await user.click(hardOptions[hardOptions.length - 1])

    expect(await screen.findByText('当前筛选暂无题目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /清除难度筛选/ }))

    expect(await screen.findByText('Java 中的序列化是什么？')).toBeInTheDocument()
    expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
      { category: 1, difficulty: undefined, page: 0, size: 20, sort: 'latest' },
      { silentGlobalError: true },
    )
  })

  it('filters the current page by local study status and practices the filtered questions only', async () => {
    const user = userEvent.setup()
    const progress = createDefaultProgress('2026-06-21T00:00:00.000Z')
    progress.questionStates = {
      11: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      12: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
    }
    progress.dailyPlan = [11]
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Java 中的序列化是什么？')).toBeInTheDocument()
    expect(screen.getByText('HashMap 为什么线程不安全？')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: '按学习状态筛选' }))
    await user.click(await screen.findByText('薄弱题'))

    expect(screen.getByText('Java 中的序列化是什么？')).toBeInTheDocument()
    expect(screen.queryByText('HashMap 为什么线程不安全？')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /练本页/ }))

    expect(await screen.findByText('练习入口')).toBeInTheDocument()
    expect(screen.getByText('?queue=11&from=filtered-list')).toBeInTheDocument()
  })

  it('filters the current page by due reviews and practices only overdue questions', async () => {
    const user = userEvent.setup()
    const progress = createDefaultProgress('2026-06-21T00:00:00.000Z')
    progress.questionStates = {
      11: {
        status: 'learning',
        addedToPlan: false,
        reviewCount: 1,
        lastReviewedAt: '2020-01-01T00:00:00.000Z',
      },
      12: {
        status: 'mastered',
        addedToPlan: false,
        reviewCount: 3,
        lastReviewedAt: '2999-01-01T00:00:00.000Z',
      },
    }
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(fixtures.questions[0].title)).toBeInTheDocument()
    expect(screen.getByText(fixtures.questions[1].title)).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: '按学习状态筛选' }))
    await user.click(await screen.findByText('到期复习'))

    expect(screen.getByText(fixtures.questions[0].title)).toBeInTheDocument()
    expect(screen.queryByText(fixtures.questions[1].title)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /练本页/ }))

    expect(await screen.findByText('练习入口')).toBeInTheDocument()
    expect(screen.getByText('?queue=11&from=review-due')).toBeInTheDocument()
  })

  it('falls back to the unfinished daily plan queue when the current filter has no practice items', async () => {
    const user = userEvent.setup()
    const progress = createDefaultProgress('2026-06-21T00:00:00.000Z')
    progress.questionStates = {
      11: { status: 'mastered', addedToPlan: false, reviewCount: 2 },
      12: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    }
    progress.dailyPlan = [12]
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))

    render(
      <MemoryRouter initialEntries={['/bank/1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/bank/:id" element={<QuestionList />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(fixtures.questions[0].title)).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: '按学习状态筛选' }))
    await user.click(await screen.findByText('薄弱题'))
    await user.click(toolbarPracticeButton())

    expect(await screen.findByText('练习入口')).toBeInTheDocument()
    expect(screen.getByText('?queue=12&from=daily-plan')).toBeInTheDocument()
  })

  it.each(['/bank/abc', '/bank/2.5', '/bank/0'])(
    'rejects invalid category route %s without requesting backend data',
    async (entry) => {
      render(
        <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/bank/:id" element={<QuestionList />} />
          </Routes>
        </MemoryRouter>,
      )

      expect(await screen.findByText('分类地址无效')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '返回题库' })).toBeInTheDocument()
      expect(vi.mocked(getCategoryById)).not.toHaveBeenCalled()
      expect(vi.mocked(getQuestions)).not.toHaveBeenCalled()
    },
  )
})
