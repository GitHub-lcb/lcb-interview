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
