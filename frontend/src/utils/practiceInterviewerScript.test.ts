import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import {
  buildPracticeInterviewerScript,
  buildPracticeInterviewerScriptMarkdown,
} from './practiceInterviewerScript'

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

describe('practiceInterviewerScript', () => {
  it('builds a warmup script before the first attempt', () => {
    const script = buildPracticeInterviewerScript(question(), [])

    expect(script.level).toBe('warmup')
    expect(script.steps).toHaveLength(3)
    expect(script.steps[0].prompt).toContain('HashMap 为什么线程不安全')
    expect(script.primaryPrompt).toContain('HashMap 为什么线程不安全')
    expect(JSON.stringify(script)).not.toContain('undefined')
  })

  it('focuses repair script on the weakest latest criterion', () => {
    const script = buildPracticeInterviewerScript(question(), [
      attempt(52, { specificity: 35, risk: 48 }),
    ])

    expect(script.level).toBe('repair')
    expect(script.steps[0].criterionKey).toBe('specificity')
    expect(script.steps[0].title).toContain('场景细节')
    expect(script.steps[0].prompt).toContain('场景细节')
  })

  it('turns a strong answer into advanced pressure questions', () => {
    const script = buildPracticeInterviewerScript(question(), [
      attempt(86, { coverage: 88, structure: 84, specificity: 82, risk: 86 }),
    ])

    expect(script.level).toBe('advanced')
    expect(script.title).toContain('进阶')
    expect(script.steps.some(item => item.prompt.includes('方案 A'))).toBe(true)
    expect(script.steps.some(item => item.prompt.includes('45 秒'))).toBe(true)
  })

  it('prioritizes the most regressed criterion when latest attempt falls back', () => {
    const script = buildPracticeInterviewerScript(question(), [
      attempt(58, { coverage: 70, structure: 68, specificity: 38, risk: 56 }, '2026-06-18T08:00:00.000Z'),
      attempt(70, { coverage: 72, structure: 70, specificity: 72, risk: 66 }, '2026-06-18T07:00:00.000Z'),
    ])

    expect(script.level).toBe('regression')
    expect(script.summary).toContain('回落')
    expect(script.steps[0].criterionKey).toBe('specificity')
    expect(script.steps[0].prompt).toContain('场景细节')
    expect(JSON.stringify(script)).not.toContain('undefined')
  })

  it('exports the interviewer script as portable markdown', () => {
    const markdown = buildPracticeInterviewerScriptMarkdown(question(), [
      attempt(86, { coverage: 88, structure: 84, specificity: 82, risk: 86 }),
    ], NOW)

    expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 本题面试官脚本')
    expect(markdown).toContain('生成时间：2026-06-18')
    expect(markdown).toContain('## 脚本概览')
    expect(markdown).toContain('## 追问步骤')
    expect(markdown).toContain('方案对比')
  })

  it('exports warmup markdown without undefined placeholders', () => {
    const markdown = buildPracticeInterviewerScriptMarkdown(question(), [], NOW)

    expect(markdown).toContain('首次回答预热')
    expect(markdown).not.toContain('undefined')
  })
})
