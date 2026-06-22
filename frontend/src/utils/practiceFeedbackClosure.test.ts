import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import { buildPracticeFeedbackClosure, buildPracticeFeedbackClosureMarkdown } from './practiceFeedbackClosure'

function question(overrides: Partial<PracticeQueueItem> = {}): PracticeQueueItem {
  return {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    difficulty: 'MEDIUM',
    categoryName: 'Java 并发',
    tags: ['Java', '并发'],
    viewCount: 120,
    status: 'learning',
    source: 'plan',
    ...overrides,
  }
}

function feedback(score: number, overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [
      { key: 'coverage', label: '覆盖度', score, summary: '覆盖一般' },
      { key: 'structure', label: '结构化', score: Math.min(score, 54), summary: '结构不足' },
      { key: 'specificity', label: '场景细节', score, summary: '场景一般' },
      { key: 'risk', label: '风险意识', score, summary: '风险一般' },
    ],
    advice: [],
    followUps: ['如果面试官继续追问扩容并发风险，你会怎么解释？'],
    ...overrides,
  }
}

describe('buildPracticeFeedbackClosure', () => {
  it('prioritizes rewrite and weak marking for low-score answers', () => {
    const closure = buildPracticeFeedbackClosure(
      question(),
      'HashMap 多线程会有问题。',
      feedback(52, {
        criteria: [
          { key: 'coverage', label: '覆盖度', score: 62, summary: '覆盖一般' },
          { key: 'structure', label: '结构化', score: 42, summary: '结构不足' },
          { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
          { key: 'risk', label: '风险意识', score: 58, summary: '风险不足' },
        ],
      }),
    )

    expect(closure.level).toBe('repair')
    expect(closure.title).toContain('先修复')
    expect(closure.primaryAction).toMatchObject({ kind: 'rewrite' })
    expect(closure.primaryAction.prompt).toContain('结构化')
    expect(closure.actions.some(action => action.kind === 'weak')).toBe(true)
  })

  it('uses the first follow-up as the main action for pass-level answers', () => {
    const closure = buildPracticeFeedbackClosure(
      question(),
      '先讲结论，再讲 HashMap put 和 resize 在并发下可能互相覆盖。',
      feedback(72, {
        criteria: [
          { key: 'coverage', label: '覆盖度', score: 72, summary: '覆盖一般' },
          { key: 'structure', label: '结构化', score: 70, summary: '结构可用' },
          { key: 'specificity', label: '场景细节', score: 68, summary: '场景一般' },
          { key: 'risk', label: '风险意识', score: 66, summary: '风险一般' },
        ],
      }),
    )

    expect(closure.level).toBe('follow-up')
    expect(closure.primaryAction.kind).toBe('follow-up')
    expect(closure.primaryAction.prompt).toContain('扩容并发风险')
    expect(closure.actions.some(action => action.kind === 'answer')).toBe(true)
  })

  it('recommends mastered marking for strong answers', () => {
    const closure = buildPracticeFeedbackClosure(
      question(),
      '先给结论，再解释 put、resize、数据覆盖和链表环风险，最后补 ConcurrentHashMap 的替代方案。',
      feedback(88, {
        criteria: [
          { key: 'coverage', label: '覆盖度', score: 88, summary: '覆盖完整' },
          { key: 'structure', label: '结构化', score: 86, summary: '结构清晰' },
          { key: 'specificity', label: '场景细节', score: 84, summary: '有场景' },
          { key: 'risk', label: '风险意识', score: 82, summary: '有风险' },
        ],
      }),
    )

    expect(closure.level).toBe('pass')
    expect(closure.primaryAction.kind).toBe('mastered')
    expect(closure.actions.some(action => action.kind === 'follow-up')).toBe(true)
  })

  it('asks for project context first when the answer is too short', () => {
    const closure = buildPracticeFeedbackClosure(
      question(),
      '线程不安全。',
      feedback(76),
    )

    expect(closure.actions[0]).toMatchObject({ kind: 'rewrite' })
    expect(closure.actions[0].description).toContain('项目场景')
    expect(closure.metrics.some(metric => metric.label === '答案长度' && metric.detail === '信息量偏少')).toBe(true)
  })

  it('exports low-score closure as portable markdown', () => {
    const markdown = buildPracticeFeedbackClosureMarkdown(
      question(),
      'HashMap 在多线程下 put 和 resize 都可能出现覆盖、丢数据和结构异常，所以不能直接并发写。',
      feedback(52, {
        criteria: [
          { key: 'coverage', label: '覆盖度', score: 62, summary: '覆盖一般' },
          { key: 'structure', label: '结构化', score: 42, summary: '结构不足' },
          { key: 'specificity', label: '场景细节', score: 55, summary: '场景不足' },
          { key: 'risk', label: '风险意识', score: 58, summary: '风险不足' },
        ],
      }),
      '2026-06-17T00:00:00.000Z',
    )

    expect(markdown).toContain('# HashMap 为什么线程不安全？ 单题评分闭环')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 闭环摘要')
    expect(markdown).toContain('先修复最低分维度')
    expect(markdown).toContain('结构化')
    expect(markdown).toContain('重答结构化')
    expect(markdown).toContain('标记薄弱')
    expect(markdown).toContain('## 原始回答')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps short-answer closure export actionable', () => {
    const markdown = buildPracticeFeedbackClosureMarkdown(
      question(),
      '线程不安全。',
      feedback(76),
      '2026-06-17T00:00:00.000Z',
    )

    expect(markdown).toContain('补场景后重答')
    expect(markdown).toContain('项目场景')
    expect(markdown).toContain('## 行动清单')
    expect(markdown).not.toContain('undefined')
  })
})
