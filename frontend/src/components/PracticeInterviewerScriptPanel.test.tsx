import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { message } from 'antd'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import { buildPracticeInterviewerScript } from '../utils/practiceInterviewerScript'
import PracticeInterviewerScriptPanel from './PracticeInterviewerScriptPanel'

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

function attempt(score: number, createdAt: string): InterviewAttempt {
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
        criterion('specificity', score - 4),
        criterion('risk', score),
      ],
      advice: [],
      followUps: [],
    },
  }
}

function followUpAttempt(prompt: string, body: string, createdAt: string, score = 82): InterviewAttempt {
  return {
    ...attempt(score, createdAt),
    answer: `追问：${prompt}\n\n我的回答：${body}`,
  }
}

function passedBody(): string {
  return [
    '结论：HashMap 在并发写入时不安全，因为扩容迁移机制可能造成结构异常。',
    '在线上项目中我会用错误率、吞吐和扩容耗时指标验证。',
    '面试官追问时，我会补充风险边界和 ConcurrentHashMap 替代方案。',
  ].join('\n')
}

describe('PracticeInterviewerScriptPanel', () => {
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
    message.destroy()
    cleanup()
  })

  it('renders the interviewer script status and steps', () => {
    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[attempt(86, '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('本题面试官脚本')).toBeInTheDocument()
    expect(screen.getByText(/进阶/)).toBeInTheDocument()
    expect(screen.getByText(/方案对比/)).toBeInTheDocument()
  })

  it('passes a selected interviewer prompt back to the answer box', async () => {
    const onUsePrompt = vi.fn()

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[attempt(86, '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={onUsePrompt}
      />,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /带入回答框/ })[0])

    expect(onUsePrompt).toHaveBeenCalledTimes(1)
    expect(onUsePrompt.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })

  it('copies the interviewer script markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[attempt(86, '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制脚本/ }))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('本题面试官脚本')
    expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })

  it('copies the interviewer script progress markdown', async () => {
    const warmupPrompt = '请用 30 秒回答「HashMap 为什么线程不安全？扩容时会发生什么？」：先给结论，再补一句核心原因。'
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[followUpAttempt(warmupPrompt, passedBody(), '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制进度/ }))

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain('本题面试官脚本进度')
    expect(writeText.mock.calls[0][0]).toContain('脚本进度：1 / 3')
    expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })

  it('uses the progress primary action to continue with the next pending prompt', async () => {
    const onUsePrompt = vi.fn()
    const warmupPrompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[followUpAttempt(warmupPrompt, passedBody(), '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={onUsePrompt}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /继续下一问/ }))

    expect(onUsePrompt).toHaveBeenCalledTimes(1)
    expect(onUsePrompt.mock.calls[0][0]).toContain('结论 -> 机制 -> 场景 -> 边界')
  })

  it('uses the progress primary action to repair the attempted prompt first', async () => {
    const onUsePrompt = vi.fn()
    const warmupPrompt = buildPracticeInterviewerScript(question(), []).steps[0].prompt

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[followUpAttempt(warmupPrompt, '结论：HashMap 多线程不安全。', '2026-06-18T08:00:00.000Z', 65)]}
        onUsePrompt={onUsePrompt}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /修复当前问/ }))

    expect(onUsePrompt).toHaveBeenCalledTimes(1)
    expect(onUsePrompt.mock.calls[0][0]).toBe(warmupPrompt)
  })

  it('hides the progress primary action when all script steps have passed', () => {
    const script = buildPracticeInterviewerScript(question(), [])

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={script.steps.map((step, index) => (
          followUpAttempt(step.prompt, passedBody(), `2026-06-18T08:0${index}:00.000Z`)
        ))}
        onUsePrompt={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /继续下一问/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /修复当前问/ })).not.toBeInTheDocument()
  })

  it('renders script progress and passed state for completed follow-up steps', () => {
    const warmupPrompt = '请用 30 秒回答「HashMap 为什么线程不安全？扩容时会发生什么？」：先给结论，再补一句核心原因。'

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[followUpAttempt(warmupPrompt, passedBody(), '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={vi.fn()}
      />,
    )

    expect(screen.getByText('脚本进度 1 / 3')).toBeInTheDocument()
    expect(screen.getByText('已通过')).toBeInTheDocument()
    expect(screen.getByText('下一问已标出，继续完成未通过追问。')).toBeInTheDocument()
  })

  it('shows a repair action when a follow-up step was attempted but not passed', () => {
    const warmupPrompt = '请用 30 秒回答「HashMap 为什么线程不安全？扩容时会发生什么？」：先给结论，再补一句核心原因。'

    render(
      <PracticeInterviewerScriptPanel
        question={question()}
        attempts={[followUpAttempt(warmupPrompt, '结论：HashMap 多线程不安全。', '2026-06-18T08:00:00.000Z', 65)]}
        onUsePrompt={vi.fn()}
      />,
    )

    expect(screen.getByText('修复中')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /继续修复/ })).toBeInTheDocument()
  })
})
