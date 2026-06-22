import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeInterviewerScript } from './practiceInterviewerScript'
import { analyzePracticeScriptAnswerAcceptance } from './practiceScriptAnswerAcceptance'

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

function attempt(score: number, createdAt = '2026-06-18T08:00:00.000Z'): InterviewAttempt {
  return {
    questionId: 1,
    answer: `回答 ${score}`,
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

describe('practiceScriptAnswerAcceptance', () => {
  it('keeps a normal answer in idle state until a script prompt is inserted', () => {
    const result = analyzePracticeScriptAnswerAcceptance(question(), [], '普通主答案')

    expect(result.level).toBe('idle')
    expect(result.score).toBe(0)
    expect(result.nextAction).toContain('先从本题面试官脚本选择追问')
    expect(result.items.every(item => !item.covered)).toBe(true)
    expect(JSON.stringify(result)).not.toContain('undefined')
  })

  it('recognizes an inserted prompt with no answer as empty', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const result = analyzePracticeScriptAnswerAcceptance(question(), [], answerFor(prompt, ''))

    expect(result.level).toBe('empty')
    expect(result.score).toBe(0)
    expect(result.matchedPrompt).toBe(prompt)
    expect(result.nextAction).toContain('先写出追问回答')
    expect(JSON.stringify(result)).not.toContain('undefined')
  })

  it('passes a complete advanced follow-up answer with evidence and pressure coverage', () => {
    const attempts = [attempt(88)]
    const prompt = buildPracticeInterviewerScript(question(), attempts).steps[0].prompt
    const result = analyzePracticeScriptAnswerAcceptance(
      question(),
      attempts,
      answerFor(prompt, [
        '结论：我会围绕 HashMap 并发扩容给出方案 A 和方案 B 的取舍。',
        '方案 A 是外部加锁，优点是改动小，缺点是高并发吞吐会下降。',
        '方案 B 是替换为 ConcurrentHashMap，适合线上项目的并发写场景。',
        '我会用压测吞吐、错误率和扩容耗时做验证，并在风险边界上保留降级兜底。',
        '面试官追问技术取舍时，我的选择是优先 ConcurrentHashMap，因为它更适合并发读写。',
      ].join('\n')),
    )

    expect(result.level).toBe('passed')
    expect(result.score).toBe(100)
    expect(result.criterionLabel).toBe('进阶追问')
    expect(result.items.every(item => item.covered)).toBe(true)
    expect(result.nextAction).toContain('可以提交评分')
    expect(JSON.stringify(result)).not.toContain('undefined')
  })

  it('prioritizes missing evidence after the answer directly responds to the follow-up', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const result = analyzePracticeScriptAnswerAcceptance(
      question(),
      [],
      answerFor(prompt, '结论：HashMap 多线程不安全，因为扩容和 put 并发执行时会出现覆盖写和结构异常。'),
    )

    expect(result.items.find(item => item.key === 'direct')?.covered).toBe(true)
    expect(result.items.find(item => item.key === 'evidence')?.covered).toBe(false)
    expect(result.nextAction).toContain('补项目动作')
    expect(JSON.stringify(result)).not.toContain('undefined')
  })

  it('falls back to generic follow-up acceptance when the prompt is not in the current script', () => {
    const result = analyzePracticeScriptAnswerAcceptance(
      question(),
      [],
      answerFor('请随便追问一个不在脚本里的问题', '结论：我会先正面回答，再补项目指标和风险边界。'),
    )

    expect(result.level).not.toBe('idle')
    expect(result.matchedPrompt).toBeUndefined()
    expect(result.summary).toContain('本题面试官脚本')
    expect(JSON.stringify(result)).not.toContain('undefined')
  })
})
