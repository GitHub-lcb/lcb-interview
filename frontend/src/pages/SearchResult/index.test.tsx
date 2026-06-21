import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
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

const RECENT_SEARCH_STORAGE_KEY = 'lcb-recent-searches'

vi.mock('../../api/question', () => ({
  getQuestions: vi.fn().mockResolvedValue({
    content: fixtures.questions,
    page: 0,
    size: 20,
    total: 1,
    totalPages: 1,
  }),
}))

function SearchLocationProbe() {
  const location = useLocation()
  return (
    <>
      <SearchResult />
      <span data-testid="search-location">{location.search}</span>
    </>
  )
}

function PracticeLocationProbe() {
  const location = useLocation()
  return (
    <div>
      <span>练习入口</span>
      <span>{location.search}</span>
    </div>
  )
}

function toolbarPracticeButton(): HTMLButtonElement {
  const button = document.querySelector('.search-toolbar-actions .ant-btn-primary')
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('Search practice action was not rendered')
  }
  return button
}

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
        { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'relevance' },
        { silentGlobalError: true },
      )
    })
  })

  it('stores successful keywords as recent searches with the latest keyword first', async () => {
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(['Redis', 'MySQL']))

    render(
      <MemoryRouter initialEntries={['/search?q=Java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()

    const recentSearches = screen.getByLabelText('最近搜索')
    expect(recentSearches).toHaveTextContent('Java')
    expect(recentSearches).toHaveTextContent('Redis')
    expect(recentSearches).toHaveTextContent('MySQL')
    expect(JSON.parse(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY) || '[]')).toEqual(['Java', 'Redis', 'MySQL'])
  })

  it('re-runs a recent search from the empty search page and clears recent searches', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(RECENT_SEARCH_STORAGE_KEY, JSON.stringify(['Redis', 'JVM']))

    render(
      <MemoryRouter initialEntries={['/search']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    const recentSearches = await screen.findByLabelText('最近搜索')
    await user.click(within(recentSearches).getByRole('button', { name: 'Redis' }))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('search-location').textContent || '')
      expect(params.get('q')).toBe('Redis')
    })
    expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
      { keyword: 'Redis', difficulty: undefined, page: 0, size: 20, sort: 'relevance' },
      { silentGlobalError: true },
    )

    await user.click(screen.getByRole('button', { name: '清空最近搜索' }))

    expect(screen.queryByLabelText('最近搜索')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(RECENT_SEARCH_STORAGE_KEY)).toBeNull()
  })

  it('passes selected sort mode to the backend search query', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'relevance' },
        { silentGlobalError: true },
      )
    })

    await user.click(screen.getByRole('combobox', { name: '按排序方式选择' }))
    await user.click(await screen.findByText('按最新'))

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
        { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'latest' },
        { silentGlobalError: true },
      )
    })

    await user.click(screen.getByRole('combobox', { name: '按排序方式选择' }))
    await user.click(await screen.findByText('按热度'))

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
        { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'hot' },
        { silentGlobalError: true },
      )
    })
  })

  it('loads difficulty sort and page from the URL search state', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=java&difficulty=HARD&sort=hot&page=2']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { keyword: 'java', difficulty: 'HARD', page: 1, size: 20, sort: 'hot' },
        { silentGlobalError: true },
      )
    })
  })

  it('writes selected filters to the URL for shareable search state', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(vi.mocked(getQuestions)).toHaveBeenCalledWith(
        { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'relevance' },
        { silentGlobalError: true },
      )
    })

    await user.click(screen.getByRole('combobox', { name: '按难度筛选' }))
    await user.click(await screen.findByText('困难'))
    await user.click(screen.getByRole('combobox', { name: '按排序方式选择' }))
    await user.click(await screen.findByText('按热度'))

    await waitFor(() => {
      const params = new URLSearchParams(screen.getByTestId('search-location').textContent || '')
      expect(params.get('q')).toBe('java')
      expect(params.get('difficulty')).toBe('HARD')
      expect(params.get('sort')).toBe('hot')
      expect(params.get('page')).toBeNull()
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

    await user.click(screen.getByRole('combobox', { name: '按难度筛选' }))
    await user.click(await screen.findByText('困难'))

    expect(await screen.findByText('当前筛选暂无题目')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /清除难度筛选/ }))

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()
    expect(vi.mocked(getQuestions)).toHaveBeenLastCalledWith(
      { keyword: 'java', difficulty: undefined, page: 0, size: 20, sort: 'relevance' },
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

  it('starts search-result practice with the filtered-list handoff source', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('HashMap resize')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /练本页/ }))

    expect(await screen.findByText('练习入口')).toBeInTheDocument()
    expect(screen.getByText('?queue=21&from=filtered-list')).toBeInTheDocument()
  })

  it('falls back to the unfinished daily plan queue when the search page has no results', async () => {
    const user = userEvent.setup()
    vi.mocked(getQuestions).mockResolvedValueOnce({
      content: [],
      page: 0,
      size: 20,
      total: 0,
      totalPages: 0,
    })
    const progress = createDefaultProgress('2026-06-21T00:00:00.000Z')
    progress.dailyPlan = [31]
    progress.questionStates = {
      31: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    }
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))

    render(
      <MemoryRouter initialEntries={['/search?q=missing']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/search" element={<SearchResult />} />
          <Route path="/practice" element={<PracticeLocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(getQuestions).toHaveBeenCalledTimes(1))
    await user.click(toolbarPracticeButton())

    expect(await screen.findByText('练习入口')).toBeInTheDocument()
    expect(screen.getByText('?queue=31&from=daily-plan')).toBeInTheDocument()
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
