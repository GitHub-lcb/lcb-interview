# 今日闭环验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for the report utility and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让学习计划页能实时判断今日计划是否闭环，并给出下一步补齐动作。

**Architecture:** 新增 `dailyPlanCompletion` 纯函数消费 `StudyProgress` 和当前时间；新增 `DailyPlanCompletionPanel` 展示验收报告；`StudyPlan` 将本地进度传入组件。所有逻辑本地计算，不新增后端接口。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度。

---

### Task 1: 验收数据模型和生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/dailyPlanCompletion.test.ts`
- Create: `frontend/src/utils/dailyPlanCompletion.ts`

- [ ] **Step 1: Write failing tests**

覆盖空计划、复习债风险、薄弱风险、未完成、已达标缺面试、已加强。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- dailyPlanCompletion`

Expected: FAIL because `./dailyPlanCompletion` does not exist.

- [ ] **Step 3: Add types**

在 `frontend/src/types.ts` 增加：

```ts
export type DailyPlanCompletionLevel = 'empty' | 'risk' | 'active' | 'ready' | 'excellent'

export interface DailyPlanCompletionMetric {
  key: 'completion' | 'mastered' | 'risk' | 'interview'
  label: string
  value: string
  detail: string
}

export interface DailyPlanCompletionAction {
  label: string
  description: string
  to: string
}

export interface DailyPlanCompletionTodo {
  id: string
  questionId?: number
  title: string
  description: string
  tone: 'danger' | 'warning' | 'default' | 'success'
  to: string
}

export interface DailyPlanCompletion {
  level: DailyPlanCompletionLevel
  title: string
  summary: string
  completionRate: number
  totalCount: number
  masteredCount: number
  remainingCount: number
  weakCount: number
  reviewDebtCount: number
  interviewTodayCount: number
  metrics: DailyPlanCompletionMetric[]
  todos: DailyPlanCompletionTodo[]
  primaryAction: DailyPlanCompletionAction
}
```

- [ ] **Step 4: Implement utility**

实现 `buildDailyPlanCompletion(progress, now)`，复用 `buildScheduledReviewQueue` 和 `buildDailyPracticePath`。

- [ ] **Step 5: Verify GREEN**

Run: `cd frontend; npm run test -- dailyPlanCompletion`

Expected: PASS.

### Task 2: 页面展示

**Files:**
- Create: `frontend/src/components/DailyPlanCompletionPanel.test.tsx`
- Create: `frontend/src/components/DailyPlanCompletionPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

验证组件能显示“今日闭环验收”、完成率和主行动。

- [ ] **Step 2: Implement panel**

组件使用 `buildDailyPlanCompletion`，显示指标、待办和主行动按钮。

- [ ] **Step 3: Wire StudyPlan**

在 `DailyPlanBriefPanel` 后插入 `DailyPlanCompletionPanel`。

- [ ] **Step 4: Add styles**

使用 8px 圆角、白底、紧凑指标栅格和移动端单列布局。

### Task 3: Verification and commit

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend; npm run test`

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend; npm run build`

Expected: build succeeds.

- [ ] **Step 3: Run backend tests**

Run: `cd backend; mvn test`

Expected: all backend tests pass.

- [ ] **Step 4: Run whitespace check**

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-daily-plan-completion-design.md docs/superpowers/plans/2026-06-17-daily-plan-completion-implementation.md frontend/src/types.ts frontend/src/utils/dailyPlanCompletion.test.ts frontend/src/utils/dailyPlanCompletion.ts frontend/src/components/DailyPlanCompletionPanel.test.tsx frontend/src/components/DailyPlanCompletionPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增今日闭环验收"
```
