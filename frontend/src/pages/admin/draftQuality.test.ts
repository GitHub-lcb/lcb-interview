import { describe, expect, it } from 'vitest'
import { getDraftQualityWarnings } from './draftQuality'
import type { QuestionAdmin } from '../../types'

function baseDraft(overrides: Partial<QuestionAdmin> = {}): QuestionAdmin {
  return {
    id: 1,
    title: 'Java HashMap 为什么线程不安全',
    summary: 'HashMap 在并发写入时没有同步保护，可能出现数据覆盖、结构异常以及读到不一致结果。',
    content: [
      '30 秒口述版',
      '标准答案',
      '面试官评分点',
      '高频追问',
      '这是一段足够长的答案内容。'.repeat(120),
    ].join('\n'),
    principle: 'HashMap 的数组、链表和红黑树结构会在 put、resize、treeify 时修改共享状态，并发写入没有 happens-before 约束，可能造成覆盖和结构异常。'.repeat(2),
    comparison: 'ConcurrentHashMap 通过 CAS、同步控制和更细粒度的桶级保护降低并发冲突，适合共享读写；Hashtable 全方法同步，吞吐较低。'.repeat(2),
    scenario: '单线程临时 Map 或外部已加锁时可以使用 HashMap；多线程共享写入、缓存索引和连接状态表应使用并发容器。'.repeat(2),
    risk: '线上风险包括数据丢失、偶发读取不一致、扩容期间延迟抖动以及难以复现的并发缺陷，需要压测和竞态测试兜底。'.repeat(2),
    projectExp: '项目表达可说本地缓存索引曾由 HashMap 改造为 ConcurrentHashMap，并通过并发压测验证更新一致性和吞吐。'.repeat(2),
    codeExamples: '[{"lang":"java","title":"并发容器","code":"new ConcurrentHashMap<>()","description":"替代共享 HashMap"}]',
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    categoryId: 1,
    tags: ['Java'],
    viewCount: 0,
    createTime: '2026-06-19T10:00:00',
    status: 'DRAFT',
    source: 'AI_GENERATED',
    ...overrides,
  }
}

describe('draftQuality', () => {
  it('returns no warnings for a publishable draft', () => {
    expect(getDraftQualityWarnings(baseDraft())).toEqual([])
  })

  it('catches drafts that old list tags would have treated as complete', () => {
    const warnings = getDraftQualityWarnings(baseDraft({
      content: '有答案但缺少发布要求的结构段落。'.repeat(20),
      comparison: '',
      scenario: '',
    }))

    expect(warnings.map(warning => warning.label)).toEqual(
      expect.arrayContaining(['短答案', '缺口述', '缺标准答案', '缺评分点', '缺追问', '缺对比', '缺场景']),
    )
  })

  it('requires code examples only for code-oriented drafts', () => {
    const warnings = getDraftQualityWarnings(baseDraft({ codeExamples: '[]' }))

    expect(warnings.map(warning => warning.label)).toContain('缺代码')
  })
})
