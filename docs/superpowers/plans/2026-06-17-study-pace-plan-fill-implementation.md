# 配速计划补齐 Implementation Plan

> **For agentic workers:** Use test-driven-development for the plan-fill utility and verification-before-completion before commit. Do not open a browser.

**Goal:** 让备考配速教练的“补齐今日计划”可以直接生成并写入符合今日目标题量的题目队列。

**Architecture:** 新增 `studyPacePlan` 纯函数消费 `StudyProgress`、候选题和配速教练结果；扩展 `StudyPaceCoachPanel` 支持补齐回调；`StudyPlan` 负责调用 `setDailyPlan`。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度。

---

### Task 1: 配速计划补齐生成器

**Files:**
- Create: `frontend/src/utils/studyPacePlan.test.ts`
- Create: `frontend/src/utils/studyPacePlan.ts`

- [ ] **Step 1: Write failing tests**

覆盖保留已有计划、复习债优先、目标长度截断、候选题不足、已达目标不扩张。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- studyPacePlan`

Expected: FAIL because `./studyPacePlan` does not exist.

- [ ] **Step 3: Implement utility**

实现 `buildPaceFilledDailyPlan(progress, candidates, now)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- studyPacePlan`

Expected: PASS.

### Task 2: 页面接入

**Files:**
- Modify: `frontend/src/components/StudyPaceCoachPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`

- [ ] **Step 1: Add panel callback**

`StudyPaceCoachPanel` 支持 `onFillPlan` 和 `canFillPlan`。

- [ ] **Step 2: Wire StudyPlan**

在 `StudyPlan` 中用热门题调用 `buildPaceFilledDailyPlan`，写入 `setDailyPlan`。

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
git add docs/superpowers/specs/2026-06-17-study-pace-plan-fill-design.md docs/superpowers/plans/2026-06-17-study-pace-plan-fill-implementation.md frontend/src/utils/studyPacePlan.test.ts frontend/src/utils/studyPacePlan.ts frontend/src/components/StudyPaceCoachPanel.tsx frontend/src/pages/StudyPlan/index.tsx
git commit -m "功能：新增配速计划补齐"
```
