import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Question } from '../types'
import AnswerQualityPanel from './AnswerQualityPanel'

function question(): Question {
  return {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    content: '标准回答',
    difficulty: 'MEDIUM',
    categoryName: 'Java 集合',
    categoryId: 1,
    tags: ['Java', '集合'],
    viewCount: 100,
    createTime: '2026-06-15T00:00:00',
    summary: 'HashMap 线程不安全主要来自并发扩容和覆盖写。',
    principle: '并发修改会破坏桶和链表结构。',
    risk: '不要只说没有加锁，要说明边界。',
  }
}

describe('AnswerQualityPanel', () => {
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

  it('copies answer quality markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<AnswerQualityPanel question={question()} />)

    await userEvent.click(screen.getByRole('button', { name: /复制质量/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# HashMap 为什么线程不安全？ 答案质量卡')
    expect(writeText.mock.calls[0][0]).toContain('## 质量概览')
    expect(writeText.mock.calls[0][0]).toContain('## 面试官追问')
  })
})
