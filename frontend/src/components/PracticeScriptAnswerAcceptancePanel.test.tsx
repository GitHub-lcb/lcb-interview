import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeInterviewerScript } from '../utils/practiceInterviewerScript'
import PracticeScriptAnswerAcceptancePanel from './PracticeScriptAnswerAcceptancePanel'

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

describe('PracticeScriptAnswerAcceptancePanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the idle state for normal answers', () => {
    render(<PracticeScriptAnswerAcceptancePanel question={question()} attempts={[]} answer="普通主答案" />)

    expect(screen.getByLabelText('追问回答验收')).toBeInTheDocument()
    expect(screen.getByText('先从本题面试官脚本选择追问')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('renders passed state for a complete follow-up answer', () => {
    const attempts = [attempt(88)]
    const prompt = buildPracticeInterviewerScript(question(), attempts).steps[0].prompt

    render(
      <PracticeScriptAnswerAcceptancePanel
        question={question()}
        attempts={attempts}
        answer={answerFor(prompt, [
          '结论：我会围绕 HashMap 并发扩容给出方案 A 和方案 B 的取舍。',
          '方案 A 是外部加锁，方案 B 是替换为 ConcurrentHashMap。',
          '在线上项目中我会用吞吐、错误率和扩容耗时做验证。',
          '风险边界是高并发写入和扩容抖动，因此保留降级兜底。',
          '我的选择是 ConcurrentHashMap，因为它更适合并发读写。',
        ].join('\n'))}
      />,
    )

    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('可以提交评分')).toBeInTheDocument()
    expect(screen.getByText('进阶追问')).toBeInTheDocument()
  })

  it('renders the next action for a partial follow-up answer', () => {
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt

    render(
      <PracticeScriptAnswerAcceptancePanel
        question={question()}
        attempts={[]}
        answer={answerFor(prompt, '结论：HashMap 多线程不安全，因为并发扩容会有结构异常。')}
      />,
    )

    expect(screen.getByText('补项目动作、指标或验证方式')).toBeInTheDocument()
  })

  it('passes a follow-up repair template back to the answer box', async () => {
    const onUseRepairTemplate = vi.fn()
    const prompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt

    render(
      <PracticeScriptAnswerAcceptancePanel
        question={question()}
        attempts={[]}
        answer={answerFor(prompt, '结论：HashMap 多线程不安全，因为并发扩容会有结构异常。')}
        onUseRepairTemplate={onUseRepairTemplate}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /补项目证据/ }))

    expect(onUseRepairTemplate).toHaveBeenCalledTimes(1)
    expect(onUseRepairTemplate.mock.calls[0][0]).toContain(`追问：${prompt}`)
    expect(onUseRepairTemplate.mock.calls[0][0]).toContain('项目证据：')
  })
})
