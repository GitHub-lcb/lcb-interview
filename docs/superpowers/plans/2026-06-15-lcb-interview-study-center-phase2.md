# LCB Interview Study Center Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved A+C MVP into a fuller local study center with persistent question snapshots, a review queue, and a dedicated study plan page.

**Architecture:** Keep progress local in `localStorage` and avoid backend schema changes. Store lightweight question snapshots whenever pages load question data, then use those snapshots to render today plan and review queues even after leaving the source list.

**Tech Stack:** React 18, Vite, TypeScript, Ant Design 5, Vitest.

---

## File Structure

- Modify `frontend/src/types.ts`: add `QuestionSnapshot` and `ReviewQueueItem`, extend `StudyProgress`.
- Modify `frontend/src/utils/studyProgress.ts`: add snapshot memory, plan resolution, review queue helpers.
- Modify `frontend/src/utils/studyProgress.test.ts`: cover snapshot persistence and review queue ordering.
- Modify `frontend/src/hooks/useStudyProgress.ts`: expose `rememberQuestion` and `rememberQuestions`.
- Modify `frontend/src/pages/Home/index.tsx`: remember hot questions.
- Modify `frontend/src/pages/QuestionList/index.tsx`: remember loaded list questions.
- Modify `frontend/src/pages/SearchResult/index.tsx`: remember search results.
- Modify `frontend/src/pages/QuestionDetail/index.tsx`: remember detail question.
- Create `frontend/src/pages/StudyPlan/index.tsx`: local study plan page.
- Modify `frontend/src/App.tsx`: add `/study` route.
- Modify `frontend/src/components/Layout/Header.tsx`: add study nav entry.
- Modify `frontend/src/components/StudyDashboard.tsx`: link to study page and resolve plan from snapshots.
- Modify `frontend/src/styles/global.css`: study plan layout.

## Task 1: Progress Snapshot Core

- [ ] Write failing tests for remembering question snapshots, resolving daily plan from snapshots, and ordering weak questions before learning questions.
- [ ] Run `npm run test -- studyProgress` and confirm the new tests fail because helpers are missing.
- [ ] Add `QuestionSnapshot` and `ReviewQueueItem` types.
- [ ] Implement `rememberQuestions`, `resolvePlanQuestions`, and `buildReviewQueue`.
- [ ] Run `npm run test -- studyProgress` and confirm all study progress tests pass.

## Task 2: Hook and Page Data Capture

- [ ] Expose `rememberQuestion` and `rememberQuestions` from `useStudyProgress`.
- [ ] Call `rememberQuestions` after Home hot questions load.
- [ ] Call `rememberQuestions` after category and search lists load.
- [ ] Call `rememberQuestion` after detail loads.
- [ ] Run `npm run build` and confirm TypeScript passes.

## Task 3: Study Plan Page

- [ ] Create `/study` page showing summary metrics, today plan, review queue, and empty state.
- [ ] Add study nav entry in Header.
- [ ] Add "打开学习计划" entry point in StudyDashboard.
- [ ] Add responsive CSS for the study page.
- [ ] Run `npm run build` and confirm it passes.

## Task 4: Verification

- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `mvn test`.
- [ ] Run browser QA against mocked `/api` routes: home, detail, study page, refresh persistence, mobile no overflow.
