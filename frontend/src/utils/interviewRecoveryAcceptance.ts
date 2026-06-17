import type {
  InterviewAttempt,
  InterviewCriterionKey,
  InterviewMistakeLedger,
  InterviewMistakeLedgerAction,
  InterviewMistakeLedgerItem,
  InterviewRecoveryAcceptance,
  StudyProgress,
} from '../types'

const PASSING_SCORE = 70

export function buildInterviewRecoveryAcceptance(
  progress: StudyProgress,
  ledger: InterviewMistakeLedger,
): InterviewRecoveryAcceptance {
  if (ledger.level === 'empty' || ledger.items.length === 0) {
    return buildStaticReport(
      'empty',
      '等待建立验收样本',
      '先完成一次模拟面试，系统才能判断错因修复是否真的过线。',
      0,
      [],
      [],
      [],
      ledger.primaryAction,
    )
  }

  const primaryItem = ledger.items[0]
  if (ledger.level === 'stable' || primaryItem.type === 'advanced') {
    return buildStaticReport(
      'advanced',
      '当前无需错因验收',
      '最新记录没有明显低分错因，可以继续做高压追问和边界场景训练。',
      primaryItem.affectedQuestionIds.length,
      primaryItem.affectedQuestionIds,
      [],
      [],
      ledger.primaryAction,
    )
  }

  const result = primaryItem.affectedQuestionIds.reduce(
    (bucket, questionId) => {
      const latestAttempt = latestAttemptForQuestion(progress, questionId)
      if (!latestAttempt) {
        bucket.pendingQuestionIds.push(questionId)
        return bucket
      }

      const score = scoreForItem(latestAttempt, primaryItem)
      if (score >= PASSING_SCORE) {
        bucket.passedQuestionIds.push(questionId)
        return bucket
      }

      bucket.failedQuestionIds.push(questionId)
      return bucket
    },
    {
      passedQuestionIds: [] as number[],
      failedQuestionIds: [] as number[],
      pendingQuestionIds: [] as number[],
    },
  )

  const totalCount = primaryItem.affectedQuestionIds.length
  const status = resolveStatus(result.passedQuestionIds.length, result.failedQuestionIds.length, result.pendingQuestionIds.length)

  return {
    status,
    title: titleForStatus(status, primaryItem),
    summary: summaryForStatus(status, primaryItem, result.passedQuestionIds.length, totalCount),
    passedCount: result.passedQuestionIds.length,
    totalCount,
    passedQuestionIds: result.passedQuestionIds,
    failedQuestionIds: result.failedQuestionIds,
    pendingQuestionIds: result.pendingQuestionIds,
    primaryAction: {
      label: status === 'passed' ? '继续加压' : '继续复测',
      description: primaryItem.summary,
      to: primaryItem.to || '/practice',
    },
  }
}

function latestAttemptForQuestion(progress: StudyProgress, questionId: number): InterviewAttempt | undefined {
  return [...(progress.interviewAttempts[questionId] ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function scoreForItem(attempt: InterviewAttempt, item: InterviewMistakeLedgerItem): number {
  if (!item.criterionKey) {
    return attempt.feedback.score
  }

  return attempt.feedback.criteria.find(criterion => criterion.key === item.criterionKey)?.score ?? attempt.feedback.score
}

function resolveStatus(
  passedCount: number,
  failedCount: number,
  pendingCount: number,
): InterviewRecoveryAcceptance['status'] {
  if (failedCount > 0) {
    return 'failed'
  }
  if (pendingCount === 0 && passedCount > 0) {
    return 'passed'
  }
  if (passedCount > 0) {
    return 'testing'
  }
  return 'pending'
}

function titleForStatus(
  status: InterviewRecoveryAcceptance['status'],
  item: InterviewMistakeLedgerItem,
): string {
  if (status === 'passed') {
    return '首要错因已过线'
  }
  if (status === 'failed') {
    return '最新复测仍未过线'
  }
  if (status === 'testing') {
    return '复测正在推进'
  }
  return `${item.label}待复测`
}

function summaryForStatus(
  status: InterviewRecoveryAcceptance['status'],
  item: InterviewMistakeLedgerItem,
  passedCount: number,
  totalCount: number,
): string {
  if (status === 'passed') {
    return `已用最新模拟面试证明 ${totalCount} 道关联题全部达标，可以把训练切到加压模式。`
  }
  if (status === 'failed') {
    return `还有关联题的最新复测低于 ${PASSING_SCORE} 分，继续围绕「${item.label}」回炉。`
  }
  if (status === 'testing') {
    return `${passedCount}/${totalCount} 道关联题已达标，剩余题目还需要完成同一轮复测。`
  }
  return `还没有看到「${item.label}」的最新复测记录，先按修复计划完成一轮模拟面试。`
}

function buildStaticReport(
  status: InterviewRecoveryAcceptance['status'],
  title: string,
  summary: string,
  totalCount: number,
  passedQuestionIds: number[],
  failedQuestionIds: number[],
  pendingQuestionIds: number[],
  primaryAction: InterviewMistakeLedgerAction,
): InterviewRecoveryAcceptance {
  return {
    status,
    title,
    summary,
    passedCount: passedQuestionIds.length,
    totalCount,
    passedQuestionIds,
    failedQuestionIds,
    pendingQuestionIds,
    primaryAction,
  }
}
