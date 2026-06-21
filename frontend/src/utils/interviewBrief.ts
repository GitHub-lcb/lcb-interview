import type { PrepRoute } from '../data/freeSuperiority'
import type {
  InterviewBriefAction,
  InterviewBriefItem,
  InterviewBriefLevel,
  InterviewBriefReport,
  QuestionSnapshot,
  StudyProgress,
  StudyQuestionStatus,
} from '../types'
import { buildInterviewReviewSummary } from './interviewReview'
import { buildDailyPracticePath } from './practiceRoute'
import { buildRouteProgressList } from './routeProgress'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'
import { getQuestionState } from './studyProgress'

interface CategoryBucket {
  categoryName: string
  mastered: number
  weak: number
  learning: number
  masteredTitles: string[]
  weakTitles: string[]
}

const BRIEF_LIMIT = 3
const WARMUP_LIMIT = 6
const INTERVIEW_BRIEF_SOURCE = 'interview-brief'

export function buildInterviewBrief(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): InterviewBriefReport {
  const tracked = Object.keys(progress.questionStates).length
  const buckets = buildCategoryBuckets(progress)
  const reviewQueue = buildScheduledReviewQueue(progress, now, 30)
  const reviewSummary = summarizeReviewSchedule(reviewQueue)
  const interviewSummary = buildInterviewReviewSummary(progress)
  const strengths = buildStrengths(buckets)
  const risks = buildRisks(progress, buckets, reviewSummary, interviewSummary)
  const warmups = buildWarmups(routes, progress, reviewQueue)
  const level = resolveLevel(tracked, risks, warmups)
  const primaryAction = resolvePrimaryAction(level, risks, warmups)

  return {
    level,
    title: titleForLevel(level, progress.targetRole),
    summary: summaryForLevel(level, progress, strengths, risks, warmups),
    primaryAction,
    strengths: strengths.length > 0 ? strengths : fallbackStrengths(tracked),
    risks,
    warmups,
  }
}

/**
 * 构建面试前冲刺简报 Markdown，便于用户复制每日备考重点。
 *
 * @param routes 免费备考路线
 * @param progress 本地学习进度
 * @param now 当前时间，用于生成稳定日期和复用复习排期判断
 * @returns 可携带的 Markdown 冲刺简报
 */
export function buildInterviewBriefMarkdown(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const brief = buildInterviewBrief(routes, progress, now)

  return [
    `# ${progress.targetRole} 面试前冲刺简报`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderBriefOverview(brief),
    renderBriefSection('可主动表达', brief.strengths, '掌握题会自动沉淀为面试优势。'),
    renderBriefSection('必须规避', brief.risks, '当前没有显著风险，保持节奏即可。'),
    renderBriefSection('开口热身', brief.warmups, '加入计划或复习队列后会生成热身题。'),
  ].join('\n').trimEnd()
}

function renderBriefOverview(brief: InterviewBriefReport): string {
  return [
    '## 简报概览',
    `- 状态：${brief.title}`,
    `- 摘要：${brief.summary}`,
    `- 下一步：${brief.primaryAction.label}，${brief.primaryAction.to}`,
    `- 说明：${brief.primaryAction.description}`,
    '',
  ].join('\n')
}

function renderBriefSection(title: string, items: InterviewBriefItem[], emptyText: string): string {
  if (items.length === 0) {
    return [
      `## ${title}`,
      `- ${emptyText}`,
      '',
    ].join('\n')
  }

  const lines = [`## ${title}`]
  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 指标：${item.metric}`,
      `   - 说明：${item.description}`,
      `   - 入口：${item.to ?? '无'}`,
    )
  })

  return [...lines, ''].join('\n')
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function buildCategoryBuckets(progress: StudyProgress): CategoryBucket[] {
  const buckets = new Map<string, CategoryBucket>()

  for (const snapshot of Object.values(progress.questionSnapshots)) {
    const state = getQuestionState(progress, snapshot.id)
    if (state.status === 'new' && !state.addedToPlan) {
      continue
    }
    const bucket = buckets.get(snapshot.categoryName) ?? {
      categoryName: snapshot.categoryName,
      mastered: 0,
      weak: 0,
      learning: 0,
      masteredTitles: [],
      weakTitles: [],
    }
    applyStatusToBucket(bucket, state.status, snapshot.title)
    buckets.set(snapshot.categoryName, bucket)
  }

  return [...buckets.values()]
}

function applyStatusToBucket(bucket: CategoryBucket, status: StudyQuestionStatus, title: string): void {
  if (status === 'mastered') {
    bucket.mastered += 1
    bucket.masteredTitles.push(title)
  }
  if (status === 'weak') {
    bucket.weak += 1
    bucket.weakTitles.push(title)
  }
  if (status === 'learning') {
    bucket.learning += 1
  }
}

function buildStrengths(buckets: CategoryBucket[]): InterviewBriefItem[] {
  return buckets
    .filter(bucket => bucket.mastered > 0)
    .sort((a, b) => {
      const masteredDiff = b.mastered - a.mastered
      if (masteredDiff !== 0) {
        return masteredDiff
      }
      return a.weak - b.weak
    })
    .slice(0, BRIEF_LIMIT)
    .map(bucket => ({
      id: `strength-${bucket.categoryName}`,
      title: `${bucket.categoryName} 可以主动表达`,
      metric: `${bucket.mastered} 掌握`,
      description: bucket.masteredTitles[0]
        ? `可从「${bucket.masteredTitles[0]}」切入，讲清原理、场景和风险。`
        : '这类题已经形成稳定掌握记录，可以作为面试主动展示素材。',
    }))
}

function buildRisks(
  progress: StudyProgress,
  buckets: CategoryBucket[],
  reviewSummary: ReturnType<typeof summarizeReviewSchedule>,
  interviewSummary: ReturnType<typeof buildInterviewReviewSummary>,
): InterviewBriefItem[] {
  const tracked = Object.keys(progress.questionStates).length
  if (tracked === 0) {
    return [{
      id: 'empty-progress',
      title: '还没有学习轨迹',
      metric: '0 记录',
      description: '先把高频题加入计划，简报才会生成可复用的面试素材。',
      to: '/banks',
    }]
  }

  const risks: InterviewBriefItem[] = []
  if (reviewSummary.overdue > 0) {
    risks.push({
      id: 'review-overdue',
      title: '复习逾期会拖累临场稳定性',
      metric: `${reviewSummary.overdue} 逾期`,
      description: `已有 ${reviewSummary.overdue} 道题错过复习窗口，先补回记忆债。`,
      to: '/study',
    })
  }

  if (reviewSummary.activeRecall > 0) {
    risks.push({
      id: 'active-recall',
      title: '多次遇见题还没完成主动回忆',
      metric: `${reviewSummary.activeRecall} 主动回忆`,
      description: `已有 ${reviewSummary.activeRecall} 道题多次遇见但还没脱稿回忆，先回到复习队列完成一次开口验证。`,
      to: '/study',
    })
  }

  const weakBucket = [...buckets]
    .filter(bucket => bucket.weak > 0)
    .sort((a, b) => b.weak - a.weak)[0]
  if (weakBucket) {
    risks.push({
      id: `weak-${weakBucket.categoryName}`,
      title: `${weakBucket.categoryName} 薄弱题集中`,
      metric: `${weakBucket.weak} 薄弱`,
      description: weakBucket.weakTitles[0]
        ? `先复盘「${weakBucket.weakTitles[0]}」，避免面试追问时断层。`
        : '薄弱题需要先回到学习计划复盘。',
      to: '/study',
    })
  }

  if (interviewSummary.totalAttempts === 0) {
    risks.push({
      id: 'interview-missing',
      title: '缺少模拟面试样本',
      metric: '未开口',
      description: '题目会看不等于能讲清，至少完成一轮本地规则评分。',
      to: '/practice',
    })
  } else if (interviewSummary.trend === 'declining') {
    risks.push({
      id: 'interview-declining',
      title: '模拟面试表现回落',
      metric: `${interviewSummary.averageScore} 平均分`,
      description: '最近模拟面试分数回落，先稳住结构化表达再继续扩题。',
      to: '/practice',
    })
  } else if (interviewSummary.averageScore < 70) {
    risks.push({
      id: 'interview-low-score',
      title: '表达分数仍需打磨',
      metric: `${interviewSummary.averageScore} 平均分`,
      description: interviewSummary.recommendation,
      to: '/practice',
    })
  }

  if (progress.dailyPlan.length === 0) {
    risks.push({
      id: 'empty-plan',
      title: '今日计划为空',
      metric: '无计划',
      description: '面试前最后阶段要减少选择成本，先固定今天要讲的题。',
      to: '/study',
    })
  }

  return risks.slice(0, BRIEF_LIMIT)
}

function buildWarmups(
  routes: PrepRoute[],
  progress: StudyProgress,
  reviewQueue: ReturnType<typeof buildScheduledReviewQueue>,
): InterviewBriefItem[] {
  const seen = new Set<number>()
  const items: InterviewBriefItem[] = []
  const dueItems = reviewQueue.filter(item => item.dueStatus !== 'upcoming')

  for (const item of dueItems) {
    pushWarmup(
      items,
      seen,
      item,
      isActiveRecallWarmup(item) ? '主动回忆' : item.dueStatus === 'overdue' ? '逾期复习' : '今日到期',
    )
  }

  // 热身队列先消化复习债，再补岗位路线下一步，避免同一道题在多个来源重复出现。
  for (const routeProgress of buildRouteProgressList(routes, progress)) {
    for (const questionId of routeProgress.nextQuestionIds) {
      const snapshot = progress.questionSnapshots[questionId]
      if (!snapshot) {
        continue
      }
      pushWarmup(items, seen, snapshot, routeProgress.route.title)
    }
  }

  for (const questionId of progress.dailyPlan) {
    const snapshot = progress.questionSnapshots[questionId]
    if (snapshot) {
      pushWarmup(items, seen, snapshot, '今日计划')
    }
  }

  return items.slice(0, WARMUP_LIMIT)
}

function pushWarmup(
  items: InterviewBriefItem[],
  seen: Set<number>,
  snapshot: QuestionSnapshot,
  source: string,
): void {
  if (seen.has(snapshot.id)) {
    return
  }
  seen.add(snapshot.id)
  items.push({
    id: `warmup-${snapshot.id}`,
    questionId: snapshot.id,
    title: snapshot.title,
    metric: source,
    description: `${snapshot.categoryName} · ${snapshot.difficulty}`,
    to: `/question/${snapshot.id}`,
  })
}

function isActiveRecallWarmup(item: ReturnType<typeof buildScheduledReviewQueue>[number]): boolean {
  return item.status === 'new'
    && item.reviewCount === 0
    && (item.encounterCount ?? 0) >= 2
}

function resolveLevel(
  tracked: number,
  risks: InterviewBriefItem[],
  warmups: InterviewBriefItem[],
): InterviewBriefLevel {
  if (tracked === 0) {
    return 'empty'
  }
  if (risks.some(risk => ['review-overdue', 'active-recall', 'interview-declining'].includes(risk.id) || risk.id.startsWith('weak-'))) {
    return 'risk'
  }
  if (warmups.length > 0) {
    return 'warmup'
  }
  return 'ready'
}

function resolvePrimaryAction(
  level: InterviewBriefLevel,
  risks: InterviewBriefItem[],
  warmups: InterviewBriefItem[],
): InterviewBriefAction {
  if (level === 'empty') {
    return {
      label: '进入题库',
      description: '先建立第一批可追踪题目。',
      to: '/banks',
    }
  }

  const firstRisk = risks[0]
  if (
    firstRisk?.id === 'review-overdue'
    || firstRisk?.id === 'active-recall'
    || firstRisk?.id === 'empty-plan'
    || firstRisk?.id.startsWith('weak-')
  ) {
    return {
      label: '先处理风险',
      description: firstRisk.description,
      to: firstRisk.to ?? '/study',
    }
  }
  if (firstRisk?.id.startsWith('interview-')) {
    return {
      label: '进入模拟面试',
      description: firstRisk.description,
      to: '/practice',
    }
  }
  if (warmups.length > 0) {
    return {
      label: '开始热身题',
      description: '按简报队列先讲一轮高价值题。',
      to: buildInterviewBriefWarmupPath(warmups),
    }
  }
  return {
    label: '继续训练',
    description: '保持当前节奏，继续做一轮模拟面试。',
    to: '/practice',
  }
}

function buildInterviewBriefWarmupPath(warmups: InterviewBriefItem[]): string {
  const questionIds = warmups
    .map(item => item.questionId)
    .filter((questionId): questionId is number => (
      typeof questionId === 'number'
      && Number.isInteger(questionId)
      && questionId > 0
    ))

  return buildDailyPracticePath(questionIds, WARMUP_LIMIT, INTERVIEW_BRIEF_SOURCE)
}

function titleForLevel(level: InterviewBriefLevel, targetRole: string): string {
  if (level === 'empty') {
    return `${targetRole} 面试简报待生成`
  }
  if (level === 'risk') {
    return `${targetRole} 面试前先控风险`
  }
  if (level === 'warmup') {
    return `${targetRole} 面试前热身清单`
  }
  return `${targetRole} 面试素材已就绪`
}

function summaryForLevel(
  level: InterviewBriefLevel,
  progress: StudyProgress,
  strengths: InterviewBriefItem[],
  risks: InterviewBriefItem[],
  warmups: InterviewBriefItem[],
): string {
  const tracked = Object.keys(progress.questionStates).length
  if (level === 'empty') {
    return '先跟踪题目、完成复习和模拟面试，系统会自动整理可讲优势与风险。'
  }
  return `已跟踪 ${tracked} 道题，沉淀 ${strengths.length} 个优势方向，识别 ${risks.length} 个风险，准备 ${warmups.length} 道热身题。`
}

function fallbackStrengths(tracked: number): InterviewBriefItem[] {
  if (tracked === 0) {
    return [{
      id: 'strength-empty',
      title: '优势素材待沉淀',
      metric: '待建立',
      description: '标记掌握题后，这里会自动整理可主动表达的技术方向。',
    }]
  }
  return [{
    id: 'strength-building',
    title: '继续沉淀可讲素材',
    metric: `${tracked} 跟踪`,
    description: '把学习中题目推进到掌握后，会形成更明确的面试优势。',
  }]
}
