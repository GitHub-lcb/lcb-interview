import type { PrepRoute } from '../data/freeSuperiority'
import type {
  DailyMissionPlan,
  DailyPlanBrief,
  DailyPlanCompletion,
  InterviewEmergencyKit,
  InterviewLastMinuteBrief,
  InterviewBriefItem,
  InterviewBriefReport,
  InterviewFollowUpDefense,
  InterviewMaterialVault,
  InterviewMistakeLedger,
  InterviewRecoveryAcceptance,
  InterviewRecoveryPlan,
  PrepHealthDimension,
  PrepHealthReport,
  StudyProgress,
} from '../types'
import { buildDailyMissionPlan } from './dailyMission'
import { buildDailyPlanBrief } from './dailyPlanBrief'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewBrief } from './interviewBrief'
import { buildInterviewEmergencyKit } from './interviewEmergencyKit'
import { buildInterviewFollowUpDefense } from './interviewFollowUpDefense'
import { buildInterviewLastMinuteBrief } from './interviewLastMinuteBrief'
import { buildInterviewMaterialVault } from './interviewMaterialVault'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewRecoveryAcceptance } from './interviewRecoveryAcceptance'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
import { buildPrepHealthReport } from './prepHealth'

const recoveryModeLabels: Record<InterviewRecoveryPlan['mode'], string> = {
  empty: '待建立样本',
  repair: '错因修复',
  advanced: '稳定加压',
}

export function buildSprintReportMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const health = buildPrepHealthReport(routes, progress, now)
  const brief = buildInterviewBrief(routes, progress, now)
  const completion = buildDailyPlanCompletion(progress, now)
  const dailyMission = buildDailyMissionPlan(routes, progress, now)
  const dailyBrief = buildDailyPlanBrief(progress, [], now)
  const mistakeLedger = buildInterviewMistakeLedger(progress)
  const recoveryPlan = buildInterviewRecoveryPlan(mistakeLedger)
  const recoveryAcceptance = buildInterviewRecoveryAcceptance(progress, mistakeLedger)
  const emergencyKit = buildInterviewEmergencyKit(progress, now)
  const lastMinuteBrief = buildInterviewLastMinuteBrief(progress, now)
  const materialVault = buildInterviewMaterialVault(progress)
  const followUpDefense = buildInterviewFollowUpDefense(progress)
  const generatedDate = formatDate(now)

  return [
    `# ${progress.targetRole} 面试冲刺报告`,
    '',
    `生成时间：${generatedDate}`,
    `目标周期：${progress.sprintDays} 天`,
    '',
    renderExecutiveSummarySection(health, completion, mistakeLedger, recoveryPlan),
    renderDailyMissionSection(dailyMission),
    renderEmergencyKitSection(emergencyKit),
    renderLastMinuteBriefSection(lastMinuteBrief),
    renderMaterialVaultSection(materialVault),
    renderFollowUpDefenseSection(followUpDefense),
    renderHealthSection(health),
    renderDimensionsSection(health.dimensions),
    renderDailyCompletionSection(completion),
    renderDailyPlanBriefSection(dailyBrief),
    renderBriefSection('可主动表达', brief.strengths),
    renderBriefSection('必须规避', brief.risks),
    renderBriefSection('开口热身题', brief.warmups),
    renderMistakeLedgerSection(mistakeLedger),
    renderRecoveryPlanSection(recoveryPlan),
    renderRecoveryAcceptanceSection(recoveryAcceptance),
    renderActionSection(health, brief, completion, recoveryPlan, materialVault, followUpDefense, recoveryAcceptance, dailyMission),
  ].join('\n')
}

function renderHealthSection(health: PrepHealthReport): string {
  return [
    '## 备考健康度',
    `- 总分：${health.score}`,
    `- 状态：${health.title}`,
    `- 最大风险：${health.primaryDimension.label}`,
    `- 说明：${health.summary}`,
    '',
  ].join('\n')
}

function renderExecutiveSummarySection(
  health: PrepHealthReport,
  completion: DailyPlanCompletion,
  ledger: InterviewMistakeLedger,
  recoveryPlan: InterviewRecoveryPlan,
): string {
  const recoveryTo = recoveryPlan.primaryAction.to || '/practice'

  return [
    '## 一页作战摘要',
    `- 总分：${health.score}，最大风险：${health.primaryDimension.label}`,
    `- 今日闭环：${completion.title}，完成率 ${completion.completionRate}%`,
    `- 错题恢复：${ledger.title}，${recoveryPlan.title}`,
    `- 先做健康动作：${health.primaryAction.label} - ${health.primaryAction.description}（${health.primaryAction.to}）`,
    `- 再做今日动作：${completion.primaryAction.label} - ${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    `- 最后做恢复动作：${recoveryPlan.primaryAction.label} - ${recoveryPlan.primaryAction.description}（${recoveryTo}）`,
    '',
  ].join('\n')
}

function renderDailyMissionSection(plan: DailyMissionPlan): string {
  const missionLines = plan.missions.length > 0
    ? plan.missions.map((mission, index) => (
      `- ${index + 1}. ${mission.title}：${mission.description}；${mission.reason}；${mission.metric}；入口：${mission.to}`
    ))
    : ['- 暂无今日任务，先进入学习计划生成任务。']

  return [
    '## 今日冲刺任务',
    `- 摘要：${plan.summary}`,
    `- 任务数：${plan.missions.length}`,
    ...missionLines,
    '',
  ].join('\n')
}

function renderEmergencyKitSection(kit: InterviewEmergencyKit): string {
  const itemLines = kit.items.length > 0
    ? kit.items.slice(0, 5).map(item => (
      `- ${item.durationMinutes} 分钟｜${item.title}：${item.description}；${item.reason}（${item.to || '/practice'}）`
    ))
    : ['- 暂无急救动作。']

  return [
    '## 面试前急救包',
    `- 状态：${kit.title}`,
    `- 摘要：${kit.summary}`,
    `- 预计耗时：${kit.totalMinutes} 分钟`,
    `- 复习债：${kit.reviewDebtCount} 道`,
    `- 错因信号：${kit.mistakeCount} 个`,
    ...itemLines,
    '',
  ].join('\n')
}

function renderLastMinuteBriefSection(brief: InterviewLastMinuteBrief): string {
  const itemLines = brief.items.length > 0
    ? brief.items.slice(0, 5).map(item => (
      `- ${item.title}：${item.detail}；${item.evidence}（${item.actionLabel}，${item.to || '/practice'}）`
    ))
    : ['- 暂无最后 24 小时动作。']

  return [
    '## 最后 24 小时面试简报',
    `- 状态：${brief.title}`,
    `- 摘要：${brief.summary}`,
    `- 进场信心：${brief.confidenceScore} 分`,
    ...brief.metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    ...itemLines,
    '',
  ].join('\n')
}

function renderMaterialVaultSection(vault: InterviewMaterialVault): string {
  const snippetLines = vault.snippets.length > 0
    ? vault.snippets.slice(0, 6).map(snippet => (
      `- ${snippet.label}：${snippet.title}（${snippet.score} 分）${snippet.content}；${snippet.reason}（${snippet.to}）`
    ))
    : [
      `- 暂无高分素材，${vault.primaryAction.label}：${vault.primaryAction.description}（${vault.primaryAction.to}）`,
    ]

  return [
    '## 高分表达素材库',
    `- 状态：${vault.title}`,
    `- 摘要：${vault.summary}`,
    ...vault.metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    ...snippetLines,
    '',
  ].join('\n')
}

function renderFollowUpDefenseSection(defense: InterviewFollowUpDefense): string {
  const itemLines = defense.items.length > 0
    ? defense.items.slice(0, 5).map(item => (
      `- ${item.title}：${item.prompt}；${item.pressurePoint}；${item.answerGuide}；${item.criterionLabel}，${item.score} 分；入口：${item.to}`
    ))
    : [
      `- 暂无追问防线，${defense.primaryAction.label}：${defense.primaryAction.description}（${defense.primaryAction.to}）`,
    ]

  return [
    '## 面试追问防线',
    `- 状态：${defense.title}`,
    `- 摘要：${defense.summary}`,
    ...defense.metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    ...itemLines,
    '',
  ].join('\n')
}

function renderDimensionsSection(dimensions: PrepHealthDimension[]): string {
  return [
    '## 四维诊断',
    ...dimensions.map(dimension => (
      `- ${dimension.label}：${dimension.score} 分，${dimension.description}（${dimension.detail}）`
    )),
    '',
  ].join('\n')
}

function renderBriefSection(title: string, items: InterviewBriefItem[]): string {
  if (items.length === 0) {
    return [
      `## ${title}`,
      '- 暂无，继续积累本地学习记录后会自动生成。',
      '',
    ].join('\n')
  }

  return [
    `## ${title}`,
    ...items.map(item => {
      const questionSuffix = item.questionId ? `，题目 ID：${item.questionId}` : ''
      return `- ${item.title}：${item.description}（${item.metric}${questionSuffix}）`
    }),
    '',
  ].join('\n')
}

function renderDailyCompletionSection(completion: DailyPlanCompletion): string {
  const todoLines = completion.todos.length > 0
    ? completion.todos.map(todo => `- 待办：${todo.title} - ${todo.description}（${todo.to}）`)
    : ['- 待办：暂无额外待办。']

  return [
    '## 今日计划闭环',
    `- 状态：${completion.title}`,
    `- 说明：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    `- 已掌握：${completion.masteredCount}/${completion.totalCount}`,
    `- 复习债：${completion.reviewDebtCount} 道`,
    `- 薄弱题：${completion.weakCount} 道`,
    `- 今日面试：${completion.interviewTodayCount} 次`,
    ...todoLines,
    '',
  ].join('\n')
}

function renderDailyPlanBriefSection(brief: DailyPlanBrief): string {
  if (brief.items.length === 0) {
    return [
      '## 今日作战简报',
      `- 摘要：${brief.summary}`,
      '',
    ].join('\n')
  }

  return [
    '## 今日作战简报',
    `- 摘要：${brief.summary}`,
    ...brief.items.slice(0, 8).map(item => (
      `- ${item.title}：${item.sourceLabel}，${item.actionLabel}；${item.reason}（${item.categoryName}，题目 ID：${item.questionId}，${item.to}）`
    )),
    '',
  ].join('\n')
}

function renderMistakeLedgerSection(ledger: InterviewMistakeLedger): string {
  const itemLines = ledger.items.length > 0
    ? ledger.items.slice(0, 5).map(item => {
      const questionIds = item.affectedQuestionIds.length > 0 ? item.affectedQuestionIds.join(', ') : '暂无'
      return `- ${item.label}：${item.summary}；平均分：${item.averageScore}；次数：${item.attempts}；题目 ID：${questionIds}；入口：${item.to || '/practice'}`
    })
    : ['- 暂无历史错因，先完成一次模拟面试来建立样本。']

  return [
    '## 面试错题账本',
    `- 状态：${ledger.title}`,
    `- 摘要：${ledger.summary}`,
    `- 问题总数：${ledger.totalProblems}`,
    ...itemLines,
    '',
  ].join('\n')
}

function renderRecoveryPlanSection(plan: InterviewRecoveryPlan): string {
  return [
    '## 错题恢复计划',
    `- 模式：${recoveryModeLabels[plan.mode]}`,
    `- 标题：${plan.title}`,
    `- 说明：${plan.summary}`,
    `- 预计耗时：${plan.totalMinutes} 分钟`,
    ...plan.steps.slice(0, 4).flatMap((step, index) => [
      `- 步骤 ${index + 1}：${step.title}`,
      `  - 动作：${step.description}`,
      `  - 原因：${step.reason}`,
      `  - 入口：${step.to || '/practice'}`,
    ]),
    '',
  ].join('\n')
}

function renderRecoveryAcceptanceSection(acceptance: InterviewRecoveryAcceptance): string {
  return [
    '## 错题恢复验收',
    `- 状态：${acceptance.title}`,
    `- 摘要：${acceptance.summary}`,
    `- 已验收：${acceptance.passedCount}/${acceptance.totalCount}`,
    `- 已过线题目：${formatQuestionIds(acceptance.passedQuestionIds)}`,
    `- 未过线题目：${formatQuestionIds(acceptance.failedQuestionIds)}`,
    `- 待复测题目：${formatQuestionIds(acceptance.pendingQuestionIds)}`,
    `- 行动：${acceptance.primaryAction.label} - ${acceptance.primaryAction.description}（${acceptance.primaryAction.to}）`,
    '',
  ].join('\n')
}

function renderActionSection(
  health: PrepHealthReport,
  brief: InterviewBriefReport,
  completion: DailyPlanCompletion,
  recoveryPlan: InterviewRecoveryPlan,
  materialVault: InterviewMaterialVault,
  followUpDefense: InterviewFollowUpDefense,
  recoveryAcceptance: InterviewRecoveryAcceptance,
  dailyMission: DailyMissionPlan,
): string {
  // 报告被复制到外部文档后仍要能指导下一步，所以保留今日任务、健康、表达、今日闭环、错题恢复、高分素材、追问防线和错题验收行动线。
  const primaryMission = dailyMission.missions[0]
  const missionLine = primaryMission
    ? `- 今日任务：${primaryMission.title} - ${primaryMission.description}（${primaryMission.to}）`
    : '- 今日任务：生成今日计划 - 先进入学习计划建立今天的任务队列。（/study）'

  return [
    '## 下一步行动',
    missionLine,
    `- 健康雷达：${health.primaryAction.label} - ${health.primaryAction.description}（${health.primaryAction.to}）`,
    `- 面试简报：${brief.primaryAction.label} - ${brief.primaryAction.description}（${brief.primaryAction.to}）`,
    `- 今日闭环：${completion.primaryAction.label} - ${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    `- 错题恢复：${recoveryPlan.primaryAction.label} - ${recoveryPlan.primaryAction.description}（${recoveryPlan.primaryAction.to || '/practice'}）`,
    `- 高分素材：${materialVault.primaryAction.label} - ${materialVault.primaryAction.description}（${materialVault.primaryAction.to}）`,
    `- 追问防线：${followUpDefense.primaryAction.label} - ${followUpDefense.primaryAction.description}（${followUpDefense.primaryAction.to}）`,
    `- 错题验收：${recoveryAcceptance.primaryAction.label} - ${recoveryAcceptance.primaryAction.description}（${recoveryAcceptance.primaryAction.to}）`,
    '',
  ].join('\n')
}

function formatQuestionIds(questionIds: number[]): string {
  return questionIds.length > 0 ? questionIds.join(', ') : '暂无'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
