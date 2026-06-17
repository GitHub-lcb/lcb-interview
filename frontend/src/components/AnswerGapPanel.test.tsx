import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { Question } from '../types'
import AnswerGapPanel from './AnswerGapPanel'

function question(): Question {
  return {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    summary: 'HashMap 多线程写入时没有同步保护，可能出现数据覆盖和扩容异常。',
    content: '标准回答需要说明 HashMap 的 put、resize、桶数组和节点引用修改过程。',
    principle: '底层原理是数组加链表/红黑树，扩容迁移时会重新计算位置。',
    comparison: '可对比 Hashtable、Collections.synchronizedMap 和 ConcurrentHashMap。',
    scenario: '在线上高并发缓存写入场景，应使用 ConcurrentHashMap 或外部锁。',
    risk: '风险包括可见性问题、数据覆盖、并发扩容异常；只读场景风险较低。',
    projectExp: '项目落地要说明压测、监控、锁粒度和迁移方案。',
    codeExamples: '',
    diagrams: '',
    difficulty: 'HARD',
    categoryName: 'Java 集合',
    categoryId: 1,
    tags: ['HashMap', '并发', '扩容'],
    viewCount: 300,
    createTime: '2026-06-17T00:00:00.000Z',
  }
}

describe('AnswerGapPanel', () => {
  it('copies answer gap markdown for review notes', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <AnswerGapPanel
        question={question()}
        answer="HashMap 多线程不安全，因为 put 和 resize 没有同步保护，可以用 ConcurrentHashMap。"
      />,
    )

    expect(screen.getByText('答案差距校准')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /复制校准/ }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# HashMap 为什么线程不安全？ 答案差距校准'))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('## 重写提纲'))
  })
})
