import type {
  InterviewMistakeLedger,
  InterviewMistakeLedgerItem,
  InterviewRecoveryPlan,
  InterviewRecoveryStep,
} from '../types'

const modeLabels: Record<InterviewRecoveryPlan['mode'], string> = {
  empty: '待建立样本',
  repair: '错因修复',
  advanced: '稳定加压',
}

export function buildInterviewRecoveryMarkdown(
  ledger: InterviewMistakeLedger,
  plan: InterviewRecoveryPlan,
  targetRole: string,
  now = new Date().toISOString(),
): string {
  const role = targetRole.trim() || '面试'

  return [
    `# ${role} 面试错因修复计划`,
    '',
    `生成日期：${formatDate(now)}`,
    `计划模式：${modeLabels[plan.mode]}`,
    `计划总耗时：${plan.totalMinutes} 分钟`,
    '',
    renderOverview(ledger, plan),
    renderMistakes(ledger.items),
    renderSteps(plan.steps),
    renderPrimaryAction(plan),
  ].join('\n')
}

function renderOverview(ledger: InterviewMistakeLedger, plan: InterviewRecoveryPlan): string {
  return [
    '## 错因概览',
    `- 当前状态：${ledger.title}`,
    `- 错因摘要：${ledger.summary}`,
    `- 修复计划：${plan.title}`,
    `- 计划说明：${plan.summary}`,
    '',
  ].join('\n')
}

function renderMistakes(items: InterviewMistakeLedgerItem[]): string {
  if (items.length === 0) {
    return [
      '## 错因条目',
      '- 暂无历史错因，先完成一次模拟面试来建立样本。',
      '',
    ].join('\n')
  }

  return [
    '## 错因条目',
    ...items.map(item => {
      const questionIds = item.affectedQuestionIds.length > 0 ? item.affectedQuestionIds.join(', ') : '暂无'
      return `- ${item.label}：${item.summary}；题目 ID：${questionIds}；训练入口：${item.to || '/practice'}`
    }),
    '',
  ].join('\n')
}

function renderSteps(steps: InterviewRecoveryStep[]): string {
  return [
    '## 修复步骤',
    ...steps.flatMap((step, index) => [
      `${index + 1}. ${step.title}`,
      `   - 耗时：${step.durationMinutes} 分钟`,
      `   - 动作：${step.description}`,
      `   - 原因：${step.reason}`,
      `   - 入口：${step.to || '/practice'}`,
    ]),
    '',
  ].join('\n')
}

function renderPrimaryAction(plan: InterviewRecoveryPlan): string {
  return [
    '## 首要行动',
    `- ${plan.primaryAction.label}：${plan.primaryAction.description}`,
    `- 入口：${plan.primaryAction.to || '/practice'}`,
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
