import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewCriterionKey, InterviewFeedback, StudyProgress } from '../types'
import { createDefaultProgress } from '../utils/studyProgress'
import InterviewReviewPanel from './InterviewReviewPanel'

function criterion(key: InterviewCriterionKey, score: number) {
  const labels: Record<InterviewCriterionKey, string> = {
    coverage: '覆盖度',
    structure: '结构化',
    specificity: '具体性',
    risk: '风险意识',
  }
  return { key, label: labels[key], score, summary: `${labels[key]} ${score}` }
}

function feedback(score: number): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : 'pass',
    criteria: [
      criterion('coverage', score),
      criterion('structure', Math.max(0, score - 8)),
      criterion('specificity', Math.max(0, score - 18)),
      criterion('risk', Math.max(0, score - 12)),
    ],
    advice: [],
    followUps: [],
  }
}

function progressWithAttempts(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-17T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 集合',
        tags: ['Java'],
        viewCount: 100,
      },
    },
    interviewAttempts: {
      1: [
        {
          questionId: 1,
          answer: '回答内容',
          feedback: feedback(76),
          createdAt: '2026-06-17T12:00:00',
        },
      ],
    },
  }
}

describe('InterviewReviewPanel', () => {
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

  it('copies interview review markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InterviewReviewPanel progress={progressWithAttempts()} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制复盘/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 模拟面试复盘')
    expect(writeText.mock.calls[0][0]).toContain('## 复盘概览')
    expect(writeText.mock.calls[0][0]).toContain('入口：/question/1')
  })
})
