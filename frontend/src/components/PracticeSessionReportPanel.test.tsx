import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { message } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

function attempt(questionId: number, score: number, structureScore = score): InterviewAttempt {
  return {
    questionId,
    answer: '先讲结论，再补机制、场景、风险和落地方案。',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖核心概念' },
        { key: 'structure', label: '结构化', score: structureScore, summary: '结构表达一般' },
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
  afterEach(() => {
    cleanup()
    message.destroy()
  })

  it('renders session metrics and navigates with the primary action', async () => {
    const onNavigate = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

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

    await userEvent.click(screen.getByRole('button', { name: /复制战报/ }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Java 后端 本轮模拟面试战报'))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('本轮正在推进'))

    await userEvent.click(screen.getByRole('button', { name: /继续未答题/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=2')
  })

  it('renders repair actions for weak practice sessions', async () => {
    const onNavigate = vi.fn()
    const onUseRepairAction = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 56, 38)],
          },
          questionStates: {
            2: { status: 'weak', addedToPlan: true, reviewCount: 1 },
          },
        }}
        onNavigate={onNavigate}
        onUseRepairAction={onUseRepairAction}
      />
    )

    expect(screen.getByText('本轮补弱动作')).toBeInTheDocument()
    expect(screen.getByText(/Java 面试题 1/)).toBeInTheDocument()
    expect(screen.getAllByText(/结构化/).length).toBeGreaterThan(0)
    expect(screen.getByText(/先按/)).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: /去补弱/ })[0])

    expect(onUseRepairAction).toHaveBeenCalledWith(expect.objectContaining({
      questionId: 1,
      criterionLabel: '结构化',
      to: '/practice?question=1',
    }))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('falls back to navigation when repair action handler is absent', async () => {
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 56, 38)],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    await userEvent.click(screen.getAllByRole('button', { name: /去补弱/ })[0])

    expect(onNavigate).toHaveBeenCalledWith('/practice?question=1')
  })
})
