import type { QuestionAdmin } from '../../types'

export interface DraftQualityWarning {
  label: string
  color: 'error' | 'warning' | 'default'
}

const VALID_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD'])
const CODE_KEYWORDS = [
  '代码',
  '实现',
  'SQL',
  '算法',
  '配置',
  '线程',
  '并发',
  '锁',
  'Spring',
  'MyBatis',
  'Redis',
  'MySQL',
  'Kafka',
  'RabbitMQ',
  'Docker',
  'K8s',
  'Java',
]

export function getDraftQualityWarnings(question: QuestionAdmin): DraftQualityWarning[] {
  const warnings: DraftQualityWarning[] = []
  const mainAnswer = (question.content || question.answer || '').trim()

  if (!mainAnswer) {
    warnings.push({ label: '空答案', color: 'error' })
  } else {
    requireLength(warnings, mainAnswer, 500, '短答案', 'warning')
    requireIncludes(warnings, mainAnswer, '30 秒口述版', '缺口述')
    requireIncludes(warnings, mainAnswer, '标准答案', '缺标准答案')
    requireIncludes(warnings, mainAnswer, '面试官评分点', '缺评分点')
    requireIncludes(warnings, mainAnswer, '高频追问', '缺追问')
  }

  requireLength(warnings, question.summary, 40, '缺摘要', 'warning')
  requireLength(warnings, question.principle, 120, '缺原理', 'warning')
  requireLength(warnings, question.comparison, 80, '缺对比', 'warning')
  requireLength(warnings, question.scenario, 80, '缺场景', 'warning')
  requireLength(warnings, question.risk, 80, '缺风险', 'warning')
  requireLength(warnings, question.projectExp, 80, '缺项目', 'warning')

  if (needsCodeExample(question) && !hasCodeExample(question.codeExamples)) {
    warnings.push({ label: '缺代码', color: 'default' })
  }
  if (!VALID_DIFFICULTIES.has(question.difficulty || '')) {
    warnings.push({ label: '难度异常', color: 'error' })
  }

  return warnings
}

function requireLength(
  warnings: DraftQualityWarning[],
  value: string | undefined,
  minLength: number,
  label: string,
  color: DraftQualityWarning['color'],
) {
  if (value == null || value.trim().length < minLength) {
    warnings.push({ label, color })
  }
}

function requireIncludes(
  warnings: DraftQualityWarning[],
  value: string,
  keyword: string,
  label: string,
) {
  if (!value.includes(keyword)) {
    warnings.push({ label, color: 'warning' })
  }
}

function needsCodeExample(question: QuestionAdmin) {
  const text = [
    question.title,
    question.categoryName,
    ...(question.tags || []),
  ].filter(Boolean).join(' ')
  return CODE_KEYWORDS.some(keyword => text.includes(keyword))
}

function hasCodeExample(codeExamples?: string) {
  if (codeExamples == null || codeExamples.trim() === '' || codeExamples.trim() === '[]') {
    return false
  }
  try {
    const parsed = JSON.parse(codeExamples)
    return Array.isArray(parsed) && parsed.some(item => typeof item?.code === 'string' && item.code.trim() !== '')
  } catch {
    return false
  }
}
