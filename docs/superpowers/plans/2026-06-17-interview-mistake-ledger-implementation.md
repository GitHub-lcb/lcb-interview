# 面试错因本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页新增本地面试错因本，把历史模拟面试评分沉淀成可执行的专项训练队列。

**Architecture:** 新增 `interviewMistakeLedger` 纯函数聚合 `StudyProgress`；新增 `InterviewMistakeLedgerPanel` 展示错因和训练按钮；`StudyPlan` 只插入组件。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度结构。

---

### Task 1: 错因聚合器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewMistakeLedger.test.ts`
- Create: `frontend/src/utils/interviewMistakeLedger.ts`

- [ ] **Step 1: Write failing tests**

覆盖空记录、重复低分维度聚合、薄弱题未开口、无错因时进阶入口、训练队列去重。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewMistakeLedger`

Expected: FAIL because `./interviewMistakeLedger` does not exist.

- [ ] **Step 3: Implement aggregator**

新增 `InterviewMistakeLedgerItem`、`InterviewMistakeLedger` 类型，实现 `buildInterviewMistakeLedger(progress)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- interviewMistakeLedger`

Expected: PASS.

### Task 2: 学习计划页接入

**Files:**
- Create: `frontend/src/components/InterviewMistakeLedgerPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel**

展示错因标题、摘要、错因卡片和专项训练按钮。

- [ ] **Step 2: Insert into StudyPlan**

在 `<InterviewBriefPanel progress={progress} />` 后插入 `<InterviewMistakeLedgerPanel progress={progress} />`。

- [ ] **Step 3: Add CSS**

新增 `.interview-mistake-panel`、`.interview-mistake-grid`、`.interview-mistake-card` 和移动端单列规则。

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
git add docs/superpowers/specs/2026-06-17-interview-mistake-ledger-design.md docs/superpowers/plans/2026-06-17-interview-mistake-ledger-implementation.md frontend/src/types.ts frontend/src/utils/interviewMistakeLedger.test.ts frontend/src/utils/interviewMistakeLedger.ts frontend/src/components/InterviewMistakeLedgerPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增面试错因本"
```

