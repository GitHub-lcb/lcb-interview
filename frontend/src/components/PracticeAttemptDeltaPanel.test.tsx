import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, InterviewCriterion, PracticeQueueItem } from '../types'
import PracticeAttemptDeltaPanel from './PracticeAttemptDeltaPanel'

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

function attempt(score: number, specificity: number, createdAt: string): InterviewAttempt {
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
        criterion('specificity', specificity),
        criterion('risk', score),
      ],
      advice: [],
      followUps: [],
    },
  }
}

describe('PracticeAttemptDeltaPanel', () => {
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

  it('renders the latest attempt delta and criterion movement', () => {
    render(
      <PracticeAttemptDeltaPanel
        question={question()}
        attempts={[
          attempt(82, 76, '2026-06-18T08:00:00.000Z'),
          attempt(68, 44, '2026-06-18T07:00:00.000Z'),
        ]}
        onUsePrompt={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('本题重答验收')).toBeInTheDocument()
    expect(screen.getByText('+14')).toBeInTheDocument()
    expect(screen.getByText('重答有效')).toBeInTheDocument()
    expect(screen.getByText(/场景细节/)).toBeInTheDocument()
  })

  it('passes the primary retry prompt back to the answer box', async () => {
    const onUsePrompt = vi.fn()

    render(
      <PracticeAttemptDeltaPanel
        question={question()}
        attempts={[attempt(62, 42, '2026-06-18T08:00:00.000Z')]}
        onUsePrompt={onUsePrompt}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /再答一次验收/ }))

    expect(onUsePrompt).toHaveBeenCalledTimes(1)
    expect(onUsePrompt.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
    expect(onUsePrompt.mock.calls[0][0]).toContain('场景细节')
  })
})
