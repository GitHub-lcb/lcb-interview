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
  batchFillAnswers: vi.fn(),
  batchGenerate: vi.fn(),
  getAiConfigStatus: vi.fn(),
  getBatchFillAnswerStatus: vi.fn(),
  updateAiConfig: vi.fn(),
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
    vi.mocked(adminApi.getBatchFillAnswerStatus).mockResolvedValue({ status: 'IDLE' } as never)
    vi.mocked((adminApi as any).getAiConfigStatus).mockResolvedValue({
      available: true,
      apiKeyConfigured: true,
      model: 'glm-5.2',
      endpointHost: 'opencode.ai',
      message: 'AI 生成服务已配置',
    })
    vi.mocked(adminApi.listDrafts).mockResolvedValue({ total: 0 } as never)
    vi.mocked(adminApi.streamRewritePublishedAnswers).mockReturnValue(new AbortController())
    vi.mocked((adminApi as any).updateAiConfig).mockResolvedValue({
      available: true,
      apiKeyConfigured: true,
      maskedApiKey: 'sk-n****cret',
      model: 'glm-5.2',
      apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
      endpointHost: 'opencode.ai',
      interviewEnabled: true,
      message: 'AI 生成服务已配置',
    })
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

  it('shows ai configuration warning and disables generation when remote ai is unavailable', async () => {
    vi.mocked(getCategories).mockResolvedValue([
      {
        id: 1,
        name: 'Java 基础',
        icon: 'java',
        description: 'Java 基础题库',
        sortOrder: 1,
      },
    ])
    vi.mocked((adminApi as any).getAiConfigStatus).mockResolvedValue({
      available: false,
      apiKeyConfigured: false,
      model: 'glm-5.2',
      endpointHost: 'opencode.ai',
      message: 'AI 生成服务未配置密钥，请设置 AI_OPENCODE_API_KEY',
    })

    const { container } = render(<AIGenerate />)

    expect(await screen.findByText('AI 服务未配置')).toBeInTheDocument()
    expect(screen.getByText(/AI_OPENCODE_API_KEY/)).toBeInTheDocument()
    expect(container.querySelector('button[type="submit"]')).toBeDisabled()
  })

  it('shows masked ai key and saves a new runtime configuration', async () => {
    const user = userEvent.setup()
    vi.mocked(getCategories).mockResolvedValue([
      {
        id: 1,
        name: 'Java 鍩虹',
        icon: 'java',
        description: 'Java 鍩虹棰樺簱',
        sortOrder: 1,
      },
    ])
    vi.mocked((adminApi as any).getAiConfigStatus).mockResolvedValue({
      available: true,
      apiKeyConfigured: true,
      maskedApiKey: 'sk-l****3456',
      model: 'glm-5.2',
      apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
      endpointHost: 'opencode.ai',
      interviewEnabled: true,
      message: 'AI 生成服务已配置',
    })

    render(<AIGenerate />)

    expect(await screen.findByText('sk-l****3456')).toBeInTheDocument()
    expect(screen.queryByText('sk-live-abcdef123456')).not.toBeInTheDocument()

    await user.type(screen.getByTestId('ai-config-api-key'), 'sk-new-secret')
    await user.click(screen.getByTestId('ai-config-submit'))

    await waitFor(() => {
      expect((adminApi as any).updateAiConfig).toHaveBeenCalledWith(expect.objectContaining({
        apiKey: 'sk-new-secret',
        model: 'glm-5.2',
        apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
        interviewEnabled: true,
      }))
    })
  })
})
