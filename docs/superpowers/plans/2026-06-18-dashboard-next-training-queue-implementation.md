# Dashboard Next Training Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next training queue to the study dashboard daily Markdown report.

**Architecture:** Reuse `frontend/src/utils/nextTrainingQueue.ts` inside `studyDashboardReport.ts`. Keep report rendering local to the dashboard report utility and cover both populated and empty queue exports.

**Tech Stack:** React/Vite frontend, TypeScript utility tests with Vitest.

---

### Task 1: Add Failing Report Tests

**Files:**
- Modify: `frontend/src/utils/studyDashboardReport.test.ts`

- [ ] Assert populated dashboard Markdown contains `## 下一轮训练队列`.
- [ ] Assert it includes queue summary, primary action, first queued title, action label, and practice entry.
- [ ] Assert empty dashboard Markdown keeps the queue section actionable.

### Task 2: Render Queue Section

**Files:**
- Modify: `frontend/src/utils/studyDashboardReport.ts`

- [ ] Import `buildNextTrainingQueue`.
- [ ] Build the queue with current `progress` and `now`.
- [ ] Add `renderNextTrainingQueue(queue)` between today completion and next question.
- [ ] Render up to 5 queue items with source, reason, action, and entry.
- [ ] Preserve existing report sections and output order.

### Task 3: Verify and Commit

**Commands:**
- `npm run test -- studyDashboardReport`
- `npm run test`
- `npm run build`
- `git diff --check`

**Commit:**
- `git commit -m "功能：工作台日报增加下一轮训练队列"`
