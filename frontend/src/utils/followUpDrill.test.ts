import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, PracticeQueueItem } from '../types'
import { buildFollowUpDrillMarkdown, buildFollowUpDrillPack } from './followUpDrill'

const question: PracticeQueueItem = {
  id: 101,
  title: 'HashMap 为什么线程不安全？扩容时会发生什么？',
  difficulty: 'HARD',
  categoryName: 'Java 集合',
  categoryId: 1,
  tags: ['HashMap', '并发', '扩容'],
  viewCount: 300,
  status: 'learning',
  source: 'review',
}

function feedback(partial: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    score: 55,
    level: 'needs-work',
    criteria: [
      { key: 'coverage', label: '知识覆盖', score: 65, summary: '核心概念不足' },
      { key: 'structure', label: '表达结构', score: 82, summary: '结构可用' },
      { key: 'specificity', label: '场景细节', score: 30, summary: '缺少场景' },
      { key: 'risk', label: '边界风险', score: 42, summary: '缺少边界' },
    ],
    advice: ['加入线上场景和边界说明。'],
    followUps: [
      '放到线上高并发写入场景，你会怎么选型和验证？',
      '这个方案的边界、风险和常见误区是什么？',
    ],
    ...partial,
  }
}

describe('buildFollowUpDrillPack', () => {
  it('prioritizes the weakest criterion and explains how to answer', () => {
    const pack = buildFollowUpDrillPack(question, 'HashMap 多线程不安全。', feedback())

    expect(pack.title).toContain('追问')
    expect(pack.items[0].criterionKey).toBe('specificity')
    expect(pack.items[0].prompt).toContain('线上高并发')
    expect(pack.items[0].pressurePoint).toContain('场景')
    expect(pack.items[0].answerGuide).toContain('项目')
  })

  it('generates fallback drills when feedback has no follow-up prompts', () => {
    const pack = buildFollowUpDrillPack(question, '回答较短。', feedback({ followUps: [] }))

    expect(pack.items.length).toBeGreaterThanOrEqual(2)
    expect(pack.items.some(item => item.criterionKey === 'risk')).toBe(true)
    expect(pack.items.every(item => item.answerGuide.length > 0)).toBe(true)
  })

  it('adds domain-specific HashMap pressure questions', () => {
    const pack = buildFollowUpDrillPack(question, '提到了 HashMap 和扩容。', feedback())

    expect(pack.items.some(item => item.prompt.includes('ConcurrentHashMap'))).toBe(true)
  })

  it('keeps strong answers under pressure with advanced prompts', () => {
    const strongFeedback = feedback({
      score: 88,
      level: 'strong',
      criteria: feedback().criteria.map(item => ({ ...item, score: 86, summary: '表现稳定' })),
      followUps: [],
    })

    const pack = buildFollowUpDrillPack(question, '首先说明结论，其次展开原理、项目场景和风险。', strongFeedback)

    expect(pack.summary).toContain('进阶')
    expect(pack.items.some(item => item.prompt.includes('权衡'))).toBe(true)
  })

  it('deduplicates and limits drill prompts', () => {
    const noisyFeedback = feedback({
      followUps: [
        '这个方案的边界、风险和常见误区是什么？',
        '这个方案的边界、风险和常见误区是什么？',
        '请用 60 秒重新回答：HashMap 为什么线程不安全？',
        '请用 60 秒重新回答：HashMap 为什么线程不安全？',
      ],
    })

    const pack = buildFollowUpDrillPack(question, '回答里缺少风险。', noisyFeedback)
    const prompts = pack.items.map(item => item.prompt)

    expect(new Set(prompts).size).toBe(prompts.length)
    expect(pack.items.length).toBeLessThanOrEqual(5)
  })

  it('exports follow-up drill pack as portable markdown', () => {
    const markdown = buildFollowUpDrillMarkdown(
      question,
      'HashMap 多线程下扩容会出现覆盖写和结构异常。',
      feedback(),
      '2026-06-18T00:00:00.000Z',
    )

    expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 追问加压训练')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 题目上下文')
    expect(markdown).toContain('## 训练概览')
    expect(markdown).toContain('## 加压题单')
    expect(markdown).toContain('维度：场景细节')
    expect(markdown).toContain('答题引导：')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps follow-up drill export actionable without a prior answer', () => {
    const markdown = buildFollowUpDrillMarkdown(
      question,
      ' ',
      feedback(),
      '2026-06-18T00:00:00.000Z',
    )

    expect(markdown).toContain('当前回答摘要：未填写本轮回答')
    expect(markdown).toContain('## 加压题单')
    expect(markdown).not.toContain('undefined')
  })
})
