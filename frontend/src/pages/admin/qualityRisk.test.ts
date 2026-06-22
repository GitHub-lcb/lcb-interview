import { describe, expect, it } from 'vitest'
import type { AdminCategoryQuality } from '../../types'
import { buildCategoryRiskBreakdown, draftRiskPath } from './qualityRisk'

const row: AdminCategoryQuality = {
  categoryId: 2,
  categoryName: 'Redis',
  total: 20,
  published: 8,
  draft: 9,
  rejected: 1,
  emptyAnswer: 3,
  shortAnswer: 4,
  missingPrinciple: 5,
  missingRisk: 6,
  missingProjectExp: 7,
  missingCodeExamples: 8,
  missingSummary: 1,
  missingComparison: 2,
  missingScenario: 0,
  missingContentSections: 4,
  invalidDifficulty: 1,
  completionRate: 60,
  riskScore: 71,
}

describe('qualityRisk', () => {
  it('prioritizes the largest actionable category risk', () => {
    const breakdown = buildCategoryRiskBreakdown(row)

    expect(breakdown[0]).toMatchObject({
      label: '缺代码',
      value: 8,
      riskType: 'MISSING_CODE_EXAMPLES',
    })
    expect(breakdown.map(item => item.label)).toContain('缺结构段')
    expect(breakdown.map(item => item.label)).toContain('难度异常')
  })

  it('builds a draft-review path scoped to category and risk type', () => {
    expect(draftRiskPath(row, 'MISSING_CODE_EXAMPLES'))
      .toBe('/admin/draft-review?categoryId=2&risk=MISSING_CODE_EXAMPLES')
  })

  it('omits categoryId when the backend reports an unknown category', () => {
    expect(draftRiskPath({ ...row, categoryId: null }, 'EMPTY_ANSWER'))
      .toBe('/admin/draft-review?risk=EMPTY_ANSWER')
  })
})
