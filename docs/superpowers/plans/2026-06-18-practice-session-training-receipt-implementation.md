# Practice Session Training Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a training receipt template to the practice session report so users can record the evidence produced after schedule checklist completion.

**Architecture:** Derive the receipt from existing training contract, training schedule, and schedule checklist builders. Render it in Markdown and the report panel without adding persistence or backend changes.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Add Failing Tests

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] Add Markdown expectations for `## 训练回执模板`, `训练目标`, `完成证据`, `阻断项`, `下一步`, and `主行动：`.
- [ ] Add empty-state expectations for `## 训练回执模板` and `等待生成训练回执`.
- [ ] Add component expectations for `aria-label="训练回执模板"` and the four receipt fields.
- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel` and confirm failure because the receipt model and panel do not exist yet.

### Task 2: Implement Receipt Model And Markdown

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] Add `PracticeSessionTrainingReceiptStatus`, `PracticeSessionTrainingReceiptItem`, and `PracticeSessionTrainingReceipt`.
- [ ] Add `buildPracticeSessionTrainingReceipt(queue, progress, now)` based on the existing training builders.
- [ ] Add `renderSessionTrainingReceipt` after `renderSessionScheduleChecklist`.
- [ ] Run the focused tests and verify the Markdown assertions pass.

### Task 3: Render Receipt Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Import and memoize `buildPracticeSessionTrainingReceipt`.
- [ ] Render the receipt panel after the schedule checklist panel.
- [ ] Add compact responsive styles and mobile one-column behavior.
- [ ] Run focused tests until component assertions pass.

### Task 4: Verify And Commit

**Files:**
- All modified files.

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit docs with `文档：设计战报训练回执模板`.
- [ ] Commit feature with `功能：战报显示训练回执模板`.
