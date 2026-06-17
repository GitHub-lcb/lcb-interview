# 面试错因修复计划 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for the utility and verification-before-completion before commit. Do not open a browser for this plan.

**Goal:** 在面试错因本中新增可执行的三步修复计划，把“发现错因”推进到“马上训练、补齐表达、复测加压”。

**Architecture:** 新增 `interviewRecoveryPlan` 纯函数消费 `InterviewMistakeLedger`；扩展类型；在 `InterviewMistakeLedgerPanel` 内展示步骤列表；样式放入全局 CSS，保持现有学习计划页风格。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度与练习队列。

---

### Task 1: 修复计划生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewRecoveryPlan.test.ts`
- Create: `frontend/src/utils/interviewRecoveryPlan.ts`

- [ ] **Step 1: Write failing tests**

覆盖空状态、高风险低分维度、薄弱未开口、稳定加压路径。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewRecoveryPlan`

Expected: FAIL because `./interviewRecoveryPlan` does not exist.

- [ ] **Step 3: Implement utility**

实现 `buildInterviewRecoveryPlan(ledger)`，输出最多 3 个步骤、总耗时和主行动。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- interviewRecoveryPlan`

Expected: PASS.

### Task 2: 页面接入

**Files:**
- Modify: `frontend/src/components/InterviewMistakeLedgerPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Render recovery plan**

在错因卡片下方展示修复步骤，首步骤按钮高亮。

- [ ] **Step 2: Add responsive CSS**

新增 `.interview-recovery-plan`、`.interview-recovery-steps`、`.interview-recovery-step`，移动端单列展示。

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
git add docs/superpowers/specs/2026-06-17-interview-recovery-plan-design.md docs/superpowers/plans/2026-06-17-interview-recovery-plan-implementation.md frontend/src/types.ts frontend/src/utils/interviewRecoveryPlan.test.ts frontend/src/utils/interviewRecoveryPlan.ts frontend/src/components/InterviewMistakeLedgerPanel.tsx frontend/src/styles/global.css
git commit -m "功能：新增错因修复计划"
```
