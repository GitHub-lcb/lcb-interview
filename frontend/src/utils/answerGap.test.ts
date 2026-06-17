import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import { buildAnswerGapMarkdown, buildAnswerGapReport } from './answerGap'

function question(patch: Partial<Question> = {}): Question {
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
    ...patch,
  }
}

describe('buildAnswerGapReport', () => {
  it('returns zero score and actionable outline for blank answers', () => {
    const report = buildAnswerGapReport(question(), '   ')

    expect(report.score).toBe(0)
    expect(report.level).toBe('empty')
    expect(report.missingModules.length).toBeGreaterThan(0)
    expect(report.rewriteOutline[0]).toContain('先补')
  })

  it('detects missing risk and project modules from a shallow answer', () => {
    const report = buildAnswerGapReport(question(), 'HashMap 多线程不安全，因为 put 和 resize 没有同步保护，可以用 ConcurrentHashMap。')

    expect(report.level).not.toBe('aligned')
    expect(report.missingModules.map(item => item.label)).toContain('风险误区')
    expect(report.missingModules.map(item => item.label)).toContain('项目落地')
    expect(report.rewriteOutline.some(item => item.includes('风险'))).toBe(true)
  })

  it('scores a well-rounded answer highly', () => {
    const report = buildAnswerGapReport(question(), `
      HashMap 在线程并发写入时不安全，put 会修改桶数组和节点引用，resize 会迁移节点并重新计算位置。
      在高并发缓存写入场景我会选择 ConcurrentHashMap，或者外部加锁控制锁粒度。
      风险包括可见性、数据覆盖、并发扩容异常；如果只是只读场景风险较低。
      项目里我会通过压测、监控和迁移方案验证替换效果。
    `)

    expect(report.score).toBeGreaterThanOrEqual(75)
    expect(report.level).toBe('aligned')
    expect(report.coveredModules.map(item => item.label)).toContain('风险误区')
  })

  it('strips markdown from standard answer before keyword matching', () => {
    const report = buildAnswerGapReport(question({
      risk: '```text\n风险：并发扩容异常、数据覆盖。\n```',
    }), '需要说明并发扩容异常和数据覆盖。')

    expect(report.modules.find(item => item.label === '风险误区')?.status).not.toBe('missing')
  })

  it('does not punish modules missing from the standard answer', () => {
    const report = buildAnswerGapReport(question({
      comparison: '',
      projectExp: '',
    }), 'HashMap 多线程写入不安全，put 和 resize 没有同步保护，风险是数据覆盖。')

    expect(report.modules.map(item => item.label)).not.toContain('对比分析')
    expect(report.modules.map(item => item.label)).not.toContain('项目落地')
  })

  it('exports answer gap calibration as portable markdown', () => {
    const markdown = buildAnswerGapMarkdown(
      question(),
      'HashMap 多线程不安全，因为 put 和 resize 没有同步保护，可以用 ConcurrentHashMap。',
      '2026-06-17T00:00:00.000Z',
    )

    expect(markdown).toContain('# HashMap 为什么线程不安全？ 答案差距校准')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 校准摘要')
    expect(markdown).toContain('风险误区')
    expect(markdown).toContain('项目落地')
    expect(markdown).toContain('## 模块明细')
    expect(markdown).toContain('## 重写提纲')
  })

  it('keeps blank answer markdown actionable', () => {
    const markdown = buildAnswerGapMarkdown(question(), ' ', '2026-06-17T00:00:00.000Z')

    expect(markdown).toContain('分数：0')
    expect(markdown).toContain('先完成基础回答')
    expect(markdown).toContain('回答为空')
    expect(markdown).not.toContain('undefined')
  })
})
