import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, StudyProgress } from '../types'
import StudyPaceCoachPanel from './StudyPaceCoachPanel'

const NOW = '2026-06-17T09:00:00.000Z'

function interviewAttempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '模拟回答',
    createdAt: NOW,
    feedback: {
      score: 82,
      level: 'strong',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score: 82, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score: 82, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score: 82, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score: 82, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function progressNeedsPlanFill(): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    dailyPlan: [1],
    updatedAt: NOW,
    questionStates: {
      1: {
        status: 'learning',
        addedToPlan: true,
        reviewCount: 1,
        lastReviewedAt: '2099-06-17T09:00:00.000Z',
      },
    },
    questionSnapshots: {
      1: {
        id: 1,
        title: 'Question 1',
        difficulty: 'MEDIUM',
        categoryName: 'Java 并发',
        tags: ['Java'],
        viewCount: 101,
      },
    },
    interviewAttempts: {
      1: [interviewAttempt(1)],
    },
  }
}

describe('StudyPaceCoachPanel', () => {
  afterEach(() => {
    cleanup()
  })

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

  it('runs the fill-plan callback when pacing asks to complete today plan', async () => {
    const onFillPlan = vi.fn()

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPaceCoachPanel progress={progressNeedsPlanFill()} onFillPlan={onFillPlan} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /补齐今日计划/ }))

    expect(onFillPlan).toHaveBeenCalledTimes(1)
  })

  it('copies study pace markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyPaceCoachPanel progress={progressNeedsPlanFill()} onFillPlan={vi.fn()} />
      </MemoryRouter>
    )

    await userEvent.click(screen.getByRole('button', { name: /复制配速/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('备考配速报告')
    expect(writeText.mock.calls[0][0]).toContain('## 配速概览')
    expect(writeText.mock.calls[0][0]).toContain('入口：/study')
  })
})
