import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { message } from 'antd'
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
    content: 'answer',
    difficulty: 'MEDIUM',
    categoryName: 'Java',
    tags: [],
    viewCount: 0,
    status: 'DRAFT',
    source: 'AI_GENERATED',
    createTime: '2026-06-19T10:00:00',
  }
}

function renderDraftReview() {
  return render(
    <MemoryRouter initialEntries={['/admin/draft-review']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DraftReview />
    </MemoryRouter>,
  )
}

describe('DraftReview quality gate errors', () => {
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

  it('does not mask backend quality gate errors with a generic approval failure', async () => {
    const user = userEvent.setup()
    vi.mocked(adminApi.listDrafts).mockResolvedValue({
      records: [draft(41, 'quality-gate-draft')],
      total: 1,
      current: 1,
      pages: 1,
    })
    vi.mocked(adminApi.approveDraft)
      .mockRejectedValue(new Error('题目质量未达标：content 内容少于 500 字'))
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => null as never)

    renderDraftReview()

    const row = (await screen.findByText('quality-gate-draft')).closest('tr')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getAllByRole('button')[1])

    await waitFor(() => expect(adminApi.approveDraft).toHaveBeenCalledWith(41))
    expect(errorSpy).not.toHaveBeenCalledWith('操作失败')
  })
})
