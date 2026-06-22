import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, QuestionSnapshot, StudyProgress } from '../types'
import { buildInterviewFollowUpDefense, buildInterviewFollowUpDefenseMarkdown } from './interviewFollowUpDefense'

const NOW = '2026-06-17T10:00:00.000Z'

function snapshot(id: number, categoryName = 'Java 并发'): QuestionSnapshot {
  return {
    id,
    title: `${categoryName} 追问题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName,
    tags: [categoryName],
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

function attempt(
  questionId: number,
  score: number,
  answer: string,
  followUps: string[] = ['如果面试官追问线上场景，你会怎么验证？'],
  createdAt = NOW,
): InterviewAttempt {
  return {
    questionId,
    answer,
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: score - 5, summary: '覆盖还不完整' },
        { key: 'structure', label: '结构化', score, summary: '结构基本清楚' },
        { key: 'specificity', label: '场景细节', score: Math.max(0, score - 12), summary: '缺少场景验证' },
        { key: 'risk', label: '风险意识', score: Math.max(0, score - 8), summary: '边界还不够' },
      ],
      advice: [],
      followUps,
    },
  }
}

describe('buildInterviewFollowUpDefense', () => {
  it('returns an actionable empty report before any interview attempt', () => {
    const report = buildInterviewFollowUpDefense(progress())

    expect(report.level).toBe('empty')
    expect(report.items).toEqual([])
    expect(report.primaryAction).toMatchObject({ label: '先做一题模拟', to: '/practice' })
    expect(report.metrics[0]).toMatchObject({ key: 'items', value: '0' })
  })

  it('prioritizes the latest low-score follow-up as the first defense item', () => {
    const report = buildInterviewFollowUpDefense(progress({
      questionSnapshots: {
        1: snapshot(1, 'Redis'),
        2: snapshot(2, 'Java 并发'),
      },
      interviewAttempts: {
        1: [attempt(1, 88, '结论是先保证一致性，再补监控和回滚。', ['请比较两种方案的权衡。'])],
        2: [attempt(2, 62, '只说了 HashMap 线程不安全，缺少线上验证。')],
      },
    }))

    expect(report.level).toBe('risk')
    expect(report.riskCount).toBe(1)
    expect(report.items[0]).toMatchObject({ questionId: 2, score: 62 })
    expect(report.items[0].prompt).toContain('线上')
    expect(report.items[0].to).toBe('/practice?queue=2&from=interview-retrospective')
    expect(report.primaryAction.to).toBe('/practice?queue=2&from=interview-retrospective')
  })

  it('uses only the latest attempt of each question', () => {
    const report = buildInterviewFollowUpDefense(progress({
      questionSnapshots: {
        1: snapshot(1, 'MySQL'),
      },
      interviewAttempts: {
        1: [
          attempt(1, 48, '旧回答只有结论。', ['旧低分追问不应出现。'], '2026-06-16T10:00:00.000Z'),
          attempt(1, 86, '项目场景是慢查询升高，先定位 SQL、索引和执行计划，再验证回滚。', ['请压缩成 45 秒版本。'], NOW),
        ],
      },
    }))

    expect(report.riskCount).toBe(0)
    expect(report.items.map(item => item.prompt).join(' ')).not.toContain('旧低分追问')
    expect(report.items[0].prompt).toContain('45 秒')
  })

  it('limits the defense list to five items', () => {
    const report = buildInterviewFollowUpDefense(progress({
      questionSnapshots: {
        1: snapshot(1, 'Redis'),
        2: snapshot(2, 'MySQL'),
        3: snapshot(3, 'Spring'),
      },
      interviewAttempts: {
        1: [attempt(1, 58, 'Redis 回答缺少风险。')],
        2: [attempt(2, 64, 'MySQL 回答缺少场景。')],
        3: [attempt(3, 69, 'Spring 回答缺少底层链路。')],
      },
    }))

    expect(report.items).toHaveLength(5)
    expect(report.metrics.find(metric => metric.key === 'categories')?.value).toBe('3')
  })

  it('exports high-risk follow-up defense as portable markdown', () => {
    const markdown = buildInterviewFollowUpDefenseMarkdown(progress({
      questionSnapshots: {
        1: snapshot(1, 'Redis'),
        2: snapshot(2, 'Java 并发'),
      },
      interviewAttempts: {
        1: [attempt(1, 88, '结论是先保证一致性，再补监控和回滚。', ['请比较两种方案的权衡。'])],
        2: [attempt(2, 62, '只说了 HashMap 线程不安全，缺少线上验证。')],
      },
    }), NOW)

    expect(markdown).toContain('# Java 后端 面试追问防线')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 防线概览')
    expect(markdown).toContain('防线追问')
    expect(markdown).toContain('Java 并发 追问题 2')
    expect(markdown).toContain('如果面试官追问线上场景')
    expect(markdown).toContain('面试官在追项目场景')
    expect(markdown).toContain('入口：/practice?queue=2&from=interview-retrospective')
    expect(markdown).not.toContain('undefined')
  })

  it('keeps empty follow-up defense export actionable', () => {
    const markdown = buildInterviewFollowUpDefenseMarkdown(progress(), NOW)

    expect(markdown).toContain('追问防线待建立')
    expect(markdown).toContain('暂无追问防线')
    expect(markdown).toContain('先做一题模拟')
    expect(markdown).not.toContain('undefined')
  })
})
