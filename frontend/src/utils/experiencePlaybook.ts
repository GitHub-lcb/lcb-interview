import type { ActionLink, ExperienceSet } from '../data/freeSuperiority'
import type { InterviewAttempt, QuestionSnapshot, StudyProgress } from '../types'

const PERSONAL_PRESSURE_LIMIT = 5
const LOW_SCORE_THRESHOLD = 70
const ACTIVE_RECALL_THRESHOLD = 2

export interface ExperiencePressureQueueItem {
  questionId: number
  title: string
  categoryName: string
  difficulty: string
  signal: string
  detail: string
  interviewerProbe: string
  passCriteria: string
  to: string
  practicePath: string
  priority: number
}

export interface ExperiencePressureQueue {
  title: string
  summary: string
  totalCount: number
  queuePath: string
  items: ExperiencePressureQueueItem[]
}

/**
 * 构建真实面试场景包 Markdown，便于用户把公司类型、追问主题和训练入口复制到外部面试清单。
 *
 * @param experienceSets 面试场景组配置
 * @param targetRole 目标岗位
 * @param now 生成时间，默认取当前时间
 * @param progress 本地学习进度，可选；传入后会生成个人押题队列
 * @returns 可复制或下载的 Markdown 场景包
 */
export function buildExperiencePlaybookMarkdown(
  experienceSets: ExperienceSet[],
  targetRole: string,
  now = new Date().toISOString(),
  progress?: StudyProgress,
): string {
  return [
    `# ${sanitizeMarkdownValue(targetRole, '岗位')} 真实面试场景包`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderExperienceOverview(experienceSets),
    renderPersonalPressureQueue(progress),
    renderExperienceItems(experienceSets),
  ].join('\n').trimEnd()
}

export function buildExperiencePressureQueue(progress?: StudyProgress): ExperiencePressureQueue {
  const items = buildPersonalPressureItems(progress)
  const queuePath = items.length > 0
    ? `/practice?queue=${items.map(item => item.questionId).join(',')}&from=experience-playbook`
    : '/practice'

  return {
    title: items.length > 0 ? '个人押题队列' : '个人押题待生成',
    summary: items.length > 0
      ? `已从薄弱题、低分模拟和多次遇见题中筛出 ${items.length} 道真实面试高压题。`
      : '先标记薄弱题或完成模拟面试，系统会把面经场景反向生成训练队列。',
    totalCount: items.length,
    queuePath,
    items,
  }
}

function renderExperienceOverview(experienceSets: ExperienceSet[]): string {
  const companyTypes = [...new Set(experienceSets.map(set => sanitizeMarkdownValue(set.companyType, '未分类')))]

  return [
    '## 场景总览',
    `- 场景组：${experienceSets.length} 组`,
    `- 覆盖公司类型：${companyTypes.length > 0 ? companyTypes.join('、') : '暂无'}`,
    `- 主训练入口：${primaryPracticeEntry(experienceSets)}`,
    '',
  ].join('\n')
}

function renderPersonalPressureQueue(progress?: StudyProgress): string {
  const queue = buildExperiencePressureQueue(progress)
  const items = queue.items

  if (items.length === 0) {
    return [
      '## 个人押题队列',
      `- ${queue.summary}`,
      `- 入口：${queue.queuePath}`,
      '',
    ].join('\n')
  }

  const lines = [
    '## 个人押题队列',
    `- 数据来源：本地学习轨迹，已筛出 ${items.length} 道高压题。`,
    `- 训练入口：${queue.queuePath}`,
  ]

  items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${sanitizeMarkdownValue(item.title, `题目 #${item.questionId}`)}`,
      `   - 压力信号：${item.signal}`,
      `   - 面试场景：${sanitizeMarkdownValue(item.categoryName, '未分组')} · ${sanitizeMarkdownValue(item.difficulty, 'MEDIUM')}`,
      `   - 追问方向：${item.detail}`,
      `   - 面试官追问：${item.interviewerProbe}`,
      `   - 通过口径：${item.passCriteria}`,
      `   - 单题训练入口：${item.practicePath}`,
      `   - 题目入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}

function buildPersonalPressureItems(progress?: StudyProgress): ExperiencePressureQueueItem[] {
  if (!progress) {
    return []
  }

  const items = new Map<number, ExperiencePressureQueueItem>()

  for (const [rawId, state] of Object.entries(progress.questionStates)) {
    const questionId = Number(rawId)
    if (!Number.isInteger(questionId) || questionId <= 0) {
      continue
    }
    const snapshot = progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)

    if (state.status === 'weak') {
      upsertPressureItem(items, {
        questionId,
        title: snapshot.title,
        categoryName: snapshot.categoryName,
        difficulty: snapshot.difficulty,
        signal: '薄弱题',
        detail: '需要把答案从会看推进到能讲清项目场景、失败边界和取舍理由。',
        interviewerProbe: `请用一个真实项目说明「${snapshot.title}」的触发场景、排查证据和失败边界。`,
        passCriteria: '能在 60 秒内讲清结论、项目证据、失败边界和下一步兜底。',
        to: `/question/${questionId}`,
        practicePath: buildSinglePracticePath(questionId),
        priority: 320 + state.reviewCount,
      })
    }

    if (state.status === 'new' && state.reviewCount === 0 && (state.encounterCount ?? 0) >= ACTIVE_RECALL_THRESHOLD) {
      upsertPressureItem(items, {
        questionId,
        title: snapshot.title,
        categoryName: snapshot.categoryName,
        difficulty: snapshot.difficulty,
        signal: `多次遇见 ${state.encounterCount ?? ACTIVE_RECALL_THRESHOLD} 次`,
        detail: '已经多次打开但还没形成复述记录，适合放到真实面试热身里脱稿验证。',
        interviewerProbe: `${snapshot.title}已经多次遇见但还没有复述记录，请先脱稿讲 60 秒。`,
        passCriteria: '能不看答案讲出结论、核心机制、一个场景例子和一个风险边界。',
        to: `/question/${questionId}`,
        practicePath: buildSinglePracticePath(questionId),
        priority: 200 + (state.encounterCount ?? ACTIVE_RECALL_THRESHOLD),
      })
    }
  }

  for (const attempt of latestLowScoreAttempts(progress.interviewAttempts)) {
    const snapshot = progress.questionSnapshots[attempt.questionId] ?? fallbackSnapshot(attempt.questionId)
    const weakest = [...attempt.feedback.criteria].sort((left, right) => left.score - right.score)[0]
    upsertPressureItem(items, {
      questionId: attempt.questionId,
      title: snapshot.title,
      categoryName: snapshot.categoryName,
      difficulty: snapshot.difficulty,
      signal: `模拟 ${attempt.feedback.score} 分`,
      detail: weakest
        ? `最低维度是「${weakest.label}」${weakest.score} 分，面试官会继续追问证据、边界和兜底。`
        : '最近模拟分数偏低，先用场景追问补足结构、证据和风险。',
      interviewerProbe: weakest
        ? `${snapshot.title}最近模拟 ${attempt.feedback.score} 分，最低维度是「${weakest.label}」${weakest.score} 分，你会怎么补证据和兜底？`
        : `${snapshot.title}最近模拟 ${attempt.feedback.score} 分，如果面试官继续压边界，你会怎么补结构、证据和风险？`,
      passCriteria: '能正面回应最低分维度，并补一个可追问的指标、边界或降级方案。',
      to: `/question/${attempt.questionId}`,
      practicePath: buildSinglePracticePath(attempt.questionId),
      priority: 280 - attempt.feedback.score,
    })
  }

  return [...items.values()]
    .sort((left, right) => right.priority - left.priority || left.questionId - right.questionId)
    .slice(0, PERSONAL_PRESSURE_LIMIT)
}

function upsertPressureItem(
  items: Map<number, ExperiencePressureQueueItem>,
  candidate: ExperiencePressureQueueItem,
): void {
  const current = items.get(candidate.questionId)
  if (!current) {
    items.set(candidate.questionId, candidate)
    return
  }

  items.set(candidate.questionId, {
    ...candidate,
    signal: mergeSignal(current.signal, candidate.signal),
    detail: candidate.priority >= current.priority ? candidate.detail : current.detail,
    interviewerProbe: candidate.priority >= current.priority ? candidate.interviewerProbe : current.interviewerProbe,
    passCriteria: candidate.priority >= current.priority ? candidate.passCriteria : current.passCriteria,
    practicePath: candidate.priority >= current.priority ? candidate.practicePath : current.practicePath,
    priority: Math.max(current.priority, candidate.priority),
  })
}

function buildSinglePracticePath(questionId: number): string {
  return `/practice?queue=${questionId}&from=experience-playbook`
}

function mergeSignal(left: string, right: string): string {
  return [...new Set([left, right].flatMap(value => value.split('、')).map(value => value.trim()).filter(Boolean))].join('、')
}

function latestLowScoreAttempts(attemptsByQuestion: StudyProgress['interviewAttempts']): InterviewAttempt[] {
  const seen = new Set<number>()
  return Object.values(attemptsByQuestion)
    .flat()
    .filter(attempt => attempt.feedback.score < LOW_SCORE_THRESHOLD)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .filter(attempt => {
      if (seen.has(attempt.questionId)) {
        return false
      }
      seen.add(attempt.questionId)
      return true
    })
}

function renderExperienceItems(experienceSets: ExperienceSet[]): string {
  if (experienceSets.length === 0) {
    return [
      '## 场景题单',
      '1. 暂无面试场景组',
      '   - 下一步：先确认目标岗位，再补充至少一组场景题单。',
      '   - 入口：/practice',
    ].join('\n')
  }

  const lines = ['## 场景题单']
  experienceSets.forEach((set, index) => {
    lines.push(
      `${index + 1}. ${sanitizeMarkdownValue(set.title, `场景组 #${index + 1}`)}`,
      `   - 公司类型：${sanitizeMarkdownValue(set.companyType, '未分类')}`,
      `   - 摘要：${sanitizeMarkdownValue(set.summary, '暂无摘要')}`,
      `   - 追问主题：${renderTextList(set.drills, '待补充')}`,
      `   - 行动入口：${renderActions(set.actions)}`,
    )
  })

  return [...lines, ''].join('\n')
}

function primaryPracticeEntry(experienceSets: ExperienceSet[]): string {
  return experienceSets
    .flatMap(set => set.actions)
    .find(action => action.to === '/practice')?.to
    ?? experienceSets[0]?.actions[0]?.to
    ?? '/practice'
}

function renderActions(actions: ActionLink[]): string {
  if (actions.length === 0) {
    return '开始模拟面试（/practice）'
  }
  return actions
    .map(action => `${sanitizeMarkdownValue(action.label, '开始训练')}（${sanitizeMarkdownValue(action.to, '/practice')}）`)
    .join('；')
}

function renderTextList(values: string[], fallback: string): string {
  const normalized = values.map(value => value.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized.join('、') : fallback
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function sanitizeMarkdownValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}

function fallbackSnapshot(questionId: number): QuestionSnapshot {
  return {
    id: questionId,
    title: `题目 #${questionId}`,
    difficulty: 'MEDIUM',
    categoryName: '未分组',
    tags: [],
    viewCount: 0,
  }
}
