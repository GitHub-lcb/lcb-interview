# 面试错因复测验收 Implementation Plan

> **For agentic workers:** Use test-driven-development for the acceptance utility and verification-before-completion before commit. Do not open a browser.

**Goal:** 在错因本修复计划后新增复测验收状态，让用户知道首要错因是否已经被最新模拟面试压下去。

**Architecture:** 新增 `interviewRecoveryAcceptance` 纯函数读取 `StudyProgress` 和 `InterviewMistakeLedger`；扩展类型；`InterviewMistakeLedgerPanel` 渲染验收条；CSS 增加状态色。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度。

---

### Task 1: 复测验收生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewRecoveryAcceptance.test.ts`
- Create: `frontend/src/utils/interviewRecoveryAcceptance.ts`

- [ ] **Step 1: Write failing tests**

覆盖空状态、维度错因未开始、部分复测、全部通过、复测失败、薄弱题开口通过。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewRecoveryAcceptance`

Expected: FAIL because `./interviewRecoveryAcceptance` does not exist.

- [ ] **Step 3: Implement acceptance utility**

实现 `buildInterviewRecoveryAcceptance(progress, ledger)`，输出状态、计数、摘要和复测入口。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- interviewRecoveryAcceptance`

Expected: PASS.

### Task 2: 面板接入

**Files:**
- Modify: `frontend/src/components/InterviewMistakeLedgerPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Render acceptance strip**

放在修复计划下方，展示状态、计数、摘要和继续复测按钮。

- [ ] **Step 2: Add responsive CSS**

保证移动端不挤压按钮和状态文字。

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
git add docs/superpowers/specs/2026-06-17-interview-recovery-acceptance-design.md docs/superpowers/plans/2026-06-17-interview-recovery-acceptance-implementation.md frontend/src/types.ts frontend/src/utils/interviewRecoveryAcceptance.test.ts frontend/src/utils/interviewRecoveryAcceptance.ts frontend/src/components/InterviewMistakeLedgerPanel.tsx frontend/src/styles/global.css
git commit -m "功能：新增错因复测验收"
```
