import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { StudyProgress } from '../../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../../utils/studyProgress'
import { writePracticeAnswerDraft } from '../../utils/practiceAnswerDraftStore'
import AppLayout from '.'

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

function progress(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-20T09:00:00.000Z'),
    dailyPlan: [2],
    questionSnapshots: {
      2: {
        id: 2,
        title: 'MySQL 索引题',
        difficulty: 'MEDIUM',
        categoryName: 'MySQL',
        tags: ['MySQL'],
        viewCount: 99,
      },
    },
    questionStates: {
      2: {
        status: 'learning',
        addedToPlan: true,
        reviewCount: 1,
      },
    },
  }
}

describe('AppLayout global recovery dock', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.clear()
    window.sessionStorage.clear()
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
    window.sessionStorage.clear()
  })

  it('surfaces answer drafts across ordinary user pages', async () => {
    writePracticeAnswerDraft(2, 'MySQL 索引草稿回答', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter initialEntries={['/banks']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/banks" element={<div>题库页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const dock = screen.getByLabelText('全站未提交回答恢复')
    expect(within(dock).getByRole('heading', { name: '继续未完成训练' })).toBeInTheDocument()
    expect(within(dock).getByText('1 份回答草稿待评分')).toBeInTheDocument()
    expect(within(dock).getByText('MySQL 索引题')).toBeInTheDocument()

    await userEvent.click(within(dock).getByRole('button', { name: /恢复 1 份草稿/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2')
  })

  it('lets users hide the current recovery dock until draft content changes', async () => {
    writePracticeAnswerDraft(2, 'MySQL 索引草稿回答', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter initialEntries={['/banks']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/banks" element={<div>题库页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const dock = screen.getByLabelText('全站未提交回答恢复')
    await userEvent.click(within(dock).getByRole('button', { name: '本次先隐藏' }))

    expect(screen.queryByLabelText('全站未提交回答恢复')).not.toBeInTheDocument()

    writePracticeAnswerDraft(2, 'MySQL 索引草稿回答，补充覆盖索引。', '2026-06-20T09:45:00.000Z')

    await waitFor(() => {
      expect(screen.getByLabelText('全站未提交回答恢复')).toBeInTheDocument()
    })
  })

  it('stays hidden on the practice page to avoid duplicating the editor draft state', () => {
    writePracticeAnswerDraft(2, 'MySQL 索引草稿回答', '2026-06-20T09:30:00.000Z')

    render(
      <MemoryRouter initialEntries={['/practice']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/practice" element={<div>训练页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByLabelText('全站未提交回答恢复')).not.toBeInTheDocument()
  })

  it('clears the active search query when submitting an empty header search on the search page', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=java']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/search" element={<div>搜索页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const searchInput = screen.getByPlaceholderText('搜索...')
    expect(searchInput).toHaveValue('java')

    await userEvent.clear(searchInput)
    await userEvent.keyboard('{Enter}')

    expect(navigate).toHaveBeenCalledWith('/search')
  })
})
