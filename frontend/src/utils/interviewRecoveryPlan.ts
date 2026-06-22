import type {
  InterviewMistakeLedger,
  InterviewMistakeLedgerItem,
  InterviewRecoveryPlan,
  InterviewRecoveryStep,
} from '../types'
import { appendPracticeHandoffSource } from './practiceRoute'

const EMPTY_PLAN_MINUTES = 12
const REPAIR_MINUTES = [12, 10, 15]
const ADVANCED_MINUTES = [15, 15, 12]
const INTERVIEW_RETROSPECTIVE_SOURCE = 'interview-retrospective'
const PRACTICE_RECOVERY_TARGET_PATTERN = /[?&](queue|question)=/

export function buildInterviewRecoveryPlan(ledger: InterviewMistakeLedger): InterviewRecoveryPlan {
  if (ledger.level === 'empty' || ledger.items.length === 0) {
    const step = buildEmptyStep()
    return {
      mode: 'empty',
      title: '先建立面试样本',
      summary: '完成一次模拟面试后，系统会把低分维度和薄弱题沉淀成修复计划。',
      totalMinutes: EMPTY_PLAN_MINUTES,
      steps: [step],
      primaryAction: actionFromStep(step),
    }
  }

  const primaryItem = ledger.items[0]
  if (ledger.level === 'stable' || primaryItem.type === 'advanced') {
    const steps = buildAdvancedSteps(primaryItem)
    return {
      mode: 'advanced',
      title: '稳定后继续加压',
      summary: '当前没有明显低分错因，下一轮重点是追问深度、边界场景和复盘沉淀。',
      totalMinutes: sumMinutes(steps),
      steps,
      primaryAction: actionFromStep(steps[0]),
    }
  }

  const steps = buildRepairSteps(primaryItem)
  return {
    mode: 'repair',
    title: '三步修复首要错因',
    summary: `先处理「${primaryItem.label}」，再补齐表达证据，最后用同一组题复测。`,
    totalMinutes: sumMinutes(steps),
    steps,
    primaryAction: actionFromStep(steps[0]),
  }
}

function buildEmptyStep(): InterviewRecoveryStep {
  return {
    id: 'create-first-interview-record',
    title: '完成一次模拟面试',
    description: '先用一题开口作答，让系统产生第一条可复盘的评分记录。',
    reason: '没有真实表达样本时，错因修复计划只能停留在猜测。',
    durationMinutes: EMPTY_PLAN_MINUTES,
    questionIds: [],
    to: '/practice',
    actionLabel: '开始模拟面试',
    priority: 1,
  }
}

function buildRepairSteps(item: InterviewMistakeLedgerItem): InterviewRecoveryStep[] {
  const to = withInterviewRetrospectiveSource(item.to)

  return [
    {
      id: `${item.id}-replay`,
      title: item.type === 'weak-unspoken' ? '薄弱题开口首轮' : `${item.label}回炉训练`,
      description: '按错因题单重新作答，先把最高优先级问题压下去。',
      reason: item.summary,
      durationMinutes: REPAIR_MINUTES[0],
      questionIds: item.affectedQuestionIds,
      to,
      actionLabel: item.actionLabel,
      priority: 3,
    },
    {
      id: `${item.id}-rewrite`,
      title: rewriteTitle(item),
      description: '把答案补成“结论、依据、场景、风险”都能说出口的版本。',
      reason: '二次作答前先补齐表达材料，能减少同一错因反复出现。',
      durationMinutes: REPAIR_MINUTES[1],
      questionIds: item.affectedQuestionIds,
      to,
      actionLabel: '补齐表达',
      priority: 2,
    },
    {
      id: `${item.id}-pressure-test`,
      title: '高压追问复测',
      description: '用同一组题再跑一轮模拟面试，确认错因是否真的下降。',
      reason: '只看答案不等于能在追问下稳定表达，必须用复测闭环。',
      durationMinutes: REPAIR_MINUTES[2],
      questionIds: item.affectedQuestionIds,
      to,
      actionLabel: '复测加压',
      priority: 1,
    },
  ]
}

function buildAdvancedSteps(item: InterviewMistakeLedgerItem): InterviewRecoveryStep[] {
  const to = withInterviewRetrospectiveSource(item.to)
  const questionIds = item.affectedQuestionIds

  return [
    {
      id: 'advanced-follow-up',
      title: '连续追问加压',
      description: '围绕最近答过的题连续回答追问，训练临场拆解能力。',
      reason: '稳定状态下继续做普通题收益变低，追问更能暴露上限。',
      durationMinutes: ADVANCED_MINUTES[0],
      questionIds,
      to,
      actionLabel: '继续加压',
      priority: 3,
    },
    {
      id: 'advanced-boundary',
      title: '补一轮边界场景',
      description: '给每道题追加一个异常、并发、性能或降级场景。',
      reason: '高分回答要能从标准答案延伸到真实工程边界。',
      durationMinutes: ADVANCED_MINUTES[1],
      questionIds,
      to,
      actionLabel: '练边界',
      priority: 2,
    },
    {
      id: 'advanced-review',
      title: '沉淀可复用表达',
      description: '把高分题整理成可迁移的话术骨架，下一次面试直接调用。',
      reason: '把一次高分转成稳定模板，才能在不同题目间复用。',
      durationMinutes: ADVANCED_MINUTES[2],
      questionIds,
      to,
      actionLabel: '复盘沉淀',
      priority: 1,
    },
  ]
}

function rewriteTitle(item: InterviewMistakeLedgerItem): string {
  if (item.type === 'weak-unspoken') {
    return '把薄弱题改写成面试表达'
  }
  if (item.criterionKey === 'coverage') {
    return '补齐核心知识覆盖'
  }
  if (item.criterionKey === 'structure') {
    return '重排三段式表达结构'
  }
  if (item.criterionKey === 'risk') {
    return '补齐边界和风险兜底'
  }
  return '补齐项目场景和量化细节'
}

function actionFromStep(step: InterviewRecoveryStep) {
  return {
    label: step.actionLabel,
    description: step.description,
    to: step.to,
  }
}

function withInterviewRetrospectiveSource(to?: string): string {
  const target = to || '/practice'
  if (!target.startsWith('/practice') || !PRACTICE_RECOVERY_TARGET_PATTERN.test(target)) {
    return target
  }

  return appendPracticeHandoffSource(target, INTERVIEW_RETROSPECTIVE_SOURCE, { replace: false })
}

function sumMinutes(steps: InterviewRecoveryStep[]): number {
  return steps.reduce((sum, step) => sum + step.durationMinutes, 0)
}
