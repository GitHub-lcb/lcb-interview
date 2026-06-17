import type {
  InterviewAttempt,
  InterviewMaterialKind,
  InterviewMaterialSnippet,
  InterviewMaterialVault,
  InterviewMaterialVaultAction,
  InterviewMaterialVaultLevel,
  InterviewMaterialVaultMetric,
  QuestionSnapshot,
  StudyProgress,
} from '../types'

const HIGH_SCORE_THRESHOLD = 80
const MAX_SNIPPETS = 6
const MAX_CONTENT_CHARS = 96

const kindLabels: Record<InterviewMaterialKind, string> = {
  conclusion: '结论话术',
  scenario: '项目场景',
  risk: '风险边界',
}

const kindPriority: Record<InterviewMaterialKind, number> = {
  risk: 30,
  scenario: 20,
  conclusion: 10,
}

export function buildInterviewMaterialVault(progress: StudyProgress): InterviewMaterialVault {
  // 只沉淀高分回答，避免把刚过线但不稳定的表达固化成面试话术。
  const snippets = Object.entries(progress.interviewAttempts)
    .map(([questionId, attempts]) => buildSnippetForQuestion(Number(questionId), attempts, progress))
    .filter((snippet): snippet is InterviewMaterialSnippet => Boolean(snippet))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_SNIPPETS)

  const totalSamples = snippets.length
  const categoryCount = new Set(snippets.map(snippet => snippet.categoryName)).size
  const averageScore = totalSamples === 0
    ? 0
    : Math.round(snippets.reduce((sum, snippet) => sum + snippet.score, 0) / totalSamples)
  const level = resolveLevel(totalSamples, categoryCount)

  return {
    level,
    title: titleForLevel(level),
    summary: summaryForLevel(level, totalSamples, categoryCount, averageScore),
    totalSamples,
    categoryCount,
    averageScore,
    metrics: buildMetrics(totalSamples, categoryCount, averageScore, snippets.length),
    snippets,
    primaryAction: actionForLevel(level),
  }
}

function buildSnippetForQuestion(
  questionId: number,
  attempts: InterviewAttempt[],
  progress: StudyProgress,
): InterviewMaterialSnippet | null {
  const attempt = latestHighScoreAttempt(attempts)
  if (!attempt) {
    return null
  }

  const snapshot = progress.questionSnapshots[questionId] ?? fallbackSnapshot(questionId)
  const material = extractMaterial(attempt.answer)

  return {
    id: `${questionId}-${attempt.createdAt}-${material.kind}`,
    questionId,
    title: snapshot.title,
    categoryName: snapshot.categoryName,
    score: attempt.feedback.score,
    kind: material.kind,
    label: kindLabels[material.kind],
    content: truncate(material.content),
    reason: buildReason(material.kind, attempt.feedback.score, snapshot.categoryName),
    to: `/question/${questionId}`,
    priority: attempt.feedback.score * 10 + kindPriority[material.kind] + timestampWeight(attempt.createdAt),
    createdAt: attempt.createdAt,
  }
}

function latestHighScoreAttempt(attempts: InterviewAttempt[]): InterviewAttempt | undefined {
  return [...attempts]
    .filter(attempt => attempt.feedback.score >= HIGH_SCORE_THRESHOLD)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

function extractMaterial(answer: string): { kind: InterviewMaterialKind; content: string } {
  const sentences = splitSentences(answer)
  const detected = sentences
    .map(sentence => ({ sentence, kind: detectKind(sentence) }))
    .filter((item): item is { sentence: string; kind: InterviewMaterialKind } => Boolean(item.kind))
    [0]

  if (detected) {
    return {
      kind: detected.kind,
      content: detected.sentence,
    }
  }

  const fallback = [...sentences].sort((a, b) => b.length - a.length)[0] ?? '这道题已经形成稳定表达，可以作为面试主动展示素材。'
  return {
    kind: 'conclusion',
    content: fallback,
  }
}

function splitSentences(answer: string): string[] {
  return answer
    .split(/[。！？!?；;\n]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)
}

function detectKind(sentence: string): InterviewMaterialKind | null {
  if (/(项目场景|业务场景|场景是)/.test(sentence)) {
    return 'scenario'
  }
  if (/(风险|边界|降级|回滚|监控|兜底|补偿|告警)/.test(sentence)) {
    return 'risk'
  }
  if (/(项目|场景|线上|并发|容量|业务|压测|峰值|高峰)/.test(sentence)) {
    return 'scenario'
  }
  if (/(结论|核心|本质|首先|关键|原则)/.test(sentence)) {
    return 'conclusion'
  }
  return null
}

function truncate(content: string): string {
  if (content.length <= MAX_CONTENT_CHARS) {
    return content
  }
  return `${content.slice(0, MAX_CONTENT_CHARS)}...`
}

function timestampWeight(createdAt: string): number {
  const time = Date.parse(createdAt)
  if (!Number.isFinite(time)) {
    return 0
  }
  return Math.min(9, Math.floor(time / 1000) % 10)
}

function buildReason(kind: InterviewMaterialKind, score: number, categoryName: string): string {
  if (kind === 'risk') {
    return `${categoryName} 的高分回答已经覆盖风险边界，适合面试前直接复述。`
  }
  if (kind === 'scenario') {
    return `${score} 分回答里有可迁移项目场景，能把知识点落到工程语境。`
  }
  return `${score} 分回答具备清晰结论，可以作为同类题的开场话术。`
}

function resolveLevel(totalSamples: number, categoryCount: number): InterviewMaterialVaultLevel {
  if (totalSamples === 0) {
    return 'empty'
  }
  if (totalSamples >= 2 && categoryCount >= 2) {
    return 'ready'
  }
  return 'building'
}

function titleForLevel(level: InterviewMaterialVaultLevel): string {
  if (level === 'empty') {
    return '高分表达素材待沉淀'
  }
  if (level === 'ready') {
    return '高分表达素材已可复用'
  }
  return '继续扩充高分素材'
}

function summaryForLevel(
  level: InterviewMaterialVaultLevel,
  totalSamples: number,
  categoryCount: number,
  averageScore: number,
): string {
  if (level === 'empty') {
    return '完成 80 分以上模拟回答后，系统会自动抽取可复述的话术片段。'
  }
  if (level === 'ready') {
    return `已沉淀 ${totalSamples} 条高分素材，覆盖 ${categoryCount} 个分类，平均 ${averageScore} 分。`
  }
  return `已有 ${totalSamples} 条高分素材，继续补齐更多分类后可形成面试话术库。`
}

function buildMetrics(
  totalSamples: number,
  categoryCount: number,
  averageScore: number,
  readyCount: number,
): InterviewMaterialVaultMetric[] {
  return [
    {
      key: 'samples',
      label: '高分样本',
      value: String(totalSamples),
      detail: `${HIGH_SCORE_THRESHOLD} 分以上才沉淀`,
    },
    {
      key: 'categories',
      label: '覆盖分类',
      value: String(categoryCount),
      detail: categoryCount >= 2 ? '素材分布稳定' : '继续扩展方向',
    },
    {
      key: 'average',
      label: '平均素材分',
      value: `${averageScore} 分`,
      detail: averageScore >= 90 ? '可做主打素材' : '可继续打磨',
    },
    {
      key: 'ready',
      label: '可复述素材',
      value: String(readyCount),
      detail: readyCount > 0 ? '面试前直接复盘' : '等待高分回答',
    },
  ]
}

function actionForLevel(level: InterviewMaterialVaultLevel): InterviewMaterialVaultAction {
  if (level === 'empty') {
    return {
      label: '先做一题模拟',
      description: '用一次完整开口回答生成第一条高分素材。',
      to: '/practice',
    }
  }
  if (level === 'ready') {
    return {
      label: '复盘高分素材',
      description: '把高分片段整理成面试前可直接复述的话术。',
      to: '/study',
    }
  }
  return {
    label: '继续扩充素材',
    description: '再做一轮模拟面试，补齐更多分类的高分表达。',
    to: '/practice',
  }
}

function fallbackSnapshot(questionId: number): QuestionSnapshot {
  return {
    id: questionId,
    title: `题目 #${questionId}`,
    difficulty: 'MEDIUM',
    categoryName: '未分类',
    tags: [],
    viewCount: 0,
  }
}
