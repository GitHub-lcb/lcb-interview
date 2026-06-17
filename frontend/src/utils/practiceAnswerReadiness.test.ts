import { describe, expect, it } from 'vitest'
import type { PracticeQueueItem } from '../types'
import { analyzePracticeAnswerReadiness } from './practiceAnswerReadiness'

function question(overrides: Partial<PracticeQueueItem> = {}): PracticeQueueItem {
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
    ...overrides,
  }
}

describe('practiceAnswerReadiness', () => {
  it('keeps an empty answer in the first-sentence state', () => {
    const result = analyzePracticeAnswerReadiness(question(), '')

    expect(result.level).toBe('empty')
    expect(result.score).toBe(0)
    expect(result.nextAction).toContain('先写出第一句结论')
    expect(result.items.every(item => !item.covered)).toBe(true)
    expect(JSON.stringify(result)).not.toContain('undefined')
  })

  it('marks a structured HashMap answer as sharp', () => {
    const result = analyzePracticeAnswerReadiness(question(), [
      '结论：HashMap 在多线程并发写入时不是线程安全的。',
      '机制：put 和 resize 扩容迁移可能发生覆盖写、链表或红黑树结构异常，应该对比 ConcurrentHashMap。',
      '场景：在线上高并发项目里，如果本地缓存需要并发写，我会换成 ConcurrentHashMap 并监控异常和吞吐。',
      '边界：需要注意 HashMap 只能用于单线程或外部同步场景，否则要用加锁、不可变 Map 或降级兜底。',
    ].join('\n'))

    expect(result.level).toBe('sharp')
    expect(result.score).toBe(100)
    expect(result.items.every(item => item.covered)).toBe(true)
    expect(result.nextAction).toContain('可以提交评分')
  })

  it('prioritizes missing scenario before risk for a partial answer', () => {
    const result = analyzePracticeAnswerReadiness(
      question(),
      '结论：HashMap 多线程不安全。机制：扩容和 put 时可能发生覆盖写和结构异常。',
    )

    expect(result.score).toBe(50)
    expect(result.items.find(item => item.key === 'conclusion')?.covered).toBe(true)
    expect(result.items.find(item => item.key === 'mechanism')?.covered).toBe(true)
    expect(result.items.find(item => item.key === 'scenario')?.covered).toBe(false)
    expect(result.items.find(item => item.key === 'risk')?.covered).toBe(false)
    expect(result.nextAction).toContain('补一个线上/项目场景')
    expect(JSON.stringify(result)).not.toContain('undefined')
  })
})
