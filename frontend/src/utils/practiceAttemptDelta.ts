import type {
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'

export type PracticeAttemptDeltaLevel = 'empty' | 'single' | 'improved' | 'regressed' | 'stable'
export type PracticeAttemptDeltaTone = 'up' | 'down' | 'same'

export interface PracticeAttemptCriterionDelta {
  key: InterviewCriterionKey
  label: string
  latestScore: number
  previousScore: number
  delta: number
  tone: PracticeAttemptDeltaTone
}

export interface PracticeAttemptDeltaAction {
  label: string
  description: string
  prompt: string
}

export interface PracticeAttemptDelta {
  level: PracticeAttemptDeltaLevel
  title: string
  summary: string
  latestScore: number
  previousScore?: number
  scoreDelta: number
  criterionDeltas: PracticeAttemptCriterionDelta[]
  primaryAction: PracticeAttemptDeltaAction
}

const criterionOrder: InterviewCriterionKey[] = ['coverage', 'structure', 'specificity', 'risk']

const fallbackCriterionLabels: Record<InterviewCriterionKey, string> = {
  coverage: '知识覆盖',
  structure: '表达结构',
  specificity: '场景细节',
  risk: '边界风险',
}

export function buildPracticeAttemptDelta(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
): PracticeAttemptDelta {
  const orderedAttempts = [...attempts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const latest = orderedAttempts[0]
  const previous = orderedAttempts[1]

  if (!latest) {
    return buildEmptyDelta(question)
  }

  if (!previous) {
    const weakest = resolveWeakestCriterion(latest.feedback.criteria)

    return {
      level: 'single',
      title: '已建立首次基线',
      summary: `当前本题 ${latest.feedback.score} 分，下一轮优先补齐「${weakest.label}」来验证是否真的进步。`,
      latestScore: latest.feedback.score,
      scoreDelta: 0,
      criterionDeltas: buildBaselineCriteria(latest.feedback.criteria),
      primaryAction: {
        label: '再答一次验收',
        description: `围绕${weakest.label}重答一次，形成可比较的第二个样本。`,
        prompt: buildRetryPrompt(question, weakest.label),
      },
    }
  }

  const criterionDeltas = buildCriterionDeltas(latest.feedback.criteria, previous.feedback.criteria)
  const scoreDelta = latest.feedback.score - previous.feedback.score
  const level = resolveDeltaLevel(scoreDelta)
  const focusCriterion = resolveFocusCriterion(level, criterionDeltas)

  return {
    level,
    title: resolveTitle(level),
    summary: resolveSummary(level, latest.feedback.score, previous.feedback.score),
    latestScore: latest.feedback.score,
    previousScore: previous.feedback.score,
    scoreDelta,
    criterionDeltas,
    primaryAction: buildPrimaryAction(question, level, latest.feedback.score, focusCriterion),
  }
}

function buildEmptyDelta(question: PracticeQueueItem | QuestionSnapshot): PracticeAttemptDelta {
  return {
    level: 'empty',
    title: '等待首次评分',
    summary: '先完成一次模拟面试评分，系统会在第二次重答后自动验收是否真的进步。',
    latestScore: 0,
    scoreDelta: 0,
    criterionDeltas: [],
    primaryAction: {
      label: '先完成一次模拟评分',
      description: '先说完整答案，再提交评分，建立第一条可追踪基线。',
      prompt: `请先完整回答「${question.title}」，按结论 -> 机制 -> 场景 -> 边界组织。`,
    },
  }
}

function buildBaselineCriteria(criteria: InterviewCriterion[]): PracticeAttemptCriterionDelta[] {
  const criteriaByKey = new Map(criteria.map(item => [item.key, item]))

  return criterionOrder.map(key => {
    const criterion = criteriaByKey.get(key)
    const latestScore = criterion?.score ?? 0

    return {
      key,
      label: criterion?.label ?? fallbackCriterionLabels[key],
      latestScore,
      previousScore: 0,
      delta: latestScore,
      tone: latestScore >= 60 ? 'up' : 'same',
    }
  })
}

function buildCriterionDeltas(
  latestCriteria: InterviewCriterion[],
  previousCriteria: InterviewCriterion[],
): PracticeAttemptCriterionDelta[] {
  const latestByKey = new Map(latestCriteria.map(item => [item.key, item]))
  const previousByKey = new Map(previousCriteria.map(item => [item.key, item]))

  return criterionOrder.map(key => {
    const latest = latestByKey.get(key)
    const previous = previousByKey.get(key)
    const latestScore = latest?.score ?? 0
    const previousScore = previous?.score ?? 0
    const delta = latestScore - previousScore

    return {
      key,
      label: latest?.label ?? previous?.label ?? fallbackCriterionLabels[key],
      latestScore,
      previousScore,
      delta,
      tone: delta > 0 ? 'up' : delta < 0 ? 'down' : 'same',
    }
  })
}

function resolveDeltaLevel(scoreDelta: number): PracticeAttemptDeltaLevel {
  if (scoreDelta >= 5) {
    return 'improved'
  }
  if (scoreDelta <= -5) {
    return 'regressed'
  }
  return 'stable'
}

function resolveTitle(level: PracticeAttemptDeltaLevel): string {
  if (level === 'improved') {
    return '重答有效'
  }
  if (level === 'regressed') {
    return '重答回落'
  }
  if (level === 'stable') {
    return '重答持平'
  }
  if (level === 'single') {
    return '已建立首次基线'
  }
  return '等待首次评分'
}

function resolveSummary(level: PracticeAttemptDeltaLevel, latestScore: number, previousScore: number): string {
  if (level === 'improved') {
    return `从 ${previousScore} 分提升到 ${latestScore} 分，说明本题重答已经产生正向反馈。`
  }
  if (level === 'regressed') {
    return `从 ${previousScore} 分回落到 ${latestScore} 分，需要先找出丢分维度再重答。`
  }
  return `当前 ${latestScore} 分，与上次 ${previousScore} 分接近，下一轮要补一个更明确的突破点。`
}

function buildPrimaryAction(
  question: PracticeQueueItem | QuestionSnapshot,
  level: PracticeAttemptDeltaLevel,
  latestScore: number,
  focusCriterion: PracticeAttemptCriterionDelta,
): PracticeAttemptDeltaAction {
  if (level === 'improved' && latestScore >= 80) {
    return {
      label: '进入追问验证',
      description: '分数已经过线，用追问检查项目细节、边界和取舍是否稳定。',
      prompt: `请围绕「${question.title}」继续追问我，重点验证项目场景、边界风险和替代方案。`,
    }
  }

  if (level === 'improved') {
    return {
      label: `继续补${focusCriterion.label}`,
      description: `虽然整体进步，但${focusCriterion.label}仍是下一轮最值得拉高的维度。`,
      prompt: buildRetryPrompt(question, focusCriterion.label),
    }
  }

  if (level === 'regressed') {
    return {
      label: `按${focusCriterion.label}重答`,
      description: `${focusCriterion.label}是本轮回落最明显的维度，先把它修回来。`,
      prompt: buildRetryPrompt(question, focusCriterion.label),
    }
  }

  return {
    label: `按${focusCriterion.label}重答`,
    description: `整体变化不大，下一次回答必须明确补强${focusCriterion.label}。`,
    prompt: buildRetryPrompt(question, focusCriterion.label),
  }
}

function resolveFocusCriterion(
  level: PracticeAttemptDeltaLevel,
  criterionDeltas: PracticeAttemptCriterionDelta[],
): PracticeAttemptCriterionDelta {
  if (level === 'regressed') {
    return [...criterionDeltas].sort((a, b) => a.delta - b.delta || a.latestScore - b.latestScore)[0]
      ?? fallbackCriterionDelta('specificity')
  }

  return [...criterionDeltas].sort((a, b) => a.latestScore - b.latestScore || a.delta - b.delta)[0]
    ?? fallbackCriterionDelta('specificity')
}

function resolveWeakestCriterion(criteria: InterviewCriterion[]): InterviewCriterion {
  return [...criteria].sort((a, b) => a.score - b.score)[0] ?? {
    key: 'specificity',
    label: fallbackCriterionLabels.specificity,
    score: 0,
    summary: '暂无评分维度',
  }
}

function fallbackCriterionDelta(key: InterviewCriterionKey): PracticeAttemptCriterionDelta {
  return {
    key,
    label: fallbackCriterionLabels[key],
    latestScore: 0,
    previousScore: 0,
    delta: 0,
    tone: 'same',
  }
}

function buildRetryPrompt(question: PracticeQueueItem | QuestionSnapshot, focusLabel: string): string {
  return `请重新回答「${question.title}」，这次必须重点补齐${focusLabel}：先给结论，再讲机制，补一个真实项目场景，最后说明边界风险和验证方式。`
}
