import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { getCategoryById } from '../../api/category'
import { getQuestions } from '../../api/question'
import QuestionList from './index'

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
        { category: 1, difficulty: undefined, page: 0, size: 20 },
        { silentGlobalError: true },
      )
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

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('困难'))

    expect(await screen.findByText('当前筛选暂无题目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /清除难度筛选/ }))

    expect(await screen.findByText('Java 中的序列化是什么？')).toBeInTheDocument()
    expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
      { category: 1, difficulty: undefined, page: 0, size: 20 },
      { silentGlobalError: true },
    )
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
