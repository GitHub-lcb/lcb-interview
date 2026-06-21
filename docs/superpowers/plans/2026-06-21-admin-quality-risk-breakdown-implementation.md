# Admin Quality Risk Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin quality dashboard explain each risky category with a complete risk breakdown and direct draft-review action.

**Architecture:** Extend the existing quality summary DTO instead of adding new endpoints. Keep risk-priority logic in a focused frontend utility so the dashboard remains display-oriented and the behavior is easy to test.

**Tech Stack:** Spring Boot 3, JDK 21 records, MyBatis-Plus, React 18, TypeScript, Ant Design 5, JUnit 5, Vitest.

---

## File Structure

- Modify `backend/src/main/java/com/lcbinterview/dto/AdminCategoryQualityVO.java`: add missing risk counters to the category quality record.
- Modify `backend/src/main/java/com/lcbinterview/service/AdminQualityService.java`: pass the already-computed counters into the expanded DTO.
- Modify `backend/src/test/java/com/lcbinterview/service/AdminQualityServiceTest.java`: assert the expanded counters and completion behavior.
- Create `frontend/src/pages/admin/qualityRisk.ts`: convert an `AdminCategoryQuality` row into prioritized risk items and draft-review URLs.
- Create `frontend/src/pages/admin/qualityRisk.test.ts`: lock down priority ordering, empty state, and URL generation.
- Modify `frontend/src/types.ts`: add the expanded category quality fields.
- Modify `frontend/src/pages/admin/Dashboard.tsx`: render the full breakdown and first action.
- Modify `frontend/src/pages/admin/Dashboard.test.tsx`: assert the dashboard displays the primary risk and new breakdown fields.

## Task 1: Backend DTO Coverage

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/dto/AdminCategoryQualityVO.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/AdminQualityService.java`
- Modify: `backend/src/test/java/com/lcbinterview/service/AdminQualityServiceTest.java`

- [ ] **Step 1: Write the failing backend assertions**

Add assertions to `buildSummaryAggregatesQuestionQualityAndPrioritizesRiskyCategories`:

```java
AdminCategoryQualityVO redis = summary.categories().getFirst();
assertThat(redis.missingSummary()).isEqualTo(1);
assertThat(redis.missingComparison()).isEqualTo(1);
assertThat(redis.missingScenario()).isEqualTo(1);
assertThat(redis.missingContentSections()).isEqualTo(1);
assertThat(redis.invalidDifficulty()).isEqualTo(0);
```

Add a second invalid-difficulty draft in the mocked question list:

```java
Question invalidDifficulty = question(5L, 2L, "DRAFT", publishableContent(520),
        repeat("原理", 70), repeat("风险", 45), repeat("项目", 45), validCodeExample());
invalidDifficulty.setDifficulty("UNKNOWN");
```

Then assert:

```java
assertThat(summary.categories().getFirst().invalidDifficulty()).isEqualTo(1);
```

- [ ] **Step 2: Run the backend test to verify it fails**

Run:

```bash
cd backend
mvn test -Dtest=AdminQualityServiceTest
```

Expected: compile failure because `AdminCategoryQualityVO` does not expose the new accessor methods yet.

- [ ] **Step 3: Expand the DTO and service mapping**

Add these record fields after `missingCodeExamples`:

```java
@Schema(description = "缺少摘要题目数") long missingSummary,
@Schema(description = "缺少对比分析题目数") long missingComparison,
@Schema(description = "缺少场景说明题目数") long missingScenario,
@Schema(description = "缺少结构化答案段落题目数") long missingContentSections,
@Schema(description = "难度值异常题目数") long invalidDifficulty,
```

Update `CategoryStats.toVO()` to pass:

```java
missingSummary,
missingComparison,
missingScenario,
missingContentSections,
invalidDifficulty,
```

- [ ] **Step 4: Run the backend test to verify it passes**

Run:

```bash
cd backend
mvn test -Dtest=AdminQualityServiceTest
```

Expected: PASS.

## Task 2: Frontend Risk Utility

**Files:**
- Create: `frontend/src/pages/admin/qualityRisk.ts`
- Create: `frontend/src/pages/admin/qualityRisk.test.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Write the failing frontend utility test**

Create `qualityRisk.test.ts` with cases for top risk and path generation:

```ts
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
```

- [ ] **Step 2: Run the frontend utility test to verify it fails**

Run:

```bash
cd frontend
npm run test -- qualityRisk
```

Expected: FAIL because `qualityRisk.ts` does not exist and the type lacks the new fields.

- [ ] **Step 3: Add the frontend type fields**

Add to `AdminCategoryQuality` in `frontend/src/types.ts`:

```ts
missingSummary: number
missingComparison: number
missingScenario: number
missingContentSections: number
invalidDifficulty: number
```

- [ ] **Step 4: Implement `qualityRisk.ts`**

Create a utility that returns non-zero risks sorted by count and severity:

```ts
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
```

- [ ] **Step 5: Run the frontend utility test to verify it passes**

Run:

```bash
cd frontend
npm run test -- qualityRisk
```

Expected: PASS.

## Task 3: Dashboard Integration

**Files:**
- Modify: `frontend/src/pages/admin/Dashboard.tsx`
- Modify: `frontend/src/pages/admin/Dashboard.test.tsx`

- [ ] **Step 1: Write the failing dashboard assertions**

Extend the mocked Redis row in `Dashboard.test.tsx` with the new fields and assert:

```ts
expect(within(row as HTMLElement).getByText('首要缺口')).toBeInTheDocument()
expect(within(row as HTMLElement).getByText('缺代码 8')).toBeInTheDocument()
expect(within(row as HTMLElement).getByText('缺结构段 4')).toBeInTheDocument()
```

- [ ] **Step 2: Run the dashboard test to verify it fails**

Run:

```bash
cd frontend
npm run test -- Dashboard
```

Expected: FAIL because the dashboard does not yet render the new breakdown.

- [ ] **Step 3: Render prioritized breakdown**

Import:

```ts
import { buildCategoryRiskBreakdown, draftRiskPath } from './qualityRisk'
```

In the `结构缺口` column, render `buildCategoryRiskBreakdown(row).slice(0, 8)` instead of the four hard-coded module tags. Add a compact `首要处理` column that displays the first item and navigates with `draftRiskPath(row, primary.riskType)`.

- [ ] **Step 4: Run dashboard tests**

Run:

```bash
cd frontend
npm run test -- Dashboard qualityRisk
```

Expected: PASS.

## Task 4: Verification

**Files:**
- All files above.

- [ ] **Step 1: Run focused backend test**

```bash
cd backend
mvn test -Dtest=AdminQualityServiceTest
```

Expected: PASS.

- [ ] **Step 2: Run focused frontend tests**

```bash
cd frontend
npm run test -- Dashboard qualityRisk
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 4: Check diff hygiene**

```bash
git diff --check
```

Expected: no whitespace errors.

## Self-Review

- Spec coverage: Complete risk fields, prioritized explanation, and draft-review handoff are covered.
- Placeholder scan: no TBD/TODO/later placeholders.
- Type consistency: Backend DTO fields match frontend `AdminCategoryQuality` field names and utility usage.
