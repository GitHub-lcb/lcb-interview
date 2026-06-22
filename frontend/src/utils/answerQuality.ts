import type { AnswerQualityResult, Question } from '../types'

const FIELD_WEIGHTS: Array<[keyof Question, string, number]> = [
  ['summary', '30 秒口径', 12],
  ['content', '标准回答', 20],
  ['principle', '原理深挖', 16],
  ['comparison', '对比分析', 10],
  ['scenario', '适用场景', 10],
  ['risk', '风险误区', 12],
  ['projectExp', '项目落地', 14],
  ['codeExamples', '代码示例', 3],
  ['diagrams', '图解', 3],
]

export function getQuickAnswer(question: Question): string {
  if (question.summary?.trim()) {
    return question.summary.trim()
  }
  const content = question.content || question.answer || ''
  return stripMarkdown(content).split(/\n\s*\n/)[0]?.trim() || '这道题还缺少快速回答，请先阅读标准答案。'
}

export function calculateAnswerQuality(question: Question): AnswerQualityResult {
  let score = 0
  const completedFields: string[] = []
  const missingFields: string[] = []

  for (const [field, label, weight] of FIELD_WEIGHTS) {
    const value = question[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      score += weight
      completedFields.push(label)
    } else {
      missingFields.push(label)
    }
  }

  const clamped = Math.max(0, Math.min(100, score))
  return {
    score: clamped,
    level: clamped >= 85 ? 'excellent' : clamped >= 60 ? 'good' : 'needs-work',
    completedFields,
    missingFields,
  }
}

/**
 * 构建单题答案质量 Markdown，便于用户把追问、误区和补强模块沉淀到外部错题本。
 *
 * @param question 当前题目
 * @param now 当前时间，用于生成稳定日期
 * @returns 可复制或下载的 Markdown 答案质量卡
 */
export function buildAnswerQualityMarkdown(
  question: Question,
  now = new Date().toISOString(),
): string {
  const quality = calculateAnswerQuality(question)

  return [
    `# ${question.title} 答案质量卡`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderQualityOverview(question, quality),
    renderFieldList('已覆盖模块', quality.completedFields, '暂无完整覆盖模块，先补齐快速回答和标准回答。'),
    renderFieldList('可补强模块', quality.missingFields, '当前核心模块覆盖较完整，下一步进入模拟面试验证表达。'),
    renderFollowUps(question),
    renderMistakeHint(question),
  ].join('\n').trimEnd()
}

function renderQualityOverview(question: Question, quality: AnswerQualityResult): string {
  return [
    '## 质量概览',
    `- 分类：${question.categoryName || '未分类'}`,
    `- 难度：${question.difficulty}`,
    `- 质量分：${quality.score}`,
    `- 等级：${labelForQualityLevel(quality.level)}`,
    `- 快速回答：${getQuickAnswer(question)}`,
    '',
  ].join('\n')
}

function renderFieldList(title: string, fields: string[], emptyText: string): string {
  if (fields.length === 0) {
    return [
      `## ${title}`,
      `- ${emptyText}`,
      '',
    ].join('\n')
  }

  return [
    `## ${title}`,
    ...fields.map(field => `- ${field}`),
    '',
  ].join('\n')
}

function renderFollowUps(question: Question): string {
  const followUps = generateFollowUps(question)
  if (followUps.length === 0) {
    return [
      '## 面试官追问',
      '- 暂无追问。先补齐题目标题和分类，系统会生成追问。',
      '',
    ].join('\n')
  }

  return [
    '## 面试官追问',
    ...followUps.map((item, index) => `${index + 1}. ${item}`),
    '',
  ].join('\n')
}

function renderMistakeHint(question: Question): string {
  return [
    '## 误区提醒',
    `- ${getMistakeHint(question)}`,
  ].join('\n')
}

function labelForQualityLevel(level: AnswerQualityResult['level']): string {
  if (level === 'excellent') {
    return '优秀'
  }
  if (level === 'good') {
    return '可用'
  }
  return '需补强'
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

export function generateFollowUps(question: Question): string[] {
  const subject = extractSubject(question.title)
  const category = question.categoryName || '这个知识点'
  return [
    `${subject} 的底层机制是什么？`,
    `如果面试官结合项目追问 ${subject}，你会怎么落地回答？`,
    `${category} 中还有哪些容易和 ${subject} 混淆的点？`,
  ]
}

export function getMistakeHint(question: Question): string {
  if (question.risk?.trim()) {
    return stripMarkdown(question.risk).split(/\n\s*\n/)[0].trim()
  }
  return '不要只背结论，要补充原因、适用边界和项目中的取舍。'
}

function extractSubject(title: string): string {
  return title
    .replace(/[？?。！!]/g, '')
    .replace(/为什么|是什么|如何|怎么|请解释|说说/g, '')
    .trim() || title
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .trim()
}
