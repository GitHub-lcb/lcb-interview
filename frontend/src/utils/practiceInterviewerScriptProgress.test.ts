import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeInterviewerScript } from './practiceInterviewerScript'
import {
  buildPracticeInterviewerScriptProgress,
  buildPracticeInterviewerScriptProgressMarkdown,
} from './practiceInterviewerScriptProgress'

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

  return { key, label: labels[key], score, summary: `${labels[key]} ${score}` }
}

function attempt(answer: string, createdAt: string, score = 80): InterviewAttempt {
  return {
    questionId: 1,
    answer,
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        criterion('coverage', score),
        criterion('structure', score),
        criterion('specificity', score),
        criterion('risk', score),
      ],
      advice: [],
      followUps: [],
    },
  }
}

function answerFor(prompt: string, body: string): string {
  return `追问：${prompt}\n\n我的回答：${body}`
}

function passedBody(): string {
  return [
    '结论：HashMap 在并发写入时不安全，因为扩容迁移机制可能造成结构异常。',
    '在线上项目中我会用错误率、吞吐和扩容耗时指标验证。',
    '面试官追问时，我会补充风险边界和 ConcurrentHashMap 替代方案。',
  ].join('\n')
}

describe('practiceInterviewerScriptProgress', () => {
  it('keeps all script steps pending when there is no follow-up answer', () => {
    const progress = buildPracticeInterviewerScriptProgress(question(), [])

    expect(progress.totalSteps).toBe(3)
    expect(progress.passedCount).toBe(0)
    expect(progress.progressPercent).toBe(0)
    expect(progress.steps.every(item => item.status === 'pending')).toBe(true)
    expect(progress.nextStep?.prompt).toContain('HashMap 为什么线程不安全')
    expect(JSON.stringify(progress)).not.toContain('undefined')
  })

  it('marks the first script step as passed when the latest matching answer passes acceptance', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const progress = buildPracticeInterviewerScriptProgress(question(), [
      attempt(answerFor(prompt, passedBody()), '2026-06-18T08:00:00.000Z', 82),
    ])

    expect(progress.passedCount).toBe(1)
    expect(progress.attemptedCount).toBe(0)
    expect(progress.progressPercent).toBe(33)
    expect(progress.steps[0].status).toBe('passed')
    expect(progress.steps[0].acceptanceScore).toBe(100)
    expect(progress.nextStep?.id).toBe(progress.steps[1].step.id)
    expect(JSON.stringify(progress)).not.toContain('undefined')
  })

  it('marks the matching script step as attempted when acceptance has not passed', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const progress = buildPracticeInterviewerScriptProgress(question(), [
      attempt(answerFor(prompt, '结论：HashMap 多线程不安全。'), '2026-06-18T08:00:00.000Z', 65),
    ])

    expect(progress.passedCount).toBe(0)
    expect(progress.attemptedCount).toBe(1)
    expect(progress.steps[0].status).toBe('attempted')
    expect(progress.nextStep?.id).toBe(progress.steps[0].step.id)
    expect(progress.summary).toContain('继续修复')
    expect(JSON.stringify(progress)).not.toContain('undefined')
  })

  it('uses the latest matching attempt for a script step', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const progress = buildPracticeInterviewerScriptProgress(question(), [
      attempt(answerFor(prompt, '结论：HashMap 多线程不安全。'), '2026-06-18T09:00:00.000Z', 65),
      attempt(answerFor(prompt, passedBody()), '2026-06-18T08:00:00.000Z', 82),
    ])

    expect(progress.steps[0].status).toBe('attempted')
    expect(progress.steps[0].latestAttemptAt).toBe('2026-06-18T09:00:00.000Z')
    expect(progress.nextStep?.id).toBe(progress.steps[0].step.id)
  })

  it('exports script progress markdown for completed follow-up steps', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const markdown = buildPracticeInterviewerScriptProgressMarkdown(
      question(),
      [attempt(answerFor(prompt, passedBody()), '2026-06-18T08:00:00.000Z', 82)],
      '2026-06-18T10:00:00.000Z',
    )

    expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 本题面试官脚本进度')
    expect(markdown).toContain('脚本进度：1 / 3（33%）')
    expect(markdown).toContain('下一步：下一问已标出，继续完成未通过追问。')
    expect(markdown).toContain('已通过')
    expect(markdown).toContain('验收分：100')
    expect(markdown).toContain('最近练习：2026-06-18')
    expect(markdown).not.toContain('undefined')
  })

  it('exports repair guidance when a follow-up step is attempted but not passed', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const markdown = buildPracticeInterviewerScriptProgressMarkdown(
      question(),
      [attempt(answerFor(prompt, '结论：HashMap 多线程不安全。'), '2026-06-18T09:00:00.000Z', 65)],
      '2026-06-18T10:00:00.000Z',
    )

    expect(markdown).toContain('脚本进度：0 / 3（0%）')
    expect(markdown).toContain('修复中')
    expect(markdown).toContain('继续修复当前未通过追问')
    expect(markdown).not.toContain('undefined')
  })
})
