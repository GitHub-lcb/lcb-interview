# 面试错因修复计划导出 Implementation Plan

> **For agentic workers:** Use test-driven-development for the Markdown generator and verification-before-completion before commit. Do not open a browser.

**Goal:** 让用户一键复制或下载面试错因修复计划 Markdown，把本地训练闭环带到离线笔记和面试前复盘。

**Architecture:** 新增 `interviewRecoveryReport` 纯函数；`InterviewMistakeLedgerPanel` 增加复制按钮和剪贴板降级下载；样式复用现有修复计划头部。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、浏览器 Clipboard API 与 Blob 下载。

---

### Task 1: Markdown 生成器

**Files:**
- Create: `frontend/src/utils/interviewRecoveryReport.test.ts`
- Create: `frontend/src/utils/interviewRecoveryReport.ts`

- [ ] **Step 1: Write failing tests**

覆盖高风险错因导出、空状态导出，不允许出现 `undefined`。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewRecoveryReport`

Expected: FAIL because `./interviewRecoveryReport` does not exist.

- [ ] **Step 3: Implement generator**

实现 `buildInterviewRecoveryMarkdown(ledger, plan, targetRole, now)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- interviewRecoveryReport`

Expected: PASS.

### Task 2: 面板接入

**Files:**
- Modify: `frontend/src/components/InterviewMistakeLedgerPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add copy action**

在修复计划头部展示“复制计划”，复制失败时下载 Markdown。

- [ ] **Step 2: Add compact action style**

保证按钮在移动端不会挤压标题。

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
git add docs/superpowers/specs/2026-06-17-interview-recovery-export-design.md docs/superpowers/plans/2026-06-17-interview-recovery-export-implementation.md frontend/src/utils/interviewRecoveryReport.test.ts frontend/src/utils/interviewRecoveryReport.ts frontend/src/components/InterviewMistakeLedgerPanel.tsx frontend/src/styles/global.css
git commit -m "功能：新增错因修复计划导出"
```
