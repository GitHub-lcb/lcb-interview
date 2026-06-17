# 备考健康雷达 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页新增完全免费的备考健康雷达，把复习债、能力覆盖、表达稳定性和执行节奏合成一个可行动诊断。

**Architecture:** 新增 `prepHealth` 纯函数聚合已有本地工具函数，新增 `PrepHealthRadarPanel` 负责展示和跳转，首页只做组件编排。数据全部来自 `useStudyProgress` 的本地进度，不新增后端接口。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度工具。

---

### Task 1: 健康雷达算法

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/prepHealth.test.ts`
- Create: `frontend/src/utils/prepHealth.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import type { StudyProgress } from '../types'
import { buildPrepHealthReport } from './prepHealth'

function emptyProgress(): StudyProgress {
  return {
    targetRole: 'Java 后端工程师',
    sprintDays: 14,
    questionStates: {},
    questionSnapshots: {},
    interviewAttempts: {},
    dailyPlan: [],
    updatedAt: '2026-06-17T00:00:00.000Z',
  }
}

describe('buildPrepHealthReport', () => {
  it('guides new users to establish a local learning trail', () => {
    const report = buildPrepHealthReport([], emptyProgress(), '2026-06-17T00:00:00.000Z')
    expect(report.level).toBe('empty')
    expect(report.primaryAction.to).toBe('/study')
  })

  it('treats overdue weak review as the highest risk', () => {
    const progress = emptyProgress()
    progress.questionStates[1] = {
      status: 'weak',
      addedToPlan: true,
      reviewCount: 1,
      lastReviewedAt: '2026-06-13T00:00:00.000Z',
    }
    progress.questionSnapshots[1] = {
      id: 1,
      title: 'volatile 为什么不能保证原子性？',
      difficulty: 'MEDIUM',
      categoryName: 'Java 并发',
      tags: ['Java 并发'],
      viewCount: 100,
    }

    const report = buildPrepHealthReport([], progress, '2026-06-17T00:00:00.000Z')
    expect(report.primaryDimension.key).toBe('review')
    expect(report.primaryAction.to).toBe('/study')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- prepHealth`

Expected: FAIL because `./prepHealth` does not exist.

- [ ] **Step 3: Implement minimal algorithm**

Add `PrepHealth*` types, implement `buildPrepHealthReport(routes, progress, now)` with four dimensions, average score, level mapping and primary action selection.

- [ ] **Step 4: Run focused tests**

Run: `cd frontend; npm run test -- prepHealth`

Expected: PASS.

### Task 2: 首页健康雷达面板

**Files:**
- Create: `frontend/src/components/PrepHealthRadarPanel.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Integrate panel**

Create a component that calls `buildPrepHealthReport(prepRoutes, progress)`, renders the score, primary action and four dimensions, and navigates via `useNavigate`.

- [ ] **Step 2: Place on homepage**

Render `<PrepHealthRadarPanel />` after `<DailyMissionPanel />`.

- [ ] **Step 3: Add responsive CSS**

Add `.prep-health-panel`, `.prep-health-main`, `.prep-health-grid`, `.prep-health-dimension` and mobile grid rules.

- [ ] **Step 4: Run full frontend checks**

Run: `cd frontend; npm run test`

Expected: all tests pass.

Run: `cd frontend; npm run build`

Expected: build succeeds.

### Task 3: Final verification and commit

**Files:**
- All files from Tasks 1-2.

- [ ] **Step 1: Run backend regression**

Run: `cd backend; mvn test`

Expected: all backend tests pass.

- [ ] **Step 2: Run whitespace check**

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 3: Commit with Chinese message**

```bash
git add docs/superpowers/specs/2026-06-17-prep-health-radar-design.md docs/superpowers/plans/2026-06-17-prep-health-radar-implementation.md frontend/src/types.ts frontend/src/utils/prepHealth.test.ts frontend/src/utils/prepHealth.ts frontend/src/components/PrepHealthRadarPanel.tsx frontend/src/pages/Home/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增备考健康雷达"
```

