# 今日队列训练入口 Implementation Plan

> **For agentic workers:** Use test-driven-development for the route utility and verification-before-completion before commit. Do not open a browser.

**Goal:** 让学习计划页顶部“开始训练”在有今日计划时直接进入今日队列，减少从计划到训练的切换摩擦。

**Architecture:** 新增 `practiceRoute` 纯函数；`StudyPlan` 顶部训练按钮使用该函数生成路径。

**Tech Stack:** React 18、TypeScript、Vitest、React Router。

---

### Task 1: 训练路径生成器

**Files:**
- Create: `frontend/src/utils/practiceRoute.test.ts`
- Create: `frontend/src/utils/practiceRoute.ts`

- [ ] **Step 1: Write failing tests**

覆盖空队列、去重、截断和非法 ID 过滤。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- practiceRoute`

Expected: FAIL because `./practiceRoute` does not exist.

- [ ] **Step 3: Implement utility**

实现 `buildDailyPracticePath(questionIds, limit)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- practiceRoute`

Expected: PASS.

### Task 2: 学习计划页接入

**Files:**
- Modify: `frontend/src/pages/StudyPlan/index.tsx`

- [ ] **Step 1: Import utility**

引入 `buildDailyPracticePath`。

- [ ] **Step 2: Update start button**

把顶部“开始训练”按钮的跳转改为 `navigate(buildDailyPracticePath(progress.dailyPlan))`。

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
git add docs/superpowers/specs/2026-06-17-daily-practice-route-design.md docs/superpowers/plans/2026-06-17-daily-practice-route-implementation.md frontend/src/utils/practiceRoute.test.ts frontend/src/utils/practiceRoute.ts frontend/src/pages/StudyPlan/index.tsx
git commit -m "功能：新增今日队列训练入口"
```
