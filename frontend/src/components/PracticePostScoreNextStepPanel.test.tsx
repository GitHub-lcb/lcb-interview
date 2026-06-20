import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, PracticeQueueItem, StudyProgress } from '../types'
import PracticePostScoreNextStepPanel from './PracticePostScoreNextStepPanel'

const NOW = '2026-06-20T08:30:00.000Z'

afterEach(() => cleanup())

function queueItem(id: number, title: string, status: PracticeQueueItem['status'] = 'learning'): PracticeQueueItem {
  return {
    id,
    title,
    difficulty: id === 1 ? 'HARD' : 'MEDIUM',
    categoryName: id === 1 ? 'Java 集合' : 'Redis',
    tags: ['Java'],
    viewCount: 100 + id,
    status,
    source: 'plan',
  }
}

function attempt(questionId: number, score: number): InterviewAttempt {
  return {
    questionId,
    answer: '先讲结论，再补机制、场景和风险。',
    createdAt: NOW,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score, summary: '覆盖情况' },
        { key: 'structure', label: '结构化', score, summary: '结构情况' },
        { key: 'specificity', label: '场景细节', score, summary: '场景情况' },
        { key: 'risk', label: '风险意识', score, summary: '风险情况' },
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
    dailyPlan: [1, 2],
    questionStates: {
      1: { status: 'weak', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
      2: { status: 'learning', addedToPlan: true, reviewCount: 0 },
    },
    questionSnapshots: {},
    interviewAttempts: {
      1: [attempt(1, 52)],
    },
    updatedAt: NOW,
  }
}

describe('PracticePostScoreNextStepPanel', () => {
  it('surfaces the immediate closure and next-training actions after scoring', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'weak'),
          queueItem(2, 'Redis 缓存雪崩'),
        ]}
        progress={progress()}
        now={NOW}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('评分后下一步')).toBeInTheDocument()
    expect(within(panel).getByText('趁热处理下一轮训练')).toBeInTheDocument()
    expect(within(panel).getByText('52 分，已自动标记薄弱，并留在今日计划继续补强。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('完成率 0%')).toBeInTheDocument()
    expect(within(panel).getByLabelText('风险 2')).toBeInTheDocument()
    expect(within(panel).getByLabelText('下一轮 2')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /开始下一轮训练/ }))
    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')

    await user.click(within(panel).getByRole('button', { name: /先清复习债/ }))
    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=2')
  })

  it('prioritizes the next first-run question before generic next training', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onContinueFirstRun = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'weak'),
          queueItem(2, 'Redis 缓存雪崩'),
          queueItem(3, 'MySQL 索引失效'),
        ]}
        progress={progress()}
        now={NOW}
        firstRunProgress={{
          answeredCount: 1,
          totalCount: 3,
          nextQuestionTitle: 'Redis 缓存雪崩',
          onContinue: onContinueFirstRun,
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('继续完成首练队列')).toBeInTheDocument()
    expect(within(panel).getByText('已完成 1 / 3，下一题继续回答「Redis 缓存雪崩」。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('首练进度 1 / 3')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /继续第 2 题/ }))

    expect(onContinueFirstRun).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('keeps completed first-run rehearsal focused before generic next training', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onContinueFirstRunRehearsal = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'JVM GC 调优', 'mastered'),
          queueItem(2, 'Redis 缓存雪崩', 'mastered'),
        ]}
        progress={{
          ...progress(),
          questionStates: {
            1: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: NOW },
            2: { status: 'mastered', addedToPlan: true, reviewCount: 2, lastReviewedAt: NOW },
          },
          interviewAttempts: {
            1: [attempt(1, 83)],
            2: [attempt(2, 91)],
          },
        }}
        now={NOW}
        firstRunProgress={{
          answeredCount: 1,
          totalCount: 2,
          nextQuestionTitle: 'Redis 缓存雪崩',
          onContinue: onContinueFirstRunRehearsal,
          variant: 'rehearsal',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('继续复述首练过线题')).toBeInTheDocument()
    expect(within(panel).getByText('已复述 1 / 2，下一题继续脱稿「Redis 缓存雪崩」。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('复述进度 1 / 2')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /继续第 2 题/ }))

    expect(onContinueFirstRunRehearsal).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('surfaces first-run completion before generic next training', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onContinueFirstRun = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'weak'),
          queueItem(2, 'Redis 缓存雪崩'),
          queueItem(3, 'MySQL 索引失效'),
        ]}
        progress={{
          ...progress(),
          dailyPlan: [1, 2, 3],
          questionStates: {
            1: { status: 'weak', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
            2: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
            3: { status: 'mastered', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
          },
          interviewAttempts: {
            1: [attempt(1, 52)],
            2: [attempt(2, 68)],
            3: [attempt(3, 86)],
          },
        }}
        now={NOW}
        firstRunProgress={{
          answeredCount: 3,
          totalCount: 3,
          onContinue: onContinueFirstRun,
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('首练队列已完成')).toBeInTheDocument()
    expect(within(panel).getByText('已完成 3 / 3，先看本轮战报，再按风险题补弱。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('首练进度 3 / 3')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /按战报补弱/ }))

    expect(onContinueFirstRun).not.toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2&from=first-run-repair')
  })

  it('keeps first-run repair wording before generic next training', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onContinueFirstRunRepair = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'weak'),
          queueItem(2, 'Redis 缓存雪崩', 'weak'),
        ]}
        progress={progress()}
        now={NOW}
        firstRunProgress={{
          answeredCount: 1,
          totalCount: 2,
          nextQuestionTitle: 'Redis 缓存雪崩',
          onContinue: onContinueFirstRunRepair,
          variant: 'repair',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('继续修复首练补弱队列')).toBeInTheDocument()
    expect(within(panel).getByText('已修复 1 / 2，下一题继续补弱「Redis 缓存雪崩」。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('补弱进度 1 / 2')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /继续第 2 题/ }))

    expect(onContinueFirstRunRepair).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('keeps first-run repair context when opening a listed risk item', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'weak'),
          queueItem(2, 'Redis 缓存雪崩', 'weak'),
        ]}
        progress={progress()}
        now={NOW}
        firstRunProgress={{
          answeredCount: 2,
          totalCount: 2,
          onContinue: vi.fn(),
          variant: 'repair',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    await user.click(within(panel).getByRole('button', { name: /HashMap 并发问题/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1&from=first-run-repair')
  })

  it('switches completed first-run rehearsal risk items into repair context', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'JVM GC 调优', 'weak'),
          queueItem(2, 'Redis 缓存雪崩', 'mastered'),
        ]}
        progress={{
          ...progress(),
          questionStates: {
            1: { status: 'weak', addedToPlan: true, reviewCount: 3, lastReviewedAt: NOW },
            2: { status: 'mastered', addedToPlan: true, reviewCount: 3, lastReviewedAt: NOW },
          },
          interviewAttempts: {
            1: [attempt(1, 52)],
            2: [attempt(2, 91)],
          },
        }}
        now={NOW}
        firstRunProgress={{
          answeredCount: 2,
          totalCount: 2,
          onContinue: vi.fn(),
          variant: 'rehearsal',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('首练过线复述已完成')).toBeInTheDocument()
    expect(within(panel).getByText('已复述 2 / 2，本轮过线题已完成脱稿验证，继续处理新暴露的风险题。')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /JVM GC 调优/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1&from=first-run-repair')
  })

  it('surfaces a first-run repair closure when no risk items remain', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'HashMap 并发问题', 'mastered'),
          queueItem(2, 'Redis 缓存雪崩', 'mastered'),
        ]}
        progress={{
          ...progress(),
          questionStates: {
            1: { status: 'mastered', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
            2: { status: 'mastered', addedToPlan: true, reviewCount: 1, lastReviewedAt: NOW },
          },
          interviewAttempts: {
            1: [attempt(1, 84)],
            2: [attempt(2, 88)],
          },
        }}
        now={NOW}
        firstRunProgress={{
          answeredCount: 2,
          totalCount: 2,
          onContinue: vi.fn(),
          variant: 'repair',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('首练补弱已过线')).toBeInTheDocument()
    expect(within(panel).getByText('已修复 2 / 2，本轮首练补弱已过线，回到战报沉淀可复述证据。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('下一轮 0')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /HashMap 并发问题/ })).not.toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /查看首练战报/ }))

    expect(onNavigate).toHaveBeenCalledWith('/study')
    await user.click(within(panel).getByRole('button', { name: /回到启动台/ }))
    expect(onNavigate).toHaveBeenCalledWith('/')
  })

  it('surfaces a first-run rehearsal closure without duplicating the report action', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticePostScoreNextStepPanel
        queue={[
          queueItem(1, 'JVM GC 调优', 'mastered'),
          queueItem(2, 'Redis 缓存雪崩', 'mastered'),
        ]}
        progress={{
          ...progress(),
          questionStates: {
            1: { status: 'mastered', addedToPlan: true, reviewCount: 3, lastReviewedAt: NOW },
            2: { status: 'mastered', addedToPlan: true, reviewCount: 3, lastReviewedAt: NOW },
          },
          interviewAttempts: {
            1: [attempt(1, 86)],
            2: [attempt(2, 91)],
          },
        }}
        now={NOW}
        firstRunProgress={{
          answeredCount: 2,
          totalCount: 2,
          onContinue: vi.fn(),
          variant: 'rehearsal',
        }}
        onNavigate={onNavigate}
      />,
    )

    const panel = screen.getByLabelText('评分后下一步')

    expect(within(panel).getByText('首练过线复述已完成')).toBeInTheDocument()
    expect(within(panel).getByText('已复述 2 / 2，本轮过线题已完成脱稿验证，回到战报沉淀可复述证据。')).toBeInTheDocument()
    expect(within(panel).getByLabelText('下一轮 0')).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: /查看首练战报/ }))
    expect(onNavigate).toHaveBeenCalledWith('/study')

    await user.click(within(panel).getByRole('button', { name: /回到启动台/ }))
    expect(onNavigate).toHaveBeenCalledWith('/')
  })
})
