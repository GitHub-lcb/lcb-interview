import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeQueueItem } from '../types'
import PracticeAnswerScaffoldPanel from './PracticeAnswerScaffoldPanel'

function question(): PracticeQueueItem {
  return {
    id: 1,
    title: 'HashMap 为什么线程不安全？扩容时会发生什么？',
    difficulty: 'HARD',
    categoryName: 'Java 集合',
    categoryId: 1,
    tags: ['HashMap', '并发', '扩容'],
    viewCount: 300,
    status: 'learning',
    source: 'review',
  }
}

describe('PracticeAnswerScaffoldPanel', () => {
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
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the scaffold outline before answering', () => {
    render(
      <PracticeAnswerScaffoldPanel
        question={question()}
        targetRole="Java 后端"
        onUseTemplate={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('答题脚手架')).toBeInTheDocument()
    expect(screen.getByText('先给结论')).toBeInTheDocument()
    expect(screen.getByText('补核心机制')).toBeInTheDocument()
    expect(screen.getByText('带项目场景')).toBeInTheDocument()
    expect(screen.getByText('收边界风险')).toBeInTheDocument()
  })

  it('passes a reusable answer template into the answer box', async () => {
    const onUseTemplate = vi.fn()

    render(
      <PracticeAnswerScaffoldPanel
        question={question()}
        targetRole="Java 后端"
        onUseTemplate={onUseTemplate}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /带入回答框/ }))

    expect(onUseTemplate).toHaveBeenCalledTimes(1)
    expect(onUseTemplate.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
    expect(onUseTemplate.mock.calls[0][0]).toContain('Java 后端')
  })

  it('copies scaffold markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <PracticeAnswerScaffoldPanel
        question={question()}
        targetRole="Java 后端"
        onUseTemplate={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制脚手架/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('答题脚手架')
    expect(writeText.mock.calls[0][0]).toContain('## 口述提纲')
    expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })
})
