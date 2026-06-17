import type { PrepRoute } from '../data/freeSuperiority'
import type {
  DailyPlanBrief,
  DailyPlanCompletion,
  InterviewEmergencyKit,
  InterviewLastMinuteBrief,
  InterviewBriefItem,
  InterviewBriefReport,
  InterviewMistakeLedger,
  InterviewRecoveryPlan,
  PrepHealthDimension,
  PrepHealthReport,
  StudyProgress,
} from '../types'
import { buildDailyPlanBrief } from './dailyPlanBrief'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewBrief } from './interviewBrief'
import { buildInterviewEmergencyKit } from './interviewEmergencyKit'
import { buildInterviewLastMinuteBrief } from './interviewLastMinuteBrief'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
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
  const dailyBrief = buildDailyPlanBrief(progress, [], now)
  const mistakeLedger = buildInterviewMistakeLedger(progress)
  const recoveryPlan = buildInterviewRecoveryPlan(mistakeLedger)
  const emergencyKit = buildInterviewEmergencyKit(progress, now)
  const lastMinuteBrief = buildInterviewLastMinuteBrief(progress, now)
  const generatedDate = formatDate(now)

  return [
    `# ${progress.targetRole} 面试冲刺报告`,
    '',
    `生成时间：${generatedDate}`,
    `目标周期：${progress.sprintDays} 天`,
    '',
    renderExecutiveSummarySection(health, completion, mistakeLedger, recoveryPlan),
    renderEmergencyKitSection(emergencyKit),
    renderLastMinuteBriefSection(lastMinuteBrief),
    renderHealthSection(health),
    renderDimensionsSection(health.dimensions),
    renderDailyCompletionSection(completion),
    renderDailyPlanBriefSection(dailyBrief),
    renderBriefSection('可主动表达', brief.strengths),
    renderBriefSection('必须规避', brief.risks),
    renderBriefSection('开口热身题', brief.warmups),
    renderMistakeLedgerSection(mistakeLedger),
    renderRecoveryPlanSection(recoveryPlan),
    renderActionSection(health, brief, completion, recoveryPlan),
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

function renderActionSection(
  health: PrepHealthReport,
  brief: InterviewBriefReport,
  completion: DailyPlanCompletion,
  recoveryPlan: InterviewRecoveryPlan,
): string {
  // 报告被复制到外部文档后仍要能指导下一步，所以保留健康、表达、今日闭环和错题恢复行动线。
  return [
    '## 下一步行动',
    `- 健康雷达：${health.primaryAction.label} - ${health.primaryAction.description}（${health.primaryAction.to}）`,
    `- 面试简报：${brief.primaryAction.label} - ${brief.primaryAction.description}（${brief.primaryAction.to}）`,
    `- 今日闭环：${completion.primaryAction.label} - ${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    `- 错题恢复：${recoveryPlan.primaryAction.label} - ${recoveryPlan.primaryAction.description}（${recoveryPlan.primaryAction.to || '/practice'}）`,
    '',
  ].join('\n')
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
