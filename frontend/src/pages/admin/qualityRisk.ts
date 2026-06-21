import type { AdminCategoryQuality, DraftRiskType } from '../../types'

export interface CategoryRiskItem {
  label: string
  value: number
  riskType: DraftRiskType
  tone: 'error' | 'warning' | 'default'
  severity: number
}

const riskFields: Array<{
  key: keyof AdminCategoryQuality
  label: string
  riskType: DraftRiskType
  tone: CategoryRiskItem['tone']
  severity: number
}> = [
  { key: 'emptyAnswer', label: '空答案', riskType: 'EMPTY_ANSWER', tone: 'error', severity: 100 },
  { key: 'shortAnswer', label: '短答案', riskType: 'SHORT_ANSWER', tone: 'warning', severity: 80 },
  { key: 'missingContentSections', label: '缺结构段', riskType: 'MISSING_CONTENT_SECTIONS', tone: 'warning', severity: 75 },
  { key: 'invalidDifficulty', label: '难度异常', riskType: 'INVALID_DIFFICULTY', tone: 'error', severity: 70 },
  { key: 'missingSummary', label: '缺摘要', riskType: 'MISSING_SUMMARY', tone: 'warning', severity: 60 },
  { key: 'missingPrinciple', label: '缺原理', riskType: 'MISSING_PRINCIPLE', tone: 'warning', severity: 55 },
  { key: 'missingComparison', label: '缺对比', riskType: 'MISSING_COMPARISON', tone: 'warning', severity: 50 },
  { key: 'missingScenario', label: '缺场景', riskType: 'MISSING_SCENARIO', tone: 'warning', severity: 45 },
  { key: 'missingRisk', label: '缺风险', riskType: 'MISSING_RISK', tone: 'warning', severity: 40 },
  { key: 'missingProjectExp', label: '缺项目', riskType: 'MISSING_PROJECT_EXP', tone: 'warning', severity: 35 },
  { key: 'missingCodeExamples', label: '缺代码', riskType: 'MISSING_CODE_EXAMPLES', tone: 'default', severity: 30 },
]

export function buildCategoryRiskBreakdown(row: AdminCategoryQuality): CategoryRiskItem[] {
  return riskFields
    .map(field => ({
      label: field.label,
      value: Number(row[field.key] ?? 0),
      riskType: field.riskType,
      tone: field.tone,
      severity: field.severity,
    }))
    .filter(item => item.value > 0)
    .sort((left, right) => right.value - left.value || right.severity - left.severity)
}

export function draftRiskPath(row: AdminCategoryQuality, riskType: DraftRiskType): string {
  const params = new URLSearchParams()
  if (row.categoryId) {
    params.set('categoryId', String(row.categoryId))
  }
  params.set('risk', riskType)
  return `/admin/draft-review?${params.toString()}`
}
