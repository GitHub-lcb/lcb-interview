import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import SearchResult from './index'

const fixtures = vi.hoisted(() => ({
  questions: [
    {
      id: 21,
      title: 'HashMap resize',
      content: 'Explain resize behavior',
      difficulty: 'MEDIUM',
      categoryName: 'Java',
      categoryId: 1,
      tags: ['Java'],
      viewCount: 88,
      createTime: '2026-06-20T00:00:00.000Z',
    },
  ],
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

describe('SearchResult', () => {
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

  it('loads search results silently because the page owns its inline failure state', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { keyword: 'java', difficulty: undefined, page: 0, size: 20 },
        { silentGlobalError: true },
      )
    })
  })

  it('clears stale results when submitting an empty search from an existing query', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('输入技术点、场景或题目关键词')
    await user.clear(input)
    await user.keyboard('{Enter}')

    expect(await screen.findByText('输入关键词开始搜索')).toBeInTheDocument()
    expect(screen.queryByText('HashMap resize')).not.toBeInTheDocument()
  })

  it('shows a recoverable empty state when a difficulty filter has no search results', async () => {
    const user = userEvent.setup()
    vi.mocked(getQuestions).mockImplementation((params) => Promise.resolve({
      content: params.difficulty === 'HARD' ? [] : fixtures.questions,
      page: 0,
      size: 20,
      total: params.difficulty === 'HARD' ? 0 : fixtures.questions.length,
      totalPages: params.difficulty === 'HARD' ? 0 : 1,
    }))

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('困难'))

    expect(await screen.findByText('当前筛选暂无题目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /清除难度筛选/ }))

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()
    expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
      { keyword: 'java', difficulty: undefined, page: 0, size: 20 },
      { silentGlobalError: true },
    )
  })

  it('exposes each search result title as a direct detail link', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: '打开题目 HashMap resize' })).toHaveAttribute('href', '/question/21')
  })

  it('opens a search result with the keyboard', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
          <Route path="/question/:id" element={<div>题目详情页</div>} />
        </Routes>
      </MemoryRouter>,
    )

    const title = await screen.findByText('HashMap resize')
    const card = title.closest('article') as HTMLElement
    card.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('题目详情页')).toBeInTheDocument()
  })
})
