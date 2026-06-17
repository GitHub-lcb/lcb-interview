import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import PracticeFeedbackClosurePanel from './PracticeFeedbackClosurePanel'

afterEach(() => cleanup())

function question(): PracticeQueueItem {
  return {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['Java'],
    viewCount: 100,
    status: 'learning',
    source: 'plan',
  }
}

function feedback(): InterviewFeedback {
  return {
    score: 52,
    level: 'needs-work',
    criteria: [
      { key: 'coverage', label: '覆盖度', score: 62, summary: '覆盖一般' },
      { key: 'structure', label: '结构化', score: 42, summary: '结构不足' },
      { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
      { key: 'risk', label: '风险意识', score: 58, summary: '风险不足' },
    ],
    advice: [],
    followUps: [],
  }
}

describe('PracticeFeedbackClosurePanel', () => {
  it('renders closure metrics and sends rewrite prompts back to practice', () => {
    const onUsePrompt = vi.fn()

    render(
      <PracticeFeedbackClosurePanel
        question={question()}
        answer="HashMap 在多线程下 put 和 resize 都可能出现覆盖、丢数据和结构异常，所以不能直接并发写。"
        feedback={feedback()}
        onUsePrompt={onUsePrompt}
        onMarkWeak={vi.fn()}
        onMarkMastered={vi.fn()}
        onOpenAnswer={vi.fn()}
        onNext={vi.fn()}
      />
    )

    expect(screen.getByText('面试后闭环教练')).toBeInTheDocument()
    expect(screen.getByText('先修复最低分维度')).toBeInTheDocument()
    expect(screen.getByText('最低维度')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /重答结构化/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /重答结构化/ }))

    expect(onUsePrompt).toHaveBeenCalledTimes(1)
    expect(onUsePrompt.mock.calls[0][0]).toContain('结构化')
  })

  it('copies the single-question closure markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <PracticeFeedbackClosurePanel
        question={question()}
        answer="HashMap 在多线程下 put 和 resize 都可能出现覆盖、丢数据和结构异常，所以不能直接并发写。"
        feedback={feedback()}
        onUsePrompt={vi.fn()}
        onMarkWeak={vi.fn()}
        onMarkMastered={vi.fn()}
        onOpenAnswer={vi.fn()}
        onNext={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /复制闭环/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# HashMap 为什么线程不安全？ 单题评分闭环')
    expect(writeText.mock.calls[0][0]).toContain('重答结构化')
  })
})
