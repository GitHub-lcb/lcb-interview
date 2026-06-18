import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { message } from 'antd'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, PracticeQueueItem, StudyProgress } from '../types'
import { buildPracticeInterviewerScript } from '../utils/practiceInterviewerScript'
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

function attempt(
  questionId: number,
  score: number,
  structureScore = score,
  criterionScores: Partial<Record<InterviewCriterionKey, number>> = {},
  createdAt = NOW,
): InterviewAttempt {
  return {
    questionId,
    answer: '先讲结论，再补机制、场景、风险和落地方案。',
    createdAt,
    feedback: {
      score,
      level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
      criteria: [
        { key: 'coverage', label: '覆盖度', score: criterionScores.coverage ?? score, summary: '覆盖核心概念' },
        { key: 'structure', label: '结构化', score: criterionScores.structure ?? structureScore, summary: '结构表达一般' },
        { key: 'specificity', label: '场景细节', score: criterionScores.specificity ?? score, summary: '场景细节一般' },
        { key: 'risk', label: '风险意识', score: criterionScores.risk ?? score, summary: '风险意识一般' },
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

function answerFor(prompt: string, body: string): string {
  return `追问：${prompt}\n\n我的回答：${body}`
}

function passedScriptBody(): string {
  return [
    '结论：这个问题需要先说明机制，再补充项目证据。',
    '在线上项目中我会用错误率、耗时和吞吐指标验证。',
    '面试官继续追问时，我会补充风险边界和替代方案。',
  ].join('\n')
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

    expect(screen.getByText('下一轮训练')).toBeInTheDocument()
    expect(screen.getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /开始下一轮训练/ })).toBeInTheDocument()
    expect(screen.getByText('本轮模拟面试战报')).toBeInTheDocument()
    expect(screen.getByText('本轮正在推进')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('76 分')).toBeInTheDocument()
    expect(screen.getByText('队列画像')).toBeInTheDocument()
    expect(screen.getByText('今日计划 2 道')).toBeInTheDocument()
    expect(screen.getAllByText('Java 面试题 2').length).toBeGreaterThan(0)
    expect(screen.getByText('今日闭环')).toBeInTheDocument()
    expect(screen.getByText(/完成率/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /复制战报/ }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Java 后端 本轮模拟面试战报'))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('本轮正在推进'))

    await userEvent.click(screen.getByRole('button', { name: /进入队列/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')

    await userEvent.click(screen.getByRole('button', { name: /开始下一轮训练/ }))

    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/practice?queue='))

    await userEvent.click(screen.getByRole('button', { name: /继续未答题/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=2')
  })

  it('renders high-score materials from the current session queue', async () => {
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 88)],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const materialBlock = screen.getByLabelText('本轮高分素材')

    expect(within(materialBlock).getByText('本轮高分素材')).toBeInTheDocument()
    expect(within(materialBlock).getAllByText(/高分素材/).length).toBeGreaterThan(0)
    expect(within(materialBlock).getByText('Java 面试题 1')).toBeInTheDocument()
    expect(within(materialBlock).getByText(/88 分/)).toBeInTheDocument()

    await userEvent.click(within(materialBlock).getByRole('button', { name: /Java 面试题 1/ }))

    expect(onNavigate).toHaveBeenCalledWith('/question/1')
  })

  it('renders follow-up defenses from the current session queue', async () => {
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 62, 45)],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const defenseBlock = screen.getByLabelText('本轮追问防线')

    expect(within(defenseBlock).getByText('本轮追问防线')).toBeInTheDocument()
    expect(within(defenseBlock).getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
    expect(within(defenseBlock).getByText(/表达结构/)).toBeInTheDocument()

    await userEvent.click(within(defenseBlock).getAllByRole('button', { name: /Java 面试题 1/ })[0])

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
  })

  it('renders script command from the current session queue', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const currentQueue = [question(1), question(2)]
    const prompt = buildPracticeInterviewerScript(currentQueue[0], []).steps[0].prompt

    render(
      <PracticeSessionReportPanel
        queue={currentQueue}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [
              {
                ...attempt(1, 82),
                answer: answerFor(prompt, passedScriptBody()),
              },
            ],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const commandBlock = screen.getByLabelText('本轮脚本总控')

    expect(within(commandBlock).getByText('本轮脚本总控')).toBeInTheDocument()
    expect(within(commandBlock).getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
    expect(within(commandBlock).getByText(/1 \/ 3/)).toBeInTheDocument()

    await user.click(within(commandBlock).getAllByRole('button', { name: /Java 面试题 1/ })[0])

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
  })

  it('renders mistake ledger from the current session queue', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 58, 58, { specificity: 35 })],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const ledgerBlock = screen.getByLabelText('本轮错因账本')

    expect(within(ledgerBlock).getByText('本轮错因账本')).toBeInTheDocument()
    expect(within(ledgerBlock).getByText('场景细节反复失分')).toBeInTheDocument()
    expect(within(ledgerBlock).getByText(/三步修复首要错因/)).toBeInTheDocument()

    await user.click(within(ledgerBlock).getByRole('button', { name: /场景细节反复失分/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
  })

  it('renders recovery acceptance from the current session queue', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 58, 58, { specificity: 35 })],
            2: [
              attempt(2, 82, 82, { specificity: 82 }),
              attempt(2, 52, 52, { specificity: 35 }, '2026-06-16T08:00:00.000Z'),
            ],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const acceptanceBlock = screen.getByLabelText('本轮错因验收')

    expect(within(acceptanceBlock).getByText('本轮错因验收')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('最新复测仍未过线')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('1 / 2')).toBeInTheDocument()

    await user.click(within(acceptanceBlock).getByRole('button', { name: /继续复测/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders ability radar from the current session queue', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <PracticeSessionReportPanel
        queue={[question(1), question(2)]}
        progress={{
          ...progress(),
          interviewAttempts: {
            1: [attempt(1, 62, 72, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
            2: [attempt(2, 72, 74, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
          },
        }}
        onNavigate={onNavigate}
      />
    )

    const radarBlock = screen.getByLabelText('本轮薄弱能力雷达')

    expect(within(radarBlock).getByText('本轮薄弱能力雷达')).toBeInTheDocument()
    expect(within(radarBlock).getByText('场景细节')).toBeInTheDocument()
    expect(within(radarBlock).getByText('55')).toBeInTheDocument()

    await user.click(within(radarBlock).getByRole('button', { name: /回炉场景细节/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('keeps the queue profile actionable for empty sessions', () => {
    render(
      <PracticeSessionReportPanel
        queue={[]}
        progress={progress()}
        onNavigate={vi.fn()}
      />
    )

    expect(screen.getByText('队列画像')).toBeInTheDocument()
    expect(screen.getByText(/暂无队列画像/)).toBeInTheDocument()
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
    expect(screen.getAllByText(/Java 面试题 1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/结构化/).length).toBeGreaterThan(0)
    expect(within(screen.getByLabelText('本轮补弱动作')).getByText(/先按/)).toBeInTheDocument()

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
