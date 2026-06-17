# Sprint Report Next Training Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next training queue to the sprint report Markdown.

**Architecture:** Build one `NextTrainingQueue` inside `buildSprintReportMarkdown` and pass it into executive summary, a new report section, and the final action section.

**Tech Stack:** TypeScript utility functions, Vitest tests.

---

### Task 1: Add Failing Tests

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`

- [ ] Assert populated reports include `## 下一轮训练队列`.
- [ ] Assert one-page summary includes the next training action.
- [ ] Assert final action section includes “下一轮训练”.
- [ ] Assert empty reports keep the queue section actionable.

### Task 2: Implement Report Rendering

**Files:**
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] Import `NextTrainingQueue` and `buildNextTrainingQueue`.
- [ ] Build queue once in `buildSprintReportMarkdown`.
- [ ] Pass queue into `renderExecutiveSummarySection`.
- [ ] Add `renderNextTrainingQueueSection`.
- [ ] Pass queue into `renderActionSection`.

### Task 3: Verify and Commit

**Commands:**
- `npm run test -- sprintReport`
- `npm run test`
- `npm run build`
- `git diff --check`

**Commit:**
- `git commit -m "功能：冲刺报告增加下一轮训练队列"`
