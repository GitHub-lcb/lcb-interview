import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, StudyProgress } from '../types'
import InterviewMaterialVaultPanel from './InterviewMaterialVaultPanel'

const NOW = '2026-06-17T10:30:00.000Z'

function attempt(questionId: number): InterviewAttempt {
  return {
    questionId,
    answer: '项目场景是订单高峰期并发扣库存，我们先做限流削峰，再用监控和补偿任务兜底。',
    createdAt: NOW,
    feedback: {
      score: 88,
      level: 'strong',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: 88, summary: '覆盖核心概念' },
        { key: 'structure', label: '结构化', score: 88, summary: '结构表达稳定' },
        { key: 'specificity', label: '场景细节', score: 88, summary: '场景细节充分' },
        { key: 'risk', label: '风险意识', score: 88, summary: '风险意识清楚' },
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
    questionSnapshots: {
      1: {
        id: 1,
        title: '如何设计秒杀库存扣减？',
        difficulty: 'HARD',
        categoryName: '系统设计',
        tags: ['架构'],
        viewCount: 100,
      },
      2: {
        id: 2,
        title: 'Redis 缓存击穿怎么处理？',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        tags: ['Redis'],
        viewCount: 80,
      },
    },
    interviewAttempts: {
      1: [attempt(1)],
      2: [attempt(2)],
    },
    dailyPlan: [],
    updatedAt: NOW,
  }
}

describe('InterviewMaterialVaultPanel', () => {
  it('renders high-score materials and emits navigation actions', async () => {
    const onNavigate = vi.fn()

    render(<InterviewMaterialVaultPanel progress={progress()} onNavigate={onNavigate} />)

    expect(screen.getByText('高分表达素材库')).toBeInTheDocument()
    expect(screen.getByText('高分表达素材已可复用')).toBeInTheDocument()
    expect(screen.getByText('高分样本')).toBeInTheDocument()
    expect(screen.getAllByText(/项目场景/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/订单高峰期并发扣库存/).length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /复盘高分素材/ }))
    expect(onNavigate).toHaveBeenCalledWith('/study')

    await userEvent.click(screen.getByRole('button', { name: /如何设计秒杀库存扣减/ }))
    expect(onNavigate).toHaveBeenCalledWith('/question/1')
  })
})
