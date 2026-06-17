import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
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
})
