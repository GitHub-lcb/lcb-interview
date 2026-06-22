import { describe, expect, it } from 'vitest'
import type { PracticeQueueItem } from '../types'
import { evaluateInterviewAnswer } from './interviewCoach'

const question: PracticeQueueItem = {
  id: 101,
  title: 'HashMap thread safety and resize mechanism',
  difficulty: 'HARD',
  categoryName: 'Java Collections',
  categoryId: 1,
  tags: ['HashMap', 'Thread Safety', 'Resize'],
  viewCount: 320,
  status: 'learning',
  source: 'review',
}

describe('interviewCoach', () => {
  it('returns low score and direct advice for a blank answer', () => {
    const feedback = evaluateInterviewAnswer(question, '   ')

    expect(feedback.score).toBe(0)
    expect(feedback.level).toBe('needs-work')
    expect(feedback.criteria.every(item => item.score === 0)).toBe(true)
    expect(feedback.advice[0]).toContain('先写出')
    expect(feedback.followUps).toHaveLength(2)
  })

  it('scores a structured answer with keywords, example, and risk awareness highly', () => {
    const feedback = evaluateInterviewAnswer(question, `
      首先，HashMap 在多线程下线程不安全，resize 过程中可能出现数据覆盖和链表/树结构异常。
      其次，put 操作会修改桶数组和节点引用，没有同步保护，两个线程同时扩容会造成可见性和覆盖问题。
      例如高并发缓存写入时，我会使用 ConcurrentHashMap 或者在外层加锁，并说明锁粒度。
      风险是不能只说 HashMap 不安全，还要说明边界：只读场景风险较低，写多读多必须换并发容器。
    `)

    expect(feedback.score).toBeGreaterThanOrEqual(80)
    expect(feedback.level).toBe('strong')
    expect(feedback.criteria.map(item => item.key)).toEqual(['coverage', 'structure', 'specificity', 'risk'])
    expect(feedback.followUps.some(item => item.includes('ConcurrentHashMap'))).toBe(true)
  })

  it('asks targeted follow-up questions for shallow answers', () => {
    const feedback = evaluateInterviewAnswer(question, 'HashMap is not safe in multiple threads.')

    expect(feedback.score).toBeLessThan(60)
    expect(feedback.level).toBe('needs-work')
    expect(feedback.followUps.some(item => item.includes('线上'))).toBe(true)
    expect(feedback.advice.length).toBeGreaterThanOrEqual(2)
  })
})
