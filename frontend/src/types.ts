export interface Category {
  id: number
  name: string
  icon: string
  description: string
  sortOrder: number
}

export interface Tag {
  id: number
  name: string
}

export interface Question {
  id: number
  title: string
  summary?: string
  content: string
  answer?: string        // 备选答案（当 content 为空时使用）
  principle?: string
  comparison?: string
  scenario?: string
  risk?: string
  projectExp?: string
  codeExamples?: string
  diagrams?: string
  relatedIds?: string
  difficulty: string
  categoryName: string
  categoryId?: number
  tags: string[]
  viewCount: number
  createTime: string
}

export interface QuestionAdmin extends Question {
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED'
  source: 'AI_GENERATED' | 'AI_REWRITE' | 'MANUAL'
}

export type DraftRiskType =
  | 'EMPTY_ANSWER'
  | 'SHORT_ANSWER'
  | 'MISSING_SUMMARY'
  | 'MISSING_PRINCIPLE'
  | 'MISSING_COMPARISON'
  | 'MISSING_SCENARIO'
  | 'MISSING_RISK'
  | 'MISSING_PROJECT_EXP'
  | 'MISSING_CODE_EXAMPLES'
  | 'MISSING_CONTENT_SECTIONS'
  | 'INVALID_DIFFICULTY'

export type DraftContentStatus = 'EMPTY' | 'WITH_CONTENT'

export interface DraftReviewFilters {
  categoryId?: number
  difficulty?: string
  keyword?: string
  riskType?: DraftRiskType
  contentStatus?: DraftContentStatus
}

export interface AdminCategoryQuality {
  categoryId: number | null
  categoryName: string
  total: number
  published: number
  draft: number
  rejected: number
  emptyAnswer: number
  shortAnswer: number
  missingPrinciple: number
  missingRisk: number
  missingProjectExp: number
  missingCodeExamples: number
  missingSummary: number
  missingComparison: number
  missingScenario: number
  missingContentSections: number
  invalidDifficulty: number
  completionRate: number
  riskScore: number
}

export interface AdminQualityTodo {
  type: 'EMPTY_ANSWER' | 'QUALITY_RISK' | 'DRAFT_REVIEW' | 'REJECTED_REPAIR' | 'QUALITY_HEALTHY' | string
  title: string
  detail: string
  categoryId: number | null
  categoryName: string | null
  count: number
  tone: 'danger' | 'warning' | 'default' | 'success' | string
}

export interface AdminQualitySummary {
  totalQuestions: number
  publishedQuestions: number
  draftQuestions: number
  rejectedQuestions: number
  emptyAnswerQuestions: number
  qualityRiskQuestions: number
  completionRate: number
  categories: AdminCategoryQuality[]
  todos: AdminQualityTodo[]
}

export interface CodeExample {
  lang: string
  title: string
  code: string
  description: string
}

export interface Diagram {
  type: 'mermaid' | 'svg' | 'url'
  alt: string
  content: string
  caption: string
}

export interface BatchProgress {
  status: 'RUNNING' | 'IDLE'
  totalCategories: number
  completedCategories: number
  totalQuestions: number
  generatedQuestions: number
  failedCategories: number
  currentCategory: string | null
  currentMessage: string | null
  errors: string[]
}

export interface AdminAiConfigStatus {
  available: boolean
  apiKeyConfigured: boolean
  maskedApiKey?: string
  model: string
  apiUrl?: string
  endpointHost: string
  interviewEnabled?: boolean
  message: string
}

export interface AdminAiConfigUpdateRequest {
  apiKey?: string
  model?: string
  apiUrl?: string
  interviewEnabled?: boolean
}

export interface GenerationTask {
  taskId: number
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  total: number
  successCount: number
  failCount: number
  message: string
  errors: string[]
  generatedIds: number[]
  thinking?: string       // AI 思考过程（reasoning_content）
}

export interface StreamEvent {
  type: 'thinking' | 'content' | 'progress' | 'question_result' | 'total' | 'done' | 'error' | 'info'
  data: string
}

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  total: number
  totalPages: number
}

export type StudyQuestionStatus = 'new' | 'learning' | 'mastered' | 'weak'

export interface QuestionStudyState {
  status: StudyQuestionStatus
  addedToPlan: boolean
  lastReviewedAt?: string
  reviewCount: number
  lastEncounteredAt?: string
  encounterCount?: number
}

export interface QuestionSnapshot {
  id: number
  title: string
  difficulty: string
  categoryName: string
  categoryId?: number
  tags: string[]
  viewCount: number
}

export interface StudyProgress {
  targetRole: string
  sprintDays: number
  questionStates: Record<number, QuestionStudyState>
  questionSnapshots: Record<number, QuestionSnapshot>
  interviewAttempts: Record<number, InterviewAttempt[]>
  dailyPlan: number[]
  updatedAt: string
}

export interface StudySummary {
  totalTracked: number
  mastered: number
  weak: number
  learning: number
  masteryRate: number
}

export interface StudyStrategyFactor {
  key: 'mastery' | 'weakness' | 'interview' | 'plan'
  label: string
  value: string
  score: number
  detail: string
}

export interface StudyStrategyAction {
  key: string
  label: string
  description: string
  to: string
  tone: 'primary' | 'default' | 'warning'
}

export interface StudyStrategyRisk {
  key: 'start-tracking' | 'empty-plan' | 'weak-review' | 'interview-practice' | 'continue-route'
  title: string
  description: string
}

export interface StudyStrategy {
  readinessScore: number
  level: 'start' | 'building' | 'ready' | 'sharp'
  title: string
  summary: string
  primaryRisk: StudyStrategyRisk
  factors: StudyStrategyFactor[]
  actions: StudyStrategyAction[]
}

export type DailyMissionKind = 'draft' | 'review' | 'ability' | 'experience' | 'interview' | 'plan'

export interface DailyMissionItem {
  id: string
  kind: DailyMissionKind
  title: string
  actionLabel: string
  description: string
  reason: string
  to: string
  priority: number
  metric: string
}

export interface DailyMissionPlan {
  title: string
  summary: string
  missions: DailyMissionItem[]
}

export type StudyPaceCoachLevel = 'empty' | 'behind' | 'balanced' | 'ahead'

export type StudyPaceActionKey = 'start' | 'review' | 'activeRecall' | 'plan' | 'interview' | 'practice'

export interface StudyPaceAction {
  key: StudyPaceActionKey
  label: string
  description: string
  to: string
}

export interface StudyPaceMetric {
  key: 'target' | 'planned' | 'review' | 'activeRecall' | 'interview'
  label: string
  value: string
  detail: string
}

export interface StudyPaceCoach {
  level: StudyPaceCoachLevel
  title: string
  summary: string
  dailyQuestionTarget: number
  plannedCount: number
  reviewDueCount: number
  activeRecallCount: number
  interviewAttemptCount: number
  metrics: StudyPaceMetric[]
  actions: StudyPaceAction[]
  primaryAction: StudyPaceAction
}

export type PrepHealthDimensionKey = 'review' | 'ability' | 'interview' | 'pace'

export type PrepHealthDimensionStatus = 'empty' | 'danger' | 'warning' | 'stable'

export type PrepHealthLevel = 'empty' | 'risk' | 'watch' | 'healthy'

export interface PrepHealthDimension {
  key: PrepHealthDimensionKey
  label: string
  score: number
  status: PrepHealthDimensionStatus
  metric: string
  description: string
  detail: string
}

export interface PrepHealthAction {
  label: string
  description: string
  to: string
}

export interface PrepHealthReport {
  score: number
  level: PrepHealthLevel
  title: string
  summary: string
  dimensions: PrepHealthDimension[]
  primaryDimension: PrepHealthDimension
  primaryAction: PrepHealthAction
}

export type InterviewBriefLevel = 'empty' | 'risk' | 'warmup' | 'ready'

export interface InterviewBriefItem {
  id: string
  title: string
  description: string
  metric: string
  questionId?: number
  to?: string
}

export interface InterviewBriefAction {
  label: string
  description: string
  to: string
}

export interface InterviewBriefReport {
  level: InterviewBriefLevel
  title: string
  summary: string
  primaryAction: InterviewBriefAction
  strengths: InterviewBriefItem[]
  risks: InterviewBriefItem[]
  warmups: InterviewBriefItem[]
}

export type InterviewMistakeLedgerLevel = 'empty' | 'risk' | 'watch' | 'stable'

export type InterviewMistakeLedgerItemType = 'criterion' | 'weak-unspoken' | 'advanced'

export interface InterviewMistakeLedgerAction {
  label: string
  description: string
  to: string
}

export interface InterviewMistakeLedgerItem {
  id: string
  type: InterviewMistakeLedgerItemType
  criterionKey?: InterviewCriterionKey
  label: string
  summary: string
  averageScore: number
  attempts: number
  affectedQuestionIds: number[]
  latestQuestionTitle: string
  priority: number
  to: string
  actionLabel: string
}

export interface InterviewMistakeLedger {
  level: InterviewMistakeLedgerLevel
  title: string
  summary: string
  totalProblems: number
  items: InterviewMistakeLedgerItem[]
  primaryAction: InterviewMistakeLedgerAction
}

export type InterviewRecoveryPlanMode = 'empty' | 'repair' | 'advanced'

export interface InterviewRecoveryStep {
  id: string
  title: string
  description: string
  reason: string
  durationMinutes: number
  questionIds: number[]
  to: string
  actionLabel: string
  priority: number
}

export interface InterviewRecoveryPlan {
  mode: InterviewRecoveryPlanMode
  title: string
  summary: string
  totalMinutes: number
  steps: InterviewRecoveryStep[]
  primaryAction: InterviewMistakeLedgerAction
}

export type InterviewRecoveryAcceptanceStatus = 'empty' | 'pending' | 'testing' | 'passed' | 'failed' | 'advanced'

export interface InterviewRecoveryAcceptance {
  status: InterviewRecoveryAcceptanceStatus
  title: string
  summary: string
  passedCount: number
  totalCount: number
  passedQuestionIds: number[]
  failedQuestionIds: number[]
  pendingQuestionIds: number[]
  primaryAction: InterviewMistakeLedgerAction
}

export interface WeakArea {
  categoryId?: number
  categoryName: string
  score: number
  weakCount: number
  learningCount: number
  masteredCount: number
}

export type AbilityReadinessLevel = 'empty' | 'weak' | 'building' | 'ready'

export interface AbilityMapItem {
  routeId: string
  title: string
  role: string
  readinessScore: number
  readinessLevel: AbilityReadinessLevel
  remembered: number
  mastered: number
  weak: number
  learning: number
  nextQuestionIds: number[]
  summary: string
}

export interface ReviewQueueItem extends QuestionSnapshot {
  status: StudyQuestionStatus
  lastReviewedAt?: string
  reviewCount: number
  lastEncounteredAt?: string
  encounterCount?: number
  reason: string
}

export type ReviewDueStatus = 'overdue' | 'due-today' | 'upcoming'

export interface ScheduledReviewItem extends ReviewQueueItem {
  dueStatus: ReviewDueStatus
  nextReviewAt: string
  daysUntilDue: number
  scheduleReason: string
}

export interface ReviewScheduleSummary {
  overdue: number
  dueToday: number
  upcoming: number
  activeRecall: number
  nextReviewAt?: string
}

export type DailyPlanBriefItemSource = 'review-debt' | 'weak' | 'learning' | 'new' | 'mastered'

export interface DailyPlanBriefMetric {
  key: 'total' | 'reviewDebt' | 'weak' | 'new'
  label: string
  value: string
  detail: string
}

export interface DailyPlanBriefItem {
  id: string
  questionId: number
  title: string
  categoryName: string
  status: StudyQuestionStatus
  source: DailyPlanBriefItemSource
  sourceLabel: string
  reason: string
  actionLabel: string
  to: string
  priority: number
  dueStatus?: ReviewDueStatus
}

export interface DailyPlanBrief {
  title: string
  summary: string
  totalCount: number
  reviewDebtCount: number
  weakCount: number
  newCount: number
  metrics: DailyPlanBriefMetric[]
  items: DailyPlanBriefItem[]
}

export type DailyPlanCompletionLevel = 'empty' | 'risk' | 'active' | 'ready' | 'excellent'

export interface DailyPlanCompletionMetric {
  key: 'completion' | 'mastered' | 'risk' | 'interview'
  label: string
  value: string
  detail: string
}

export interface DailyPlanCompletionAction {
  label: string
  description: string
  to: string
}

export interface DailyPlanCompletionTodo {
  id: string
  questionId?: number
  title: string
  description: string
  tone: 'danger' | 'warning' | 'default' | 'success'
  to: string
}

export interface DailyPlanCompletionImpact {
  questionId: number
  title: string
  score: number
  status: StudyQuestionStatus
  message: string
  actionLabel: string
  to: string
  createdAt: string
}

export interface DailyPlanCompletion {
  level: DailyPlanCompletionLevel
  title: string
  summary: string
  completionRate: number
  totalCount: number
  masteredCount: number
  remainingCount: number
  weakCount: number
  reviewDebtCount: number
  interviewTodayCount: number
  metrics: DailyPlanCompletionMetric[]
  statusImpacts: DailyPlanCompletionImpact[]
  todos: DailyPlanCompletionTodo[]
  primaryAction: DailyPlanCompletionAction
}

export type NextTrainingQueueItemSource = 'score-impact' | 'review-debt' | 'mistake' | 'weak' | 'learning' | 'plan'

export interface NextTrainingQueueMetric {
  key: 'total' | 'urgent' | 'weak' | 'interview'
  label: string
  value: string
  detail: string
}

export interface NextTrainingQueueAction {
  label: string
  description: string
  to: string
}

export interface NextTrainingQueueItem {
  id: string
  questionId: number
  title: string
  categoryName: string
  status: StudyQuestionStatus
  source: NextTrainingQueueItemSource
  sourceLabel: string
  reason: string
  actionLabel: string
  to: string
  priority: number
  score?: number
  dueStatus?: ReviewDueStatus
}

export interface NextTrainingQueue {
  title: string
  summary: string
  totalCount: number
  urgentCount: number
  weakCount: number
  interviewRepairCount: number
  metrics: NextTrainingQueueMetric[]
  items: NextTrainingQueueItem[]
  primaryAction: NextTrainingQueueAction
}

export type InterviewEmergencyKitLevel = 'empty' | 'critical' | 'focused' | 'ready'

export type InterviewEmergencyKitItemKind = 'review' | 'mistake' | 'weak' | 'closure' | 'sample'

export interface InterviewEmergencyKitAction {
  label: string
  description: string
  to: string
}

export interface InterviewEmergencyKitMetric {
  key: 'actions' | 'minutes' | 'review' | 'mistake'
  label: string
  value: string
  detail: string
}

export interface InterviewEmergencyKitItem {
  id: string
  kind: InterviewEmergencyKitItemKind
  title: string
  description: string
  reason: string
  to: string
  durationMinutes: number
  priority: number
  questionIds: number[]
  actionLabel: string
}

export interface InterviewEmergencyKit {
  level: InterviewEmergencyKitLevel
  title: string
  summary: string
  totalMinutes: number
  reviewDebtCount: number
  mistakeCount: number
  metrics: InterviewEmergencyKitMetric[]
  items: InterviewEmergencyKitItem[]
  primaryAction: InterviewEmergencyKitAction
}

export type InterviewLastMinuteBriefLevel = 'empty' | 'risk' | 'focused' | 'ready'

export type InterviewLastMinuteBriefItemKind = 'must-review' | 'talk-track' | 'avoid' | 'closing' | 'sample'

export interface InterviewLastMinuteBriefAction {
  label: string
  description: string
  to: string
}

export interface InterviewLastMinuteBriefMetric {
  key: 'confidence' | 'attempts' | 'review' | 'mistake' | 'average'
  label: string
  value: string
  detail: string
}

export interface InterviewLastMinuteBriefItem {
  id: string
  kind: InterviewLastMinuteBriefItemKind
  title: string
  detail: string
  evidence: string
  to: string
  questionIds: number[]
  priority: number
  actionLabel: string
}

export interface InterviewLastMinuteBrief {
  level: InterviewLastMinuteBriefLevel
  title: string
  summary: string
  confidenceScore: number
  metrics: InterviewLastMinuteBriefMetric[]
  items: InterviewLastMinuteBriefItem[]
  primaryAction: InterviewLastMinuteBriefAction
}

export type InterviewMaterialVaultLevel = 'empty' | 'building' | 'ready'

export type InterviewMaterialKind = 'conclusion' | 'scenario' | 'risk'

export interface InterviewMaterialVaultAction {
  label: string
  description: string
  to: string
}

export interface InterviewMaterialVaultMetric {
  key: 'samples' | 'categories' | 'average' | 'ready'
  label: string
  value: string
  detail: string
}

export interface InterviewMaterialSnippet {
  id: string
  questionId: number
  title: string
  categoryName: string
  score: number
  kind: InterviewMaterialKind
  label: string
  content: string
  reason: string
  to: string
  priority: number
  createdAt: string
}

export interface InterviewMaterialVault {
  level: InterviewMaterialVaultLevel
  title: string
  summary: string
  totalSamples: number
  categoryCount: number
  averageScore: number
  metrics: InterviewMaterialVaultMetric[]
  snippets: InterviewMaterialSnippet[]
  primaryAction: InterviewMaterialVaultAction
}

export type InterviewFollowUpDefenseLevel = 'empty' | 'risk' | 'pressure' | 'ready'

export interface InterviewFollowUpDefenseAction {
  label: string
  description: string
  to: string
}

export interface InterviewFollowUpDefenseMetric {
  key: 'items' | 'average' | 'risk' | 'categories'
  label: string
  value: string
  detail: string
}

export interface InterviewFollowUpDefenseItem {
  id: string
  questionId: number
  title: string
  categoryName: string
  score: number
  criterionKey: FollowUpDrillCriterionKey
  criterionLabel: string
  prompt: string
  pressurePoint: string
  answerGuide: string
  to: string
  priority: number
  createdAt: string
}

export interface InterviewFollowUpDefense {
  level: InterviewFollowUpDefenseLevel
  title: string
  summary: string
  averageScore: number
  riskCount: number
  categoryCount: number
  metrics: InterviewFollowUpDefenseMetric[]
  items: InterviewFollowUpDefenseItem[]
  primaryAction: InterviewFollowUpDefenseAction
}

export type PracticeQueueSource = 'review' | 'plan' | 'page' | 'active-recall' | 'new'

export interface PracticeQueueItem extends QuestionSnapshot {
  status: StudyQuestionStatus
  source: PracticeQueueSource
}

export type PracticeSessionReportLevel = 'empty' | 'in-progress' | 'risk' | 'passed'

export type PracticeSessionReportActionKind = 'start' | 'repair' | 'continue' | 'review'

export interface PracticeSessionReportMetric {
  key: 'answered' | 'average' | 'pass' | 'weakest'
  label: string
  value: string
  detail: string
}

export interface PracticeSessionReportAction {
  kind: PracticeSessionReportActionKind
  label: string
  description: string
  to: string
}

export interface PracticeSessionReportPressureItem {
  questionId: number
  signal: string
  detail: string
  interviewerProbe?: string
  passCriteria?: string
}

export interface PracticeSessionReportContext {
  sourceLabel: string
  queuePath?: string
  pressureItems?: PracticeSessionReportPressureItem[]
}

export interface PracticeSessionRepairAction {
  questionId: number
  title: string
  score?: number
  criterionKey?: InterviewCriterionKey
  criterionLabel: string
  criterionScore?: number
  reason: string
  action: string
  to: string
}

export interface PracticeSessionQueueProfile {
  isEmpty: boolean
  sourceSummary: string
  nextQuestionTitle: string
  nextQuestionMeta: string
  unansweredQuestionIds: number[]
  weakQuestionIds: number[]
  queuePath: string
}

export interface PracticeSessionReport {
  level: PracticeSessionReportLevel
  title: string
  summary: string
  answeredCount: number
  totalCount: number
  averageScore: number
  passCount: number
  weakQuestionIds: number[]
  metrics: PracticeSessionReportMetric[]
  repairActions: PracticeSessionRepairAction[]
  queueProfile: PracticeSessionQueueProfile
  primaryAction: PracticeSessionReportAction
}

export type InterviewCriterionKey = 'coverage' | 'structure' | 'specificity' | 'risk'

export interface InterviewCriterion {
  key: InterviewCriterionKey
  label: string
  score: number
  summary: string
}

export type PracticeSessionAbilityRadarStatus = 'empty' | 'risk' | 'watch' | 'stable'

export interface PracticeSessionAbilityRadarItem {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  attempts: number
  lowScoreQuestionIds: number[]
  summary: string
  actionLabel: string
  to: string
}

export interface PracticeSessionAbilityRadar {
  status: PracticeSessionAbilityRadarStatus
  title: string
  summary: string
  answeredCount: number
  weakestItem?: PracticeSessionAbilityRadarItem
  items: PracticeSessionAbilityRadarItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionInterviewerDecisionStatus = 'empty' | 'reject-risk' | 'hold' | 'pass' | 'strong-pass'

export interface PracticeSessionInterviewerDecisionEvidence {
  key: 'answered' | 'average' | 'pass' | 'weakest'
  label: string
  value: string
  detail: string
}

export interface PracticeSessionInterviewerDecision {
  status: PracticeSessionInterviewerDecisionStatus
  title: string
  verdict: string
  summary: string
  evidence: PracticeSessionInterviewerDecisionEvidence[]
  blockers: string[]
  primaryAction: PracticeSessionReportAction
}

export interface PracticeSessionActionPriorityItem {
  id: string
  kind: PracticeSessionReportActionKind
  label: string
  description: string
  reason: string
  to: string
  priority: number
}

export interface PracticeSessionActionPriorities {
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionActionPriorityItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionEvidenceGapStatus = 'empty' | 'blocked' | 'watch' | 'ready'

export interface PracticeSessionEvidenceGapItem {
  id: string
  questionId: number
  title: string
  criterionKey: InterviewCriterionKey
  criterionLabel: string
  score: number
  gap: string
  interviewerProbe: string
  repairHint: string
  to: string
  priority: number
}

export interface PracticeSessionEvidenceGaps {
  status: PracticeSessionEvidenceGapStatus
  title: string
  summary: string
  totalCount: number
  criticalCount: number
  items: PracticeSessionEvidenceGapItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionReplayCardStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionReplayCardItem {
  id: string
  questionId: number
  title: string
  focus: string
  openingLine: string
  evidenceLine: string
  boundaryLine: string
  rehearsalPrompt: string
  to: string
  priority: number
}

export interface PracticeSessionReplayCards {
  status: PracticeSessionReplayCardStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionReplayCardItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionReplayChecklistStatus = 'empty' | 'checking' | 'ready'

export interface PracticeSessionReplayChecklistItem {
  id: string
  label: string
  description: string
  failureSignal: string
  target: string
  to: string
}

export interface PracticeSessionReplayChecklist {
  status: PracticeSessionReplayChecklistStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionReplayChecklistItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionPressureProbeStatus = 'empty' | 'pressure' | 'ready'

export interface PracticeSessionPressureProbeItem {
  id: string
  questionId: number
  title: string
  label: string
  probe: string
  riskSignal: string
  answerGuide: string
  to: string
  priority: number
}

export interface PracticeSessionPressureProbes {
  status: PracticeSessionPressureProbeStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionPressureProbeItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionRiskGuardrailStatus = 'empty' | 'warning' | 'ready'

export interface PracticeSessionRiskGuardrailItem {
  id: string
  label: string
  avoid: string
  reason: string
  replacement: string
  to: string
  priority: number
}

export interface PracticeSessionRiskGuardrails {
  status: PracticeSessionRiskGuardrailStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionRiskGuardrailItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionRetryDraftStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionRetryDraftItem {
  id: string
  questionId: number
  title: string
  conclusionLine: string
  evidenceLine: string
  boundaryLine: string
  closingLine: string
  fullDraft: string
  to: string
  priority: number
}

export interface PracticeSessionRetryDrafts {
  status: PracticeSessionRetryDraftStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionRetryDraftItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionPassGateStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionPassGateItemStatus = 'blocked' | 'ready'

export interface PracticeSessionPassGateItem {
  id: string
  label: string
  target: string
  current: string
  status: PracticeSessionPassGateItemStatus
  action: string
  to: string
  priority: number
}

export interface PracticeSessionPassGate {
  status: PracticeSessionPassGateStatus
  title: string
  summary: string
  passedCount: number
  totalCount: number
  items: PracticeSessionPassGateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionPassEvidenceStatus = 'empty' | 'blocked' | 'ready'

export interface PracticeSessionPassEvidenceItem {
  id: string
  label: string
  value: string
  explanation: string
  action: string
  to: string
  priority: number
}

export interface PracticeSessionPassEvidence {
  status: PracticeSessionPassEvidenceStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionPassEvidenceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionTrainingContractStatus = 'empty' | 'repair' | 'advance'

export interface PracticeSessionTrainingContractItem {
  id: string
  label: string
  value: string
  detail: string
  priority: number
}

export interface PracticeSessionTrainingContract {
  status: PracticeSessionTrainingContractStatus
  title: string
  summary: string
  items: PracticeSessionTrainingContractItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionTrainingScheduleStatus = 'empty' | 'repair' | 'advance'

export interface PracticeSessionTrainingScheduleItem {
  id: string
  phase: string
  timeRange: string
  title: string
  task: string
  acceptance: string
  to: string
  priority: number
}

export interface PracticeSessionTrainingSchedule {
  status: PracticeSessionTrainingScheduleStatus
  title: string
  summary: string
  totalMinutes: number
  items: PracticeSessionTrainingScheduleItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionScheduleChecklistStatus = 'empty' | 'repair' | 'advance'

export interface PracticeSessionScheduleChecklistItem {
  id: string
  phase: string
  checkLabel: string
  completionRule: string
  evidenceTemplate: string
  reviewQuestion: string
  to: string
  priority: number
}

export interface PracticeSessionScheduleChecklist {
  status: PracticeSessionScheduleChecklistStatus
  title: string
  summary: string
  items: PracticeSessionScheduleChecklistItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionTrainingReceiptStatus = 'empty' | 'repair' | 'advance'

export interface PracticeSessionTrainingReceiptItem {
  id: string
  label: string
  prompt: string
  example: string
  priority: number
}

export interface PracticeSessionTrainingReceipt {
  status: PracticeSessionTrainingReceiptStatus
  title: string
  summary: string
  items: PracticeSessionTrainingReceiptItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionReceiptAcceptanceStatus = 'empty' | 'repair' | 'advance'

export interface PracticeSessionReceiptAcceptanceItem {
  id: string
  label: string
  target: string
  check: string
  fallbackAction: string
  to: string
  priority: number
}

export interface PracticeSessionReceiptAcceptance {
  status: PracticeSessionReceiptAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionReceiptAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionAdvanceGateStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionAdvanceGateItemState = 'waiting' | 'blocked' | 'passed'

export interface PracticeSessionAdvanceGateItem {
  id: string
  label: string
  condition: string
  state: PracticeSessionAdvanceGateItemState
  action: string
  to: string
  priority: number
}

export interface PracticeSessionAdvanceGate {
  status: PracticeSessionAdvanceGateStatus
  title: string
  summary: string
  items: PracticeSessionAdvanceGateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionLaunchPacketStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionLaunchPacketItem {
  id: string
  label: string
  instruction: string
  completionRule: string
  to: string
  priority: number
}

export interface PracticeSessionLaunchPacket {
  status: PracticeSessionLaunchPacketStatus
  title: string
  summary: string
  items: PracticeSessionLaunchPacketItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionLaunchChecklistStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionLaunchChecklistItem {
  id: string
  phase: string
  completionRule: string
  evidenceTemplate: string
  reviewQuestion: string
  to: string
  priority: number
}

export interface PracticeSessionLaunchChecklist {
  status: PracticeSessionLaunchChecklistStatus
  title: string
  summary: string
  items: PracticeSessionLaunchChecklistItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionRehearsalStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionRehearsal {
  status: PracticeSessionFirstQuestionRehearsalStatus
  title: string
  summary: string
  questionTitle: string
  reason: string
  openingPrompt: string
  passSignal: string
  evidenceRequirement: string
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionRubricStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionRubricItem {
  id: string
  label: string
  target: string
  check: string
  evidence: string
  priority: number
}

export interface PracticeSessionFirstQuestionRubric {
  status: PracticeSessionFirstQuestionRubricStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionRubricItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReceiptStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReceiptItem {
  id: string
  label: string
  prompt: string
  example: string
  priority: number
}

export interface PracticeSessionFirstQuestionReceipt {
  status: PracticeSessionFirstQuestionReceiptStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReceiptItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReceiptAcceptanceStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReceiptAcceptanceItem {
  id: string
  label: string
  target: string
  check: string
  fallbackAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReceiptAcceptance {
  status: PracticeSessionFirstQuestionReceiptAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReceiptAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReleaseGateStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionFirstQuestionReleaseGateItemState = 'waiting' | 'blocked' | 'passed'

export interface PracticeSessionFirstQuestionReleaseGateItem {
  id: string
  label: string
  evidence: string
  releaseRule: string
  action: string
  state: PracticeSessionFirstQuestionReleaseGateItemState
  to: string
  priority: number
}

export interface PracticeSessionFirstQuestionReleaseGate {
  status: PracticeSessionFirstQuestionReleaseGateStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReleaseGateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReviewTemplateStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReviewTemplateItem {
  id: string
  label: string
  prompt: string
  example: string
  acceptanceRule: string
  priority: number
}

export interface PracticeSessionFirstQuestionReviewTemplate {
  status: PracticeSessionFirstQuestionReviewTemplateStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReviewTemplateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReviewAcceptanceStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReviewAcceptanceItem {
  id: string
  label: string
  target: string
  check: string
  fallbackAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReviewAcceptance {
  status: PracticeSessionFirstQuestionReviewAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReviewAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReviewArchiveStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReviewArchiveItem {
  id: string
  label: string
  source: string
  content: string
  nextUse: string
  lossRisk: string
  priority: number
}

export interface PracticeSessionFirstQuestionReviewArchive {
  status: PracticeSessionFirstQuestionReviewArchiveStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReviewArchiveItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionArchiveReuseStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionArchiveReuseItem {
  id: string
  label: string
  action: string
  openingPrompt: string
  acceptanceRule: string
  fallbackAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionArchiveReuse {
  status: PracticeSessionFirstQuestionArchiveReuseStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionArchiveReuseItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReceiptStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReceiptItem {
  id: string
  label: string
  prompt: string
  example: string
  acceptanceRule: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReceipt {
  status: PracticeSessionFirstQuestionReuseReceiptStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReceiptItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReceiptAcceptanceStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReceiptAcceptanceItem {
  id: string
  label: string
  target: string
  passSignal: string
  missingRisk: string
  repairAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReceiptAcceptance {
  status: PracticeSessionFirstQuestionReuseReceiptAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReceiptAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReleaseGateStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionFirstQuestionReuseReleaseGateItemState = 'waiting' | 'blocked' | 'passed'

export interface PracticeSessionFirstQuestionReuseReleaseGateItem {
  id: string
  label: string
  evidence: string
  releaseRule: string
  action: string
  state: PracticeSessionFirstQuestionReuseReleaseGateItemState
  to: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReleaseGate {
  status: PracticeSessionFirstQuestionReuseReleaseGateStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReleaseGateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewTemplateStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReviewTemplateItem {
  id: string
  label: string
  prompt: string
  example: string
  acceptanceRule: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewTemplate {
  status: PracticeSessionFirstQuestionReuseReviewTemplateStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewTemplateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewAcceptanceStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReviewAcceptanceItem {
  id: string
  label: string
  target: string
  passSignal: string
  missingRisk: string
  repairAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewAcceptance {
  status: PracticeSessionFirstQuestionReuseReviewAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewArchiveStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReviewArchiveItem {
  id: string
  label: string
  source: string
  content: string
  nextUse: string
  lossRisk: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewArchive {
  status: PracticeSessionFirstQuestionReuseReviewArchiveStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewArchiveItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewHandoffStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReviewHandoffItem {
  id: string
  label: string
  action: string
  openingPrompt: string
  acceptanceRule: string
  fallbackAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewHandoff {
  status: PracticeSessionFirstQuestionReuseReviewHandoffStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewHandoffItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewHandoffAcceptanceStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionFirstQuestionReuseReviewHandoffAcceptanceItem {
  id: string
  label: string
  target: string
  passSignal: string
  missingRisk: string
  repairAction: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewHandoffAcceptance {
  status: PracticeSessionFirstQuestionReuseReviewHandoffAcceptanceStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewHandoffAcceptanceItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateItemState = 'waiting' | 'blocked' | 'passed'

export interface PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateItem {
  id: string
  label: string
  evidence: string
  releaseRule: string
  action: string
  state: PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateItemState
  to: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewHandoffReleaseGate {
  status: PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewHandoffReleaseGateItem[]
  primaryAction: PracticeSessionReportAction
}

export type PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptStatus = 'empty' | 'blocked' | 'ready'

export type PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptItemState = 'waiting' | 'blocked' | 'handed-off'

export interface PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptItem {
  id: string
  label: string
  conclusion: string
  evidence: string
  nextAction: string
  state: PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptItemState
  to: string
  priority: number
}

export interface PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceipt {
  status: PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptStatus
  title: string
  summary: string
  items: PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptItem[]
  primaryAction: PracticeSessionReportAction
}

export interface InterviewFeedback {
  score: number
  level: 'strong' | 'pass' | 'needs-work'
  criteria: InterviewCriterion[]
  advice: string[]
  followUps: string[]
  source?: 'RULE_BASED' | 'LOCAL_RULE_BASED' | 'AI'
}

export interface InterviewAttempt {
  questionId: number
  answer: string
  feedback: InterviewFeedback
  createdAt: string
}

export type InterviewTrend = 'empty' | 'improving' | 'declining' | 'stable'

export interface InterviewCriterionSummary {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  attempts: number
  summary: string
}

export interface InterviewReviewAttempt extends InterviewAttempt {
  question?: QuestionSnapshot
}

export interface InterviewReviewSummary {
  totalAttempts: number
  answeredQuestions: number
  averageScore: number
  bestScore: number
  latestScore?: number
  trend: InterviewTrend
  weakestCriterion?: InterviewCriterionSummary
  criteria: InterviewCriterionSummary[]
  recentAttempts: InterviewReviewAttempt[]
  recommendation: string
}

export type FollowUpDrillCriterionKey = InterviewCriterionKey | 'advanced'

export interface FollowUpDrillItem {
  id: string
  criterionKey: FollowUpDrillCriterionKey
  criterionLabel: string
  prompt: string
  pressurePoint: string
  answerGuide: string
  priority: number
}

export interface FollowUpDrillPack {
  title: string
  summary: string
  items: FollowUpDrillItem[]
}

export type PracticeFeedbackClosureLevel = 'repair' | 'follow-up' | 'pass' | 'excellent'

export type PracticeFeedbackClosureActionKind = 'rewrite' | 'follow-up' | 'weak' | 'mastered' | 'answer' | 'next'

export interface PracticeFeedbackClosureMetric {
  key: 'score' | 'weakest' | 'length' | 'followUps'
  label: string
  value: string
  detail: string
}

export interface PracticeFeedbackClosureAction {
  kind: PracticeFeedbackClosureActionKind
  label: string
  description: string
  tone: 'primary' | 'danger' | 'default' | 'success'
  prompt?: string
}

export interface PracticeFeedbackClosure {
  level: PracticeFeedbackClosureLevel
  title: string
  summary: string
  metrics: PracticeFeedbackClosureMetric[]
  actions: PracticeFeedbackClosureAction[]
  primaryAction: PracticeFeedbackClosureAction
}

export type AnswerGapModuleStatus = 'covered' | 'partial' | 'missing'

export type AnswerGapLevel = 'empty' | 'high-risk' | 'partial' | 'aligned'

export interface AnswerGapModule {
  key: string
  label: string
  score: number
  status: AnswerGapModuleStatus
  evidence: string
  guidance: string
}

export interface AnswerGapReport {
  score: number
  level: AnswerGapLevel
  title: string
  summary: string
  modules: AnswerGapModule[]
  coveredModules: AnswerGapModule[]
  missingModules: AnswerGapModule[]
  rewriteOutline: string[]
}

export interface AnswerQualityResult {
  score: number
  level: 'excellent' | 'good' | 'needs-work'
  completedFields: string[]
  missingFields: string[]
}
