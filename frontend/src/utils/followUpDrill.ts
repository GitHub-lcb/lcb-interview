import type {
  FollowUpDrillCriterionKey,
  FollowUpDrillItem,
  FollowUpDrillPack,
  InterviewCriterion,
  InterviewFeedback,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'

const MAX_DRILLS = 5

const CRITERION_LABELS: Record<FollowUpDrillCriterionKey, string> = {
  coverage: '知识覆盖',
  structure: '表达结构',
  specificity: '场景细节',
  risk: '边界风险',
  advanced: '进阶追问',
}

export function buildFollowUpDrillPack(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
): FollowUpDrillPack {
  const weakCriteria = [...feedback.criteria]
    .sort((a, b) => a.score - b.score)
    .filter(item => item.score < 75)
  const criteria = weakCriteria.length > 0 ? weakCriteria : feedback.criteria
  const candidates = [
    ...feedback.followUps.map(prompt => drillFromPrompt(prompt, criteria, answer)),
    ...criteria.map(criterion => drillFromCriterion(question, answer, criterion)),
    ...domainDrills(question, feedback),
    ...advancedDrills(question, feedback),
  ]

  const items = dedupeDrills(candidates)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_DRILLS)

  return {
    title: feedback.score >= 80 ? '进阶追问加压' : '追问加压训练',
    summary: feedback.score >= 80
      ? '当前回答已经可用，继续用进阶追问检查权衡、边界和项目落地。'
      : '按最低分维度生成追问，先补最容易被面试官继续追打的缺口。',
    items,
  }
}

/**
 * 构建单题追问加压训练 Markdown，便于用户把本轮模拟面试追问沉淀到离线复盘材料。
 *
 * @param question 当前训练题目
 * @param answer 用户本轮原始回答
 * @param feedback 本轮面试评分反馈
 * @param now 生成时间，用于测试时固定日期
 * @returns 可复制或下载的 Markdown 追问训练包
 */
export function buildFollowUpDrillMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
  now = new Date().toISOString(),
): string {
  const pack = buildFollowUpDrillPack(question, answer, feedback)

  return [
    `# ${question.title} 追问加压训练`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderQuestionContext(question, answer, feedback),
    [
      '## 训练概览',
      pack.title,
      '',
      pack.summary,
      '',
    ].join('\n'),
    renderDrillItems(pack.items),
  ].join('\n').trimEnd()
}

function drillFromPrompt(
  prompt: string,
  criteria: InterviewCriterion[],
  answer: string,
): FollowUpDrillItem {
  const key = inferCriterionKey(prompt, criteria)
  const basePriority = key === criteria[0]?.key ? 100 : 70
  return buildDrillItem(key, prompt, answer, basePriority)
}

function drillFromCriterion(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  criterion: InterviewCriterion,
): FollowUpDrillItem {
  const prompt = fallbackPrompt(question, criterion.key)
  return buildDrillItem(criterion.key, prompt, answer, 95 - criterion.score)
}

function domainDrills(
  question: PracticeQueueItem | QuestionSnapshot,
  feedback: InterviewFeedback,
): FollowUpDrillItem[] {
  const normalized = normalize([question.title, question.categoryName, ...question.tags].join(' '))
  const priority = feedback.score >= 80 ? 72 : 88
  const drills: FollowUpDrillItem[] = []

  if (normalized.includes('hashmap')) {
    drills.push(buildDrillItem(
      'coverage',
      '如果换成 ConcurrentHashMap，它解决了哪些并发问题？还有哪些边界？',
      '',
      priority,
    ))
  }
  if (normalized.includes('redis')) {
    drills.push(buildDrillItem(
      'risk',
      'Redis 方案在缓存击穿、穿透、雪崩里分别会暴露什么风险？',
      '',
      priority,
    ))
  }
  if (normalized.includes('mysql')) {
    drills.push(buildDrillItem(
      'specificity',
      '如果线上慢查询突然升高，你会按什么顺序定位和验证？',
      '',
      priority,
    ))
  }
  if (normalized.includes('spring')) {
    drills.push(buildDrillItem(
      'coverage',
      '如果面试官继续问 Spring 底层链路，你会从哪个核心扩展点展开？',
      '',
      priority,
    ))
  }
  if (normalized.includes('rag') || normalized.includes('ai')) {
    drills.push(buildDrillItem(
      'risk',
      '如果召回效果不稳定，你会如何拆解检索、排序和生成链路的责任？',
      '',
      priority,
    ))
  }

  return drills
}

function advancedDrills(
  question: PracticeQueueItem | QuestionSnapshot,
  feedback: InterviewFeedback,
): FollowUpDrillItem[] {
  if (feedback.score < 80) {
    return []
  }

  return [
    buildDrillItem(
      'advanced',
      `如果面试官要求你比较两种方案的权衡，你会如何重新回答「${question.title}」？`,
      '',
      82,
    ),
    buildDrillItem(
      'advanced',
      '请把这个答案压缩成 45 秒版本，同时保留结论、证据和风险。',
      '',
      78,
    ),
  ]
}

function buildDrillItem(
  criterionKey: FollowUpDrillCriterionKey,
  prompt: string,
  answer: string,
  priority: number,
): FollowUpDrillItem {
  return {
    id: `${criterionKey}-${hashPrompt(prompt)}`,
    criterionKey,
    criterionLabel: CRITERION_LABELS[criterionKey],
    prompt,
    pressurePoint: pressurePoint(criterionKey),
    answerGuide: answerGuide(criterionKey, answer),
    priority,
  }
}

function inferCriterionKey(
  prompt: string,
  criteria: InterviewCriterion[],
): FollowUpDrillCriterionKey {
  const normalized = normalize(prompt)
  if (normalized.includes('线上') || normalized.includes('场景') || normalized.includes('验证') || normalized.includes('项目')) {
    return 'specificity'
  }
  if (normalized.includes('边界') || normalized.includes('风险') || normalized.includes('误区')) {
    return 'risk'
  }
  if (normalized.includes('60 秒') || normalized.includes('重新回答') || normalized.includes('结构')) {
    return 'structure'
  }
  return criteria[0]?.key ?? 'coverage'
}

function fallbackPrompt(
  question: PracticeQueueItem | QuestionSnapshot,
  key: FollowUpDrillCriterionKey,
): string {
  if (key === 'coverage') {
    return `请补齐「${question.title}」里的定义、核心机制和替代方案。`
  }
  if (key === 'structure') {
    return `请用“结论 -> 原因 -> 场景 -> 边界”重新回答「${question.title}」。`
  }
  if (key === 'specificity') {
    return '放到一个真实项目或线上故障场景，你会怎么选型、验证和复盘？'
  }
  if (key === 'risk') {
    return '这个方案的适用边界、失败场景和常见误区是什么？'
  }
  return `请从方案权衡角度重新回答「${question.title}」。`
}

function pressurePoint(key: FollowUpDrillCriterionKey): string {
  if (key === 'coverage') {
    return '面试官在确认你是否真的理解机制，而不是只背结论。'
  }
  if (key === 'structure') {
    return '面试官在压缩时间，要求你把答案讲得更清晰。'
  }
  if (key === 'specificity') {
    return '面试官在追项目场景、验证路径和真实经验。'
  }
  if (key === 'risk') {
    return '面试官在确认你是否知道方案边界和失败代价。'
  }
  return '面试官在把问题从“会不会”推进到“能否权衡取舍”。'
}

function answerGuide(key: FollowUpDrillCriterionKey, answer: string): string {
  const hasPriorAnswer = answer.trim().length > 0
  if (key === 'coverage') {
    return '先补定义，再讲机制，最后给一个替代方案或对比对象。'
  }
  if (key === 'structure') {
    return '用 4 句组织：结论、原因、项目例子、边界风险。'
  }
  if (key === 'specificity') {
    return hasPriorAnswer
      ? '沿用原答案结论，补一个项目/线上场景、数据指标和验证步骤。'
      : '补一个项目场景，说明触发条件、排查动作、验证指标。'
  }
  if (key === 'risk') {
    return '至少讲 2 个边界：什么时候适用、什么时候会失败、如何兜底。'
  }
  return '用“方案 A / 方案 B / 取舍理由 / 我的选择”组织回答。'
}

function dedupeDrills(items: FollowUpDrillItem[]): FollowUpDrillItem[] {
  const seen = new Set<string>()
  const result: FollowUpDrillItem[] = []

  for (const item of items) {
    const key = normalize(item.prompt)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(item)
  }

  return result
}

function renderQuestionContext(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
): string {
  return [
    '## 题目上下文',
    `- 分类：${question.categoryName || '未分类'}`,
    `- 难度：${question.difficulty || '未知'}`,
    `- 当前评分：${feedback.score}`,
    `- 当前等级：${labelForFeedbackLevel(feedback.level)}`,
    `- 当前回答摘要：${summarizeAnswer(answer)}`,
    '',
  ].join('\n')
}

function renderDrillItems(items: FollowUpDrillItem[]): string {
  if (items.length === 0) {
    return [
      '## 加压题单',
      '- 暂无追问题单，请先完成一次模拟回答以生成个性化追问。',
    ].join('\n')
  }

  return [
    '## 加压题单',
    ...items.map((item, index) => [
      `${index + 1}. ${item.prompt}`,
      `   - 维度：${item.criterionLabel}`,
      `   - 优先级：${item.priority}`,
      `   - 压力点：${item.pressurePoint}`,
      `   - 答题引导：${item.answerGuide}`,
    ].join('\n')),
  ].join('\n')
}

function labelForFeedbackLevel(level: InterviewFeedback['level']): string {
  if (level === 'strong') {
    return '表现强'
  }
  if (level === 'pass') {
    return '可通过'
  }
  return '需要补强'
}

function summarizeAnswer(answer: string): string {
  const normalized = answer.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return '未填写本轮回答'
  }
  if (normalized.length <= 120) {
    return normalized
  }
  return `${normalized.slice(0, 120)}...`
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hashPrompt(prompt: string): string {
  let hash = 0
  for (const char of prompt) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  }
  return Math.abs(hash).toString(36)
}
