import { describe, expect, it } from 'vitest'
import type { PracticeQueueItem } from '../types'
import {
  buildPracticeAnswerScaffold,
  buildPracticeAnswerScaffoldMarkdown,
} from './practiceAnswerScaffold'

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

describe('practiceAnswerScaffold', () => {
  it('builds a four-step speaking scaffold with Java collection hints', () => {
    const scaffold = buildPracticeAnswerScaffold(question(), 'Java 后端')

    expect(scaffold.title).toContain('4 句')
    expect(scaffold.bullets.map(item => item.key)).toEqual([
      'conclusion',
      'mechanism',
      'scenario',
      'risk',
    ])
    expect(scaffold.answerTemplate).toContain('HashMap 为什么线程不安全')
    expect(scaffold.answerTemplate).toContain('Java 后端')
    expect(scaffold.bullets.some(item => item.hint.includes('ConcurrentHashMap'))).toBe(true)
    expect(JSON.stringify(scaffold)).not.toContain('undefined')
  })

  it('falls back to a usable target role when the role is blank', () => {
    const scaffold = buildPracticeAnswerScaffold(
      question({
        title: '如何排查线上接口突然变慢？',
        categoryName: '',
        tags: [],
      }),
      '',
    )

    expect(scaffold.answerTemplate).toContain('目标岗位')
    expect(scaffold.bullets).toHaveLength(4)
    expect(JSON.stringify(scaffold)).not.toContain('undefined')
  })

  it('exports markdown scaffold with date, outline and answer template', () => {
    const markdown = buildPracticeAnswerScaffoldMarkdown(
      question(),
      'Java 后端',
      new Date('2026-06-18T08:00:00.000Z'),
    )

    expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 答题脚手架')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 口述提纲')
    expect(markdown).toContain('## 可带入回答框的模板')
    expect(markdown).toContain('ConcurrentHashMap')
    expect(markdown).not.toContain('undefined')
  })
})
