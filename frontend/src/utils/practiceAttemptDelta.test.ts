import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeAttemptDelta } from './practiceAttemptDelta'

const NOW = '2026-06-18T08:00:00.000Z'

function question(): PracticeQueueItem {
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
  }
}

function criterion(key: InterviewCriterion['key'], score: number): InterviewCriterion {
  const labels: Record<InterviewCriterion['key'], string> = {
    coverage: '知识覆盖',
    structure: '表达结构',
    specificity: '场景细节',
    risk: '边界风险',
  }
  return {
    key,
    label: labels[key],
    score,
    summary: `${labels[key]} ${score} 分`,
  }
}

function attempt(score: number, scores: Partial<Record<InterviewCriterion['key'], number>>, createdAt = NOW): InterviewAttempt {
  return {
    questionId: 1,
    answer: `回答 ${score}`,
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        criterion('coverage', scores.coverage ?? score),
        criterion('structure', scores.structure ?? score),
        criterion('specificity', scores.specificity ?? score),
        criterion('risk', scores.risk ?? score),
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('practiceAttemptDelta', () => {
  it('keeps empty attempts actionable', () => {
    const delta = buildPracticeAttemptDelta(question(), [])

    expect(delta.level).toBe('empty')
    expect(delta.latestScore).toBe(0)
    expect(delta.primaryAction.label).toBe('先完成一次模拟评分')
    expect(delta.primaryAction.prompt).toContain('HashMap 为什么线程不安全')
    expect(JSON.stringify(delta)).not.toContain('undefined')
  })

  it('builds a single-attempt baseline with a retry prompt', () => {
    const delta = buildPracticeAttemptDelta(question(), [attempt(62, { specificity: 45 })])

    expect(delta.level).toBe('single')
    expect(delta.latestScore).toBe(62)
    expect(delta.previousScore).toBeUndefined()
    expect(delta.primaryAction.label).toBe('再答一次验收')
    expect(delta.primaryAction.prompt).toContain('请重新回答')
    expect(delta.primaryAction.prompt).toContain('场景细节')
  })

  it('detects improvement and criterion deltas between latest two attempts', () => {
    const delta = buildPracticeAttemptDelta(question(), [
      attempt(82, { coverage: 86, structure: 80, specificity: 76, risk: 84 }, '2026-06-18T08:00:00.000Z'),
      attempt(68, { coverage: 72, structure: 70, specificity: 44, risk: 66 }, '2026-06-18T07:00:00.000Z'),
    ])

    expect(delta.level).toBe('improved')
    expect(delta.scoreDelta).toBe(14)
    expect(delta.title).toContain('重答有效')
    expect(delta.criterionDeltas.find(item => item.key === 'specificity')?.delta).toBe(32)
    expect(delta.primaryAction.label).toBe('进入追问验证')
  })

  it('focuses the primary action on the most regressed criterion', () => {
    const delta = buildPracticeAttemptDelta(question(), [
      attempt(58, { coverage: 70, structure: 68, specificity: 38, risk: 56 }, '2026-06-18T08:00:00.000Z'),
      attempt(70, { coverage: 72, structure: 70, specificity: 72, risk: 66 }, '2026-06-18T07:00:00.000Z'),
    ])

    expect(delta.level).toBe('regressed')
    expect(delta.scoreDelta).toBe(-12)
    expect(delta.primaryAction.label).toBe('按场景细节重答')
    expect(delta.primaryAction.prompt).toContain('场景细节')
    expect(JSON.stringify(delta)).not.toContain('undefined')
  })
})
