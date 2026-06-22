import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import {
  buildAnswerQualityMarkdown,
  calculateAnswerQuality,
  generateFollowUps,
  getMistakeHint,
  getQuickAnswer,
} from './answerQuality'

const question = (patch: Partial<Question>): Question => ({
  id: 1,
  title: 'HashMap 为什么线程不安全？',
  content: '第一段标准答案。\n\n第二段更多解释。',
  difficulty: 'MEDIUM',
  categoryName: 'Java 集合',
  categoryId: 1,
  tags: ['Java', '集合'],
  viewCount: 0,
  createTime: '2026-06-15T00:00:00',
  ...patch,
})

describe('answerQuality', () => {
  it('uses summary as the quick answer when present', () => {
    expect(getQuickAnswer(question({ summary: '30 秒回答' }))).toBe('30 秒回答')
  })

  it('falls back to the first content paragraph for quick answer', () => {
    expect(getQuickAnswer(question({ summary: undefined }))).toBe('第一段标准答案。')
  })

  it('scores complete answers higher than incomplete answers', () => {
    const complete = calculateAnswerQuality(question({
      summary: 'summary',
      principle: 'principle',
      comparison: 'comparison',
      scenario: 'scenario',
      risk: 'risk',
      projectExp: 'project',
      codeExamples: '[{"lang":"java","title":"demo","code":"class A {}","description":"demo"}]',
      diagrams: '[{"type":"mermaid","alt":"flow","content":"graph TD","caption":"flow"}]',
    }))
    const incomplete = calculateAnswerQuality(question({ content: 'short' }))

    expect(complete.score).toBeGreaterThan(incomplete.score)
    expect(complete.level).toBe('excellent')
    expect(incomplete.missingFields).toContain('项目落地')
  })

  it('generates category-aware follow-up questions', () => {
    const followUps = generateFollowUps(question({}))

    expect(followUps).toHaveLength(3)
    expect(followUps.join(' ')).toContain('HashMap')
  })

  it('uses risk as the mistake hint before generic fallback', () => {
    expect(getMistakeHint(question({ risk: '不要只背死循环。' }))).toBe('不要只背死循环。')
    expect(getMistakeHint(question({ risk: undefined }))).toContain('不要只背结论')
  })

  it('exports answer quality as portable markdown', () => {
    const markdown = buildAnswerQualityMarkdown(question({
      title: 'HashMap 为什么线程不安全？',
      categoryName: 'Java 集合',
      summary: 'HashMap 线程不安全主要来自并发扩容和覆盖写。',
      principle: '并发修改会破坏桶和链表结构。',
      risk: '不要只说没有加锁，要说明边界。',
    }), '2026-06-18T00:00:00.000Z')

    expect(markdown).toContain('# HashMap 为什么线程不安全？ 答案质量卡')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 质量概览')
    expect(markdown).toContain('## 已覆盖模块')
    expect(markdown).toContain('## 可补强模块')
    expect(markdown).toContain('## 面试官追问')
    expect(markdown).toContain('## 误区提醒')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps incomplete answer quality export actionable', () => {
    const markdown = buildAnswerQualityMarkdown(
      question({ summary: undefined, risk: undefined }),
      '2026-06-18T00:00:00.000Z',
    )

    expect(markdown).toContain('可补强模块')
    expect(markdown).toContain('不要只背结论')
    expect(markdown).not.toContain('undefined')
  })
})
