import { describe, expect, it } from 'vitest'
import type { PracticeQueueItem } from '../types'
import { buildPracticeAnswerRepairAction } from './practiceAnswerRepairAction'

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

describe('practiceAnswerRepairAction', () => {
  it('builds a scenario repair action for an answer missing project context', () => {
    const answer = '结论：HashMap 多线程不安全。机制：扩容和 put 时可能发生覆盖写和结构异常。'
    const action = buildPracticeAnswerRepairAction(question(), answer)

    expect(action.key).toBe('scenario')
    expect(action.label).toBe('补项目场景')
    expect(action.template).toContain(answer)
    expect(action.template).toContain('HashMap 为什么线程不安全')
    expect(action.template).toContain('请补一个线上/项目场景')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })

  it('builds a conclusion repair action for an empty answer', () => {
    const action = buildPracticeAnswerRepairAction(question(), '')

    expect(action.key).toBe('conclusion')
    expect(action.label).toBe('补第一句结论')
    expect(action.template).toContain('HashMap 为什么线程不安全')
    expect(action.template).toContain('结论：')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })

  it('builds a compress action when the answer already has all four parts', () => {
    const action = buildPracticeAnswerRepairAction(question(), [
      '结论：HashMap 在多线程并发写入时不是线程安全的。',
      '机制：put 和 resize 扩容迁移可能发生覆盖写和结构异常。',
      '场景：在线上高并发项目里，我会换成 ConcurrentHashMap 并监控吞吐。',
      '边界：注意 HashMap 只适合单线程，必要时用加锁或降级兜底。',
    ].join('\n'))

    expect(action.key).toBe('compress')
    expect(action.label).toBe('压缩 60 秒版')
    expect(action.template).toContain('请把这段回答压缩成 60 秒版本')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })
})
