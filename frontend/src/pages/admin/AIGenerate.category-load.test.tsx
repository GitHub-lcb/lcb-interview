import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AIGenerate from './AIGenerate'
import { getCategories } from '../../api/category'
import * as adminApi from '../../api/admin'

vi.mock('../../api/category', () => ({
  getCategories: vi.fn(),
}))

vi.mock('../../api/admin', () => ({
  batchGenerate: vi.fn(),
  getBatchStatus: vi.fn(),
  streamGenerate: vi.fn(),
  streamFillAnswer: vi.fn(),
  streamRewritePublishedAnswers: vi.fn(),
  listDrafts: vi.fn(),
}))

describe('AIGenerate category loading', () => {
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

    vi.mocked(adminApi.getBatchStatus).mockResolvedValue({ status: 'IDLE' } as never)
    vi.mocked(adminApi.listDrafts).mockResolvedValue({ total: 0 } as never)
    vi.mocked(adminApi.streamRewritePublishedAnswers).mockReturnValue(new AbortController())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('shows a recoverable inline error when category loading fails silently', async () => {
    const user = userEvent.setup()
    vi.mocked(getCategories)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce([
        {
          id: 1,
          name: 'Java 基础',
          icon: 'java',
          description: 'Java 基础题库',
          sortOrder: 1,
        },
      ])

    render(<AIGenerate />)

    await waitFor(() => {
      expect(vi.mocked(getCategories)).toHaveBeenCalledWith({ silentGlobalError: true })
    })
    expect(await screen.findByText('分类加载失败')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重试加载分类' }))

    await waitFor(() => expect(vi.mocked(getCategories)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(getCategories)).toHaveBeenLastCalledWith({ silentGlobalError: true })
    await waitFor(() => expect(screen.queryByText('分类加载失败')).not.toBeInTheDocument())
  })

  it('starts published answer rewrite stream from the new admin mode', async () => {
    const user = userEvent.setup()
    vi.mocked(getCategories).mockResolvedValue([
      {
        id: 1,
        name: 'Java 基础',
        icon: 'java',
        description: 'Java 基础题库',
        sortOrder: 1,
      },
    ])

    render(<AIGenerate />)

    await user.click(await screen.findByText('重写已发布'))
    await user.click(screen.getByRole('button', { name: '逐题流式重写答案' }))

    await waitFor(() => {
      expect(adminApi.streamRewritePublishedAnswers).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        undefined,
        5,
      )
    })
  })
})
