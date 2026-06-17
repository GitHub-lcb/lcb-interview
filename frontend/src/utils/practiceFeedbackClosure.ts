import type {
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewFeedback,
  PracticeFeedbackClosure,
  PracticeFeedbackClosureAction,
  PracticeFeedbackClosureLevel,
  PracticeFeedbackClosureMetric,
  PracticeQueueItem,
  QuestionSnapshot,
} from '../types'

const SHORT_ANSWER_CHARS = 20

export function buildPracticeFeedbackClosure(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
): PracticeFeedbackClosure {
  const weakest = resolveWeakestCriterion(feedback.criteria)
  const answerLength = countAnswerChars(answer)
  const isShortAnswer = answerLength < SHORT_ANSWER_CHARS
  const level = resolveLevel(feedback.score, weakest.score)
  const actions = buildActions({
    question,
    feedback,
    weakest,
    isShortAnswer,
    level,
  }).slice(0, 3)

  return {
    level,
    title: titleForLevel(level, isShortAnswer),
    summary: summaryForLevel(level, weakest, isShortAnswer),
    metrics: buildMetrics(feedback, weakest, answerLength),
    actions,
    primaryAction: actions[0],
  }
}

export function buildPracticeFeedbackClosureMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
  now = new Date().toISOString(),
): string {
  const closure = buildPracticeFeedbackClosure(question, answer, feedback)

  return [
    `# ${question.title} 单题评分闭环`,
    '',
    `生成时间：${formatDate(now)}`,
    `分类：${question.categoryName}`,
    `难度：${question.difficulty}`,
    '',
    renderClosureSummary(closure, feedback),
    renderCriteria(feedback.criteria),
    renderClosureMetrics(closure.metrics),
    renderClosureActions(closure.actions),
    renderOriginalAnswer(answer),
  ].join('\n')
}

function renderClosureSummary(closure: PracticeFeedbackClosure, feedback: InterviewFeedback): string {
  return [
    '## 闭环摘要',
    `- 本轮得分：${feedback.score} 分`,
    `- 闭环等级：${closure.level}`,
    `- 闭环判断：${closure.title}`,
    `- 下一步：${closure.primaryAction?.label ?? '继续复盘'}`,
    `- 说明：${closure.summary}`,
    '',
  ].join('\n')
}

function renderCriteria(criteria: InterviewCriterion[]): string {
  const lines = criteria.length > 0
    ? criteria.map(criterion => `- ${criterion.label}：${criterion.score} 分，${criterion.summary}`)
    : ['- 暂无评分维度，先完成一次回答再校准。']

  return [
    '## 评分维度',
    ...lines,
    '',
  ].join('\n')
}

function renderClosureMetrics(metrics: PracticeFeedbackClosureMetric[]): string {
  const lines = metrics.length > 0
    ? metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`)
    : ['- 暂无闭环指标。']

  return [
    '## 闭环指标',
    ...lines,
    '',
  ].join('\n')
}

function renderClosureActions(actions: PracticeFeedbackClosureAction[]): string {
  const lines = actions.length > 0
    ? actions.flatMap((action, index) => {
      const item = [`${index + 1}. ${action.label}：${action.description}`]
      if (action.prompt) {
        item.push(`   Prompt：${action.prompt}`)
      }
      return item
    })
    : ['1. 重新完成本题回答：先说结论，再补原理、场景、风险和落地。']

  return [
    '## 行动清单',
    ...lines,
    '',
  ].join('\n')
}

function renderOriginalAnswer(answer: string): string {
  return [
    '## 原始回答',
    answer.trim() || '暂无回答',
    '',
  ].join('\n')
}

function buildActions(input: {
  question: PracticeQueueItem | QuestionSnapshot
  feedback: InterviewFeedback
  weakest: InterviewCriterion
  isShortAnswer: boolean
  level: PracticeFeedbackClosureLevel
}): PracticeFeedbackClosureAction[] {
  const actions: PracticeFeedbackClosureAction[] = []

  if (input.isShortAnswer) {
    actions.push({
      kind: 'rewrite',
      label: '补场景后重答',
      description: '答案太短，先补一个项目场景、失败边界和验证指标，再重新提交评分。',
      tone: 'primary',
      prompt: buildRewritePrompt(input.question, input.weakest, true),
    })
  }

  if (input.level === 'repair') {
    actions.push({
      kind: 'rewrite',
      label: `重答${input.weakest.label}`,
      description: `最低维度是${input.weakest.label}，先重答这一块再继续下一题。`,
      tone: 'primary',
      prompt: buildRewritePrompt(input.question, input.weakest, false),
    })
    actions.push({
      kind: 'weak',
      label: '标记薄弱',
      description: '把这道题放入复习债，后续学习计划会优先安排回炉。',
      tone: 'danger',
    })
    actions.push({
      kind: 'answer',
      label: '打开答案核对',
      description: '先看标准结构，再回到模拟面试重新说一遍。',
      tone: 'default',
    })
    return dedupeActions(actions)
  }

  if (input.level === 'follow-up') {
    actions.push({
      kind: 'follow-up',
      label: '接一轮追问',
      description: '当前回答可过线但还不稳，用追问验证边界、场景和取舍。',
      tone: 'primary',
      prompt: input.feedback.followUps[0] ?? fallbackFollowUpPrompt(input.question, input.weakest.key),
    })
    actions.push({
      kind: 'answer',
      label: '打开答案核对',
      description: '对照答案补齐缺口后，再做下一轮追问。',
      tone: 'default',
    })
    actions.push({
      kind: 'next',
      label: '进入下一题',
      description: '如果追问已经说清，可以继续推进队列。',
      tone: 'default',
    })
    return dedupeActions(actions)
  }

  actions.push({
    kind: 'mastered',
    label: '标记掌握',
    description: input.level === 'excellent'
      ? '本题已经形成稳定表达，可以沉淀为面试优势素材。'
      : '本题已经过线，先标记掌握，再用追问继续拉高上限。',
    tone: 'success',
  })
  actions.push({
    kind: 'follow-up',
    label: '进阶追问',
    description: '高分答案也要继续检查权衡、边界和项目落地。',
    tone: input.level === 'excellent' ? 'default' : 'primary',
    prompt: input.feedback.followUps[0] ?? fallbackFollowUpPrompt(input.question, input.weakest.key),
  })
  actions.push({
    kind: 'next',
    label: '进入下一题',
    description: '保持节奏，继续刷新表达样本。',
    tone: 'default',
  })

  return dedupeActions(actions)
}

function resolveLevel(score: number, weakestScore: number): PracticeFeedbackClosureLevel {
  if (score < 60 || weakestScore < 60) {
    return 'repair'
  }
  if (score < 80) {
    return 'follow-up'
  }
  if (score >= 90) {
    return 'excellent'
  }
  return 'pass'
}

function titleForLevel(level: PracticeFeedbackClosureLevel, isShortAnswer: boolean): string {
  if (level === 'repair') {
    return '先修复最低分维度'
  }
  if (isShortAnswer) {
    return '先补完整再闭环'
  }
  if (level === 'follow-up') {
    return '用追问完成过线验证'
  }
  if (level === 'excellent') {
    return '本题可以沉淀为优势'
  }
  return '本题过线，继续加压'
}

function summaryForLevel(
  level: PracticeFeedbackClosureLevel,
  weakest: InterviewCriterion,
  isShortAnswer: boolean,
): string {
  if (isShortAnswer) {
    return '回答信息量不足，先补项目场景和风险边界，再重新提交评分。'
  }
  if (level === 'repair') {
    return `当前最需要修复「${weakest.label}」，不要直接跳到下一题。`
  }
  if (level === 'follow-up') {
    return `最低维度是「${weakest.label}」，用一轮追问确认能否稳定过线。`
  }
  if (level === 'excellent') {
    return '这道题已经具备主动表达价值，可以标记掌握并进入进阶追问。'
  }
  return '这道题已经过线，建议标记掌握后再用追问拉高上限。'
}

function buildMetrics(
  feedback: InterviewFeedback,
  weakest: InterviewCriterion,
  answerLength: number,
): PracticeFeedbackClosureMetric[] {
  return [
    {
      key: 'score',
      label: '本轮得分',
      value: `${feedback.score} 分`,
      detail: feedback.level === 'needs-work' ? '需要修复' : '可继续推进',
    },
    {
      key: 'weakest',
      label: '最低维度',
      value: `${weakest.label} ${weakest.score}`,
      detail: weakest.summary,
    },
    {
      key: 'length',
      label: '答案长度',
      value: `${answerLength} 字`,
      detail: answerLength < SHORT_ANSWER_CHARS ? '信息量偏少' : '可用于复盘',
    },
    {
      key: 'followUps',
      label: '追问数',
      value: `${feedback.followUps.length} 个`,
      detail: feedback.followUps.length > 0 ? '可直接加压' : '使用兜底追问',
    },
  ]
}

function resolveWeakestCriterion(criteria: InterviewCriterion[]): InterviewCriterion {
  return [...criteria].sort((a, b) => a.score - b.score)[0] ?? {
    key: 'coverage',
    label: '覆盖度',
    score: 0,
    summary: '暂无评分维度',
  }
}

function buildRewritePrompt(
  question: PracticeQueueItem | QuestionSnapshot,
  criterion: InterviewCriterion,
  requireScenario: boolean,
): string {
  const scenario = requireScenario ? '，必须补一个项目场景、容量指标和失败兜底' : ''
  return `请重新回答「${question.title}」，重点补齐${criterion.label}${scenario}。回答结构：结论 -> 原理 -> 场景 -> 风险 -> 落地。`
}

function fallbackFollowUpPrompt(
  question: PracticeQueueItem | QuestionSnapshot,
  key: InterviewCriterionKey,
): string {
  if (key === 'structure') {
    return `请用 60 秒重新组织「${question.title}」的答案，只保留结论、原因、场景和边界。`
  }
  if (key === 'specificity') {
    return `如果放到真实项目里，「${question.title}」你会如何验证和复盘？`
  }
  if (key === 'risk') {
    return `「${question.title}」的失败边界、线上风险和兜底方案是什么？`
  }
  return `请补齐「${question.title}」的核心机制、替代方案和适用边界。`
}

function countAnswerChars(answer: string): number {
  return answer.replace(/\s+/g, '').length
}

function dedupeActions(actions: PracticeFeedbackClosureAction[]): PracticeFeedbackClosureAction[] {
  const result: PracticeFeedbackClosureAction[] = []
  const seen = new Set<string>()

  for (const action of actions) {
    if (seen.has(action.kind)) {
      continue
    }
    seen.add(action.kind)
    result.push(action)
  }

  return result
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
