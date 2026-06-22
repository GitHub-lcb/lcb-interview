import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import DraftReview from './DraftReview'
import * as adminApi from '../../api/admin'
import type { QuestionAdmin } from '../../types'

vi.mock('../../api/admin', () => ({
  listDrafts: vi.fn(),
  getDraft: vi.fn(),
  approveDraft: vi.fn(),
  rejectDraft: vi.fn(),
  batchApproveDrafts: vi.fn(),
  batchRejectDrafts: vi.fn(),
}))

function draft(id: number, title: string): QuestionAdmin {
  return {
    id,
    title,
    content: '',
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    tags: [],
    viewCount: 0,
    status: 'DRAFT',
    source: 'AI_GENERATED',
    createTime: '2026-06-19T10:00:00',
  }
}

function renderDraftReview(initialEntry = '/admin/draft-review') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DraftReview />
    </MemoryRouter>,
  )
}

describe('DraftReview', () => {
  beforeEach(() => {
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

    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })

    const baseGetComputedStyle = window.getComputedStyle.bind(window)
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: (element: Element) => baseGetComputedStyle(element),
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('refreshes the current backend page after approving a draft on page two', async () => {
    const user = userEvent.setup()
    const listDrafts = vi.mocked(adminApi.listDrafts)
    listDrafts.mockImplementation(async (page = 0) => ({
      records: page === 1
        ? [draft(21, '第二页草稿题')]
        : [draft(1, '第一页草稿题')],
      total: 40,
      current: page + 1,
      pages: 2,
    }))
    vi.mocked(adminApi.approveDraft).mockResolvedValue({} as never)

    renderDraftReview()

    expect(await screen.findByText('第一页草稿题')).toBeInTheDocument()
    await user.click(screen.getByTitle('2'))
    expect(await screen.findByText('第二页草稿题')).toBeInTheDocument()

    listDrafts.mockClear()
    const row = screen.getByText('第二页草稿题').closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: /通\s*过/ }))

    await waitFor(() => expect(adminApi.approveDraft).toHaveBeenCalledWith(21))
    await waitFor(() => expect(listDrafts).toHaveBeenCalledWith(1, 20, {}, { silentGlobalError: true }))
  })

  it('applies the risk filter from the URL and renders quality warning tags', async () => {
    const listDrafts = vi.mocked(adminApi.listDrafts)
    listDrafts.mockResolvedValue({
      records: [draft(31, '空答案草稿')],
      total: 1,
      current: 1,
      pages: 1,
    })

    renderDraftReview('/admin/draft-review?risk=EMPTY_ANSWER')

    expect(await screen.findByText('空答案草稿')).toBeInTheDocument()
    await waitFor(() => expect(listDrafts).toHaveBeenCalledWith(
      0,
      20,
      { riskType: 'EMPTY_ANSWER' },
      { silentGlobalError: true },
    ))
    expect(screen.getAllByText('空答案').length).toBeGreaterThan(0)
  })

  it('applies the content status filter from the URL', async () => {
    const listDrafts = vi.mocked(adminApi.listDrafts)
    listDrafts.mockResolvedValue({
      records: [draft(41, '待补答案草稿')],
      total: 1,
      current: 1,
      pages: 1,
    })

    renderDraftReview('/admin/draft-review?contentStatus=EMPTY')

    expect(await screen.findByText('待补答案草稿')).toBeInTheDocument()
    await waitFor(() => expect(listDrafts).toHaveBeenCalledWith(
      0,
      20,
      { contentStatus: 'EMPTY' },
      { silentGlobalError: true },
    ))
  })

  it('shows a recoverable inline error when the draft list fails silently', async () => {
    const user = userEvent.setup()
    const listDrafts = vi.mocked(adminApi.listDrafts)
    listDrafts
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        records: [draft(51, '恢复后的草稿')],
        total: 1,
        current: 1,
        pages: 1,
      })

    renderDraftReview()

    await waitFor(() => {
      expect(listDrafts).toHaveBeenCalledWith(0, 20, {}, { silentGlobalError: true })
    })
    expect(await screen.findByText('草稿列表加载失败')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /重\s*试/ }))

    await waitFor(() => expect(listDrafts).toHaveBeenCalledTimes(2))
    expect(listDrafts).toHaveBeenLastCalledWith(0, 20, {}, { silentGlobalError: true })
    expect(await screen.findByText('恢复后的草稿')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('草稿列表加载失败')).not.toBeInTheDocument())
  })
})
