import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import InterviewFollowUpDefensePanel from './InterviewFollowUpDefensePanel'

const NOW = '2026-06-17T11:00:00.000Z'

function attempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '只讲了 HashMap 线程不安全，没有展开线上验证和风险边界。',
    createdAt: NOW,
    feedback: {
      score: 62,
      level: 'pass',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 60, summary: '机制覆盖不足' },
        { key: 'structure', label: '结构化', score: 66, summary: '结构基本清楚' },
        { key: 'specificity', label: '场景细节', score: 50, summary: '缺少线上场景' },
        { key: 'risk', label: '风险意识', score: 55, summary: '边界不足' },
      ],
      advice: [],
      followUps: ['如果面试官追问线上场景，你会怎么验证？'],
    },
  }
}

function progress(): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 并发',
        tags: ['HashMap'],
        viewCount: 100,
      },
    },
    interviewAttempts: {
      1: [attempt(1)],
    },
    dailyPlan: [],
    updatedAt: NOW,
  }
}

describe('InterviewFollowUpDefensePanel', () => {
  it('renders follow-up defense items and emits navigation actions', async () => {
    const onNavigate = vi.fn()

    render(<InterviewFollowUpDefensePanel progress={progress()} onNavigate={onNavigate} />)

    expect(screen.getByText('面试追问防线')).toBeInTheDocument()
    expect(screen.getByText('先补高风险追问')).toBeInTheDocument()
    expect(screen.getByText('防线追问')).toBeInTheDocument()
    expect(screen.getByText('低分回答')).toBeInTheDocument()
    expect(screen.getByText(/如果面试官追问线上场景/)).toBeInTheDocument()
    expect(screen.getAllByText(/面试官在追项目场景/).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /先修追问短板/ }))
    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')

    await userEvent.click(screen.getByRole('button', { name: /如果面试官追问线上场景/ }))
    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
  })
})
