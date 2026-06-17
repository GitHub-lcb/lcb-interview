import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, QuestionSnapshot, StudyProgress } from '../types'
import { buildInterviewMaterialVault } from './interviewMaterialVault'

const NOW = '2026-06-17T10:00:00.000Z'

function snapshot(id: number, categoryName = 'Java 基础'): QuestionSnapshot {
  return {
    id,
    title: `Java 面试题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName,
    tags: ['Java'],
    viewCount: 100 + id,
  }
}

function progress(overrides: Partial<StudyProgress> = {}): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
    ...overrides,
  }
}

function attempt(questionId: number, score: number, answer: string, createdAt = NOW): InterviewAttempt {
  return {
    questionId,
    answer,
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心概念' },
        { key: 'structure', label: '结构化', score, summary: '结构表达稳定' },
        { key: 'specificity', label: '场景细节', score, summary: '场景细节充分' },
        { key: 'risk', label: '风险意识', score, summary: '风险意识清楚' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('buildInterviewMaterialVault', () => {
  it('returns an empty vault when there are no high-score samples', () => {
    const vault = buildInterviewMaterialVault(progress())

    expect(vault.level).toBe('empty')
    expect(vault.totalSamples).toBe(0)
    expect(vault.snippets).toEqual([])
    expect(vault.primaryAction).toMatchObject({ label: '先做一题模拟', to: '/practice' })
    expect(vault.metrics[0]).toMatchObject({ key: 'samples', value: '0' })
  })

  it('does not save pass-level answers as reusable materials', () => {
    const vault = buildInterviewMaterialVault(progress({
      questionSnapshots: {
        1: snapshot(1),
      },
      interviewAttempts: {
        1: [attempt(1, 79, '结论是 HashMap 并发写会有覆盖问题，项目里需要换 ConcurrentHashMap。')],
      },
    }))

    expect(vault.level).toBe('empty')
    expect(vault.totalSamples).toBe(0)
    expect(vault.snippets).toHaveLength(0)
  })

  it('extracts scenario and risk sentences from strong answers', () => {
    const vault = buildInterviewMaterialVault(progress({
      questionSnapshots: {
        1: snapshot(1, 'Java 并发'),
        2: snapshot(2, '系统设计'),
      },
      interviewAttempts: {
        1: [attempt(1, 86, '项目场景是在订单高峰期并发写缓存，我们用分段锁控制写入范围。最后用压测和监控验证吞吐。')],
        2: [attempt(2, 88, '最大的风险是缓存击穿和回滚不一致，所以要准备降级开关、监控告警和兜底数据源。')],
      },
    }))

    expect(vault.level).toBe('ready')
    expect(vault.snippets).toHaveLength(2)
    expect(vault.snippets[0]).toMatchObject({ questionId: 2, kind: 'risk' })
    expect(vault.snippets[0].content).toContain('最大的风险')
    expect(vault.snippets[1]).toMatchObject({ questionId: 1, kind: 'scenario' })
    expect(vault.snippets[1].content).toContain('项目场景')
  })

  it('reports ready metrics when strong materials cover multiple categories', () => {
    const vault = buildInterviewMaterialVault(progress({
      questionSnapshots: {
        1: snapshot(1, 'Java 并发'),
        2: snapshot(2, '系统设计'),
        3: snapshot(3, 'Redis'),
      },
      interviewAttempts: {
        1: [attempt(1, 84, '结论是先保证线程安全，再选择合适的数据结构。')],
        2: [attempt(2, 90, '项目场景是秒杀入口，需要限流、削峰和库存一致性校验。')],
        3: [attempt(3, 92, '风险边界是缓存和数据库不一致，必须有回滚、监控和补偿任务。')],
      },
    }))

    expect(vault.level).toBe('ready')
    expect(vault.totalSamples).toBe(3)
    expect(vault.categoryCount).toBe(3)
    expect(vault.averageScore).toBe(89)
    expect(vault.primaryAction).toMatchObject({ label: '复盘高分素材', to: '/study' })
    expect(vault.metrics.find(metric => metric.key === 'categories')?.value).toBe('3')
  })
})
