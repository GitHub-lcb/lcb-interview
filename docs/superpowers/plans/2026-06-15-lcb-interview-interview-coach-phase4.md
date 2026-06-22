# Interview Coach Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local simulated interviewer flow to the practice page so users can answer, get scored, receive follow-up prompts, and keep attempt history.

**Architecture:** Keep the scoring deterministic and client-side for this phase. `interviewCoach.ts` evaluates answer quality from question metadata and the typed answer; `studyProgress.ts` stores bounded attempt history; `Practice` renders the answer input, feedback card, follow-up prompts, and latest score.

**Tech Stack:** React 18, Vite, Ant Design 5, Vitest, localStorage-backed study progress.

---

### Task 1: Scoring Engine

**Files:**
- Create: `frontend/src/utils/interviewCoach.ts`
- Create: `frontend/src/utils/interviewCoach.test.ts`
- Modify: `frontend/src/types.ts`

- [ ] Define `InterviewCriterion`, `InterviewFeedback`, and `InterviewAttempt` types.
- [ ] Write failing Vitest cases for blank answers, strong structured answers, and generated follow-up prompts.
- [ ] Implement deterministic scoring with four criteria: coverage, structure, specificity, and risk awareness.
- [ ] Run `npm run test -- interviewCoach`.

### Task 2: Attempt Storage

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/studyProgress.ts`
- Modify: `frontend/src/utils/studyProgress.test.ts`
- Modify: `frontend/src/hooks/useStudyProgress.ts`

- [ ] Add `interviewAttempts` to `StudyProgress` with backward-compatible parsing.
- [ ] Write failing tests for appending attempts, bounding history to the newest five per question, and preserving old payloads.
- [ ] Implement `recordInterviewAttempt` and expose it from `useStudyProgress`.
- [ ] Run `npm run test -- studyProgress`.

### Task 3: Practice UI

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] Add answer textarea and submit button below the current question.
- [ ] Show score, criteria, improvement advice, and follow-up prompts after submission.
- [ ] Persist the attempt and show latest score in the side panel.
- [ ] Reset draft answer and feedback when moving to another question.
- [ ] Keep mobile layout single-column with no horizontal overflow.

### Task 4: Verification

**Commands:**
- `npm run test`
- `npm run build`
- `mvn test`
- Browser QA on `/practice`: submit answer, see feedback, verify localStorage attempt, check mobile overflow, check console errors.
- `git diff --check`
