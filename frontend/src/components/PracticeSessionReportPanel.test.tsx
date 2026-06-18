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
  }, 30000)

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

  it('renders interviewer decision from the current session queue', async () => {
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

    const decisionBlock = screen.getByLabelText('本轮面试官决策卡')

    expect(within(decisionBlock).getByText('暂不建议通过')).toBeInTheDocument()
    expect(within(decisionBlock).getByText('场景细节平均 55 分')).toBeInTheDocument()

    await user.click(within(decisionBlock).getByRole('button', { name: /补齐决策阻断/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders action priorities from the current session queue', async () => {
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

    const prioritiesBlock = screen.getByLabelText('本轮行动优先级')

    expect(within(prioritiesBlock).getByText('本轮行动优先级')).toBeInTheDocument()
    expect(within(prioritiesBlock).getAllByText('补齐决策阻断').length).toBeGreaterThan(0)
    expect(within(prioritiesBlock).getByText('继续复测')).toBeInTheDocument()
    expect(within(prioritiesBlock).getByText('回炉场景细节')).toBeInTheDocument()

    await user.click(within(prioritiesBlock).getByRole('button', { name: /补齐决策阻断/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders evidence gaps from the current session queue', async () => {
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

    const gapsBlock = screen.getByLabelText('本轮证据缺口')

    expect(within(gapsBlock).getByText('本轮证据缺口')).toBeInTheDocument()
    expect(within(gapsBlock).getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
    expect(within(gapsBlock).getByText('场景细节 50 分')).toBeInTheDocument()
    expect(
      within(gapsBlock).getAllByText('这个回答放到你的项目里，规模、指标、数据和个人职责分别是什么？').length,
    ).toBeGreaterThan(0)
    expect(
      within(gapsBlock).getAllByText('补一个项目场景、触发条件、量化指标和你本人负责的动作。').length,
    ).toBeGreaterThan(0)

    await user.click(within(gapsBlock).getByRole('button', { name: /修补证据缺口/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders replay cards from the current session queue', async () => {
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

    const replayBlock = screen.getByLabelText('本轮 60 秒复述卡')

    expect(within(replayBlock).getByText('本轮 60 秒复述卡')).toBeInTheDocument()
    expect(within(replayBlock).getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
    expect(within(replayBlock).getAllByText('我先给结论：这题要落到真实项目场景里说明。').length).toBeGreaterThan(0)
    expect(within(replayBlock).getAllByText('补项目规模、触发条件、量化指标和我负责的动作。').length).toBeGreaterThan(0)
    expect(
      within(replayBlock).getAllByText('最后补验证方式、监控指标和回滚方案，避免只讲经验不讲边界。').length,
    ).toBeGreaterThan(0)

    await user.click(within(replayBlock).getByRole('button', { name: /开始60秒复述/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders replay checklist from the current session queue', async () => {
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

    const checklistBlock = screen.getByLabelText('本轮复述验收清单')

    expect(within(checklistBlock).getByText('本轮复述验收清单')).toBeInTheDocument()
    expect(within(checklistBlock).getByText('结论先行')).toBeInTheDocument()
    expect(within(checklistBlock).getByText('证据可追问')).toBeInTheDocument()
    expect(within(checklistBlock).getByText('风险有边界')).toBeInTheDocument()
    expect(within(checklistBlock).getByText('60 秒内讲完')).toBeInTheDocument()

    await user.click(within(checklistBlock).getByRole('button', { name: /按清单重答/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders pressure probes from the current session queue', async () => {
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

    const probesBlock = screen.getByLabelText('本轮压力追问卡')

    expect(within(probesBlock).getByText('本轮压力追问卡')).toBeInTheDocument()
    expect(within(probesBlock).getByText('落地证据追问')).toBeInTheDocument()
    expect(within(probesBlock).getByText('失败边界追问')).toBeInTheDocument()
    expect(within(probesBlock).getByText('技术取舍追问')).toBeInTheDocument()

    await user.click(within(probesBlock).getByRole('button', { name: /开始压力追问/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders risk guardrails from the current session queue', async () => {
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

    const guardrailsBlock = screen.getByLabelText('本轮失分禁区')

    expect(within(guardrailsBlock).getByText('本轮失分禁区')).toBeInTheDocument()
    expect(within(guardrailsBlock).getByText('禁止空讲概念')).toBeInTheDocument()
    expect(within(guardrailsBlock).getByText('禁止跳过失败边界')).toBeInTheDocument()
    expect(within(guardrailsBlock).getByText('禁止只背标准答案')).toBeInTheDocument()

    await user.click(within(guardrailsBlock).getByRole('button', { name: /避开失分禁区/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders retry drafts from the current session queue', async () => {
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

    const draftBlock = screen.getByLabelText('本轮二次提交稿')

    expect(within(draftBlock).getByText('本轮二次提交稿')).toBeInTheDocument()
    expect(within(draftBlock).getByText('结论句')).toBeInTheDocument()
    expect(within(draftBlock).getByText('证据句')).toBeInTheDocument()
    expect(within(draftBlock).getByText('边界句')).toBeInTheDocument()
    expect(within(draftBlock).getByText('收束句')).toBeInTheDocument()

    await user.click(within(draftBlock).getByRole('button', { name: /使用二次提交稿/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders pass gates from the current session queue', async () => {
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

    const gateBlock = screen.getByLabelText('本轮通过门槛')

    expect(within(gateBlock).getByText('本轮通过门槛')).toBeInTheDocument()
    expect(within(gateBlock).getByText('全题完成')).toBeInTheDocument()
    expect(within(gateBlock).getByText('平均分达标')).toBeInTheDocument()
    expect(within(gateBlock).getByText('弱项清零')).toBeInTheDocument()
    expect(within(gateBlock).getByText('二次提交稿就绪')).toBeInTheDocument()

    await user.click(within(gateBlock).getByRole('button', { name: /修复通过门槛/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders pass evidence from the current session queue', async () => {
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

    const evidenceBlock = screen.getByLabelText('本轮过线证据包')

    expect(within(evidenceBlock).getByText('本轮过线证据包')).toBeInTheDocument()
    expect(within(evidenceBlock).getByText('评分证据')).toBeInTheDocument()
    expect(within(evidenceBlock).getByText('完成证据')).toBeInTheDocument()
    expect(within(evidenceBlock).getByText('弱项证据')).toBeInTheDocument()
    expect(within(evidenceBlock).getByText('提交证据')).toBeInTheDocument()

    await user.click(within(evidenceBlock).getByRole('button', { name: /复核过线证据/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders training contract for the next session round', async () => {
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

    const contractBlock = screen.getByLabelText('下一轮训练契约')

    expect(within(contractBlock).getByText('下一轮训练契约')).toBeInTheDocument()
    expect(within(contractBlock).getByText('目标分')).toBeInTheDocument()
    expect(within(contractBlock).getByText('训练题组')).toBeInTheDocument()
    expect(within(contractBlock).getByText('验收口径')).toBeInTheDocument()
    expect(within(contractBlock).getByText('复盘证据')).toBeInTheDocument()

    await user.click(within(contractBlock).getByRole('button', { name: /执行训练契约/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders training schedule for the next session round', async () => {
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

    const scheduleBlock = screen.getByLabelText('下一轮训练日程')

    expect(within(scheduleBlock).getByText('下一轮训练日程')).toBeInTheDocument()
    expect(within(scheduleBlock).getByText('预热')).toBeInTheDocument()
    expect(within(scheduleBlock).getByText('限时作答')).toBeInTheDocument()
    expect(within(scheduleBlock).getByText('验收复盘')).toBeInTheDocument()

    await user.click(within(scheduleBlock).getByRole('button', { name: /执行日程/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders schedule checklist for the next session round', async () => {
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

    const checklistBlock = screen.getByLabelText('训练日程打卡清单')

    expect(within(checklistBlock).getByText('训练日程打卡清单')).toBeInTheDocument()
    expect(within(checklistBlock).getAllByText('完成口径').length).toBeGreaterThan(0)
    expect(within(checklistBlock).getAllByText('证据模板').length).toBeGreaterThan(0)
    expect(within(checklistBlock).getAllByText('复盘问题').length).toBeGreaterThan(0)

    await user.click(within(checklistBlock).getByRole('button', { name: /按清单打卡/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders training receipt template for the next session round', async () => {
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

    const receiptBlock = screen.getByLabelText('训练回执模板')

    expect(within(receiptBlock).getByText('训练回执模板')).toBeInTheDocument()
    expect(within(receiptBlock).getByText('训练目标')).toBeInTheDocument()
    expect(within(receiptBlock).getByText('完成证据')).toBeInTheDocument()
    expect(within(receiptBlock).getByText('阻断项')).toBeInTheDocument()
    expect(within(receiptBlock).getByText('下一步')).toBeInTheDocument()

    await user.click(within(receiptBlock).getByRole('button', { name: /填写训练回执/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders receipt acceptance card for the next session round', async () => {
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

    const acceptanceBlock = screen.getByLabelText('回执验收卡')

    expect(within(acceptanceBlock).getByText('回执验收卡')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('目标清晰')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('证据可查')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('阻断说明')).toBeInTheDocument()
    expect(within(acceptanceBlock).getByText('下一步明确')).toBeInTheDocument()

    await user.click(within(acceptanceBlock).getByRole('button', { name: /验收训练回执/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders advance gate before the next session round', async () => {
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

    const advanceGate = screen.getByLabelText('下一轮准入闸门')

    expect(within(advanceGate).getByText('下一轮准入闸门')).toBeInTheDocument()
    expect(within(advanceGate).getByText('暂缓进入下一轮')).toBeInTheDocument()
    expect(within(advanceGate).getByText('目标清晰')).toBeInTheDocument()
    expect(within(advanceGate).getByText('证据可查')).toBeInTheDocument()

    await user.click(within(advanceGate).getByRole('button', { name: /回到本轮修复/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders launch packet before the next session round', async () => {
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

    const launchPacket = screen.getByLabelText('下一轮启动包')

    expect(within(launchPacket).getByText('下一轮启动包')).toBeInTheDocument()
    expect(within(launchPacket).getByText('回修启动包')).toBeInTheDocument()
    expect(within(launchPacket).getByText('打开启动入口')).toBeInTheDocument()
    expect(within(launchPacket).getByText('完成口径')).toBeInTheDocument()

    await user.click(within(launchPacket).getByRole('button', { name: /启动回修/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders launch checklist before the next session round', async () => {
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

    const checklist = screen.getByLabelText('启动执行清单')

    expect(within(checklist).getByText('启动执行清单')).toBeInTheDocument()
    expect(within(checklist).getByText('回修执行清单')).toBeInTheDocument()
    expect(within(checklist).getAllByText('证据模板').length).toBeGreaterThan(0)
    expect(within(checklist).getAllByText('复盘问题').length).toBeGreaterThan(0)

    await user.click(within(checklist).getByRole('button', { name: /按清单执行/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question rehearsal before the next session round', async () => {
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

    const rehearsal = screen.getByLabelText('首题预演卡')

    expect(within(rehearsal).getByText('首题预演卡')).toBeInTheDocument()
    expect(within(rehearsal).getByText('回修首题预演')).toBeInTheDocument()
    expect(within(rehearsal).getByText('开场提示')).toBeInTheDocument()
    expect(within(rehearsal).getByText('通过信号')).toBeInTheDocument()
    expect(within(rehearsal).getByText('证据要求')).toBeInTheDocument()

    await user.click(within(rehearsal).getByRole('button', { name: /启动回修预演/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question rubric before the next session round', async () => {
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

    const rubric = screen.getByLabelText('首题验收尺')

    expect(within(rubric).getByText('首题验收尺')).toBeInTheDocument()
    expect(within(rubric).getByText('回修首题验收尺')).toBeInTheDocument()
    expect(within(rubric).getByText('开场命中')).toBeInTheDocument()
    expect(within(rubric).getByText('证据留存')).toBeInTheDocument()
    expect(within(rubric).getAllByText('检查口径').length).toBeGreaterThan(0)

    await user.click(within(rubric).getByRole('button', { name: /按验收尺执行/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question receipt template before the next session round', async () => {
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

    const receipt = screen.getByLabelText('首题回执模板')

    expect(within(receipt).getByText('首题回执模板')).toBeInTheDocument()
    expect(within(receipt).getByText('回修首题回执')).toBeInTheDocument()
    expect(within(receipt).getByText('本次动作')).toBeInTheDocument()
    expect(within(receipt).getByText('评分证据')).toBeInTheDocument()
    expect(within(receipt).getByText('是否达标')).toBeInTheDocument()

    await user.click(within(receipt).getByRole('button', { name: /填写首题回执/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question receipt acceptance before the next session round', async () => {
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

    const acceptance = screen.getByLabelText('首题回执验收卡')

    expect(within(acceptance).getByText('首题回执验收卡')).toBeInTheDocument()
    expect(within(acceptance).getByText('回修回执验收卡')).toBeInTheDocument()
    expect(within(acceptance).getByText('动作明确')).toBeInTheDocument()
    expect(within(acceptance).getByText('证据可查')).toBeInTheDocument()
    expect(within(acceptance).getAllByText('未通过补救').length).toBeGreaterThan(0)

    await user.click(within(acceptance).getByRole('button', { name: /验收首题回执/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question release gate before the next session round', async () => {
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

    const releaseGate = screen.getByLabelText('首题放行门禁')

    expect(within(releaseGate).getByText('首题放行门禁')).toBeInTheDocument()
    expect(within(releaseGate).getByText('首题暂缓放行')).toBeInTheDocument()
    expect(within(releaseGate).getByText('预演动作')).toBeInTheDocument()
    expect(within(releaseGate).getByText('验收口径')).toBeInTheDocument()
    expect(within(releaseGate).getByText('回执证据')).toBeInTheDocument()
    expect(within(releaseGate).getByText('放行结论')).toBeInTheDocument()
    expect(within(releaseGate).getAllByText('处理动作').length).toBeGreaterThan(0)

    await user.click(within(releaseGate).getByRole('button', { name: /回到首题修复/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question review template before the next session round', async () => {
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

    const reviewTemplate = screen.getByLabelText('首题复盘模板')

    expect(within(reviewTemplate).getByText('首题复盘模板')).toBeInTheDocument()
    expect(within(reviewTemplate).getByText('回修首题复盘模板')).toBeInTheDocument()
    expect(within(reviewTemplate).getByText('评分变化')).toBeInTheDocument()
    expect(within(reviewTemplate).getByText('证据变化')).toBeInTheDocument()
    expect(within(reviewTemplate).getByText('阻断变化')).toBeInTheDocument()
    expect(within(reviewTemplate).getByText('下一题动作')).toBeInTheDocument()
    expect(within(reviewTemplate).getAllByText('验收规则').length).toBeGreaterThan(0)

    await user.click(within(reviewTemplate).getByRole('button', { name: /填写首题复盘/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question review acceptance before the next session round', async () => {
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

    const acceptance = screen.getByLabelText('首题复盘验收卡')

    expect(within(acceptance).getByText('首题复盘验收卡')).toBeInTheDocument()
    expect(within(acceptance).getByText('回修复盘验收卡')).toBeInTheDocument()
    expect(within(acceptance).getByText('评分可比')).toBeInTheDocument()
    expect(within(acceptance).getByText('证据可追溯')).toBeInTheDocument()
    expect(within(acceptance).getByText('阻断可判定')).toBeInTheDocument()
    expect(within(acceptance).getByText('下一题可执行')).toBeInTheDocument()
    expect(within(acceptance).getAllByText('未通过补救').length).toBeGreaterThan(0)

    await user.click(within(acceptance).getByRole('button', { name: /验收首题复盘/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question review archive before the next session round', async () => {
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

    const archive = screen.getByLabelText('首题复盘归档包')

    expect(within(archive).getByText('首题复盘归档包')).toBeInTheDocument()
    expect(within(archive).getByText('回修复盘归档包')).toBeInTheDocument()
    expect(within(archive).getByText('分数快照')).toBeInTheDocument()
    expect(within(archive).getByText('证据归档')).toBeInTheDocument()
    expect(within(archive).getByText('阻断结论')).toBeInTheDocument()
    expect(within(archive).getByText('下一题种子')).toBeInTheDocument()
    expect(within(archive).getAllByText('下一轮用途').length).toBeGreaterThan(0)
    expect(within(archive).getAllByText('丢失风险').length).toBeGreaterThan(0)

    await user.click(within(archive).getByRole('button', { name: /归档首题复盘/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question archive reuse checklist before the next session round', async () => {
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

    const reuse = screen.getByLabelText('首题归档复用清单')

    expect(within(reuse).getByText('首题归档复用清单')).toBeInTheDocument()
    expect(within(reuse).getByText('回修归档复用清单')).toBeInTheDocument()
    expect(within(reuse).getByText('读分数')).toBeInTheDocument()
    expect(within(reuse).getByText('带证据')).toBeInTheDocument()
    expect(within(reuse).getByText('认阻断')).toBeInTheDocument()
    expect(within(reuse).getByText('开下一题')).toBeInTheDocument()
    expect(within(reuse).getAllByText('开场提示').length).toBeGreaterThan(0)
    expect(within(reuse).getAllByText('失败回退').length).toBeGreaterThan(0)

    await user.click(within(reuse).getByRole('button', { name: /复用首题归档/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question reuse receipt before the next session round', async () => {
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

    const receipt = screen.getByLabelText('首题复用回执模板')

    expect(within(receipt).getByText('首题复用回执模板')).toBeInTheDocument()
    expect(within(receipt).getByText('回修复用回执模板')).toBeInTheDocument()
    expect(within(receipt).getByText('分数已读')).toBeInTheDocument()
    expect(within(receipt).getByText('证据已带')).toBeInTheDocument()
    expect(within(receipt).getByText('阻断已认')).toBeInTheDocument()
    expect(within(receipt).getByText('下一题已开')).toBeInTheDocument()
    expect(within(receipt).getAllByText('填写提示').length).toBeGreaterThan(0)
    expect(within(receipt).getAllByText('验收规则').length).toBeGreaterThan(0)

    await user.click(within(receipt).getByRole('button', { name: /填写复用回执/ }))

    expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
  })

  it('renders first question reuse receipt acceptance before the next session round', async () => {
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

    const acceptance = screen.getByLabelText('首题复用回执验收卡')

    expect(within(acceptance).getByText('首题复用回执验收卡')).toBeInTheDocument()
    expect(within(acceptance).getByText('回修复用回执待验收')).toBeInTheDocument()
    expect(within(acceptance).getByText('分数对齐')).toBeInTheDocument()
    expect(within(acceptance).getByText('证据引用')).toBeInTheDocument()
    expect(within(acceptance).getByText('阻断判断')).toBeInTheDocument()
    expect(within(acceptance).getByText('下一题接续')).toBeInTheDocument()
    expect(within(acceptance).getAllByText('通过信号').length).toBeGreaterThan(0)
    expect(within(acceptance).getAllByText('补救动作').length).toBeGreaterThan(0)

    await user.click(within(acceptance).getByRole('button', { name: /验收复用回执/ }))

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
