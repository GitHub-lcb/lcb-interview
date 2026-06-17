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

export interface AnswerQualityResult {
  score: number
  level: 'excellent' | 'good' | 'needs-work'
  completedFields: string[]
  missingFields: string[]
}
