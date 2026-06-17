import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { InterviewAttempt, Question, StudyProgress } from '../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import StudyDashboard from './StudyDashboard'

const hotQuestions: Question[] = [
  {
    id: 1,
    title: 'HashMap 为什么线程不安全？',
    content: '标准答案',
    difficulty: 'HARD',
    categoryName: 'Java 集合',
    categoryId: 1,
    tags: ['HashMap', '并发'],
    viewCount: 300,
    createTime: '2026-06-18T00:00:00.000Z',
  },
  {
    id: 2,
    title: 'Redis 缓存雪崩怎么处理？',
    content: '标准答案',
    difficulty: 'MEDIUM',
    categoryName: 'Redis',
    categoryId: 2,
    tags: ['Redis'],
    viewCount: 240,
    createTime: '2026-06-18T00:00:00.000Z',
  },
]

function interviewAttempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: '先说明结论，再补充并发场景和失败边界。',
    createdAt: new Date().toISOString(),
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 70 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '知识覆盖', score, summary: '覆盖情况' },
        { key: 'structure', label: '表达结构', score, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score, summary: '场景情况' },
        { key: 'risk', label: '边界风险', score, summary: '风险情况' },
      ],
      advice: [],
      followUps: [],
    },
  }
}

function progress(): StudyProgress {
  return {
    ...createDefaultProgress('2026-06-18T00:00:00.000Z'),
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {
      1: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    },
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'HARD',
        categoryName: 'Java 集合',
        tags: ['HashMap', '并发'],
        viewCount: 300,
      },
      2: {
        id: 2,
        title: 'Redis 缓存雪崩怎么处理？',
        difficulty: 'MEDIUM',
        categoryName: 'Redis',
        tags: ['Redis'],
        viewCount: 240,
      },
    },
    interviewAttempts: {
      1: [interviewAttempt(1, 55)],
    },
    dailyPlan: [1, 2],
  }
}

describe('StudyDashboard', () => {
  beforeEach(() => {
    window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress()))
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
    window.localStorage.clear()
  })

  it('copies dashboard daily report markdown', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <StudyDashboard hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /复制日报/ }))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0][0]).toContain('# Java 后端 备考工作台日报')
    expect(writeText.mock.calls[0][0]).toContain('## 工作台概览')
    expect(writeText.mock.calls[0][0]).toContain('## 今日闭环验收')
    expect(writeText.mock.calls[0][0]).toContain('行动：重答补强，入口：/practice?queue=1')
    expect(writeText.mock.calls[0][0]).toContain('## 今日计划题单')
    expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
  })
})
