# Practice Session Training Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a next-round training schedule to the practice session report so users can execute the contract in timed blocks.

**Architecture:** Keep the feature as a derived frontend model. Extend shared types, build the schedule from the existing report, pass gate, contract, and next queue builders, then render it in the report panel and Markdown export.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Add Type And Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] Add `PracticeSessionTrainingScheduleStatus`, `PracticeSessionTrainingScheduleItem`, and `PracticeSessionTrainingSchedule`.
- [ ] Add a failing Markdown test that expects `## 下一轮训练日程`, `预热`, `限时作答`, `验收复盘`, and `主行动：`.
- [ ] Add empty-state expectations for `## 下一轮训练日程` and `等待生成训练日程`.
- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel` and confirm the new assertions fail because the schedule has not been implemented yet.

### Task 2: Build Schedule Model And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] Import the new schedule types.
- [ ] Add `buildPracticeSessionTrainingSchedule(queue, progress, now)` that returns empty, repair, or advance schedules.
- [ ] Build exactly 3 schedule items for non-empty states: warm-up, timed answer, and acceptance review.
- [ ] Add `renderSessionTrainingSchedule` after training contract and before next training.
- [ ] Run the focused utility/component test command and confirm the utility assertions pass.

### Task 3: Render Schedule Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Add a failing component test for `aria-label="下一轮训练日程"` with the three schedule stages and button navigation.
- [ ] Import and memoize `buildPracticeSessionTrainingSchedule`.
- [ ] Render the schedule panel after the training contract.
- [ ] Add responsive styles for the schedule card list.
- [ ] Run the focused tests until they pass.

### Task 4: Verify And Commit

**Files:**
- All modified files.

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit docs with `文档：设计战报下一轮训练日程`.
- [ ] Commit feature with `功能：战报显示下一轮训练日程`.
