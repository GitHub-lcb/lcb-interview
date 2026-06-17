import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import FollowUpDrillPanel from './FollowUpDrillPanel'

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

function feedback(): InterviewFeedback {
  return {
    score: 55,
    level: 'needs-work',
    criteria: [
      { key: 'coverage', label: '知识覆盖', score: 65, summary: '核心概念不足' },
      { key: 'structure', label: '表达结构', score: 82, summary: '结构可用' },
      { key: 'specificity', label: '场景细节', score: 30, summary: '缺少场景' },
      { key: 'risk', label: '边界风险', score: 42, summary: '缺少边界' },
    ],
    advice: ['加入线上场景和边界说明。'],
    followUps: [
      '放到线上高并发写入场景，你会怎么选型和验证？',
      '这个方案的边界、风险和常见误区是什么？',
    ],
  }
}

describe('FollowUpDrillPanel', () => {
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

  it('copies follow-up drill markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <FollowUpDrillPanel
        question={question()}
        answer="HashMap 多线程下扩容会出现覆盖写和结构异常。"
        feedback={feedback()}
        onPickPrompt={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制追问/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('追问加压训练')
    expect(writeText.mock.calls[0][0]).toContain('## 加压题单')
    expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })

  it('keeps drill prompts reusable in the answer box', async () => {
    const onPickPrompt = vi.fn()

    render(
      <FollowUpDrillPanel
        question={question()}
        answer="HashMap 多线程下扩容会出现覆盖写和结构异常。"
        feedback={feedback()}
        onPickPrompt={onPickPrompt}
      />,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /带入回答框/ })[0])

    expect(onPickPrompt).toHaveBeenCalledTimes(1)
    expect(onPickPrompt.mock.calls[0][0]).toContain('线上高并发写入场景')
  })
})
