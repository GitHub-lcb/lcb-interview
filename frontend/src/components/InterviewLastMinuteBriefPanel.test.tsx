import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../types'
import { createDefaultProgress } from '../utils/studyProgress'
import InterviewLastMinuteBriefPanel from './InterviewLastMinuteBriefPanel'

const NOW = '2026-06-17T09:00:00.000Z'

function attempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '回答缺少风险边界。',
    createdAt: NOW,
    feedback: {
      score: 55,
      level: 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 72, summary: '覆盖一般' },
        { key: 'structure', label: '结构化', score: 70, summary: '结构一般' },
        { key: 'specificity', label: '场景细节', score: 64, summary: '缺少场景' },
        { key: 'risk', label: '风险意识', score: 45, summary: '风险不足' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function riskyProgress(): StudyProgress {
  return {
    ...createDefaultProgress(NOW),
    dailyPlan: [1],
    questionStates: {
      1: {
        status: 'weak',
        addedToPlan: true,
        reviewCount: 1,
        lastReviewedAt: '2026-06-13T09:00:00.000Z',
      },
    },
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 并发',
        tags: ['Java'],
        viewCount: 120,
      },
    },
    interviewAttempts: {
      1: [attempt(1)],
    },
  }
}

describe('InterviewLastMinuteBriefPanel', () => {
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

  it('renders confidence, metrics and the primary last-minute action', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InterviewLastMinuteBriefPanel progress={riskyProgress()} now={NOW} />
      </MemoryRouter>
    )

    expect(screen.getByText('最后 24 小时面试简报')).toBeInTheDocument()
    expect(screen.getByText('最后 24 小时先压临场风险')).toBeInTheDocument()
    expect(screen.getAllByText('进场信心').length).toBeGreaterThan(0)
    expect(screen.getByText('复习债')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /先复盘高风险题/ }).length).toBeGreaterThan(0)
    expect(screen.getByText('1 道复习债面试前必须回看')).toBeInTheDocument()
    expect(screen.getByText(/不要再让风险意识失分/)).toBeInTheDocument()
  })
})
