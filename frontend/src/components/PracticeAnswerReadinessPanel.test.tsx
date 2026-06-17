import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PracticeQueueItem } from '../types'
import PracticeAnswerReadinessPanel from './PracticeAnswerReadinessPanel'

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

describe('PracticeAnswerReadinessPanel', () => {
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

  it('renders the first action for an empty answer', () => {
    render(<PracticeAnswerReadinessPanel question={question()} answer="" />)

    expect(screen.getByLabelText('回答结构实时检查')).toBeInTheDocument()
    expect(screen.getByText('先写出第一句结论')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders submit-ready state for a complete answer', () => {
    render(
      <PracticeAnswerReadinessPanel
        question={question()}
        answer={[
          '结论：HashMap 在多线程并发写入时不是线程安全的。',
          '机制：put 和 resize 扩容迁移可能发生覆盖写和结构异常。',
          '场景：在线上高并发项目里，我会换成 ConcurrentHashMap 并监控吞吐。',
          '边界：注意 HashMap 只适合单线程，必要时用加锁或降级兜底。',
        ].join('\n')}
      />,
    )

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('可以提交评分')).toBeInTheDocument()
  })

  it('passes the repair template back to the answer box', async () => {
    const onUseRepairTemplate = vi.fn()
    const answer = '结论：HashMap 多线程不安全。机制：扩容和 put 时可能发生覆盖写和结构异常。'

    render(
      <PracticeAnswerReadinessPanel
        question={question()}
        answer={answer}
        onUseRepairTemplate={onUseRepairTemplate}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /补项目场景/ }))

    expect(onUseRepairTemplate).toHaveBeenCalledTimes(1)
    expect(onUseRepairTemplate.mock.calls[0][0]).toContain(answer)
    expect(onUseRepairTemplate.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })
})
