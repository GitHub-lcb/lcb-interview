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
  source: 'AI_GENERATED' | 'MANUAL'
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

export type DailyMissionKind = 'review' | 'ability' | 'interview' | 'plan'

export interface DailyMissionItem {
  id: string
  kind: DailyMissionKind
  title: string
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

export type StudyPaceActionKey = 'start' | 'review' | 'plan' | 'interview' | 'practice'

export interface StudyPaceAction {
  key: StudyPaceActionKey
  label: string
  description: string
  to: string
}

export interface StudyPaceMetric {
  key: 'target' | 'planned' | 'review' | 'interview'
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
  todos: DailyPlanCompletionTodo[]
  primaryAction: DailyPlanCompletionAction
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

export type PracticeQueueSource = 'review' | 'plan' | 'page' | 'new'

export interface PracticeQueueItem extends QuestionSnapshot {
  status: StudyQuestionStatus
  source: PracticeQueueSource
}

export type InterviewCriterionKey = 'coverage' | 'structure' | 'specificity' | 'risk'

export interface InterviewCriterion {
  key: InterviewCriterionKey
  label: string
  score: number
  summary: string
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
