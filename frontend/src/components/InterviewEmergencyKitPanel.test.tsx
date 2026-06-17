import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../types'
import { createDefaultProgress } from '../utils/studyProgress'
import InterviewEmergencyKitPanel from './InterviewEmergencyKitPanel'

const NOW = '2026-06-17T09:00:00.000Z'

function attempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '回答缺少边界和项目落地。',
    createdAt: NOW,
    feedback: {
      score: 55,
      level: 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 55, summary: '覆盖不足' },
        { key: 'structure', label: '结构化', score: 60, summary: '结构一般' },
        { key: 'specificity', label: '场景细节', score: 45, summary: '缺少场景' },
        { key: 'risk', label: '风险意识', score: 60, summary: '风险不足' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function progressWithRisk(): StudyProgress {
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

describe('InterviewEmergencyKitPanel', () => {
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

  it('renders emergency summary, metrics and primary action', () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <InterviewEmergencyKitPanel progress={progressWithRisk()} now={NOW} />
      </MemoryRouter>
    )

    expect(screen.getByText('面试前急救包')).toBeInTheDocument()
    expect(screen.getByText('面试前先压最高风险')).toBeInTheDocument()
    expect(screen.getByText('预计耗时')).toBeInTheDocument()
    expect(screen.getByText('24 分钟')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /先清复习债/ })).toBeInTheDocument()
    expect(screen.getByText('1 道复习债先清掉')).toBeInTheDocument()
  })
})
