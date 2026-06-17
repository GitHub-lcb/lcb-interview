import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeInterviewerScript } from './practiceInterviewerScript'
import { buildPracticeScriptAnswerRepairAction } from './practiceScriptAnswerRepairAction'

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

function attempt(score: number): InterviewAttempt {
  return {
    questionId: 1,
    answer: `回答 ${score}`,
    createdAt: '2026-06-18T08:00:00.000Z',
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

describe('practiceScriptAnswerRepairAction', () => {
  it('asks the user to insert a script prompt before repairing a normal answer', () => {
    const action = buildPracticeScriptAnswerRepairAction(question(), [], '普通主答案')

    expect(action.key).toBe('insert-prompt')
    expect(action.label).toBe('先带入追问')
    expect(action.template).toContain('请先从本题面试官脚本选择一个追问')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })

  it('builds an evidence repair template while preserving the current follow-up prompt', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt
    const answer = answerFor(prompt, '结论：HashMap 多线程不安全，因为并发扩容会出现结构异常。')
    const action = buildPracticeScriptAnswerRepairAction(question(), [], answer)

    expect(action.key).toBe('evidence')
    expect(action.label).toBe('补项目证据')
    expect(action.template).toContain(`追问：${prompt}`)
    expect(action.template).toContain('原回答保留')
    expect(action.template).toContain('项目证据：')
    expect(action.template).toContain('指标')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })

  it('builds a pressure repair template when evidence and criterion are present but pressure is missing', () => {
    const attempts: InterviewAttempt[] = []
    const prompt = buildPracticeInterviewerScript(question(), attempts).steps[0].prompt
    const action = buildPracticeScriptAnswerRepairAction(
      question(),
      attempts,
      answerFor(prompt, [
        '结论：HashMap 在并发写入时不安全。',
        '机制：扩容迁移可能造成结构异常。',
        '在线上项目中我会用错误率和吞吐指标验证是否发生异常。',
      ].join('\n')),
    )

    expect(action.key).toBe('pressure')
    expect(action.label).toBe('补压力点')
    expect(action.template).toContain('压力点：')
    expect(action.template).toContain('面试官真正追的是')
    expect(JSON.stringify(action)).not.toContain('undefined')
  })

  it('builds a 45-second compression template after all acceptance items pass', () => {
    const attempts = [attempt(88)]
    const prompt = buildPracticeInterviewerScript(question(), attempts).steps[0].prompt
    const action = buildPracticeScriptAnswerRepairAction(
      question(),
      attempts,
      answerFor(prompt, [
        '结论：我会围绕 HashMap 并发扩容给出方案 A 和方案 B 的取舍。',
        '方案 A 是外部加锁，方案 B 是替换为 ConcurrentHashMap。',
        '在线上项目中我会用吞吐、错误率和扩容耗时做验证。',
        '风险边界是高并发写入和扩容抖动，因此保留降级兜底。',
        '我的选择是 ConcurrentHashMap，因为它更适合并发读写。',
      ].join('\n')),
    )

    expect(action.key).toBe('compress')
    expect(action.label).toBe('压缩 45 秒版')
    expect(action.template).toContain('请把这段追问回答压缩成 45 秒版本')
    expect(action.template).toContain(`追问：${prompt}`)
    expect(JSON.stringify(action)).not.toContain('undefined')
  })
})
