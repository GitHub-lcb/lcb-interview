import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, PracticeQueueItem, StudyProgress } from '../types'
import PracticeSessionReportPanel from './PracticeSessionReportPanel'

const NOW = '2026-06-17T08:30:00.000Z'

function question(id: number): PracticeQueueItem {
  return {
    id,
    title: `Java 面试题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    tags: ['Java'],
    viewCount: 100 + id,
    status: 'learning',
    source: 'plan',
  }
}

function attempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: '先讲结论，再补机制、场景、风险和落地方案。',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心概念' },
        { key: 'structure', label: '结构化', score, summary: '结构表达一般' },
        { key: 'specificity', label: '场景细节', score, summary: '场景细节一般' },
        { key: 'risk', label: '风险意识', score, summary: '风险意识一般' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function progress(): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {
      1: [attempt(1, 76)],
    },
    dailyPlan: [],
    updatedAt: NOW,
  }
}

describe('PracticeSessionReportPanel', () => {
  it('renders session metrics and navigates with the primary action', async () => {
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={progress()}
        onNavigate={onNavigate}
      />
    )

    expect(screen.getByText('本轮模拟面试战报')).toBeInTheDocument()
    expect(screen.getByText('本轮正在推进')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('76 分')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /继续未答题/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=2')
  })
})
