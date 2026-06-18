import type {
  DailyPlanCompletion,
  InterviewFollowUpDefense,
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewMaterialVault,
  InterviewMistakeLedger,
  InterviewRecoveryAcceptance,
  NextTrainingQueue,
  PracticeSessionAdvanceGate,
  PracticeSessionAdvanceGateItem,
  PracticeSessionActionPriorities,
  PracticeSessionActionPriorityItem,
  PracticeSessionAbilityRadar,
  PracticeSessionAbilityRadarItem,
  PracticeSessionEvidenceGapItem,
  PracticeSessionEvidenceGaps,
  PracticeSessionInterviewerDecision,
  PracticeSessionFirstQuestionRehearsal,
  PracticeSessionFirstQuestionRubric,
  PracticeSessionFirstQuestionRubricItem,
  PracticeSessionLaunchChecklist,
  PracticeSessionLaunchChecklistItem,
  PracticeSessionLaunchPacket,
  PracticeSessionLaunchPacketItem,
  PracticeSessionPassEvidence,
  PracticeSessionPassEvidenceItem,
  PracticeSessionPassGate,
  PracticeSessionPassGateItem,
  PracticeQueueItem,
  PracticeSessionPressureProbeItem,
  PracticeSessionPressureProbes,
  PracticeSessionReplayChecklist,
  PracticeSessionReplayChecklistItem,
  PracticeSessionReplayCardItem,
  PracticeSessionReplayCards,
  PracticeSessionRetryDraftItem,
  PracticeSessionRetryDrafts,
  PracticeSessionReceiptAcceptance,
  PracticeSessionReceiptAcceptanceItem,
  PracticeSessionRiskGuardrailItem,
  PracticeSessionRiskGuardrails,
  PracticeSessionScheduleChecklist,
  PracticeSessionScheduleChecklistItem,
  PracticeSessionTrainingContract,
  PracticeSessionTrainingContractItem,
  PracticeSessionTrainingReceipt,
  PracticeSessionTrainingReceiptItem,
  PracticeSessionTrainingSchedule,
  PracticeSessionTrainingScheduleItem,
  PracticeSessionReport,
  PracticeSessionReportAction,
  PracticeSessionReportLevel,
  PracticeSessionReportMetric,
  PracticeSessionQueueProfile,
  PracticeSessionRepairAction,
  QuestionSnapshot,
  NextTrainingQueueItem,
  StudyProgress,
} from '../types'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
import { buildInterviewFollowUpDefense } from './interviewFollowUpDefense'
import { buildInterviewMaterialVault } from './interviewMaterialVault'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewRecoveryAcceptance } from './interviewRecoveryAcceptance'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
import { buildNextTrainingQueue, formatNextTrainingQueueItemMeta } from './nextTrainingQueue'
import { buildPracticeInterviewerScriptProgress } from './practiceInterviewerScriptProgress'

const PASSING_SCORE = 70
const STRONG_SESSION_SCORE = 80
const EVIDENCE_GAP_SCORE = 75
const CRITICAL_EVIDENCE_GAP_SCORE = 60

const queueSourceLabels: Record<PracticeQueueItem['source'], string> = {
  review: '复习优先',
  plan: '今日计划',
  page: '当前筛选',
  new: '新题训练',
}

const statusLabels: Record<PracticeQueueItem['status'], string> = {
  new: '新题',
  learning: '学习中',
  mastered: '已掌握',
  weak: '薄弱',
}

const difficultyLabels: Record<string, string> = {
  EASY: '简单',
  MEDIUM: '中等',
  HARD: '困难',
}

const advanceGateItemStateLabels: Record<PracticeSessionAdvanceGateItem['state'], string> = {
  waiting: '等待样本',
  blocked: '未通过',
  passed: '已通过',
}

interface SessionAttemptItem {
  question: PracticeQueueItem
  attempt?: InterviewAttempt
}

interface WeakestCriterionSummary {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  summary: string
}

export type PracticeSessionScriptCommandStatus = 'empty' | 'pending' | 'active' | 'repair' | 'complete'

export interface PracticeSessionScriptCommandItem {
  questionId: number
  title: string
  to: string
  status: Exclude<PracticeSessionScriptCommandStatus, 'empty'>
  scriptTitle: string
  summary: string
  totalSteps: number
  passedCount: number
  attemptedCount: number
  progressPercent: number
  nextPrompt: string
  queueIndex: number
}

export interface PracticeSessionScriptCommand {
  status: PracticeSessionScriptCommandStatus
  title: string
  summary: string
  totalSteps: number
  passedCount: number
  attemptedQuestionCount: number
  progressPercent: number
  primaryAction: PracticeSessionReportAction
  items: PracticeSessionScriptCommandItem[]
}

export function buildPracticeSessionReport(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionReport {
  // 只取当前队列每题的最新一次尝试，避免历史旧分数或队列外训练污染本轮战报。
  const sessionItems = queue.map(question => ({
    question,
    attempt: latestAttemptForQuestion(progress, question.id),
  }))
  const answeredItems = sessionItems.filter(item => Boolean(item.attempt))
  const totalCount = queue.length
  const answeredCount = answeredItems.length
  const weakQuestionIds = resolveWeakQuestionIds(sessionItems, progress)
  const repairActions = buildRepairActions(sessionItems, progress)
  const queueProfile = buildQueueProfile(queue, progress, weakQuestionIds)

  if (totalCount === 0 || answeredCount === 0) {
    return buildEmptyReport(totalCount, repairActions, weakQuestionIds, queueProfile)
  }

  const averageScore = Math.round(
    answeredItems.reduce((sum, item) => sum + (item.attempt?.feedback.score ?? 0), 0) / answeredCount,
  )
  const passCount = answeredItems.filter(item => (item.attempt?.feedback.score ?? 0) >= PASSING_SCORE).length
  const weakestCriterion = summarizeWeakestCriterion(answeredItems)
  const unansweredIds = sessionItems
    .filter(item => !item.attempt)
    .map(item => item.question.id)
  const level = resolveLevel({
    answeredCount,
    averageScore,
    totalCount,
    weakQuestionIds,
  })
  const primaryAction = buildPrimaryAction(level, weakQuestionIds, unansweredIds)

  return {
    level,
    title: titleForLevel(level, unansweredIds.length),
    summary: summaryForLevel(level, answeredCount, totalCount, averageScore, weakQuestionIds.length),
    answeredCount,
    totalCount,
    averageScore,
    passCount,
    weakQuestionIds,
    metrics: buildMetrics({
      answeredCount,
      totalCount,
      averageScore,
      passCount,
      weakestCriterion,
      unansweredCount: unansweredIds.length,
    }),
    repairActions,
    queueProfile,
    primaryAction,
  }
}

export function buildPracticeSessionReportMarkdown(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const report = buildPracticeSessionReport(queue, progress)

  return [
    `# ${progress.targetRole} 本轮模拟面试战报`,
    '',
    `生成时间：${formatDate(now)}`,
    `队列题数：${queue.length}`,
    '',
    renderSessionSummary(report),
    renderSessionMetrics(report.metrics),
    renderSessionQueueProfile(report.queueProfile),
    renderSessionDailyClosure(queue, progress, now),
    renderSessionMaterialVault(queue, progress),
    renderSessionFollowUpDefense(queue, progress),
    renderSessionScriptCommand(queue, progress),
    renderSessionMistakeLedger(queue, progress),
    renderSessionRecoveryAcceptance(queue, progress),
    renderSessionAbilityRadar(queue, progress),
    renderSessionInterviewerDecision(queue, progress),
    renderSessionActionPriorities(queue, progress, now),
    renderSessionEvidenceGaps(queue, progress),
    renderSessionReplayCards(queue, progress),
    renderSessionReplayChecklist(queue, progress),
    renderSessionPressureProbes(queue, progress),
    renderSessionRiskGuardrails(queue, progress),
    renderSessionRetryDrafts(queue, progress),
    renderSessionPassGate(queue, progress),
    renderSessionPassEvidence(queue, progress),
    renderSessionTrainingContract(queue, progress, now),
    renderSessionTrainingSchedule(queue, progress, now),
    renderSessionScheduleChecklist(queue, progress, now),
    renderSessionTrainingReceipt(queue, progress, now),
    renderSessionReceiptAcceptance(queue, progress, now),
    renderSessionAdvanceGate(queue, progress, now),
    renderSessionLaunchPacket(queue, progress, now),
    renderSessionLaunchChecklist(queue, progress, now),
    renderSessionFirstQuestionRehearsal(queue, progress, now),
    renderSessionFirstQuestionRubric(queue, progress, now),
    renderSessionNextTraining(queue, progress, now),
    renderSessionRepairActions(report.repairActions),
    renderSessionQueue(queue, progress),
    renderSessionAction(report.primaryAction),
  ].join('\n')
}

export function buildPracticeSessionNextTrainingQueue(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
  limit = 5,
): NextTrainingQueue {
  return buildNextTrainingQueue(buildPracticeSessionProgressContext(queue, progress), now, limit)
}

export function buildPracticeSessionDailyCompletion(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): DailyPlanCompletion {
  return buildDailyPlanCompletion(buildPracticeSessionProgressContext(queue, progress), now)
}

export function buildPracticeSessionMaterialVault(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewMaterialVault {
  const queueIdSet = new Set(
    queue
      .map(item => item.id)
      .filter(questionId => Number.isFinite(questionId) && questionId > 0),
  )
  const context = buildPracticeSessionProgressContext(queue, progress)
  const interviewAttempts = Object.fromEntries(
    Object.entries(context.interviewAttempts)
      .filter(([questionId]) => queueIdSet.has(Number(questionId))),
  )

  return buildInterviewMaterialVault({
    ...context,
    interviewAttempts,
  })
}

export function buildPracticeSessionFollowUpDefense(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewFollowUpDefense {
  const queueIdSet = new Set(
    queue
      .map(item => item.id)
      .filter(questionId => Number.isFinite(questionId) && questionId > 0),
  )
  const context = buildPracticeSessionProgressContext(queue, progress)
  const interviewAttempts = Object.fromEntries(
    Object.entries(context.interviewAttempts)
      .filter(([questionId]) => queueIdSet.has(Number(questionId))),
  )

  return buildInterviewFollowUpDefense({
    ...context,
    interviewAttempts,
  })
}

export function buildPracticeSessionScriptCommand(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionScriptCommand {
  const items = queue.map((question, index) => {
    const scriptProgress = buildPracticeInterviewerScriptProgress(
      question,
      progress.interviewAttempts[question.id] ?? [],
    )
    return buildPracticeSessionScriptCommandItem(question, index, scriptProgress)
  })
  const totalSteps = items.reduce((total, item) => total + item.totalSteps, 0)
  const passedCount = items.reduce((total, item) => total + item.passedCount, 0)
  const attemptedQuestionCount = items.filter(item => item.attemptedCount > 0).length
  const status = resolveScriptCommandStatus(items)
  const sortedItems = [...items].sort(compareScriptCommandItems)
  const primaryItem = sortedItems[0]
  const progressPercent = totalSteps > 0 ? Math.round((passedCount / totalSteps) * 100) : 0

  return {
    status,
    title: resolveScriptCommandTitle(status),
    summary: resolveScriptCommandSummary(status, passedCount, totalSteps, attemptedQuestionCount),
    totalSteps,
    passedCount,
    attemptedQuestionCount,
    progressPercent,
    primaryAction: buildScriptCommandPrimaryAction(status, primaryItem),
    items: sortedItems,
  }
}

export function buildPracticeSessionMistakeLedger(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewMistakeLedger {
  return buildInterviewMistakeLedger(buildPracticeSessionScopedProgress(queue, progress))
}

export function buildPracticeSessionRecoveryAcceptance(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewRecoveryAcceptance {
  const scopedProgress = buildPracticeSessionScopedProgress(queue, progress)
  const ledger = buildInterviewMistakeLedger(scopedProgress)

  return buildInterviewRecoveryAcceptance(scopedProgress, ledger)
}

export function buildPracticeSessionAbilityRadar(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionAbilityRadar {
  const attemptItems = queue
    .map(question => ({
      question,
      attempt: latestAttemptForQuestion(progress, question.id),
    }))
    .filter((item): item is SessionAttemptItem & { attempt: InterviewAttempt } => Boolean(item.attempt))

  if (attemptItems.length === 0) {
    return {
      status: 'empty',
      title: '等待本轮开口样本',
      summary: '完成一次模拟面试后，系统会按覆盖度、结构化、场景细节和风险意识定位本轮短板。',
      answeredCount: 0,
      items: [],
      primaryAction: {
        kind: 'start',
        label: '开始模拟面试',
        description: '先完成一次开口作答，建立本轮能力雷达样本。',
        to: '/practice',
      },
    }
  }

  const answeredQuestionIds = attemptItems.map(item => item.question.id)
  const items = buildAbilityRadarItems(attemptItems, answeredQuestionIds)
  const weakestItem = [...items]
    .sort((a, b) => a.averageScore - b.averageScore || b.lowScoreQuestionIds.length - a.lowScoreQuestionIds.length)[0]
  const status = resolveAbilityRadarStatus(items)

  return {
    status,
    title: titleForAbilityRadarStatus(status, weakestItem),
    summary: summaryForAbilityRadarStatus(status, weakestItem),
    answeredCount: attemptItems.length,
    weakestItem,
    items,
    primaryAction: buildAbilityRadarPrimaryAction(status, weakestItem, attemptItems),
  }
}

export function buildPracticeSessionInterviewerDecision(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionInterviewerDecision {
  const report = buildPracticeSessionReport(queue, progress)
  const radar = buildPracticeSessionAbilityRadar(queue, progress)

  if (report.totalCount === 0 || report.answeredCount === 0) {
    return {
      status: 'empty',
      title: '等待面试样本',
      verdict: '等待面试样本',
      summary: '还没有足够的本轮开口记录，面试官视角暂时无法判断通过信号。',
      evidence: buildDecisionEvidence(report, radar),
      blockers: ['等待面试样本'],
      primaryAction: {
        kind: 'start',
        label: '建立面试样本',
        description: '先完成一次模拟面试，让系统产生可判断的面试证据。',
        to: '/practice',
      },
    }
  }

  const status = resolveInterviewerDecisionStatus(report, radar)
  const blockers = buildInterviewerDecisionBlockers(report, radar)

  return {
    status,
    title: titleForInterviewerDecisionStatus(status),
    verdict: verdictForInterviewerDecisionStatus(status),
    summary: summaryForInterviewerDecisionStatus(status, report, radar),
    evidence: buildDecisionEvidence(report, radar),
    blockers,
    primaryAction: buildInterviewerDecisionAction(status, report, radar, blockers),
  }
}

export function buildPracticeSessionActionPriorities(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = progress.updatedAt,
): PracticeSessionActionPriorities {
  const decision = buildPracticeSessionInterviewerDecision(queue, progress)
  const acceptance = buildPracticeSessionRecoveryAcceptance(queue, progress)
  const radar = buildPracticeSessionAbilityRadar(queue, progress)
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 3)

  if (decision.status === 'empty') {
    return {
      title: '等待建立行动队列',
      summary: '先完成一次模拟面试，系统才能把战报信号压缩成行动顺序。',
      totalCount: 0,
      items: [],
      primaryAction: decision.primaryAction,
    }
  }

  const candidates: PracticeSessionActionPriorityItem[] = []

  if (decision.status === 'reject-risk' || decision.status === 'hold') {
    candidates.push({
      id: 'decision',
      kind: decision.primaryAction.kind,
      label: decision.primaryAction.label,
      description: decision.primaryAction.description,
      reason: `面试官结论：${decision.verdict}`,
      to: decision.primaryAction.to,
      priority: 100,
    })
  }

  if (['failed', 'pending', 'testing'].includes(acceptance.status)) {
    candidates.push({
      id: 'recovery-acceptance',
      kind: 'repair',
      label: acceptance.primaryAction.label,
      description: acceptance.primaryAction.description,
      reason: acceptance.summary,
      to: acceptance.primaryAction.to,
      priority: 90,
    })
  }

  if (radar.status === 'risk' || radar.status === 'watch') {
    candidates.push({
      id: 'ability-radar',
      kind: 'repair',
      label: radar.primaryAction.label,
      description: radar.primaryAction.description,
      reason: radar.summary,
      to: radar.primaryAction.to,
      priority: 80,
    })
  }

  candidates.push({
    id: 'next-training',
    kind: 'continue',
    label: nextQueue.primaryAction.label,
    description: nextQueue.primaryAction.description,
    reason: nextQueue.summary,
    to: nextQueue.primaryAction.to,
    priority: 10,
  })

  const items = uniquePriorityItems(candidates)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
  const primaryItem = items[0]

  return {
    title: '已生成执行队列',
    summary: `已把战报信号压缩成 ${items.length} 个动作，按顺序执行即可。`,
    totalCount: items.length,
    items,
    primaryAction: primaryItem
      ? {
        kind: primaryItem.kind,
        label: primaryItem.label,
        description: primaryItem.description,
        to: primaryItem.to,
      }
      : decision.primaryAction,
  }
}

export function buildPracticeSessionEvidenceGaps(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionEvidenceGaps {
  const sessionItems = queue.map(question => ({
    question,
    attempt: latestAttemptForQuestion(progress, question.id),
  }))
  const answeredItems = sessionItems.filter((item): item is SessionAttemptItem & { attempt: InterviewAttempt } => (
    Boolean(item.attempt)
  ))

  if (queue.length === 0 || answeredItems.length === 0) {
    return {
      status: 'empty',
      title: '等待生成证据缺口',
      summary: '先完成一次模拟面试，系统才能定位会被面试官继续追问的证据漏洞。',
      totalCount: 0,
      criticalCount: 0,
      items: [],
      primaryAction: {
        kind: 'start',
        label: '建立证据样本',
        description: '先完成一次开口作答，让系统生成可分析的证据链。',
        to: queue.length > 0 ? buildQueuePath(queue.map(item => item.id)) : '/practice',
      },
    }
  }

  const candidates = answeredItems
    .flatMap(item => buildEvidenceGapItems(item.question, item.attempt))
    .sort((a, b) => b.priority - a.priority)
  const items = candidates.slice(0, 3)
  const criticalCount = candidates.filter(item => item.score < CRITICAL_EVIDENCE_GAP_SCORE).length

  if (items.length === 0) {
    return {
      status: 'ready',
      title: '证据链暂稳',
      summary: `本轮 ${answeredItems.length} 道已答题没有低于 ${EVIDENCE_GAP_SCORE} 分的证据维度，继续复测保持稳定。`,
      totalCount: 0,
      criticalCount: 0,
      items: [],
      primaryAction: {
        kind: 'continue',
        label: '继续复测',
        description: '用下一轮训练继续验证证据链是否稳定。',
        to: buildQueuePath(queue.map(item => item.id)),
      },
    }
  }

  const primaryQuestionIds = uniqueNumbers(items.map(item => item.questionId))

  return {
    status: criticalCount > 0 ? 'blocked' : 'watch',
    title: criticalCount > 0 ? '证据链会被追问' : '证据链需要加固',
    summary: `发现 ${items.length} 个最容易被继续追问的证据缺口，先补题目场景、指标和边界。`,
    totalCount: candidates.length,
    criticalCount,
    items,
    primaryAction: {
      kind: 'repair',
      label: '修补证据缺口',
      description: `${items[0].criterionLabel} ${items[0].score} 分，先补可被追问的项目证据。`,
      to: buildQueuePath(primaryQuestionIds),
    },
  }
}

export function buildPracticeSessionReplayCards(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionReplayCards {
  const evidenceGaps = buildPracticeSessionEvidenceGaps(queue, progress)

  if (evidenceGaps.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成复述卡',
      summary: '先完成一次模拟面试，系统才能把证据缺口改写成 60 秒复述卡。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: 'start',
        label: '建立复述样本',
        description: '先完成一次开口作答，再生成可复述的修复脚本。',
        to: evidenceGaps.primaryAction.to,
      },
    }
  }

  if (evidenceGaps.items.length > 0) {
    const items = evidenceGaps.items.slice(0, 3).map(buildReplayCardFromGap)

    return {
      status: 'repair',
      title: '按缺口重答',
      summary: `已把 ${items.length} 个证据缺口压缩成 60 秒复述卡，照着开口即可。`,
      totalCount: items.length,
      items,
      primaryAction: {
        kind: 'repair',
        label: '开始60秒复述',
        description: '按复述卡重答首要证据缺口。',
        to: evidenceGaps.primaryAction.to,
      },
    }
  }

  const answeredItems = queue
    .map(question => ({
      question,
      attempt: latestAttemptForQuestion(progress, question.id),
    }))
    .filter((item): item is SessionAttemptItem & { attempt: InterviewAttempt } => Boolean(item.attempt))
  const items = answeredItems.slice(0, 3).map(buildStableReplayCard)

  return {
    status: 'ready',
    title: '稳定复述保持手感',
    summary: `本轮暂无高危证据缺口，已生成 ${items.length} 张稳定复述卡用于保持通过表现。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: 'continue',
      label: '继续60秒复述',
      description: '用稳定卡继续复述，保持结论、证据和边界完整。',
      to: buildQueuePath(queue.map(item => item.id)),
    },
  }
}

export function buildPracticeSessionReplayChecklist(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionReplayChecklist {
  const replayCards = buildPracticeSessionReplayCards(queue, progress)

  if (replayCards.items.length === 0) {
    return {
      status: 'empty',
      title: '等待生成验收清单',
      summary: '先完成一次模拟面试并生成复述卡，系统才能给出提交前自查标准。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: replayCards.primaryAction.kind,
        label: '建立验收样本',
        description: '先完成一次开口作答，再生成复述验收清单。',
        to: replayCards.primaryAction.to,
      },
    }
  }

  const items = buildReplayChecklistItems(replayCards.primaryAction.to)

  return {
    status: replayCards.status === 'repair' ? 'checking' : 'ready',
    title: replayCards.status === 'repair' ? '提交前必须自查' : '稳定复述自查',
    summary: `按 ${items.length} 个验收点检查复述内容，全部满足后再进入下一轮评分。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: replayCards.primaryAction.kind,
      label: '按清单重答',
      description: '用复述卡回答前，先按清单自查结论、证据和边界。',
      to: replayCards.primaryAction.to,
    },
  }
}

export function buildPracticeSessionPressureProbes(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionPressureProbes {
  const replayCards = buildPracticeSessionReplayCards(queue, progress)

  if (replayCards.items.length === 0) {
    return {
      status: 'empty',
      title: '等待生成压力追问',
      summary: '先完成一次模拟面试并生成复述卡，系统才能把复述内容推到现场追问。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: replayCards.primaryAction.kind,
        label: '建立压力样本',
        description: '先完成一次开口作答，再生成可连续追问的压力卡。',
        to: replayCards.primaryAction.to,
      },
    }
  }

  const items = buildPressureProbeItems(replayCards.items, replayCards.primaryAction.to)

  return {
    status: replayCards.status === 'repair' ? 'pressure' : 'ready',
    title: replayCards.status === 'repair' ? '三连问压测' : '高分追问保温',
    summary: `已把复述卡升级成 ${items.length} 个现场追问，按顺序回答即可验证抗压稳定性。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: replayCards.primaryAction.kind,
      label: '开始压力追问',
      description: '按落地证据、失败边界和技术取舍连续回答。',
      to: replayCards.primaryAction.to,
    },
  }
}

export function buildPracticeSessionRiskGuardrails(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionRiskGuardrails {
  const probes = buildPracticeSessionPressureProbes(queue, progress)

  if (probes.items.length === 0) {
    return {
      status: 'empty',
      title: '等待生成失分禁区',
      summary: '先完成一次模拟面试并生成压力追问，系统才能定位重答时最容易踩的表达禁区。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: probes.primaryAction.kind,
        label: '建立禁区样本',
        description: '先完成一次开口作答，再生成本轮失分禁区。',
        to: probes.primaryAction.to,
      },
    }
  }

  const items = buildRiskGuardrailItems(probes.primaryAction.to)

  return {
    status: probes.status === 'pressure' ? 'warning' : 'ready',
    title: probes.status === 'pressure' ? '重答前先避坑' : '高分表达护栏',
    summary: `已生成 ${items.length} 条本轮失分禁区，把高风险表达替换后再重答。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: probes.primaryAction.kind,
      label: '避开失分禁区',
      description: '重答前先替换空泛、无边界和只背答案的表达。',
      to: probes.primaryAction.to,
    },
  }
}

export function buildPracticeSessionRetryDrafts(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionRetryDrafts {
  const replayCards = buildPracticeSessionReplayCards(queue, progress)
  const guardrails = buildPracticeSessionRiskGuardrails(queue, progress)

  if (replayCards.items.length === 0) {
    return {
      status: 'empty',
      title: '等待生成二次提交稿',
      summary: '先完成一次模拟面试并生成复述卡，系统才能把修复信号合并成可重答草稿。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: replayCards.primaryAction.kind,
        label: '建立提交样本',
        description: '先完成一次开口作答，再生成本轮二次提交稿。',
        to: replayCards.primaryAction.to,
      },
    }
  }

  const items = replayCards.items.slice(0, 3).map(buildRetryDraftItem)

  return {
    status: guardrails.status === 'warning' || replayCards.status === 'repair' ? 'repair' : 'ready',
    title: guardrails.status === 'warning' ? '重答稿已生成' : '稳定提交稿',
    summary: `已把 ${items.length} 张复述卡合并成二次提交稿，按结论、证据、边界和收束重答。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: replayCards.primaryAction.kind,
      label: '使用二次提交稿',
      description: '按稿重答前，先替换掉失分禁区里的高风险表达。',
      to: replayCards.primaryAction.to,
    },
  }
}

export function buildPracticeSessionPassGate(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionPassGate {
  const report = buildPracticeSessionReport(queue, progress)
  const radar = buildPracticeSessionAbilityRadar(queue, progress)
  const retryDrafts = buildPracticeSessionRetryDrafts(queue, progress)

  if (report.totalCount === 0 || report.answeredCount === 0) {
    return {
      status: 'empty',
      title: '等待生成通过门槛',
      summary: '先完成一次模拟面试，系统才能把本轮表现换算成进入下一轮前的硬门槛。',
      passedCount: 0,
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: report.primaryAction.kind,
        label: '建立通过样本',
        description: '先完成一次开口作答，再判断本轮是否能进入下一轮。',
        to: report.primaryAction.to,
      },
    }
  }

  const unansweredCount = Math.max(report.totalCount - report.answeredCount, 0)
  const queuePath = report.queueProfile.queuePath
  const items = buildPassGateItems(report, radar, retryDrafts, unansweredCount, queuePath)
  const passedCount = items.filter(item => item.status === 'ready').length
  const blockedItem = items.find(item => item.status === 'blocked')

  if (blockedItem) {
    return {
      status: 'blocked',
      title: '暂缓进入下一轮',
      summary: `先处理「${blockedItem.label}」：${blockedItem.action}。`,
      passedCount,
      totalCount: items.length,
      items,
      primaryAction: {
        kind: 'repair',
        label: '修复通过门槛',
        description: `${blockedItem.label} 未达标，先回到本轮队列完成修复。`,
        to: queuePath,
      },
    }
  }

  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, progress.updatedAt, 5)

  return {
    status: 'ready',
    title: '可以进入下一轮',
    summary: `本轮 ${items.length} 个通过门槛全部满足，可以带着二次提交稿进入下一轮加压训练。`,
    passedCount,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: 'continue',
      label: '进入下一轮训练',
      description: '本轮已达到推进标准，继续用个性化队列加压。',
      to: nextQueue.primaryAction.to,
    },
  }
}

export function buildPracticeSessionPassEvidence(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionPassEvidence {
  const report = buildPracticeSessionReport(queue, progress)
  const radar = buildPracticeSessionAbilityRadar(queue, progress)
  const retryDrafts = buildPracticeSessionRetryDrafts(queue, progress)
  const passGate = buildPracticeSessionPassGate(queue, progress)

  if (passGate.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成过线证据包',
      summary: '先完成一次模拟面试，系统才能沉淀评分、完成度、弱项和提交稿证据。',
      totalCount: 0,
      items: [],
      primaryAction: {
        kind: passGate.primaryAction.kind,
        label: '建立证据样本',
        description: '先完成一次开口作答，再生成本轮过线证据包。',
        to: passGate.primaryAction.to,
      },
    }
  }

  const items = buildPassEvidenceItems(report, radar, retryDrafts)
  const ready = passGate.status === 'ready'

  return {
    status: ready ? 'ready' : 'blocked',
    title: ready ? '过线证据已齐' : '过线证据不足',
    summary: ready
      ? `已沉淀 ${items.length} 条过线证据，可以解释为什么本轮允许进入下一轮。`
      : `已沉淀 ${items.length} 条复盘证据，先按证据包修复低分、弱项和提交稿。`,
    totalCount: items.length,
    items,
    primaryAction: {
      kind: passGate.primaryAction.kind,
      label: ready ? '带证据进入下一轮' : '复核过线证据',
      description: ready ? '带着本轮证据包进入下一轮加压。' : '按证据包回到本轮队列，先补齐过线缺口。',
      to: passGate.primaryAction.to,
    },
  }
}

export function buildPracticeSessionTrainingContract(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionTrainingContract {
  const report = buildPracticeSessionReport(queue, progress)
  const passGate = buildPracticeSessionPassGate(queue, progress)
  const passEvidence = buildPracticeSessionPassEvidence(queue, progress)
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)

  if (passGate.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成训练契约',
      summary: '先完成一次模拟面试，系统才能把本轮表现转成下一轮训练契约。',
      items: [],
      primaryAction: {
        kind: passGate.primaryAction.kind,
        label: '建立契约样本',
        description: '先完成一次开口作答，再生成下一轮训练契约。',
        to: passGate.primaryAction.to,
      },
    }
  }

  const repairMode = passGate.status === 'blocked'
  const targetScore = Math.max(STRONG_SESSION_SCORE, report.averageScore + 8)
  const contractQueuePath = repairMode ? report.queueProfile.queuePath : nextQueue.primaryAction.to
  const evidenceFocus = passEvidence.items[0]?.label ?? '评分证据'
  const items = buildTrainingContractItems({
    report,
    targetScore,
    queueSize: repairMode ? report.totalCount : nextQueue.items.length,
    queuePath: contractQueuePath,
    evidenceFocus,
    repairMode,
  })

  return {
    status: repairMode ? 'repair' : 'advance',
    title: repairMode ? '先签修复契约' : '可以签下一轮契约',
    summary: repairMode
      ? `下一轮先回到本轮 ${report.totalCount} 道题，把均分补到 ${targetScore} 分并清掉弱项。`
      : `下一轮进入 ${nextQueue.items.length} 道个性化题组，保持 ${targetScore} 分以上强通过。`,
    items,
    primaryAction: {
      kind: repairMode ? 'repair' : 'continue',
      label: '执行训练契约',
      description: repairMode ? '按契约回到本轮队列修复低分和弱项。' : '按契约进入下一轮个性化训练。',
      to: contractQueuePath,
    },
  }
}

export function buildPracticeSessionTrainingSchedule(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionTrainingSchedule {
  const report = buildPracticeSessionReport(queue, progress)
  const passGate = buildPracticeSessionPassGate(queue, progress)
  const contract = buildPracticeSessionTrainingContract(queue, progress, now)
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)

  if (contract.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成训练日程',
      summary: '先完成一次模拟面试，系统才能把训练契约拆成可执行日程。',
      totalMinutes: 0,
      items: [],
      primaryAction: {
        kind: passGate.primaryAction.kind,
        label: '建立日程样本',
        description: '先完成一次开口作答，再生成下一轮训练日程。',
        to: passGate.primaryAction.to,
      },
    }
  }

  const repairMode = contract.status === 'repair'
  const queuePath = contract.primaryAction.to
  const targetScore = contract.items.find(item => item.id === 'target-score')?.value ?? `${STRONG_SESSION_SCORE} 分以上`
  const queueLabel = contract.items.find(item => item.id === 'training-queue')?.value
    ?? `${repairMode ? report.totalCount : nextQueue.items.length} 道题，入口 ${queuePath}`
  const evidenceFocus = contract.items.find(item => item.id === 'evidence-reference')?.value ?? '评分证据'
  const scheduleItems = buildTrainingScheduleItems({
    repairMode,
    queuePath,
    targetScore,
    queueLabel,
    evidenceFocus,
    repairCount: report.repairActions.length,
  })

  return {
    status: repairMode ? 'repair' : 'advance',
    title: repairMode ? '修复日程已排好' : '推进日程已排好',
    summary: repairMode
      ? `用 ${scheduleItems.length} 个时间块先修复本轮缺口，再判断是否进入下一轮。`
      : `用 ${scheduleItems.length} 个时间块完成下一轮预热、作答和证据复盘。`,
    totalMinutes: repairMode ? 35 : 32,
    items: scheduleItems,
    primaryAction: {
      kind: repairMode ? 'repair' : 'continue',
      label: '执行日程',
      description: repairMode ? '按时间块回到本轮队列完成修复。' : '按时间块进入下一轮个性化训练。',
      to: queuePath,
    },
  }
}

export function buildPracticeSessionScheduleChecklist(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionScheduleChecklist {
  const schedule = buildPracticeSessionTrainingSchedule(queue, progress, now)

  if (schedule.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成打卡清单',
      summary: '先生成下一轮训练日程，再把每个时间块转成可核销的打卡证据。',
      items: [],
      primaryAction: {
        kind: schedule.primaryAction.kind,
        label: '建立打卡样本',
        description: '先完成一次模拟面试并生成训练日程。',
        to: schedule.primaryAction.to,
      },
    }
  }

  const items = schedule.items.map(item => buildScheduleChecklistItem(item, schedule.status))

  return {
    status: schedule.status,
    title: schedule.status === 'repair' ? '修复打卡清单' : '推进打卡清单',
    summary: `已把 ${items.length} 个时间块转成完成口径、证据模板和复盘问题。`,
    items,
    primaryAction: {
      kind: schedule.primaryAction.kind,
      label: '按清单打卡',
      description: '按清单逐项留下完成证据，再进入下一轮判断。',
      to: schedule.primaryAction.to,
    },
  }
}

export function buildPracticeSessionTrainingReceipt(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionTrainingReceipt {
  const contract = buildPracticeSessionTrainingContract(queue, progress, now)
  const checklist = buildPracticeSessionScheduleChecklist(queue, progress, now)

  if (checklist.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成训练回执',
      summary: '先完成一次模拟面试并生成打卡清单，再填写训练回执。',
      items: [],
      primaryAction: {
        kind: checklist.primaryAction.kind,
        label: '建立回执样本',
        description: '先完成一次模拟面试，让系统生成可填写的训练回执。',
        to: checklist.primaryAction.to,
      },
    }
  }

  const repairMode = checklist.status === 'repair'
  const items = buildTrainingReceiptItems({
    contract,
    checklist,
    repairMode,
  })

  return {
    status: checklist.status,
    title: repairMode ? '修复回执模板' : '推进回执模板',
    summary: repairMode
      ? '把修复目标、完成证据、阻断项和下一步写清楚，避免低分问题反复出现。'
      : '把推进目标、完成证据、剩余风险和下一步写清楚，确保下一轮继续增压。',
    items,
    primaryAction: {
      kind: checklist.primaryAction.kind,
      label: '填写训练回执',
      description: '按模板记录本轮训练结果，再进入下一轮判断。',
      to: checklist.primaryAction.to,
    },
  }
}

export function buildPracticeSessionReceiptAcceptance(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionReceiptAcceptance {
  const receipt = buildPracticeSessionTrainingReceipt(queue, progress, now)

  if (receipt.status === 'empty') {
    return {
      status: 'empty',
      title: '等待验收训练回执',
      summary: '先生成训练回执模板，再检查目标、证据、阻断和下一步是否闭环。',
      items: [],
      primaryAction: {
        kind: receipt.primaryAction.kind,
        label: '建立验收样本',
        description: '先完成一次模拟面试并生成训练回执。',
        to: receipt.primaryAction.to,
      },
    }
  }

  const repairMode = receipt.status === 'repair'
  const items = buildReceiptAcceptanceItems(receipt, repairMode)

  return {
    status: receipt.status,
    title: repairMode ? '修复回执待验收' : '推进回执待验收',
    summary: repairMode
      ? '先确认目标、证据、阻断和下一步都写清，再决定是否继续修复。'
      : '先确认回执足够支撑加压，再进入下一轮个性化训练。',
    items,
    primaryAction: {
      kind: receipt.primaryAction.kind,
      label: '验收训练回执',
      description: '按验收卡检查回执质量，再决定是否推进下一轮。',
      to: receipt.primaryAction.to,
    },
  }
}

export function buildPracticeSessionAdvanceGate(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionAdvanceGate {
  const acceptance = buildPracticeSessionReceiptAcceptance(queue, progress, now)

  if (acceptance.status === 'empty') {
    return {
      status: 'empty',
      title: '等待建立准入样本',
      summary: '先生成训练回执和回执验收卡，再判断是否能进入下一轮。',
      items: [],
      primaryAction: {
        kind: acceptance.primaryAction.kind,
        label: '建立准入样本',
        description: '先完成一次模拟面试并生成回执验收卡。',
        to: acceptance.primaryAction.to,
      },
    }
  }

  const blocked = acceptance.status === 'repair'
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)

  return {
    status: blocked ? 'blocked' : 'ready',
    title: blocked ? '暂缓进入下一轮' : '允许进入下一轮',
    summary: blocked
      ? '本轮回执仍有准入条件需要先修复，先不要把问题带进下一轮。'
      : '回执验收条件已经满足，可以进入下一轮个性化训练。',
    items: buildAdvanceGateItems(acceptance, blocked),
    primaryAction: {
      kind: blocked ? 'repair' : 'continue',
      label: blocked ? '回到本轮修复' : '进入下一轮训练',
      description: blocked ? '按未通过条件回修本轮，再重新验收。' : '带着已通过的回执进入下一轮训练。',
      to: blocked ? acceptance.primaryAction.to : nextQueue.primaryAction.to,
    },
  }
}

export function buildPracticeSessionLaunchPacket(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionLaunchPacket {
  const gate = buildPracticeSessionAdvanceGate(queue, progress, now)

  if (gate.status === 'empty') {
    return {
      status: 'empty',
      title: '等待建立启动样本',
      summary: '先完成准入闸门判断，再生成可执行的下一轮启动包。',
      items: [],
      primaryAction: {
        kind: gate.primaryAction.kind,
        label: '建立启动样本',
        description: '先完成一次模拟面试并生成准入闸门。',
        to: gate.primaryAction.to,
      },
    }
  }

  const repairMode = gate.status === 'blocked'
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)
  const items = buildLaunchPacketItems({
    gate,
    nextQueue,
    repairMode,
  })

  return {
    status: repairMode ? 'repair' : 'ready',
    title: repairMode ? '回修启动包' : '下一轮启动包',
    summary: repairMode
      ? '先按准入闸门回修本轮阻断项，再重新验收。'
      : '准入已经通过，按启动包进入下一轮训练并留下第一条样本。',
    items,
    primaryAction: {
      kind: repairMode ? 'repair' : 'continue',
      label: repairMode ? '启动回修' : '启动下一轮',
      description: repairMode ? '打开本轮队列，先清掉第一个阻断项。' : '打开下一轮队列，完成第一题开口样本。',
      to: gate.primaryAction.to,
    },
  }
}

export function buildPracticeSessionLaunchChecklist(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionLaunchChecklist {
  const packet = buildPracticeSessionLaunchPacket(queue, progress, now)

  if (packet.status === 'empty') {
    return {
      status: 'empty',
      title: '等待生成启动执行清单',
      summary: '先生成下一轮启动包，再把启动动作转成可核销证据。',
      items: [],
      primaryAction: {
        kind: packet.primaryAction.kind,
        label: '建立执行样本',
        description: '先完成一次模拟面试并生成下一轮启动包。',
        to: packet.primaryAction.to,
      },
    }
  }

  const repairMode = packet.status === 'repair'

  return {
    status: packet.status,
    title: repairMode ? '回修执行清单' : '下一轮执行清单',
    summary: repairMode
      ? '把回修启动动作转成证据模板，确保阻断项被真实处理。'
      : '把下一轮启动动作转成证据模板，确保第一条训练样本留下来。',
    items: buildLaunchChecklistItems(packet, repairMode),
    primaryAction: {
      kind: packet.primaryAction.kind,
      label: '按清单执行',
      description: '按执行清单留下证据，再进入下一轮战报判断。',
      to: packet.primaryAction.to,
    },
  }
}

export function buildPracticeSessionFirstQuestionRehearsal(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionFirstQuestionRehearsal {
  const checklist = buildPracticeSessionLaunchChecklist(queue, progress, now)
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)

  if (checklist.status === 'empty' || checklist.items.length === 0) {
    return {
      status: 'empty',
      title: '等待首题预演',
      summary: '先生成启动执行清单，再把下一步动作压缩成可开口的首题预演。',
      questionTitle: '暂无首题',
      reason: '缺少启动执行清单，暂时无法判断第一题或第一项回修动作。',
      openingPrompt: '先完成一次模拟面试，让系统生成启动执行清单。',
      passSignal: '启动执行清单生成后，再进入首题预演。',
      evidenceRequirement: '暂无证据要求。',
      primaryAction: {
        kind: checklist.primaryAction.kind,
        label: '建立首题预演',
        description: '先完成一次模拟面试并生成启动执行清单。',
        to: checklist.primaryAction.to,
      },
    }
  }

  const repairMode = checklist.status === 'repair'
  const firstChecklistItem = checklist.items[0]

  if (repairMode) {
    return {
      status: 'repair',
      title: '回修首题预演',
      summary: '准入仍未放行，先把启动清单第一项当成本轮回修首题。',
      questionTitle: firstChecklistItem.phase,
      reason: `准入闸门还在阻断状态，先处理「${firstChecklistItem.phase}」，避免把缺口带入下一轮。`,
      openingPrompt: buildFirstQuestionRepairOpeningPrompt(firstChecklistItem),
      passSignal: firstChecklistItem.completionRule,
      evidenceRequirement: firstChecklistItem.evidenceTemplate,
      primaryAction: {
        kind: 'repair',
        label: '启动回修预演',
        description: '进入回修入口，先完成第一项可核销动作。',
        to: firstChecklistItem.to,
      },
    }
  }

  const firstNextItem = nextQueue.items[0]

  if (!firstNextItem) {
    return {
      status: 'empty',
      title: '等待首题预演',
      summary: '启动执行清单已经生成，但下一轮训练队列暂时没有题目。',
      questionTitle: '暂无首题',
      reason: '下一轮训练队列为空，暂时无法生成首题开场。',
      openingPrompt: '先把题目加入今日计划或完成一次新的模拟面试。',
      passSignal: '下一轮队列出现第一道题后，再生成开场预演。',
      evidenceRequirement: '暂无证据要求。',
      primaryAction: {
        kind: checklist.primaryAction.kind,
        label: '生成首题预演',
        description: '先进入训练入口，让系统生成下一轮题目。',
        to: checklist.primaryAction.to,
      },
    }
  }

  return {
    status: 'ready',
    title: '下一轮首题预演',
    summary: '已把下一轮第一题转成开场提示、通过信号和证据要求。',
    questionTitle: firstNextItem.title,
    reason: `${firstNextItem.sourceLabel}：${firstNextItem.reason}`,
    openingPrompt: buildFirstQuestionOpeningPrompt(firstNextItem),
    passSignal: buildFirstQuestionPassSignal(firstNextItem),
    evidenceRequirement: buildFirstQuestionEvidenceRequirement(firstNextItem),
    primaryAction: {
      kind: 'continue',
      label: '开始首题预演',
      description: '进入下一轮第一题，先留下新的评分样本。',
      to: firstNextItem.to,
    },
  }
}

export function buildPracticeSessionFirstQuestionRubric(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): PracticeSessionFirstQuestionRubric {
  const rehearsal = buildPracticeSessionFirstQuestionRehearsal(queue, progress, now)

  if (rehearsal.status === 'empty') {
    return {
      status: 'empty',
      title: '等待首题验收尺',
      summary: '先生成首题预演卡，再把开口动作拆成可核验标准。',
      items: [],
      primaryAction: {
        kind: rehearsal.primaryAction.kind,
        label: '建立验收尺',
        description: '先生成首题预演，再建立首题验收口径。',
        to: rehearsal.primaryAction.to,
      },
    }
  }

  const repairMode = rehearsal.status === 'repair'

  return {
    status: rehearsal.status,
    title: repairMode ? '回修首题验收尺' : '下一轮首题验收尺',
    summary: repairMode
      ? '用 4 条硬口径确认第一项阻断是否被真实修掉。'
      : '用 4 条硬口径确认第一题是否形成可评分样本。',
    items: buildFirstQuestionRubricItems(rehearsal, repairMode),
    primaryAction: {
      kind: rehearsal.primaryAction.kind,
      label: '按验收尺执行',
      description: repairMode ? '进入回修入口，按 4 条验收点逐项核销。' : '进入首题，按 4 条验收点留下评分样本。',
      to: rehearsal.primaryAction.to,
    },
  }
}

export function buildPracticeSessionRepairDraft(action: PracticeSessionRepairAction): string {
  const hints = repairDraftHints(action.criterionKey)
  const criterionScore = typeof action.criterionScore === 'number' ? ` ${action.criterionScore} 分` : ''

  return [
    `补弱题目：${action.title}`,
    `补弱维度：${action.criterionLabel}${criterionScore}`,
    `补弱原因：${action.reason}`,
    `本次目标：${action.action}`,
    '',
    '我的重答：',
    `结论：${hints.conclusion}`,
    `原因：${hints.reason}`,
    `场景：${hints.scenario}`,
    `边界：${hints.boundary}`,
  ].join('\n')
}

function renderSessionSummary(report: PracticeSessionReport): string {
  return [
    '## 本轮摘要',
    `- 状态：${report.title}`,
    `- 说明：${report.summary}`,
    `- 已答：${report.answeredCount}/${report.totalCount}`,
    `- 平均分：${report.averageScore}`,
    `- 通过数：${report.passCount}`,
    `- 低分/薄弱题：${formatQuestionIds(report.weakQuestionIds)}`,
    '',
  ].join('\n')
}

function renderSessionMetrics(metrics: PracticeSessionReportMetric[]): string {
  return [
    '## 核心指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}

function renderSessionQueueProfile(profile: PracticeSessionQueueProfile): string {
  if (profile.isEmpty) {
    return [
      '## 队列画像',
      '- 暂无队列画像。先从学习计划、薄弱题或题库进入模拟面试。',
      '',
    ].join('\n')
  }

  return [
    '## 队列画像',
    `- 来源构成：${profile.sourceSummary}`,
    `- 下一题：${profile.nextQuestionTitle}（${profile.nextQuestionMeta}）`,
    `- 未答题：${formatQuestionIds(profile.unansweredQuestionIds)}`,
    `- 低分/薄弱题：${formatQuestionIds(profile.weakQuestionIds)}`,
    `- 队列入口：${profile.queuePath}`,
    '',
  ].join('\n')
}

function renderSessionDailyClosure(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const completion = buildPracticeSessionDailyCompletion(queue, progress, now)
  const riskCount = completion.reviewDebtCount + completion.weakCount
  const impactLines = completion.statusImpacts.length > 0
    ? completion.statusImpacts.slice(0, 4).map(impact => (
      `- 评分影响：${impact.title}，${impact.score} 分，${impact.message}；行动：${impact.actionLabel}；入口：${impact.to}`
    ))
    : ['- 评分影响：暂无计划内模拟面试评分。']

  return [
    '## 今日闭环快照',
    `- 状态：${completion.title}`,
    `- 摘要：${completion.summary}`,
    `- 完成率：${completion.completionRate}%`,
    `- 风险项：${riskCount}`,
    `- 今日模拟：${completion.interviewTodayCount} 次`,
    `- 主行动：${completion.primaryAction.label}，${completion.primaryAction.description}（${completion.primaryAction.to}）`,
    ...impactLines,
    '',
  ].join('\n')
}

function renderSessionMaterialVault(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): string {
  const vault = buildPracticeSessionMaterialVault(queue, progress)
  const lines = [
    '## 本轮高分素材',
    `- 状态：${vault.title}`,
    `- 摘要：${vault.summary}`,
    `- 主行动：${vault.primaryAction.label}，${vault.primaryAction.description}（${vault.primaryAction.to}）`,
    '',
  ]

  if (vault.snippets.length === 0) {
    return [
      ...lines,
      '- 暂无本轮高分素材。完成 80 分以上模拟回答后，战报会自动沉淀可复用表达。',
      '',
    ].join('\n')
  }

  vault.snippets.slice(0, 5).forEach((snippet, index) => {
    lines.push(
      `${index + 1}. ${snippet.title}`,
      `   - 类型：${snippet.label}`,
      `   - 得分：${snippet.score} 分`,
      `   - 片段：${snippet.content}`,
      `   - 原因：${snippet.reason}`,
      `   - 入口：${snippet.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionFollowUpDefense(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): string {
  const defense = buildPracticeSessionFollowUpDefense(queue, progress)
  const lines = [
    '## 本轮追问防线',
    `- 状态：${defense.title}`,
    `- 摘要：${defense.summary}`,
    `- 主行动：${defense.primaryAction.label}，${defense.primaryAction.description}（${defense.primaryAction.to}）`,
    '',
  ]

  if (defense.items.length === 0) {
    return [
      ...lines,
      '- 暂无本轮追问防线。完成一次模拟面试后，战报会自动生成可防守追问。',
      '',
    ].join('\n')
  }

  defense.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 维度：${item.criterionLabel}`,
      `   - 得分：${item.score} 分`,
      `   - 追问：${item.prompt}`,
      `   - 压力点：${item.pressurePoint}`,
      `   - 回答引导：${item.answerGuide}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionScriptCommand(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const command = buildPracticeSessionScriptCommand(queue, progress)
  const repairCount = command.items.filter(item => item.status === 'repair').length
  const lines = [
    '## 本轮脚本总控',
    `- 状态：${command.title}`,
    `- 总进度：${command.passedCount} / ${command.totalSteps}（${command.progressPercent}%）`,
    `- 修复中：${repairCount} 道`,
    `- 主行动：${command.primaryAction.label}，${command.primaryAction.description}（${command.primaryAction.to}）`,
    '',
  ]

  if (command.items.length === 0) {
    return [
      ...lines,
      '- 暂无本轮脚本总控。先建立练习队列，再完成本题面试官脚本。',
      '',
    ].join('\n')
  }

  command.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 脚本阶段：${item.scriptTitle}`,
      `   - 进度：${item.passedCount} / ${item.totalSteps}（${item.progressPercent}%）`,
      `   - 状态：${scriptCommandItemStatusLabel(item.status)}`,
      `   - 下一问：${item.nextPrompt || '本题脚本已通过，可以复练或沉淀素材。'}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionMistakeLedger(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const ledger = buildPracticeSessionMistakeLedger(queue, progress)
  const recoveryPlan = buildInterviewRecoveryPlan(ledger)
  const lines = [
    '## 本轮错因账本',
    `- 状态：${ledger.title}`,
    `- 摘要：${ledger.summary}`,
    `- 问题数：${ledger.totalProblems}`,
    `- 修复计划：${recoveryPlan.title}，${recoveryPlan.totalMinutes} 分钟`,
    `- 主行动：${ledger.primaryAction.label}，${ledger.primaryAction.description}（${ledger.primaryAction.to}）`,
    '',
  ]

  if (ledger.items.length === 0) {
    return [
      ...lines,
      '- 暂无本轮错因账本。完成一次模拟面试后，战报会自动定位错因。',
      '',
    ].join('\n')
  }

  ledger.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 类型：${item.type}`,
      `   - 平均分：${item.averageScore}`,
      `   - 影响题目：${formatQuestionIds(item.affectedQuestionIds)}`,
      `   - 最近题目：${item.latestQuestionTitle}`,
      `   - 动作：${item.actionLabel}`,
      `   - 入口：${item.to}`,
    )
  })

  lines.push('', '修复计划：')
  recoveryPlan.steps.slice(0, 3).forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}，${step.durationMinutes} 分钟，入口：${step.to}`)
  })

  return [...lines, ''].join('\n')
}

function renderSessionRecoveryAcceptance(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const acceptance = buildPracticeSessionRecoveryAcceptance(queue, progress)

  return [
    '## 本轮错因验收',
    `- 状态：${acceptance.title}`,
    `- 摘要：${acceptance.summary}`,
    `- 通过：${acceptance.passedCount} / ${acceptance.totalCount}`,
    `- 失败题：${formatQuestionIds(acceptance.failedQuestionIds)}`,
    `- 待复测：${formatQuestionIds(acceptance.pendingQuestionIds)}`,
    `- 主行动：${acceptance.primaryAction.label}，${acceptance.primaryAction.description}（${acceptance.primaryAction.to}）`,
    '',
  ].join('\n')
}

function renderSessionAbilityRadar(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const radar = buildPracticeSessionAbilityRadar(queue, progress)
  const weakestItem = radar.weakestItem
  const lines = [
    '## 本轮薄弱能力雷达',
    `- 状态：${radar.title}`,
    `- 摘要：${radar.summary}`,
    `- 已答：${radar.answeredCount}`,
    `- 最弱维度：${weakestItem?.label ?? '暂无'}`,
    `- 平均分：${weakestItem?.averageScore ?? 0}`,
    `- 影响题：${formatQuestionIds(weakestItem?.lowScoreQuestionIds ?? [])}`,
    `- 主行动：${radar.primaryAction.label}，${radar.primaryAction.description}（${radar.primaryAction.to}）`,
    '',
  ]

  if (radar.items.length === 0) {
    return [
      ...lines,
      '- 暂无维度明细。先完成一次模拟面试后，战报会自动生成能力雷达。',
      '',
    ].join('\n')
  }

  lines.push('维度明细：')
  radar.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}：${item.averageScore} 分，${item.attempts} 次，影响题 ${formatQuestionIds(item.lowScoreQuestionIds)}`,
      `   - 建议：${item.summary}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionInterviewerDecision(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const decision = buildPracticeSessionInterviewerDecision(queue, progress)
  const blockers = decision.blockers.length > 0 ? decision.blockers : ['暂无硬阻断']

  return [
    '## 本轮面试官决策卡',
    `- 结论：${decision.verdict}`,
    `- 状态：${decision.title}`,
    `- 摘要：${decision.summary}`,
    ...decision.evidence.map(item => `- 证据：${item.label} ${item.value}，${item.detail}`),
    ...blockers.map(blocker => `- 阻断项：${blocker}`),
    `- 主行动：${decision.primaryAction.label}，${decision.primaryAction.description}（${decision.primaryAction.to}）`,
    '',
  ].join('\n')
}

function renderSessionActionPriorities(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const priorities = buildPracticeSessionActionPriorities(queue, progress, now)
  const lines = [
    '## 本轮行动优先级',
    `- 状态：${priorities.title}`,
    `- 摘要：${priorities.summary}`,
    `- 主行动：${priorities.primaryAction.label}，${priorities.primaryAction.description}（${priorities.primaryAction.to}）`,
    '',
  ]

  if (priorities.items.length === 0) {
    return [
      ...lines,
      '- 等待建立行动队列。先完成一次模拟面试后，系统会自动排序本轮动作。',
      '',
    ].join('\n')
  }

  priorities.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 原因：${item.reason}`,
      `   - 动作：${item.description}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionEvidenceGaps(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const gaps = buildPracticeSessionEvidenceGaps(queue, progress)
  const lines = [
    '## 本轮证据缺口',
    `- 状态：${gaps.title}`,
    `- 摘要：${gaps.summary}`,
    `- 主行动：${gaps.primaryAction.label}，${gaps.primaryAction.description}（${gaps.primaryAction.to}）`,
    '',
  ]

  if (gaps.items.length === 0) {
    return [
      ...lines,
      '- 等待生成证据缺口。先完成一次模拟面试后，系统会自动定位会被追问的证据漏洞。',
      '',
    ].join('\n')
  }

  gaps.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 低分维度：${item.criterionLabel} ${item.score} 分`,
      `   - 证据缺口：${item.gap}`,
      `   - 面试官追问：${item.interviewerProbe}`,
      `   - 修复提示：${item.repairHint}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionReplayCards(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const cards = buildPracticeSessionReplayCards(queue, progress)
  const lines = [
    '## 本轮 60 秒复述卡',
    `- 状态：${cards.title}`,
    `- 摘要：${cards.summary}`,
    `- 主行动：${cards.primaryAction.label}，${cards.primaryAction.description}（${cards.primaryAction.to}）`,
    '',
  ]

  if (cards.items.length === 0) {
    return [
      ...lines,
      '- 等待生成复述卡。先完成一次模拟面试后，系统会自动生成可开口的 60 秒重答脚本。',
      '',
    ].join('\n')
  }

  cards.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 焦点：${item.focus}`,
      `   - 开场句：${item.openingLine}`,
      `   - 证据句：${item.evidenceLine}`,
      `   - 边界句：${item.boundaryLine}`,
      `   - 复述提示：${item.rehearsalPrompt}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionReplayChecklist(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const checklist = buildPracticeSessionReplayChecklist(queue, progress)
  const lines = [
    '## 本轮复述验收清单',
    `- 状态：${checklist.title}`,
    `- 摘要：${checklist.summary}`,
    `- 主行动：${checklist.primaryAction.label}，${checklist.primaryAction.description}（${checklist.primaryAction.to}）`,
    '',
  ]

  if (checklist.items.length === 0) {
    return [
      ...lines,
      '- 等待生成验收清单。先完成一次模拟面试并生成复述卡后，系统会给出提交前自查标准。',
      '',
    ].join('\n')
  }

  checklist.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 验收点：${item.description}`,
      `   - 失败信号：${item.failureSignal}`,
      `   - 达标口径：${item.target}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionPressureProbes(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const probes = buildPracticeSessionPressureProbes(queue, progress)
  const lines = [
    '## 本轮压力追问卡',
    `- 状态：${probes.title}`,
    `- 摘要：${probes.summary}`,
    `- 主行动：${probes.primaryAction.label}，${probes.primaryAction.description}（${probes.primaryAction.to}）`,
    '',
  ]

  if (probes.items.length === 0) {
    return [
      ...lines,
      '- 等待生成压力追问。先完成一次模拟面试并生成复述卡后，系统会给出现场连问脚本。',
      '',
    ].join('\n')
  }

  probes.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 题目：${item.title}`,
      `   - 面试官追问：${item.probe}`,
      `   - 暴露风险：${item.riskSignal}`,
      `   - 回答口径：${item.answerGuide}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionRiskGuardrails(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const guardrails = buildPracticeSessionRiskGuardrails(queue, progress)
  const lines = [
    '## 本轮失分禁区',
    `- 状态：${guardrails.title}`,
    `- 摘要：${guardrails.summary}`,
    `- 主行动：${guardrails.primaryAction.label}，${guardrails.primaryAction.description}（${guardrails.primaryAction.to}）`,
    '',
  ]

  if (guardrails.items.length === 0) {
    return [
      ...lines,
      '- 等待生成失分禁区。先完成一次模拟面试并生成压力追问后，系统会给出重答避坑清单。',
      '',
    ].join('\n')
  }

  guardrails.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 不要这样说：${item.avoid}`,
      `   - 失分原因：${item.reason}`,
      `   - 改成这样说：${item.replacement}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionRetryDrafts(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const drafts = buildPracticeSessionRetryDrafts(queue, progress)
  const lines = [
    '## 本轮二次提交稿',
    `- 状态：${drafts.title}`,
    `- 摘要：${drafts.summary}`,
    `- 主行动：${drafts.primaryAction.label}，${drafts.primaryAction.description}（${drafts.primaryAction.to}）`,
    '',
  ]

  if (drafts.items.length === 0) {
    return [
      ...lines,
      '- 等待生成二次提交稿。先完成一次模拟面试并生成复述卡后，系统会给出可直接重答的提交稿。',
      '',
    ].join('\n')
  }

  drafts.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 结论句：${item.conclusionLine}`,
      `   - 证据句：${item.evidenceLine}`,
      `   - 边界句：${item.boundaryLine}`,
      `   - 收束句：${item.closingLine}`,
      `   - 完整稿：${item.fullDraft}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionPassGate(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const gate = buildPracticeSessionPassGate(queue, progress)
  const lines = [
    '## 本轮通过门槛',
    `- 状态：${gate.title}`,
    `- 摘要：${gate.summary}`,
    `- 通过：${gate.passedCount}/${gate.totalCount}`,
    `- 主行动：${gate.primaryAction.label}，${gate.primaryAction.description}（${gate.primaryAction.to}）`,
    '',
  ]

  if (gate.items.length === 0) {
    return [
      ...lines,
      '- 等待生成通过门槛。先完成一次模拟面试后，系统会判断本轮是否可以进入下一轮。',
      '',
    ].join('\n')
  }

  gate.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 状态：${item.status === 'ready' ? '已通过' : '待修复'}`,
      `   - 目标：${item.target}`,
      `   - 当前：${item.current}`,
      `   - 动作：${item.action}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionPassEvidence(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const evidence = buildPracticeSessionPassEvidence(queue, progress)
  const lines = [
    '## 本轮过线证据包',
    `- 状态：${evidence.title}`,
    `- 摘要：${evidence.summary}`,
    `- 证据数：${evidence.totalCount}`,
    `- 主行动：${evidence.primaryAction.label}，${evidence.primaryAction.description}（${evidence.primaryAction.to}）`,
    '',
  ]

  if (evidence.items.length === 0) {
    return [
      ...lines,
      '- 等待生成过线证据包。先完成一次模拟面试后，系统会沉淀本轮能否过线的关键证据。',
      '',
    ].join('\n')
  }

  evidence.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 证据：${item.value}`,
      `   - 解释：${item.explanation}`,
      `   - 动作：${item.action}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionTrainingContract(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const contract = buildPracticeSessionTrainingContract(queue, progress, now)
  const lines = [
    '## 下一轮训练契约',
    `- 状态：${contract.title}`,
    `- 摘要：${contract.summary}`,
    `- 主行动：${contract.primaryAction.label}，${contract.primaryAction.description}（${contract.primaryAction.to}）`,
    '',
  ]

  if (contract.items.length === 0) {
    return [
      ...lines,
      '- 等待生成训练契约。先完成一次模拟面试后，系统会给出下一轮目标、题组和验收口径。',
      '',
    ].join('\n')
  }

  contract.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 值：${item.value}`,
      `   - 说明：${item.detail}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionTrainingSchedule(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const schedule = buildPracticeSessionTrainingSchedule(queue, progress, now)
  const lines = [
    '## 下一轮训练日程',
    `- 状态：${schedule.title}`,
    `- 摘要：${schedule.summary}`,
    `- 总时长：${schedule.totalMinutes} 分钟`,
    `- 主行动：${schedule.primaryAction.label}，${schedule.primaryAction.description}（${schedule.primaryAction.to}）`,
    '',
  ]

  if (schedule.items.length === 0) {
    return [
      ...lines,
      '- 等待生成训练日程。先完成一次模拟面试后，系统会把训练契约拆成预热、作答和验收复盘。',
      '',
    ].join('\n')
  }

  schedule.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.phase}：${item.title}`,
      `   - 时间：${item.timeRange}`,
      `   - 任务：${item.task}`,
      `   - 验收：${item.acceptance}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionScheduleChecklist(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const checklist = buildPracticeSessionScheduleChecklist(queue, progress, now)
  const lines = [
    '## 训练日程打卡清单',
    `- 状态：${checklist.title}`,
    `- 摘要：${checklist.summary}`,
    `- 主行动：${checklist.primaryAction.label}，${checklist.primaryAction.description}（${checklist.primaryAction.to}）`,
    '',
  ]

  if (checklist.items.length === 0) {
    return [
      ...lines,
      '- 等待生成打卡清单。先生成下一轮训练日程后，系统会把每个时间块转成可核销证据。',
      '',
    ].join('\n')
  }

  checklist.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.phase}：${item.checkLabel}`,
      `   - 完成口径：${item.completionRule}`,
      `   - 证据模板：${item.evidenceTemplate}`,
      `   - 复盘问题：${item.reviewQuestion}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionTrainingReceipt(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const receipt = buildPracticeSessionTrainingReceipt(queue, progress, now)
  const lines = [
    '## 训练回执模板',
    `- 状态：${receipt.title}`,
    `- 摘要：${receipt.summary}`,
    `- 主行动：${receipt.primaryAction.label}，${receipt.primaryAction.description}（${receipt.primaryAction.to}）`,
    '',
  ]

  if (receipt.items.length === 0) {
    return [
      ...lines,
      '- 等待生成训练回执。先完成一次模拟面试并生成打卡清单后，系统会给出可填写模板。',
      '',
    ].join('\n')
  }

  receipt.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 填写提示：${item.prompt}`,
      `   - 示例：${item.example}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionReceiptAcceptance(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const acceptance = buildPracticeSessionReceiptAcceptance(queue, progress, now)
  const lines = [
    '## 回执验收卡',
    `- 状态：${acceptance.title}`,
    `- 摘要：${acceptance.summary}`,
    `- 主行动：${acceptance.primaryAction.label}，${acceptance.primaryAction.description}（${acceptance.primaryAction.to}）`,
    '',
  ]

  if (acceptance.items.length === 0) {
    return [
      ...lines,
      '- 等待验收训练回执。先生成训练回执模板后，系统会给出进入下一轮前的检查点。',
      '',
    ].join('\n')
  }

  acceptance.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 目标：${item.target}`,
      `   - 检查：${item.check}`,
      `   - 未通过动作：${item.fallbackAction}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionAdvanceGate(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const gate = buildPracticeSessionAdvanceGate(queue, progress, now)
  const lines = [
    '## 下一轮准入闸门',
    `- 裁决：${gate.title}`,
    `- 摘要：${gate.summary}`,
    `- 主行动：${gate.primaryAction.label}，${gate.primaryAction.description}（${gate.primaryAction.to}）`,
    '',
  ]

  if (gate.items.length === 0) {
    return [
      ...lines,
      '- 等待建立准入样本。先完成训练回执和验收卡后，系统会给出进入下一轮的裁决。',
      '',
    ].join('\n')
  }

  gate.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 状态：${advanceGateItemStateLabels[item.state]}`,
      `   - 条件：${item.condition}`,
      `   - 行动：${item.action}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionLaunchPacket(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const packet = buildPracticeSessionLaunchPacket(queue, progress, now)
  const lines = [
    '## 下一轮启动包',
    `- 状态：${packet.title}`,
    `- 摘要：${packet.summary}`,
    `- 主行动：${packet.primaryAction.label}，${packet.primaryAction.description}（${packet.primaryAction.to}）`,
    '',
  ]

  if (packet.items.length === 0) {
    return [
      ...lines,
      '- 等待建立启动样本。先完成准入闸门后，系统会给出下一步启动动作。',
      '',
    ].join('\n')
  }

  packet.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 指令：${item.instruction}`,
      `   - 完成口径：${item.completionRule}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionLaunchChecklist(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const checklist = buildPracticeSessionLaunchChecklist(queue, progress, now)
  const lines = [
    '## 启动执行清单',
    `- 状态：${checklist.title}`,
    `- 摘要：${checklist.summary}`,
    `- 主行动：${checklist.primaryAction.label}，${checklist.primaryAction.description}（${checklist.primaryAction.to}）`,
    '',
  ]

  if (checklist.items.length === 0) {
    return [
      ...lines,
      '- 等待生成启动执行清单。先生成下一轮启动包后，系统会把启动动作转成可核销证据。',
      '',
    ].join('\n')
  }

  checklist.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.phase}`,
      `   - 完成口径：${item.completionRule}`,
      `   - 证据模板：${item.evidenceTemplate}`,
      `   - 复盘问题：${item.reviewQuestion}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionFirstQuestionRehearsal(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const rehearsal = buildPracticeSessionFirstQuestionRehearsal(queue, progress, now)
  const lines = [
    '## 首题预演卡',
    `- 状态：${rehearsal.title}`,
    `- 摘要：${rehearsal.summary}`,
    `- 首题：${rehearsal.questionTitle}`,
    `- 选择原因：${rehearsal.reason}`,
    `- 开场提示：${rehearsal.openingPrompt}`,
    `- 通过信号：${rehearsal.passSignal}`,
    `- 证据要求：${rehearsal.evidenceRequirement}`,
    `- 主行动：${rehearsal.primaryAction.label}，${rehearsal.primaryAction.description}（${rehearsal.primaryAction.to}）`,
    '',
  ]

  if (rehearsal.status === 'empty') {
    lines.push('- 等待首题预演。先生成启动执行清单和下一轮训练队列。', '')
  }

  return lines.join('\n')
}

function renderSessionFirstQuestionRubric(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const rubric = buildPracticeSessionFirstQuestionRubric(queue, progress, now)
  const lines = [
    '## 首题验收尺',
    `- 状态：${rubric.title}`,
    `- 摘要：${rubric.summary}`,
    `- 主行动：${rubric.primaryAction.label}，${rubric.primaryAction.description}（${rubric.primaryAction.to}）`,
    '',
  ]

  if (rubric.items.length === 0) {
    return [
      ...lines,
      '- 等待首题验收尺。先生成首题预演卡后，系统会给出 4 条验收口径。',
      '',
    ].join('\n')
  }

  rubric.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 目标：${item.target}`,
      `   - 检查口径：${item.check}`,
      `   - 证据：${item.evidence}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionNextTraining(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now: string,
): string {
  const nextQueue = buildPracticeSessionNextTrainingQueue(queue, progress, now, 5)
  const lines = [
    '## 下一轮训练建议',
    `- 状态：${nextQueue.title}`,
    `- 摘要：${nextQueue.summary}`,
    `- 下一步：${nextQueue.primaryAction.label}`,
    `- 说明：${nextQueue.primaryAction.description}`,
    `- 入口：${nextQueue.primaryAction.to}`,
    '',
  ]

  if (nextQueue.items.length === 0) {
    return [
      ...lines,
      '- 暂无下一轮训练题。先做一次模拟面试或生成今日计划后，系统会自动排下一轮。',
      '',
    ].join('\n')
  }

  nextQueue.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 来源：${formatNextTrainingQueueItemMeta(item)}`,
      `   - 原因：${item.reason}`,
      `   - 行动：${item.actionLabel}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function renderSessionRepairActions(actions: PracticeSessionRepairAction[]): string {
  const lines = actions.length > 0
    ? actions.map((action, index) => [
      `${index + 1}. ${action.title}`,
      `   - 维度：${action.criterionLabel}`,
      `   - 原因：${action.reason}`,
      `   - 动作：${action.action}`,
      `   - 入口：${action.to}`,
      '   - 重答模板：',
      indentRepairDraft(buildPracticeSessionRepairDraft(action)),
    ].join('\n'))
    : ['- 暂无补弱动作，先完成本轮评分后自动生成。']

  return [
    '## 补弱动作清单',
    ...lines,
    '',
  ].join('\n')
}

function indentRepairDraft(draft: string): string {
  return draft
    .split('\n')
    .map(line => `     ${line}`)
    .join('\n')
}

function renderSessionQueue(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const lines = queue.length > 0
    ? queue.map((item, index) => {
      const latestScore = latestAttemptForQuestion(progress, item.id)?.feedback.score
      const status = progress.questionStates[item.id]?.status ?? item.status
      return `- ${index + 1}. ${item.title}：${item.categoryName}，${formatDifficulty(item.difficulty)}，来源 ${formatQueueSource(item.source)}，状态 ${formatStatus(status)}，最近评分 ${formatScore(latestScore)}`
    })
    : ['- 暂无题目，先从学习计划、弱题或题库进入模拟面试。']

  return [
    '## 题目队列',
    ...lines,
    '',
  ].join('\n')
}

function renderSessionAction(action: PracticeSessionReportAction): string {
  return [
    '## 下一步行动',
    `- ${action.label}：${action.description}（${action.to}）`,
    '',
  ].join('\n')
}

function buildEmptyReport(
  totalCount: number,
  repairActions: PracticeSessionRepairAction[],
  weakQuestionIds: number[],
  queueProfile: PracticeSessionQueueProfile,
): PracticeSessionReport {
  const hasRepairActions = repairActions.length > 0

  return {
    level: hasRepairActions ? 'risk' : 'empty',
    title: hasRepairActions
      ? '本轮优先补弱'
      : totalCount > 0
        ? '等待开始本轮练习'
        : '先选择一组面试题',
    summary: hasRepairActions
      ? `本轮已有 ${totalCount} 道题，${repairActions.length} 道已标记薄弱；先按补弱模板完成评分。`
      : totalCount > 0
        ? `本轮已有 ${totalCount} 道题，完成第一道评分后会生成整体战报。`
        : '当前还没有练习队列，先从学习计划、弱题或题库中选择题目进入模拟面试。',
    answeredCount: 0,
    totalCount,
    averageScore: 0,
    passCount: 0,
    weakQuestionIds,
    metrics: buildMetrics({
      answeredCount: 0,
      totalCount,
      averageScore: 0,
      passCount: 0,
      unansweredCount: totalCount,
    }),
    repairActions,
    queueProfile,
    primaryAction: hasRepairActions
      ? {
        kind: 'repair',
        label: '补弱重练',
        description: '先回到已标记薄弱的题目，完成评分并按最低维度补弱。',
        to: buildQueuePath(repairActions.map(action => action.questionId)),
      }
      : {
        kind: 'start',
        label: '开始本轮练习',
        description: '进入模拟面试并完成第一道题评分。',
        to: '/practice',
      },
  }
}

function latestAttemptForQuestion(progress: StudyProgress, questionId: number): InterviewAttempt | undefined {
  return [...(progress.interviewAttempts[questionId] ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function resolveWeakQuestionIds(
  items: SessionAttemptItem[],
  progress: StudyProgress,
): number[] {
  return items
    .filter(item => {
      const latestScore = item.attempt?.feedback.score
      const trackedStatus = progress.questionStates[item.question.id]?.status ?? item.question.status
      return (typeof latestScore === 'number' && latestScore < PASSING_SCORE) || trackedStatus === 'weak'
    })
    .map(item => item.question.id)
}

function summarizeWeakestCriterion(items: SessionAttemptItem[]): WeakestCriterionSummary | undefined {
  const buckets = new Map<InterviewCriterionKey, { label: string; total: number; count: number; summary: string }>()

  for (const item of items) {
    for (const criterion of item.attempt?.feedback.criteria ?? []) {
      const current = buckets.get(criterion.key) ?? {
        label: criterion.label,
        total: 0,
        count: 0,
        summary: criterion.summary,
      }
      current.total += criterion.score
      current.count += 1
      current.summary = current.summary || criterion.summary
      buckets.set(criterion.key, current)
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      averageScore: Math.round(bucket.total / bucket.count),
      summary: bucket.summary,
    }))
    .sort((a, b) => a.averageScore - b.averageScore)[0]
}

function buildAbilityRadarItems(
  items: Array<SessionAttemptItem & { attempt: InterviewAttempt }>,
  fallbackQuestionIds: number[],
): PracticeSessionAbilityRadarItem[] {
  const buckets = new Map<InterviewCriterionKey, {
    label: string
    totalScore: number
    attempts: number
    lowScoreQuestionIds: number[]
  }>()

  for (const item of items) {
    for (const criterion of item.attempt.feedback.criteria) {
      const bucket = buckets.get(criterion.key) ?? {
        label: criterion.label,
        totalScore: 0,
        attempts: 0,
        lowScoreQuestionIds: [],
      }
      bucket.totalScore += criterion.score
      bucket.attempts += 1
      if (criterion.score < PASSING_SCORE) {
        bucket.lowScoreQuestionIds.push(item.question.id)
      }
      buckets.set(criterion.key, bucket)
    }
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const lowScoreQuestionIds = uniqueNumbers(bucket.lowScoreQuestionIds)

      return {
        key,
        label: bucket.label,
        averageScore: Math.round(bucket.totalScore / bucket.attempts),
        attempts: bucket.attempts,
        lowScoreQuestionIds,
        summary: actionForCriterion(key),
        actionLabel: `回炉${bucket.label}`,
        to: buildQueuePath(lowScoreQuestionIds.length > 0 ? lowScoreQuestionIds : fallbackQuestionIds),
      }
    })
    .sort(compareAbilityRadarItems)
}

function compareAbilityRadarItems(
  a: PracticeSessionAbilityRadarItem,
  b: PracticeSessionAbilityRadarItem,
): number {
  return a.averageScore - b.averageScore || b.lowScoreQuestionIds.length - a.lowScoreQuestionIds.length
}

function resolveAbilityRadarStatus(items: PracticeSessionAbilityRadarItem[]): PracticeSessionAbilityRadar['status'] {
  const weakestScore = items[0]?.averageScore ?? 0

  if (items.length === 0) {
    return 'empty'
  }
  if (weakestScore < 60) {
    return 'risk'
  }
  if (weakestScore < PASSING_SCORE) {
    return 'watch'
  }
  return 'stable'
}

function titleForAbilityRadarStatus(
  status: PracticeSessionAbilityRadar['status'],
  weakestItem?: PracticeSessionAbilityRadarItem,
): string {
  if (status === 'empty') {
    return '等待本轮开口样本'
  }
  if (status === 'risk') {
    return `${weakestItem?.label ?? '能力维度'}明显拖后`
  }
  if (status === 'watch') {
    return `${weakestItem?.label ?? '能力维度'}需要盯防`
  }
  return '四项能力本轮过线'
}

function summaryForAbilityRadarStatus(
  status: PracticeSessionAbilityRadar['status'],
  weakestItem?: PracticeSessionAbilityRadarItem,
): string {
  if (!weakestItem) {
    return '先完成一次模拟面试，系统会自动聚合四个评分维度。'
  }
  if (status === 'stable') {
    return `最低维度「${weakestItem.label}」也达到 ${weakestItem.averageScore} 分，可以继续做追问加压。`
  }
  return `最低维度「${weakestItem.label}」平均 ${weakestItem.averageScore} 分，先处理 ${weakestItem.lowScoreQuestionIds.length} 道受影响题。`
}

function buildAbilityRadarPrimaryAction(
  status: PracticeSessionAbilityRadar['status'],
  weakestItem: PracticeSessionAbilityRadarItem | undefined,
  items: Array<SessionAttemptItem & { attempt: InterviewAttempt }>,
): PracticeSessionReportAction {
  if (!weakestItem) {
    return {
      kind: 'start',
      label: '开始模拟面试',
      description: '先完成一次开口作答，建立本轮能力雷达样本。',
      to: '/practice',
    }
  }

  if (status === 'stable') {
    return {
      kind: 'continue',
      label: '继续加压',
      description: '四个能力维度均已过线，继续用本轮题目做高压追问。',
      to: buildQueuePath(items.map(item => item.question.id)),
    }
  }

  return {
    kind: 'repair',
    label: weakestItem.actionLabel,
    description: weakestItem.summary,
    to: weakestItem.to,
  }
}

function resolveInterviewerDecisionStatus(
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
): PracticeSessionInterviewerDecision['status'] {
  if (report.answeredCount === 0) {
    return 'empty'
  }
  if (report.averageScore < PASSING_SCORE || report.weakQuestionIds.length > 0 || radar.status === 'risk') {
    return 'reject-risk'
  }
  if (report.answeredCount < report.totalCount || report.averageScore < STRONG_SESSION_SCORE) {
    return 'hold'
  }
  if (report.averageScore >= 88 && radar.status === 'stable') {
    return 'strong-pass'
  }
  return 'pass'
}

function titleForInterviewerDecisionStatus(status: PracticeSessionInterviewerDecision['status']): string {
  if (status === 'empty') {
    return '等待面试样本'
  }
  if (status === 'reject-risk') {
    return '面试官会先卡阻断项'
  }
  if (status === 'hold') {
    return '还需要更多稳定证据'
  }
  if (status === 'strong-pass') {
    return '强通过信号'
  }
  return '通过信号'
}

function verdictForInterviewerDecisionStatus(status: PracticeSessionInterviewerDecision['status']): string {
  if (status === 'empty') {
    return '等待面试样本'
  }
  if (status === 'reject-risk') {
    return '暂不建议通过'
  }
  if (status === 'hold') {
    return '待观察'
  }
  if (status === 'strong-pass') {
    return '强通过信号'
  }
  return '通过信号'
}

function summaryForInterviewerDecisionStatus(
  status: PracticeSessionInterviewerDecision['status'],
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
): string {
  if (status === 'reject-risk') {
    return `平均 ${report.averageScore} 分，最低维度 ${radar.weakestItem?.label ?? '暂无'}，当前更像“需要补证据”的面试表现。`
  }
  if (status === 'hold') {
    return `已有 ${report.answeredCount}/${report.totalCount} 道样本，但还需要补齐未答题或把平均分拉到 ${STRONG_SESSION_SCORE} 分以上。`
  }
  if (status === 'strong-pass') {
    return '本轮回答完整、均分高、四项能力稳定，适合继续做更高压追问。'
  }
  return '本轮回答已形成通过信号，继续沉淀高分素材并准备连续追问。'
}

function buildDecisionEvidence(
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
): PracticeSessionInterviewerDecision['evidence'] {
  return [
    {
      key: 'answered',
      label: '已答',
      value: `${report.answeredCount} / ${report.totalCount}`,
      detail: report.answeredCount === report.totalCount ? '本轮样本完整' : '样本仍需补齐',
    },
    {
      key: 'average',
      label: '均分',
      value: `${report.averageScore}`,
      detail: report.averageScore >= PASSING_SCORE ? '达到基础通过线' : '低于基础通过线',
    },
    {
      key: 'pass',
      label: '通过题',
      value: `${report.passCount}`,
      detail: `${PASSING_SCORE} 分以上计为通过`,
    },
    {
      key: 'weakest',
      label: '最弱维度',
      value: radar.weakestItem ? `${radar.weakestItem.label} ${radar.weakestItem.averageScore}` : '暂无',
      detail: radar.weakestItem?.summary ?? '等待评分样本',
    },
  ]
}

function buildInterviewerDecisionBlockers(
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
): string[] {
  const blockers: string[] = []

  if (radar.weakestItem && radar.weakestItem.averageScore < PASSING_SCORE) {
    blockers.push(`${radar.weakestItem.label}平均 ${radar.weakestItem.averageScore} 分`)
  }
  if (report.answeredCount < report.totalCount) {
    blockers.push(`还有 ${report.totalCount - report.answeredCount} 道题没有形成面试样本`)
  }
  if (report.weakQuestionIds.length > 0) {
    blockers.push(`${report.weakQuestionIds.length} 道低分/薄弱题仍会阻断通过`)
  }
  if (report.averageScore < PASSING_SCORE) {
    blockers.push(`整轮平均 ${report.averageScore} 分低于通过线`)
  }

  return uniqueTexts(blockers)
}

function buildInterviewerDecisionAction(
  status: PracticeSessionInterviewerDecision['status'],
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
  blockers: string[],
): PracticeSessionReportAction {
  if (status === 'reject-risk') {
    return {
      kind: 'repair',
      label: '补齐决策阻断',
      description: blockers[0] ?? '先补齐当前最影响通过结论的阻断项。',
      to: radar.weakestItem?.to ?? report.primaryAction.to,
    }
  }
  if (status === 'hold') {
    return {
      kind: 'continue',
      label: '补齐观察样本',
      description: '先补齐未答题或把平均分推到稳定通过线以上。',
      to: report.primaryAction.to,
    }
  }
  if (status === 'empty') {
    return {
      kind: 'start',
      label: '建立面试样本',
      description: '先完成一次模拟面试，让系统产生可判断的面试证据。',
      to: '/practice',
    }
  }
  return {
    kind: 'continue',
    label: '继续加压追问',
    description: '把通过信号升级为更稳定的高压追问表现。',
    to: radar.primaryAction.to,
  }
}

function buildRepairActions(
  items: SessionAttemptItem[],
  progress: StudyProgress,
): PracticeSessionRepairAction[] {
  return items
    .map(item => buildRepairAction(item, progress))
    .filter((action): action is PracticeSessionRepairAction => Boolean(action))
    .sort((a, b) => repairPriority(a) - repairPriority(b))
}

function buildRepairAction(
  item: SessionAttemptItem,
  progress: StudyProgress,
): PracticeSessionRepairAction | undefined {
  const latestScore = item.attempt?.feedback.score
  const trackedStatus = progress.questionStates[item.question.id]?.status ?? item.question.status
  const shouldRepair = (typeof latestScore === 'number' && latestScore < PASSING_SCORE) || trackedStatus === 'weak'

  if (!shouldRepair) {
    return undefined
  }

  if (!item.attempt) {
    return {
      questionId: item.question.id,
      title: item.question.title,
      criterionLabel: '未评分',
      reason: '已标记薄弱但本轮还没有评分记录。',
      action: '先完成一次模拟评分，再按最低维度补弱。',
      to: buildQuestionPath(item.question.id),
    }
  }

  const weakest = resolveWeakestAttemptCriterion(item.attempt.feedback.criteria)

  return {
    questionId: item.question.id,
    title: item.question.title,
    score: item.attempt.feedback.score,
    criterionKey: weakest.key,
    criterionLabel: weakest.label,
    criterionScore: weakest.score,
    reason: `最近评分 ${item.attempt.feedback.score} 分，${weakest.label} ${weakest.score} 分拖低本轮表现。`,
    action: actionForCriterion(weakest.key),
    to: buildQuestionPath(item.question.id),
  }
}

function repairPriority(action: PracticeSessionRepairAction): number {
  const score = action.score ?? Number.MAX_SAFE_INTEGER
  const criterionScore = action.criterionScore ?? Number.MAX_SAFE_INTEGER
  return score * 1000 + criterionScore
}

function resolveWeakestAttemptCriterion(criteria: InterviewCriterion[]): InterviewCriterion {
  return [...criteria].sort((a, b) => a.score - b.score)[0] ?? {
    key: 'structure',
    label: '结构化',
    score: 0,
    summary: '暂无评分维度',
  }
}

function resolveLevel(input: {
  answeredCount: number
  averageScore: number
  totalCount: number
  weakQuestionIds: number[]
}): PracticeSessionReportLevel {
  if (input.weakQuestionIds.length > 0 || input.averageScore < PASSING_SCORE) {
    return 'risk'
  }
  if (input.answeredCount === input.totalCount && input.averageScore >= STRONG_SESSION_SCORE) {
    return 'passed'
  }
  return 'in-progress'
}

function buildPrimaryAction(
  level: PracticeSessionReportLevel,
  weakQuestionIds: number[],
  unansweredIds: number[],
): PracticeSessionReportAction {
  if (level === 'risk') {
    return {
      kind: 'repair',
      label: '补弱重练',
      description: '优先回到低分题和标弱题，先把本轮短板修到通过线。',
      to: buildQueuePath(weakQuestionIds),
    }
  }

  if (level === 'passed') {
    return {
      kind: 'review',
      label: '复盘沉淀',
      description: '本轮已经稳定通过，回到学习页沉淀为可复用表达。',
      to: '/study',
    }
  }

  if (unansweredIds.length > 0) {
    return {
      kind: 'continue',
      label: '继续未答题',
      description: '先完成剩余题目，再判断整轮是否需要补弱。',
      to: buildQueuePath(unansweredIds),
    }
  }

  return {
    kind: 'review',
    label: '复盘本轮表现',
    description: '本轮已答完但还不够稳定，先回到学习页整理薄弱表达。',
    to: '/study',
  }
}

function buildQueuePath(questionIds: number[]): string {
  if (questionIds.length === 0) {
    return '/practice'
  }
  return `/practice?queue=${questionIds.join(',')}`
}

function uniqueNumbers(values: number[]): number[] {
  const seen = new Set<number>()
  const result: number[] = []

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (seen.has(value)) {
      continue
    }
    seen.add(value)
    result.push(value)
  }

  return result
}

function uniquePriorityItems(items: PracticeSessionActionPriorityItem[]): PracticeSessionActionPriorityItem[] {
  const seen = new Set<string>()
  const result: PracticeSessionActionPriorityItem[] = []

  for (const item of items) {
    if (seen.has(item.label)) {
      continue
    }
    seen.add(item.label)
    result.push(item)
  }

  return result
}

function buildEvidenceGapItems(
  question: PracticeQueueItem,
  attempt: InterviewAttempt,
): PracticeSessionEvidenceGapItem[] {
  return attempt.feedback.criteria
    .filter(criterion => criterion.score < EVIDENCE_GAP_SCORE)
    .map(criterion => ({
      id: `${question.id}-${criterion.key}`,
      questionId: question.id,
      title: question.title,
      criterionKey: criterion.key,
      criterionLabel: criterion.label,
      score: criterion.score,
      gap: criterion.summary || evidenceGapForCriterion(criterion.key),
      interviewerProbe: interviewerProbeForCriterion(criterion.key),
      repairHint: evidenceRepairHintForCriterion(criterion.key),
      to: buildQueuePath([question.id]),
      priority: evidenceGapPriority(criterion, attempt.feedback.score),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
}

function evidenceGapPriority(criterion: InterviewCriterion, attemptScore: number): number {
  const answerPenalty = Math.max(0, PASSING_SCORE - attemptScore)

  // 证据缺口排序以维度分差为主，叠加整题低分和真实面试更容易深挖的维度权重。
  return ((EVIDENCE_GAP_SCORE - criterion.score) * 2) + answerPenalty + evidenceCriterionWeight(criterion.key)
}

function evidenceCriterionWeight(key: InterviewCriterionKey): number {
  if (key === 'specificity') {
    return 12
  }
  if (key === 'risk') {
    return 10
  }
  if (key === 'structure') {
    return 6
  }
  return 4
}

function evidenceGapForCriterion(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '知识链路还不完整，关键机制、条件或替代方案容易被追问。'
  }
  if (key === 'structure') {
    return '表达顺序不够稳定，面试官会要求你压缩并重讲。'
  }
  if (key === 'specificity') {
    return '项目证据不足，缺少真实场景、指标、规模或个人动作。'
  }
  return '风险边界不足，缺少失败场景、降级策略或取舍依据。'
}

function interviewerProbeForCriterion(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '你漏掉的关键链路、前置条件和替代方案分别是什么？'
  }
  if (key === 'structure') {
    return '请按“背景 -> 方案 -> 结果 -> 边界”在 60 秒内重新回答一遍。'
  }
  if (key === 'specificity') {
    return '这个回答放到你的项目里，规模、指标、数据和个人职责分别是什么？'
  }
  return '这个方案的失败边界、降级策略和取舍依据是什么？'
}

function evidenceRepairHintForCriterion(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '补定义、核心机制、关键步骤和至少一个替代方案差异。'
  }
  if (key === 'structure') {
    return '改成结论先行，再按背景、方案、结果和边界四段重答。'
  }
  if (key === 'specificity') {
    return '补一个项目场景、触发条件、量化指标和你本人负责的动作。'
  }
  return '补失败场景、监控信号、降级策略和为什么这样取舍。'
}

function buildReplayCardFromGap(gap: PracticeSessionEvidenceGapItem): PracticeSessionReplayCardItem {
  const script = replayScriptForCriterion(gap.criterionKey)

  return {
    id: gap.id,
    questionId: gap.questionId,
    title: gap.title,
    focus: `${gap.criterionLabel} ${gap.score} 分`,
    openingLine: script.openingLine,
    evidenceLine: script.evidenceLine,
    boundaryLine: script.boundaryLine,
    rehearsalPrompt: `请用 60 秒重答「${gap.title}」，必须包含${gap.criterionLabel}证据和可追问边界。`,
    to: gap.to,
    priority: gap.priority,
  }
}

function buildStableReplayCard(item: SessionAttemptItem & { attempt: InterviewAttempt }): PracticeSessionReplayCardItem {
  const weakestCriterion = [...item.attempt.feedback.criteria].sort((a, b) => a.score - b.score)[0]
  const criterionKey = weakestCriterion?.key ?? 'structure'
  const script = replayScriptForCriterion(criterionKey)

  return {
    id: `${item.question.id}-stable-replay`,
    questionId: item.question.id,
    title: item.question.title,
    focus: `稳定复述 ${item.attempt.feedback.score} 分`,
    openingLine: script.openingLine,
    evidenceLine: script.evidenceLine,
    boundaryLine: script.boundaryLine,
    rehearsalPrompt: `请用 60 秒复述「${item.question.title}」，保持结论、证据和边界完整。`,
    to: buildQueuePath([item.question.id]),
    priority: item.attempt.feedback.score,
  }
}

function replayScriptForCriterion(key: InterviewCriterionKey): {
  openingLine: string
  evidenceLine: string
  boundaryLine: string
} {
  if (key === 'coverage') {
    return {
      openingLine: '我先给结论：这题要先把定义和核心机制讲完整。',
      evidenceLine: '补关键步骤、前置条件和至少一个替代方案差异。',
      boundaryLine: '最后补适用边界和容易误用的场景，避免只背概念。',
    }
  }
  if (key === 'structure') {
    return {
      openingLine: '我先给结论：这题按背景、方案、结果和边界四段回答。',
      evidenceLine: '补方案选择、执行步骤、结果指标和复盘结论。',
      boundaryLine: '最后补什么时候适用、什么时候不适用，保证结构闭环。',
    }
  }
  if (key === 'specificity') {
    return {
      openingLine: '我先给结论：这题要落到真实项目场景里说明。',
      evidenceLine: '补项目规模、触发条件、量化指标和我负责的动作。',
      boundaryLine: '最后补验证方式、监控指标和回滚方案，避免只讲经验不讲边界。',
    }
  }
  return {
    openingLine: '我先给结论：这题要把方案收益和风险边界一起讲清楚。',
    evidenceLine: '补失败场景、监控信号、降级策略和取舍依据。',
    boundaryLine: '最后说明为什么这样兜底，以及什么情况下会换方案。',
  }
}

function buildReplayChecklistItems(to: string): PracticeSessionReplayChecklistItem[] {
  return [
    {
      id: 'conclusion',
      label: '结论先行',
      description: '10 秒内给出明确判断，不先铺大段背景。',
      failureSignal: '开头超过 10 秒还没有结论，或只复述题目没有观点。',
      target: '第一句话能直接回答题目，并说明接下来会补机制、证据和边界。',
      to,
    },
    {
      id: 'evidence',
      label: '证据可追问',
      description: '至少给出一个项目场景、指标、规模或个人动作。',
      failureSignal: '只说“我理解/我会处理”，没有可继续追问的事实细节。',
      target: '面试官继续问规模、指标、职责时，答案里已经有可展开的证据点。',
      to,
    },
    {
      id: 'boundary',
      label: '风险有边界',
      description: '说明失败场景、降级方案、监控信号或取舍依据。',
      failureSignal: '答案只讲正向方案，不讲什么时候失效、怎么兜底。',
      target: '至少补一个风险边界和一个验证/回滚动作。',
      to,
    },
    {
      id: 'duration',
      label: '60 秒内讲完',
      description: '控制在 45-60 秒内讲完结论、证据和边界。',
      failureSignal: '超过 60 秒仍未讲到边界，或 30 秒内只有零散关键词。',
      target: '一轮复述完整、可停顿、可被追问，不依赖长篇背诵。',
      to,
    },
  ]
}

function buildPressureProbeItems(
  replayCards: PracticeSessionReplayCardItem[],
  fallbackTo: string,
): PracticeSessionPressureProbeItem[] {
  const templates = [
    {
      id: 'landing',
      label: '落地证据追问',
      probe: '如果这个答案放到你的真实项目里，规模、指标、数据和你的职责分别是什么？',
      riskSignal: '只能讲概念，讲不出项目规模、触发条件、量化指标或本人动作。',
      guide: '先补业务场景，再补触发条件、指标变化和你本人负责的决策或实现。',
    },
    {
      id: 'failure-boundary',
      label: '失败边界追问',
      probe: '如果方案在高并发、异常数据或依赖故障下失败，你会怎么发现、降级和回滚？',
      riskSignal: '只讲正向路径，答不出失效信号、降级策略、监控指标和回滚动作。',
      guide: '用一个失败场景说明监控信号、影响范围、降级动作和恢复验证。',
    },
    {
      id: 'tradeoff',
      label: '技术取舍追问',
      probe: '为什么选择这个方案，不选替代方案？成本、收益和边界分别是什么？',
      riskSignal: '只能背标准方案，无法解释替代方案差异、成本收益和适用边界。',
      guide: '把主方案、替代方案、选择依据、代价和不适用场景按顺序说清楚。',
    },
  ] as const

  return templates.map((template, index) => {
    const card = replayCards[index % replayCards.length]

    return {
      id: `${card.id}-${template.id}-probe`,
      questionId: card.questionId,
      title: card.title,
      label: template.label,
      probe: template.probe,
      riskSignal: template.riskSignal,
      answerGuide: `${template.guide} 当前题目先围绕「${card.title}」回答。`,
      to: card.to || fallbackTo,
      priority: 100 - index,
    }
  })
}

function buildRiskGuardrailItems(to: string): PracticeSessionRiskGuardrailItem[] {
  return [
    {
      id: 'empty-concept',
      label: '禁止空讲概念',
      avoid: '不要只说“我理解核心原理”或复述定义，却没有项目规模、指标和本人动作。',
      reason: '面试官会继续追问你是否真的做过，空泛概念无法证明实战能力。',
      replacement: '改成“在某项目里，因某触发条件，我负责某动作，指标从 A 变化到 B”。',
      to,
      priority: 100,
    },
    {
      id: 'skip-boundary',
      label: '禁止跳过失败边界',
      avoid: '不要只讲正向方案，不讲什么时候失效、怎么监控、怎么降级和回滚。',
      reason: '边界缺失会让答案像背诵，面试官很容易判断你没有处理过线上风险。',
      replacement: '改成“这个方案在某场景会失效，我用某监控发现，再用某降级和回滚兜底”。',
      to,
      priority: 90,
    },
    {
      id: 'standard-only',
      label: '禁止只背标准答案',
      avoid: '不要只说标准方案正确，不解释为什么不用替代方案以及成本收益。',
      reason: '高级面试更看重取舍能力，只背标准答案无法证明你能独立做技术决策。',
      replacement: '改成“我比较过 A/B 方案，因为约束、成本和收益选择 A，但在某边界会换成 B”。',
      to,
      priority: 80,
    },
  ]
}

function buildRetryDraftItem(card: PracticeSessionReplayCardItem): PracticeSessionRetryDraftItem {
  const closingLine = '如果继续追问，我会补充项目规模、失败边界和替代方案取舍。'
  const fullDraft = [
    card.openingLine,
    card.evidenceLine,
    card.boundaryLine,
    closingLine,
  ].join(' ')

  return {
    id: `${card.id}-retry-draft`,
    questionId: card.questionId,
    title: card.title,
    conclusionLine: card.openingLine,
    evidenceLine: card.evidenceLine,
    boundaryLine: card.boundaryLine,
    closingLine,
    fullDraft,
    to: card.to,
    priority: card.priority,
  }
}

function buildPassGateItems(
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
  retryDrafts: PracticeSessionRetryDrafts,
  unansweredCount: number,
  queuePath: string,
): PracticeSessionPassGateItem[] {
  const answerReady = unansweredCount === 0
  // 通过门槛使用 80 分强标准，避免 70 分基础通过的答案直接被放进下一轮加压。
  const scoreReady = report.averageScore >= STRONG_SESSION_SCORE
  const weaknessReady = report.weakQuestionIds.length === 0 && radar.status === 'stable'
  const draftReady = retryDrafts.status === 'ready'

  return [
    {
      id: 'answered',
      label: '全题完成',
      target: '本轮题目全部完成一次评分',
      current: answerReady ? `已答完 ${report.answeredCount}/${report.totalCount}` : `还剩 ${unansweredCount} 道未答`,
      status: answerReady ? 'ready' : 'blocked',
      action: answerReady ? '保持完整样本' : '先完成未答题，避免用残缺样本判断通过。',
      to: answerReady ? queuePath : buildQueuePath(report.queueProfile.unansweredQuestionIds),
      priority: 1,
    },
    {
      id: 'average-score',
      label: '平均分达标',
      target: `${STRONG_SESSION_SCORE} 分以上再进入下一轮`,
      current: `当前平均 ${report.averageScore} 分`,
      status: scoreReady ? 'ready' : 'blocked',
      action: scoreReady ? '保持高分稳定性' : `先把平均分从 ${report.averageScore} 分补到 ${STRONG_SESSION_SCORE} 分以上。`,
      to: queuePath,
      priority: 2,
    },
    {
      id: 'weakness-cleanup',
      label: '弱项清零',
      target: '无薄弱题且四项能力雷达稳定',
      current: weaknessReady ? '弱题清零，能力雷达稳定' : `${report.weakQuestionIds.length} 道薄弱题，雷达状态：${radar.title}`,
      status: weaknessReady ? 'ready' : 'blocked',
      action: weaknessReady ? '保留当前答法' : '先修复薄弱题和最低能力维度，再进入下一轮。',
      to: queuePath,
      priority: 3,
    },
    {
      id: 'retry-draft',
      label: '二次提交稿就绪',
      target: '重答前已生成可直接提交的结论、证据、边界和收束稿',
      current: draftReady ? '二次提交稿已就绪' : retryDrafts.title,
      status: draftReady ? 'ready' : 'blocked',
      action: draftReady ? '按稿进入下一轮加压' : '先生成并使用二次提交稿，避免带着原始失分表达进入下一轮。',
      to: retryDrafts.primaryAction.to,
      priority: 4,
    },
  ]
}

function buildPassEvidenceItems(
  report: PracticeSessionReport,
  radar: PracticeSessionAbilityRadar,
  retryDrafts: PracticeSessionRetryDrafts,
): PracticeSessionPassEvidenceItem[] {
  const unansweredCount = Math.max(report.totalCount - report.answeredCount, 0)
  const queuePath = report.queueProfile.queuePath

  return [
    {
      id: 'score-evidence',
      label: '评分证据',
      value: `${report.averageScore} 分均分，${report.passCount} 道达到基础通过线`,
      explanation: report.averageScore >= STRONG_SESSION_SCORE
        ? '均分已经达到下一轮加压标准。'
        : `均分还低于 ${STRONG_SESSION_SCORE} 分强门槛，说明当前答案稳定性不足。`,
      action: report.averageScore >= STRONG_SESSION_SCORE ? '保留当前答法并继续加压。' : '优先重答低分题，把均分补到 80 分以上。',
      to: queuePath,
      priority: 1,
    },
    {
      id: 'completion-evidence',
      label: '完成证据',
      value: `${report.answeredCount}/${report.totalCount} 道已完成评分`,
      explanation: unansweredCount === 0 ? '本轮样本完整，可以进行整轮判断。' : `还有 ${unansweredCount} 道未答，样本不完整。`,
      action: unansweredCount === 0 ? '保持完整样本。' : '先完成剩余题目，再看总分和弱项。',
      to: unansweredCount === 0 ? queuePath : buildQueuePath(report.queueProfile.unansweredQuestionIds),
      priority: 2,
    },
    {
      id: 'weakness-evidence',
      label: '弱项证据',
      value: `${report.weakQuestionIds.length} 道薄弱题，${radar.title}`,
      explanation: report.weakQuestionIds.length === 0 && radar.status === 'stable'
        ? '薄弱题已经清零，四项能力没有明显短板。'
        : '仍有题目或能力维度会拖低面试官判断。',
      action: report.weakQuestionIds.length === 0 && radar.status === 'stable' ? '继续保持四项能力均衡。' : '先修复薄弱题和最低能力维度。',
      to: queuePath,
      priority: 3,
    },
    {
      id: 'submission-evidence',
      label: '提交证据',
      value: retryDrafts.title,
      explanation: retryDrafts.status === 'ready'
        ? '二次提交稿已稳定，可以作为下一轮回答基线。'
        : '二次提交稿仍处在修复状态，需要先替换高风险表达。',
      action: retryDrafts.status === 'ready' ? '带着稳定稿进入下一轮。' : '先使用二次提交稿完成一次重答。',
      to: retryDrafts.primaryAction.to,
      priority: 4,
    },
  ]
}

function buildTrainingContractItems({
  report,
  targetScore,
  queueSize,
  queuePath,
  evidenceFocus,
  repairMode,
}: {
  report: PracticeSessionReport
  targetScore: number
  queueSize: number
  queuePath: string
  evidenceFocus: string
  repairMode: boolean
}): PracticeSessionTrainingContractItem[] {
  return [
    {
      id: 'target-score',
      label: '目标分',
      value: `${targetScore} 分以上`,
      detail: repairMode
        ? `当前均分 ${report.averageScore} 分，下一轮先补到强通过线。`
        : `当前已满足推进条件，下一轮继续保持 ${targetScore} 分以上。`,
      priority: 1,
    },
    {
      id: 'training-queue',
      label: '训练题组',
      value: `${queueSize} 道题，入口 ${queuePath}`,
      detail: repairMode ? '先回到本轮队列修复低分题和薄弱题。' : '进入系统生成的下一轮个性化训练队列。',
      priority: 2,
    },
    {
      id: 'acceptance-rule',
      label: '验收口径',
      value: '均分达标、弱项清零、提交稿可复述',
      detail: '下一轮结束后继续用通过门槛验收，避免只刷题不闭环。',
      priority: 3,
    },
    {
      id: 'evidence-reference',
      label: '复盘证据',
      value: evidenceFocus,
      detail: '下一轮复盘时先对照这条证据，确认短板是否真的被修掉。',
      priority: 4,
    },
  ]
}

function buildTrainingScheduleItems({
  repairMode,
  queuePath,
  targetScore,
  queueLabel,
  evidenceFocus,
  repairCount,
}: {
  repairMode: boolean
  queuePath: string
  targetScore: string
  queueLabel: string
  evidenceFocus: string
  repairCount: number
}): PracticeSessionTrainingScheduleItem[] {
  if (repairMode) {
    return [
      {
        id: 'warm-up',
        phase: '预热',
        timeRange: '0-8 分钟',
        title: '锁定修复目标',
        task: `打开 ${queueLabel}，先复读目标分、过线证据和本轮失分禁区。`,
        acceptance: `能说清本轮要把均分补到 ${targetScore}，且知道优先修复 ${repairCount || 1} 个缺口。`,
        to: queuePath,
        priority: 1,
      },
      {
        id: 'timed-answer',
        phase: '限时作答',
        timeRange: '8-26 分钟',
        title: '逐题重答补弱',
        task: '按二次提交稿逐题开口重答，低分题先给结论、证据、边界和收束。',
        acceptance: '每道题完成一次可复述重答，不能只看稿或只收藏。',
        to: queuePath,
        priority: 2,
      },
      {
        id: 'acceptance-review',
        phase: '验收复盘',
        timeRange: '26-35 分钟',
        title: '用门槛验收能否过线',
        task: `对照 ${evidenceFocus}、通过门槛和训练契约，判断是否可以进入下一轮。`,
        acceptance: '均分、弱项和提交稿三项都达标后再推进，否则继续修复。',
        to: queuePath,
        priority: 3,
      },
    ]
  }

  return [
    {
      id: 'warm-up',
      phase: '预热',
      timeRange: '0-6 分钟',
      title: '读取下一轮题组',
      task: `打开 ${queueLabel}，先看题目来源和本轮过线证据。`,
      acceptance: `明确本轮保持 ${targetScore} 的目标，并知道第一题为什么被排进来。`,
      to: queuePath,
      priority: 1,
    },
    {
      id: 'timed-answer',
      phase: '限时作答',
      timeRange: '6-24 分钟',
      title: '完成个性化题组',
      task: '按下一轮题组限时作答，优先把证据、场景和风险讲完整。',
      acceptance: '每道题都产生一次评分样本，避免跳题进入下一轮。',
      to: queuePath,
      priority: 2,
    },
    {
      id: 'acceptance-review',
      phase: '验收复盘',
      timeRange: '24-32 分钟',
      title: '沉淀新证据包',
      task: `用 ${evidenceFocus} 校验本轮表达是否更稳，并更新下一轮训练契约。`,
      acceptance: '强通过、证据包和下一轮契约同步更新后再扩大题量。',
      to: queuePath,
      priority: 3,
    },
  ]
}

function buildScheduleChecklistItem(
  item: PracticeSessionTrainingScheduleItem,
  status: PracticeSessionScheduleChecklist['status'],
): PracticeSessionScheduleChecklistItem {
  return {
    id: item.id,
    phase: item.phase,
    checkLabel: `${item.title}已完成`,
    completionRule: item.acceptance,
    evidenceTemplate: buildScheduleEvidenceTemplate(item, status),
    reviewQuestion: buildScheduleReviewQuestion(item.phase, status),
    to: item.to,
    priority: item.priority,
  }
}

function buildScheduleEvidenceTemplate(
  item: PracticeSessionTrainingScheduleItem,
  status: PracticeSessionScheduleChecklist['status'],
): string {
  const modeLabel = status === 'repair' ? '修复' : '推进'

  return `【${modeLabel}-${item.phase}】${item.title}：我已完成「${item.task}」，结果证据是：`
}

function buildScheduleReviewQuestion(
  phase: string,
  status: PracticeSessionScheduleChecklist['status'],
): string {
  if (phase === '预热') {
    return status === 'repair' ? '我是否能说清本轮最先修哪一个缺口？' : '我是否能说清下一轮第一题为什么被选中？'
  }

  if (phase === '限时作答') {
    return status === 'repair' ? '我是否真的开口重答，而不是只看稿？' : '每道题是否都留下了评分样本？'
  }

  return status === 'repair' ? '三项通过门槛是否都达标？' : '新证据包是否足够支撑继续加题？'
}

function buildTrainingReceiptItems({
  contract,
  checklist,
  repairMode,
}: {
  contract: PracticeSessionTrainingContract
  checklist: PracticeSessionScheduleChecklist
  repairMode: boolean
}): PracticeSessionTrainingReceiptItem[] {
  const targetValue = contract.items.find(item => item.id === 'target-score')?.value ?? '80 分以上'
  const queueValue = contract.items.find(item => item.id === 'training-queue')?.value ?? contract.primaryAction.to
  const acceptanceValue = contract.items.find(item => item.id === 'acceptance-rule')?.value ?? '均分达标、弱项清零、提交稿可复述'
  const evidenceTemplate = checklist.items[0]?.evidenceTemplate ?? '我已完成本轮训练，结果证据是：'

  return [
    {
      id: 'training-target',
      label: '训练目标',
      prompt: `写清本轮目标分和训练题组：${targetValue}，${queueValue}。`,
      example: `本轮目标：${targetValue}；题组：${queueValue}。`,
      priority: 1,
    },
    {
      id: 'completion-evidence',
      label: '完成证据',
      prompt: '粘贴最关键的一条打卡证据，说明你确实完成了开口训练。',
      example: evidenceTemplate,
      priority: 2,
    },
    {
      id: 'blocking-risk',
      label: '阻断项',
      prompt: repairMode
        ? `对照 ${acceptanceValue} 写出仍未通过的阻断项。`
        : '写出推进后仍可能被追问的风险点，没有则写“暂无阻断”。',
      example: repairMode ? `当前阻断：${acceptanceValue} 中仍有一项未达标。` : '当前阻断：暂无，下一轮继续加压验证。',
      priority: 3,
    },
    {
      id: 'next-step',
      label: '下一步',
      prompt: repairMode ? '如果阻断仍存在，回到本轮队列继续修复；如果清零，再进入下一轮。' : '进入下一轮个性化训练，并用新战报继续验收。',
      example: repairMode ? `下一步：回到 ${contract.primaryAction.to} 继续修复。` : `下一步：进入 ${contract.primaryAction.to} 继续训练。`,
      priority: 4,
    },
  ]
}

function buildReceiptAcceptanceItems(
  receipt: PracticeSessionTrainingReceipt,
  repairMode: boolean,
): PracticeSessionReceiptAcceptanceItem[] {
  const target = receipt.items.find(item => item.id === 'training-target')?.example ?? '写清本轮训练目标。'
  const evidence = receipt.items.find(item => item.id === 'completion-evidence')?.example ?? '补充可追溯完成证据。'
  const blocker = receipt.items.find(item => item.id === 'blocking-risk')?.example ?? '说明是否还有阻断项。'
  const nextStep = receipt.items.find(item => item.id === 'next-step')?.example ?? receipt.primaryAction.to

  return [
    {
      id: 'target-clear',
      label: '目标清晰',
      target,
      check: '回执里必须写清本轮目标分、题组和验收口径。',
      fallbackAction: '目标不清时先回到训练契约，重写本轮目标。',
      to: receipt.primaryAction.to,
      priority: 1,
    },
    {
      id: 'evidence-traceable',
      label: '证据可查',
      target: evidence,
      check: '回执里必须能看到开口训练、打卡或评分证据。',
      fallbackAction: '证据不足时回到打卡清单，补一条可追溯记录。',
      to: receipt.primaryAction.to,
      priority: 2,
    },
    {
      id: 'blocker-explained',
      label: '阻断说明',
      target: blocker,
      check: repairMode ? '修复态必须说明阻断项是否已经清零。' : '推进态必须说明是否还有可被追问的风险点。',
      fallbackAction: repairMode ? '阻断未清零时继续修复本轮队列。' : '风险点不清时先补一轮压力追问。',
      to: receipt.primaryAction.to,
      priority: 3,
    },
    {
      id: 'next-step-clear',
      label: '下一步明确',
      target: nextStep,
      check: '回执最后必须落到继续修复或进入下一轮的具体入口。',
      fallbackAction: '下一步不明确时先按回执模板补齐行动入口。',
      to: receipt.primaryAction.to,
      priority: 4,
    },
  ]
}

function buildAdvanceGateItems(
  acceptance: PracticeSessionReceiptAcceptance,
  blocked: boolean,
): PracticeSessionAdvanceGateItem[] {
  return acceptance.items.map(item => ({
    id: `advance-${item.id}`,
    label: item.label,
    condition: item.check,
    state: blocked ? 'blocked' : 'passed',
    action: blocked ? item.fallbackAction : '已满足，可以作为进入下一轮的依据。',
    to: item.to,
    priority: item.priority,
  }))
}

function buildLaunchPacketItems({
  gate,
  nextQueue,
  repairMode,
}: {
  gate: PracticeSessionAdvanceGate
  nextQueue: NextTrainingQueue
  repairMode: boolean
}): PracticeSessionLaunchPacketItem[] {
  const firstBlockedItem = gate.items[0]
  const firstNextItem = nextQueue.items[0]

  if (repairMode) {
    return [
      {
        id: 'open-repair-entry',
        label: '打开启动入口',
        instruction: `回到 ${gate.primaryAction.to}，只处理准入闸门里第一项未通过条件。`,
        completionRule: '能看到本轮训练队列，并明确第一项阻断条件。',
        to: gate.primaryAction.to,
        priority: 1,
      },
      {
        id: 'repair-first-blocker',
        label: firstBlockedItem?.label ?? '先清首个阻断',
        instruction: firstBlockedItem?.action ?? '先补齐回执里的目标、证据、阻断和下一步。',
        completionRule: firstBlockedItem?.condition ?? '至少补齐一条可追溯证据。',
        to: firstBlockedItem?.to ?? gate.primaryAction.to,
        priority: 2,
      },
      {
        id: 'repair-completion-rule',
        label: '完成口径',
        instruction: '回修后重新填写训练回执，并再次检查准入闸门。',
        completionRule: '准入闸门从“暂缓进入下一轮”变为“允许进入下一轮”。',
        to: gate.primaryAction.to,
        priority: 3,
      },
    ]
  }

  return [
    {
      id: 'open-next-entry',
      label: '打开启动入口',
      instruction: `进入 ${gate.primaryAction.to}，先确认下一轮训练队列已经生成。`,
      completionRule: '能看到下一轮训练题，并知道第一题为什么被选中。',
      to: gate.primaryAction.to,
      priority: 1,
    },
    {
      id: 'repeat-next-target',
      label: '复读训练目标',
      instruction: '开口复读下一轮目标分、题组和验收口径。',
      completionRule: '能用一句话说清下一轮要验证哪一个能力缺口。',
      to: gate.primaryAction.to,
      priority: 2,
    },
    {
      id: 'answer-first-next-question',
      label: firstNextItem?.title ?? '完成第一题开口',
      instruction: firstNextItem ? `先完成「${firstNextItem.title}」的开口作答。` : '先完成下一轮第一题的开口作答。',
      completionRule: '留下第一条评分样本，作为下一份战报的输入。',
      to: firstNextItem?.to ?? gate.primaryAction.to,
      priority: 3,
    },
  ]
}

function buildLaunchChecklistItems(
  packet: PracticeSessionLaunchPacket,
  repairMode: boolean,
): PracticeSessionLaunchChecklistItem[] {
  return packet.items.map(item => ({
    id: `check-${item.id}`,
    phase: item.label,
    completionRule: item.completionRule,
    evidenceTemplate: buildLaunchEvidenceTemplate(item, repairMode),
    reviewQuestion: buildLaunchReviewQuestion(item.priority, repairMode),
    to: item.to,
    priority: item.priority,
  }))
}

function buildLaunchEvidenceTemplate(
  item: PracticeSessionLaunchPacketItem,
  repairMode: boolean,
): string {
  const modeLabel = repairMode ? '回修' : '推进'

  return `【${modeLabel}-启动】${item.label}：我已完成「${item.instruction}」，结果证据是：`
}

function buildLaunchReviewQuestion(priority: number, repairMode: boolean): string {
  if (priority === 1) {
    return '我是否已经打开正确入口，并确认本轮要处理的第一件事？'
  }

  if (priority === 2) {
    return repairMode ? '我是否真的处理了第一项阻断，而不是只看提示？' : '我是否能开口说清下一轮目标？'
  }

  return repairMode ? '我是否重新验收准入闸门，并看到阻断项减少？' : '我是否已经留下第一条评分样本？'
}

function buildFirstQuestionRepairOpeningPrompt(item: PracticeSessionLaunchChecklistItem): string {
  return `我先处理「${item.phase}」，本次只验证一件事：${item.completionRule}`
}

function buildFirstQuestionOpeningPrompt(item: NextTrainingQueueItem): string {
  return `我先回答「${item.title}」。结论先行说明核心方案，再补充适用场景、关键边界和验证方式。`
}

function buildFirstQuestionPassSignal(item: NextTrainingQueueItem): string {
  const scoreSignal = typeof item.score === 'number'
    ? `最近 ${item.score} 分，本次要补到 ${STRONG_SESSION_SCORE} 分以上。`
    : `本次要形成 ${STRONG_SESSION_SCORE} 分以上的可评分样本。`

  return `${scoreSignal} 回答后能说清结论、原因、场景证据和风险边界。`
}

function buildFirstQuestionEvidenceRequirement(item: NextTrainingQueueItem): string {
  return `完成「${item.title}」后保留一次评分样本，并记录来源「${item.sourceLabel}」、原因「${item.reason}」。`
}

function buildFirstQuestionRubricItems(
  rehearsal: PracticeSessionFirstQuestionRehearsal,
  repairMode: boolean,
): PracticeSessionFirstQuestionRubricItem[] {
  return [
    {
      id: 'opening-hit',
      label: '开场命中',
      target: rehearsal.openingPrompt,
      check: repairMode
        ? '开口先说明本次只修复哪一项阻断，不能直接进入下一轮题目。'
        : '30 秒内先给结论，再说明本题要验证的核心能力。',
      evidence: '保留首段开场文本或录音转写。',
      priority: 1,
    },
    {
      id: 'pass-signal-hit',
      label: '通过信号',
      target: rehearsal.passSignal,
      check: repairMode
        ? '回修后必须能对照通过信号说明阻断项已减少。'
        : '回答后必须能对照通过信号判断是否达到强通过线。',
      evidence: '保留评分结果或人工复盘结论。',
      priority: 2,
    },
    {
      id: 'evidence-saved',
      label: '证据留存',
      target: rehearsal.evidenceRequirement,
      check: '不能只完成跳转，必须留下可追溯的文字、评分或回执证据。',
      evidence: rehearsal.evidenceRequirement,
      priority: 3,
    },
    {
      id: 'next-step-clear',
      label: '下一步明确',
      target: rehearsal.primaryAction.to,
      check: repairMode
        ? '未达标就继续回修；达标后再重新检查准入闸门。'
        : '达标后进入下一轮训练建议，未达标则回到首题继续重答。',
      evidence: '下一份战报里能看到新的评分样本或阻断项变化。',
      priority: 4,
    },
  ]
}

function buildPracticeSessionScriptCommandItem(
  question: PracticeQueueItem,
  queueIndex: number,
  progress: ReturnType<typeof buildPracticeInterviewerScriptProgress>,
): PracticeSessionScriptCommandItem {
  return {
    questionId: question.id,
    title: question.title,
    to: buildQueuePath([question.id]),
    status: resolveScriptCommandItemStatus(progress),
    scriptTitle: progress.script.title,
    summary: progress.summary,
    totalSteps: progress.totalSteps,
    passedCount: progress.passedCount,
    attemptedCount: progress.attemptedCount,
    progressPercent: progress.progressPercent,
    nextPrompt: progress.nextStep?.prompt ?? '',
    queueIndex,
  }
}

function resolveScriptCommandItemStatus(
  progress: ReturnType<typeof buildPracticeInterviewerScriptProgress>,
): PracticeSessionScriptCommandItem['status'] {
  if (progress.totalSteps > 0 && progress.passedCount === progress.totalSteps) {
    return 'complete'
  }
  if (progress.attemptedCount > 0) {
    return 'repair'
  }
  if (progress.passedCount > 0) {
    return 'active'
  }
  return 'pending'
}

function resolveScriptCommandStatus(
  items: PracticeSessionScriptCommandItem[],
): PracticeSessionScriptCommandStatus {
  if (items.length === 0) {
    return 'empty'
  }
  if (items.every(item => item.status === 'complete')) {
    return 'complete'
  }
  if (items.some(item => item.status === 'repair')) {
    return 'repair'
  }
  if (items.some(item => item.status === 'active')) {
    return 'active'
  }
  return 'pending'
}

function compareScriptCommandItems(
  left: PracticeSessionScriptCommandItem,
  right: PracticeSessionScriptCommandItem,
): number {
  const priority: Record<PracticeSessionScriptCommandItem['status'], number> = {
    repair: 0,
    active: 1,
    pending: 2,
    complete: 3,
  }

  return priority[left.status] - priority[right.status]
    || left.progressPercent - right.progressPercent
    || left.queueIndex - right.queueIndex
}

function resolveScriptCommandTitle(status: PracticeSessionScriptCommandStatus): string {
  if (status === 'empty') {
    return '脚本总控待建立'
  }
  if (status === 'complete') {
    return '脚本追问已打穿'
  }
  if (status === 'repair') {
    return '脚本追问需要修复'
  }
  if (status === 'active') {
    return '脚本追问正在推进'
  }
  return '脚本追问待开始'
}

function resolveScriptCommandSummary(
  status: PracticeSessionScriptCommandStatus,
  passedCount: number,
  totalSteps: number,
  attemptedQuestionCount: number,
): string {
  if (status === 'empty') {
    return '先建立本轮练习队列，系统会汇总每题面试官脚本进度。'
  }
  if (status === 'complete') {
    return `本轮 ${totalSteps} 个脚本追问已全部通过，可以复练或沉淀高分素材。`
  }
  if (status === 'repair') {
    return `已通过 ${passedCount}/${totalSteps} 个脚本追问，${attemptedQuestionCount} 道题存在修复中追问。`
  }
  if (status === 'active') {
    return `已通过 ${passedCount}/${totalSteps} 个脚本追问，继续完成剩余追问。`
  }
  return `本轮共有 ${totalSteps} 个脚本追问，先从第一道题开始推进。`
}

function buildScriptCommandPrimaryAction(
  status: PracticeSessionScriptCommandStatus,
  item?: PracticeSessionScriptCommandItem,
): PracticeSessionReportAction {
  if (!item) {
    return {
      kind: 'start',
      label: '建立脚本总控',
      description: '先建立本轮练习队列，再完成本题面试官脚本。',
      to: '/practice',
    }
  }
  if (status === 'complete') {
    return {
      kind: 'review',
      label: '复练脚本追问',
      description: '本轮脚本已通过，回到题目复练保持临场手感。',
      to: item.to,
    }
  }
  if (status === 'repair') {
    return {
      kind: 'repair',
      label: '修复当前脚本',
      description: '先处理修复中的追问，补齐证据后再进入下一问。',
      to: item.to,
    }
  }
  if (status === 'active') {
    return {
      kind: 'continue',
      label: '继续脚本追问',
      description: '从已开始的题目继续推进未通过追问。',
      to: item.to,
    }
  }
  return {
    kind: 'continue',
    label: '开始脚本追问',
    description: '从队列第一题开始完成本题面试官脚本。',
    to: item.to,
  }
}

function scriptCommandItemStatusLabel(status: PracticeSessionScriptCommandItem['status']): string {
  if (status === 'complete') {
    return '已通过'
  }
  if (status === 'repair') {
    return '修复中'
  }
  if (status === 'active') {
    return '推进中'
  }
  return '待练'
}

function buildQueueProfile(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  weakQuestionIds: number[],
): PracticeSessionQueueProfile {
  if (queue.length === 0) {
    return {
      isEmpty: true,
      sourceSummary: '暂无来源',
      nextQuestionTitle: '暂无下一题',
      nextQuestionMeta: '先从学习计划、薄弱题或题库进入模拟面试。',
      unansweredQuestionIds: [],
      weakQuestionIds,
      queuePath: '/practice',
    }
  }

  const unansweredQuestionIds = resolveUnansweredQuestionIds(queue, progress)
  const nextQuestion = queue.find(item => unansweredQuestionIds.includes(item.id))
    ?? queue.find(item => weakQuestionIds.includes(item.id))
    ?? queue[0]
  const nextScore = latestAttemptForQuestion(progress, nextQuestion.id)?.feedback.score
  const nextStatus = progress.questionStates[nextQuestion.id]?.status ?? nextQuestion.status

  return {
    isEmpty: false,
    sourceSummary: summarizeQueueSources(queue),
    nextQuestionTitle: nextQuestion.title,
    nextQuestionMeta: `${nextQuestion.categoryName}，${formatStatus(nextStatus)}，${formatScore(nextScore)}`,
    unansweredQuestionIds,
    weakQuestionIds,
    queuePath: buildQueuePath(queue.map(item => item.id)),
  }
}

function buildPracticeSessionProgressContext(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): StudyProgress {
  if (queue.length === 0) {
    return progress
  }

  const sessionQuestionIds = queue
    .map(item => item.id)
    .filter(questionId => Number.isFinite(questionId) && questionId > 0)

  // 本轮练习队列可能来自 URL 临时参数，未必已经写入今日计划；这里仅在生成战报时补齐上下文，
  // 让下一轮训练能使用本轮评分和题目信息，不修改用户真实的本地进度。
  const questionSnapshots = { ...progress.questionSnapshots }
  const questionStates = { ...progress.questionStates }

  for (const item of queue) {
    questionSnapshots[item.id] = questionSnapshots[item.id] ?? snapshotFromQueueItem(item)
    questionStates[item.id] = questionStates[item.id] ?? {
      status: item.status,
      addedToPlan: item.source === 'plan',
      reviewCount: 0,
    }
  }

  return {
    ...progress,
    dailyPlan: [...new Set([...progress.dailyPlan, ...sessionQuestionIds])],
    questionSnapshots,
    questionStates,
  }
}

function buildPracticeSessionScopedProgress(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): StudyProgress {
  const queueIdSet = new Set(
    queue
      .map(item => item.id)
      .filter(questionId => Number.isFinite(questionId) && questionId > 0),
  )
  const context = buildPracticeSessionProgressContext(queue, progress)

  return {
    ...context,
    dailyPlan: context.dailyPlan.filter(questionId => queueIdSet.has(questionId)),
    questionStates: filterRecordByQuestionIds(context.questionStates, queueIdSet),
    questionSnapshots: filterRecordByQuestionIds(context.questionSnapshots, queueIdSet),
    interviewAttempts: filterRecordByQuestionIds(context.interviewAttempts, queueIdSet),
  }
}

function filterRecordByQuestionIds<T>(record: Record<number, T>, questionIds: Set<number>): Record<number, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([questionId]) => questionIds.has(Number(questionId))),
  ) as Record<number, T>
}

function snapshotFromQueueItem(item: PracticeQueueItem): QuestionSnapshot {
  return {
    id: item.id,
    title: item.title,
    difficulty: item.difficulty,
    categoryName: item.categoryName,
    tags: item.tags,
    viewCount: item.viewCount,
  }
}

function resolveUnansweredQuestionIds(queue: PracticeQueueItem[], progress: StudyProgress): number[] {
  return queue
    .filter(item => !latestAttemptForQuestion(progress, item.id))
    .map(item => item.id)
}

function summarizeQueueSources(queue: PracticeQueueItem[]): string {
  const counts = queue.reduce((accumulator, item) => {
    accumulator.set(item.source, (accumulator.get(item.source) ?? 0) + 1)
    return accumulator
  }, new Map<PracticeQueueItem['source'], number>())

  return [...counts.entries()]
    .map(([source, count]) => `${formatQueueSource(source)} ${count} 道`)
    .join('、') || '暂无来源'
}

function formatQueueSource(source: PracticeQueueItem['source']): string {
  return queueSourceLabels[source] ?? source
}

function formatStatus(status: PracticeQueueItem['status']): string {
  return statusLabels[status] ?? status
}

function formatDifficulty(difficulty: string): string {
  return difficultyLabels[difficulty] ?? difficulty
}

function buildQuestionPath(questionId: number): string {
  return `/practice?question=${questionId}`
}

function titleForLevel(level: PracticeSessionReportLevel, unansweredCount: number): string {
  if (level === 'empty') {
    return '等待开始本轮练习'
  }
  if (level === 'risk') {
    return '本轮优先补弱'
  }
  if (level === 'passed') {
    return '本轮已稳定通过'
  }
  return unansweredCount > 0 ? '本轮正在推进' : '本轮需要复盘'
}

function summaryForLevel(
  level: PracticeSessionReportLevel,
  answeredCount: number,
  totalCount: number,
  averageScore: number,
  weakCount: number,
): string {
  if (level === 'risk') {
    return `已答 ${answeredCount}/${totalCount}，平均 ${averageScore} 分；${weakCount} 道题需要先补弱重练。`
  }
  if (level === 'passed') {
    return `本轮 ${totalCount} 道题全部完成，平均 ${averageScore} 分，可以沉淀为面试表达素材。`
  }
  return `已答 ${answeredCount}/${totalCount}，平均 ${averageScore} 分；先补齐剩余题目再做整轮判断。`
}

function buildMetrics(input: {
  answeredCount: number
  totalCount: number
  averageScore: number
  passCount: number
  weakestCriterion?: WeakestCriterionSummary
  unansweredCount: number
}): PracticeSessionReportMetric[] {
  return [
    {
      key: 'answered',
      label: '已答题',
      value: `${input.answeredCount} / ${input.totalCount}`,
      detail: input.unansweredCount > 0 ? `剩余 ${input.unansweredCount} 道` : '本轮已答完',
    },
    {
      key: 'average',
      label: '平均分',
      value: `${input.averageScore} 分`,
      detail: input.averageScore >= PASSING_SCORE ? '达到通过线' : '低于通过线',
    },
    {
      key: 'pass',
      label: '通过数',
      value: `${input.passCount} 道`,
      detail: `${PASSING_SCORE} 分以上计为通过`,
    },
    {
      key: 'weakest',
      label: '最弱项',
      value: input.weakestCriterion
        ? `${input.weakestCriterion.label} ${input.weakestCriterion.averageScore}`
        : '暂无',
      detail: input.weakestCriterion?.summary ?? '完成评分后自动定位',
    },
  ]
}

function actionForCriterion(key: InterviewCriterionKey): string {
  if (key === 'coverage') {
    return '先补定义、机制和替代方案，再重答本题。'
  }
  if (key === 'structure') {
    return '先按“结论 -> 原因 -> 场景 -> 边界”重组结构。'
  }
  if (key === 'specificity') {
    return '补一个项目场景、触发条件和可验证指标。'
  }
  return '补失败边界、误区和兜底方案。'
}

function repairDraftHints(key?: InterviewCriterionKey): {
  conclusion: string
  reason: string
  scenario: string
  boundary: string
} {
  if (key === 'coverage') {
    return {
      conclusion: '先一句话给出定义和适用边界。',
      reason: '补核心机制、关键步骤和替代方案差异。',
      scenario: '补一个真实项目触发场景和选择依据。',
      boundary: '补不适用场景、常见误区和兜底方案。',
    }
  }
  if (key === 'structure') {
    return {
      conclusion: '先给明确结论。',
      reason: '按 2-3 点展开原因。',
      scenario: '补项目场景、规模、指标或数据。',
      boundary: '补风险、边界条件和落地方案。',
    }
  }
  if (key === 'specificity') {
    return {
      conclusion: '先把结论落到具体业务场景。',
      reason: '说明触发条件、约束和为什么这样选。',
      scenario: '补项目规模、流量、数据量、排查过程或指标。',
      boundary: '补验证方式、监控指标和回滚方案。',
    }
  }
  if (key === 'risk') {
    return {
      conclusion: '先说明核心方案和主要风险。',
      reason: '解释风险来源、影响范围和取舍。',
      scenario: '补线上异常、容量、并发或数据一致性场景。',
      boundary: '补兜底、降级、监控和恢复策略。',
    }
  }
  return {
    conclusion: '先给出可以评分的明确结论。',
    reason: '补核心原理、关键步骤和取舍依据。',
    scenario: '补一个项目场景、触发条件和验证指标。',
    boundary: '补风险边界、常见误区和兜底方案。',
  }
}

function formatQuestionIds(questionIds: number[]): string {
  return questionIds.length > 0 ? questionIds.join(', ') : '暂无'
}

function formatScore(score?: number): string {
  return typeof score === 'number' ? `${score} 分` : '暂无'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
