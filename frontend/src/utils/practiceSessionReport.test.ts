import { describe, expect, it } from 'vitest'
import type { InterviewAttempt, InterviewCriterionKey, InterviewFeedback, PracticeQueueItem, StudyProgress } from '../types'
import {
  buildPracticeSessionRepairDraft,
  buildPracticeSessionReport,
  buildPracticeSessionReportMarkdown,
} from './practiceSessionReport'
import { buildPracticeInterviewerScript } from './practiceInterviewerScript'

const NOW = '2026-06-17T08:00:00.000Z'

function question(id: number, overrides: Partial<PracticeQueueItem> = {}): PracticeQueueItem {
  return {
    id,
    title: `Java 面试题 ${id}`,
    difficulty: 'MEDIUM',
    categoryName: 'Java 基础',
    tags: ['Java'],
    viewCount: 100 + id,
    status: 'learning',
    source: 'plan',
    ...overrides,
  }
}

function progress(overrides: Partial<StudyProgress> = {}): StudyProgress {
  return {
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: NOW,
    ...overrides,
  }
}

function attempt(
  questionId: number,
  score: number,
  criterionScores: Partial<Record<InterviewCriterionKey, number>> = {},
  createdAt = NOW,
): InterviewAttempt {
  return {
    questionId,
    answer: '先给结论，再说明机制、场景、风险和落地方案。',
    feedback: feedback(score, criterionScores),
    createdAt,
  }
}

function feedback(
  score: number,
  criterionScores: Partial<Record<InterviewCriterionKey, number>> = {},
): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [
      { key: 'coverage', label: '覆盖度', score: criterionScores.coverage ?? score, summary: '覆盖核心概念' },
      { key: 'structure', label: '结构化', score: criterionScores.structure ?? score, summary: '结构表达一般' },
      { key: 'specificity', label: '场景细节', score: criterionScores.specificity ?? score, summary: '场景细节不足' },
      { key: 'risk', label: '风险意识', score: criterionScores.risk ?? score, summary: '风险意识一般' },
    ],
    advice: [],
    followUps: [],
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

describe('buildPracticeSessionReport', () => {
  it('returns an empty report when the queue has no questions', () => {
    const report = buildPracticeSessionReport([], progress())

    expect(report.level).toBe('empty')
    expect(report.answeredCount).toBe(0)
    expect(report.totalCount).toBe(0)
    expect(report.primaryAction).toMatchObject({ kind: 'start', to: '/practice' })
    expect(report.metrics[0]).toMatchObject({ key: 'answered', value: '0 / 0' })
  })

  it('points to unanswered questions while the session is still in progress', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2), question(3)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 72)],
        },
      }),
    )

    expect(report.level).toBe('in-progress')
    expect(report.answeredCount).toBe(1)
    expect(report.totalCount).toBe(3)
    expect(report.averageScore).toBe(72)
    expect(report.primaryAction).toMatchObject({ kind: 'continue', to: '/practice?queue=2,3' })
    expect(report.metrics[0]).toMatchObject({ key: 'answered', value: '1 / 3' })
    expect(report.queueProfile).toMatchObject({
      sourceSummary: '今日计划 3 道',
      nextQuestionTitle: 'Java 面试题 2',
      queuePath: '/practice?queue=1,2,3',
    })
    expect(report.queueProfile.unansweredQuestionIds).toEqual([2, 3])
  })

  it('prioritizes low score and weak questions for repair', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2), question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
        interviewAttempts: {
          1: [attempt(1, 62, { structure: 60 })],
          2: [attempt(2, 55, { structure: 45 })],
        },
      }),
    )

    expect(report.level).toBe('risk')
    expect(report.averageScore).toBe(59)
    expect(report.passCount).toBe(0)
    expect(report.weakQuestionIds).toEqual([1, 2, 3])
    expect(report.primaryAction).toMatchObject({ kind: 'repair', to: '/practice?queue=1,2,3' })
    expect(report.metrics.find(metric => metric.key === 'weakest')?.value).toContain('结构化')
    expect(report.repairActions[0]).toMatchObject({
      questionId: 2,
      title: 'Java 面试题 2',
      criterionLabel: '结构化',
      to: '/practice?question=2',
    })
    expect(report.repairActions[0].reason).toContain('55 分')
    expect(report.repairActions[0].action).toContain('结构')
    expect(report.repairActions.some(action => action.questionId === 3)).toBe(true)
  })

  it('marks the session as passed when all answered questions are strong', () => {
    const report = buildPracticeSessionReport(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 88)],
          2: [attempt(2, 92)],
        },
      }),
    )

    expect(report.level).toBe('passed')
    expect(report.answeredCount).toBe(2)
    expect(report.averageScore).toBe(90)
    expect(report.passCount).toBe(2)
    expect(report.weakQuestionIds).toEqual([])
    expect(report.primaryAction).toMatchObject({ kind: 'review', to: '/study' })
  })

  it('exports a portable markdown report for the current practice session', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2), question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
        interviewAttempts: {
          1: [attempt(1, 62, { structure: 60 })],
          2: [attempt(2, 55, { structure: 45 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 下一轮训练建议')
    expect(markdown).toContain('开始下一轮训练')
    expect(markdown).toContain('入口：/practice?queue=')
    expect(markdown).toContain('# Java 后端 本轮模拟面试战报')
    expect(markdown).toContain('生成时间：2026-06-17')
    expect(markdown).toContain('## 本轮摘要')
    expect(markdown).toContain('状态：本轮优先补弱')
    expect(markdown).toContain('低分/薄弱题：1, 2, 3')
    expect(markdown).toContain('## 核心指标')
    expect(markdown).toContain('最弱项：结构化')
    expect(markdown).toContain('## 队列画像')
    expect(markdown).toContain('来源构成：今日计划')
    expect(markdown).toContain('下一题：Java 面试题 3')
    expect(markdown).toContain('队列入口：/practice?queue=1,2,3')
    expect(markdown).toContain('## 今日闭环快照')
    expect(markdown).toContain('完成率：')
    expect(markdown).toContain('主行动：')
    expect(markdown).toContain('评分影响：')
    expect(markdown).toContain('## 补弱动作清单')
    expect(markdown).toContain('Java 面试题 2')
    expect(markdown).toContain('结构化')
    expect(markdown).toContain('/practice?question=2')
    expect(markdown).toContain('重答模板')
    expect(markdown).toContain('补弱题目：Java 面试题 2')
    expect(markdown).toContain('结论：')
    expect(markdown).toContain('原因：')
    expect(markdown).toContain('场景：')
    expect(markdown).toContain('边界：')
    expect(markdown).toContain('## 题目队列')
    expect(markdown).toContain('Java 面试题 2')
    expect(markdown).toContain('最近评分 55 分')
    expect(markdown).toContain('## 下一步行动')
    expect(markdown).toContain('/practice?queue=1,2,3')
  })

  it('exports high-score materials from the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 88)],
          2: [attempt(2, 76)],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮高分素材')
    expect(markdown).toContain('Java 面试题 1')
    expect(markdown).toContain('得分：88 分')
    expect(markdown).toContain('片段：')
    expect(markdown).toContain('入口：/question/1')
  })

  it('exports follow-up defenses from the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { structure: 45 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮追问防线')
    expect(markdown).toContain('Java 面试题 1')
    expect(markdown).toContain('追问：')
    expect(markdown).toContain('压力点：')
    expect(markdown).toContain('回答引导：')
    expect(markdown).toContain('入口：/practice?queue=1')
  })

  it('exports script command from the current session queue', () => {
    const currentQueue = [question(1), question(2)]
    const prompt = buildPracticeInterviewerScript(currentQueue[0], []).steps[0].prompt
    const markdown = buildPracticeSessionReportMarkdown(
      currentQueue,
      progress({
        interviewAttempts: {
          1: [
            {
              ...attempt(1, 82),
              answer: answerFor(prompt, passedScriptBody()),
            },
          ],
          3: [
            {
              ...attempt(3, 95),
              answer: '这道题不在当前队列，不应该出现在本轮脚本总控。',
            },
          ],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮脚本总控')
    expect(markdown).toContain('总进度：1 / 6（17%）')
    expect(markdown).toContain('Java 面试题 1')
    expect(markdown).toContain('脚本阶段：')
    expect(markdown).toContain('下一问：')
    expect(markdown).toContain('入口：/practice?queue=1')
    expect(markdown).not.toContain('Java 面试题 3')
  })

  it('exports mistake ledger from the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 58, { specificity: 35 })],
          3: [attempt(3, 40, { risk: 20 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮错因账本')
    expect(markdown).toContain('场景细节反复失分')
    expect(markdown).toContain('影响题目：1')
    expect(markdown).toContain('修复计划：三步修复首要错因')
    expect(markdown).toContain('入口：/practice?queue=1')
    expect(markdown).not.toContain('边界风险反复失分')
  })

  it('exports recovery acceptance for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 58, { specificity: 35 }, NOW)],
          2: [
            attempt(2, 82, { specificity: 82 }, NOW),
            attempt(2, 52, { specificity: 35 }, '2026-06-16T08:00:00.000Z'),
          ],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮错因验收')
    expect(markdown).toContain('最新复测仍未过线')
    expect(markdown).toContain('通过：1 / 2')
    expect(markdown).toContain('失败题：1')
    expect(markdown).toContain('待复测：暂无')
    expect(markdown).toContain('主行动：继续复测')
  })

  it('exports ability radar for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮薄弱能力雷达')
    expect(markdown).toContain('最弱维度：场景细节')
    expect(markdown).toContain('平均分：55')
    expect(markdown).toContain('影响题：1, 2')
    expect(markdown).toContain('主行动：回炉场景细节')
  })

  it('exports interviewer decision for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮面试官决策卡')
    expect(markdown).toContain('暂不建议通过')
    expect(markdown).toContain('阻断项：场景细节平均 55 分')
    expect(markdown).toContain('主行动：补齐决策阻断')
  })

  it('exports action priorities for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮行动优先级')
    expect(markdown).toContain('1. 补齐决策阻断')
    expect(markdown).toContain('2. 继续复测')
    expect(markdown).toContain('3. 回炉场景细节')
  })

  it('exports evidence gaps for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮证据缺口')
    expect(markdown).toContain('1. Java 面试题 1')
    expect(markdown).toContain('低分维度：场景细节 50 分')
    expect(markdown).toContain('面试官追问：这个回答放到你的项目里，规模、指标、数据和个人职责分别是什么？')
    expect(markdown).toContain('修复提示：补一个项目场景、触发条件、量化指标和你本人负责的动作。')
    expect(markdown).toContain('主行动：修补证据缺口')
  })

  it('exports replay cards for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮 60 秒复述卡')
    expect(markdown).toContain('1. Java 面试题 1')
    expect(markdown).toContain('开场句：我先给结论：这题要落到真实项目场景里说明。')
    expect(markdown).toContain('证据句：补项目规模、触发条件、量化指标和我负责的动作。')
    expect(markdown).toContain('边界句：最后补验证方式、监控指标和回滚方案，避免只讲经验不讲边界。')
    expect(markdown).toContain('复述提示：请用 60 秒重答「Java 面试题 1」')
  })

  it('exports replay checklist for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮复述验收清单')
    expect(markdown).toContain('1. 结论先行')
    expect(markdown).toContain('2. 证据可追问')
    expect(markdown).toContain('3. 风险有边界')
    expect(markdown).toContain('4. 60 秒内讲完')
    expect(markdown).toContain('主行动：按清单重答')
  })

  it('exports pressure probes for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮压力追问卡')
    expect(markdown).toContain('1. 落地证据追问')
    expect(markdown).toContain('2. 失败边界追问')
    expect(markdown).toContain('3. 技术取舍追问')
    expect(markdown).toContain('主行动：开始压力追问')
  })

  it('exports risk guardrails for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮失分禁区')
    expect(markdown).toContain('1. 禁止空讲概念')
    expect(markdown).toContain('2. 禁止跳过失败边界')
    expect(markdown).toContain('3. 禁止只背标准答案')
    expect(markdown).toContain('主行动：避开失分禁区')
  })

  it('exports retry drafts for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮二次提交稿')
    expect(markdown).toContain('结论句：')
    expect(markdown).toContain('证据句：')
    expect(markdown).toContain('边界句：')
    expect(markdown).toContain('收束句：')
    expect(markdown).toContain('主行动：使用二次提交稿')
  })

  it('exports pass gates for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮通过门槛')
    expect(markdown).toContain('全题完成')
    expect(markdown).toContain('平均分达标')
    expect(markdown).toContain('弱项清零')
    expect(markdown).toContain('二次提交稿就绪')
    expect(markdown).toContain('主行动：')
  })

  it('exports pass evidence for the current session queue', () => {
    const markdown = buildPracticeSessionReportMarkdown(
      [question(1), question(2)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 62, { coverage: 76, structure: 72, specificity: 50, risk: 74 })],
          2: [attempt(2, 72, { coverage: 78, structure: 74, specificity: 60, risk: 76 })],
        },
      }),
      NOW,
    )

    expect(markdown).toContain('## 本轮过线证据包')
    expect(markdown).toContain('评分证据')
    expect(markdown).toContain('完成证据')
    expect(markdown).toContain('弱项证据')
    expect(markdown).toContain('提交证据')
    expect(markdown).toContain('主行动：')
  })

  it('keeps empty session markdown actionable', () => {
    const markdown = buildPracticeSessionReportMarkdown([], progress(), NOW)

    expect(markdown).toContain('先选择一组面试题')
    expect(markdown).toContain('当前还没有练习队列')
    expect(markdown).toContain('暂无队列画像')
    expect(markdown).toContain('## 今日闭环快照')
    expect(markdown).toContain('今日计划待验收')
    expect(markdown).toContain('## 本轮高分素材')
    expect(markdown).toContain('暂无本轮高分素材')
    expect(markdown).toContain('## 本轮追问防线')
    expect(markdown).toContain('暂无本轮追问防线')
    expect(markdown).toContain('## 本轮脚本总控')
    expect(markdown).toContain('暂无本轮脚本总控')
    expect(markdown).toContain('## 本轮错因账本')
    expect(markdown).toContain('暂无本轮错因账本')
    expect(markdown).toContain('## 本轮错因验收')
    expect(markdown).toContain('等待建立验收样本')
    expect(markdown).toContain('## 本轮薄弱能力雷达')
    expect(markdown).toContain('等待本轮开口样本')
    expect(markdown).toContain('## 本轮面试官决策卡')
    expect(markdown).toContain('等待面试样本')
    expect(markdown).toContain('## 本轮行动优先级')
    expect(markdown).toContain('等待建立行动队列')
    expect(markdown).toContain('## 本轮证据缺口')
    expect(markdown).toContain('等待生成证据缺口')
    expect(markdown).toContain('## 本轮 60 秒复述卡')
    expect(markdown).toContain('等待生成复述卡')
    expect(markdown).toContain('## 本轮复述验收清单')
    expect(markdown).toContain('等待生成验收清单')
    expect(markdown).toContain('## 本轮压力追问卡')
    expect(markdown).toContain('等待生成压力追问')
    expect(markdown).toContain('## 本轮失分禁区')
    expect(markdown).toContain('等待生成失分禁区')
    expect(markdown).toContain('## 本轮二次提交稿')
    expect(markdown).toContain('等待生成二次提交稿')
    expect(markdown).toContain('## 本轮通过门槛')
    expect(markdown).toContain('等待生成通过门槛')
    expect(markdown).toContain('## 本轮过线证据包')
    expect(markdown).toContain('等待生成过线证据包')
    expect(markdown).toContain('## 下一轮训练建议')
    expect(markdown).toContain('先做一次模拟面试')
    expect(markdown).toContain('暂无题目')
    expect(markdown).not.toContain('undefined')
  })
})

describe('buildPracticeSessionRepairDraft', () => {
  it('builds a structured retry draft from the weakest criterion', () => {
    const report = buildPracticeSessionReport(
      [question(1)],
      progress({
        interviewAttempts: {
          1: [attempt(1, 56, { structure: 38 })],
        },
      }),
    )

    const draft = buildPracticeSessionRepairDraft(report.repairActions[0])

    expect(draft).toContain('补弱题目：Java 面试题 1')
    expect(draft).toContain('补弱维度：结构化')
    expect(draft).toContain('本次目标：先按')
    expect(draft).toContain('我的重答：')
    expect(draft).toContain('结论：')
    expect(draft).toContain('原因：')
    expect(draft).toContain('场景：')
    expect(draft).toContain('边界：')
  })

  it('keeps an unscored weak question repair draft actionable', () => {
    const report = buildPracticeSessionReport(
      [question(3, { status: 'weak' })],
      progress({
        questionStates: {
          3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        },
      }),
    )

    const draft = buildPracticeSessionRepairDraft(report.repairActions[0])

    expect(draft).toContain('补弱题目：Java 面试题 3')
    expect(draft).toContain('补弱维度：未评分')
    expect(draft).toContain('先完成一次模拟评分')
    expect(draft).toContain('我的重答：')
    expect(draft).not.toContain('undefined')
  })
})
