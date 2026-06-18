# Practice Session Receipt Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a receipt acceptance card to the practice session report so users can verify whether a completed training receipt is strong enough to move into the next round.

**Architecture:** Derive acceptance checkpoints from the existing training receipt builder. Add shared types, Markdown rendering, report panel rendering, focused tests, responsive styles, and no persistence.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Add Failing Tests

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] Add Markdown expectations for `## 回执验收卡`, `目标清晰`, `证据可查`, `阻断说明`, `下一步明确`, and `主行动：`.
- [ ] Add empty-state expectations for `## 回执验收卡` and `等待验收训练回执`.
- [ ] Add component expectations for `aria-label="回执验收卡"` and the four acceptance item labels.
- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel` and confirm failure because production code is missing.

### Task 2: Implement Acceptance Model And Markdown

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] Add `PracticeSessionReceiptAcceptanceStatus`, `PracticeSessionReceiptAcceptanceItem`, and `PracticeSessionReceiptAcceptance`.
- [ ] Add `buildPracticeSessionReceiptAcceptance(queue, progress, now)` based on `buildPracticeSessionTrainingReceipt`.
- [ ] Add `renderSessionReceiptAcceptance` after `renderSessionTrainingReceipt`.
- [ ] Run focused tests and verify Markdown assertions pass.

### Task 3: Render Acceptance Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Import and memoize `buildPracticeSessionReceiptAcceptance`.
- [ ] Render the acceptance panel after the receipt panel.
- [ ] Add compact responsive styles and mobile one-column behavior.
- [ ] Run focused tests until component assertions pass.

### Task 4: Verify And Commit

**Files:**
- All modified files.

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit docs with `文档：设计战报回执验收卡`.
- [ ] Commit feature with `功能：战报显示回执验收卡`.
