# Practice Session Schedule Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a schedule checklist to the practice session report so users know what evidence to leave after each scheduled block.

**Architecture:** Derive the checklist from the existing training schedule builder. Add shared types, Markdown rendering, report panel rendering, focused tests, and compact responsive styles.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Add Failing Tests

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] Add Markdown expectations for `## 训练日程打卡清单`, `完成口径`, `证据模板`, `复盘问题`, and `主行动：`.
- [ ] Add empty-state expectations for `## 训练日程打卡清单` and `等待生成打卡清单`.
- [ ] Add component expectations for `aria-label="训练日程打卡清单"` and the three checklist concepts.
- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel` and confirm failure because production code is missing.

### Task 2: Implement Checklist Model

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] Add `PracticeSessionScheduleChecklistStatus`, `PracticeSessionScheduleChecklistItem`, and `PracticeSessionScheduleChecklist`.
- [ ] Add `buildPracticeSessionScheduleChecklist(queue, progress, now)` based on `buildPracticeSessionTrainingSchedule`.
- [ ] Add `renderSessionScheduleChecklist` after `renderSessionTrainingSchedule`.
- [ ] Run focused tests until utility assertions pass.

### Task 3: Render Checklist Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Import and memoize `buildPracticeSessionScheduleChecklist`.
- [ ] Render the checklist panel after the schedule panel.
- [ ] Add responsive card styles and mobile one-column behavior.
- [ ] Run focused tests until component assertions pass.

### Task 4: Verify And Commit

**Files:**
- All modified files.

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Commit docs with `文档：设计战报训练日程打卡清单`.
- [ ] Commit feature with `功能：战报显示训练日程打卡清单`.
