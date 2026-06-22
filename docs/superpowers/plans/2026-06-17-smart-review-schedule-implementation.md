# Smart Review Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free local intelligent review schedule that shows overdue, due-today, and upcoming review work on the study plan page.

**Architecture:** Add typed schedule results and a pure `reviewSchedule.ts` utility first. Then replace the study page review queue data source with scheduled items and add a schedule summary band above the plan grid. Existing `StudyProgress` data stays unchanged; schedule is calculated at render time.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, existing localStorage study progress utilities.

---

## File Structure

- Modify `frontend/src/types.ts`: add review schedule types.
- Create `frontend/src/utils/reviewSchedule.test.ts`: TDD coverage for intervals, due status, sorting, summary, and excluding new questions.
- Create `frontend/src/utils/reviewSchedule.ts`: pure schedule calculation with Chinese comments.
- Modify `frontend/src/pages/StudyPlan/index.tsx`: use schedule summary and scheduled queue.
- Modify `frontend/src/styles/global.css`: add schedule summary and due badge styles.

## Task 1: Schedule Types And Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/reviewSchedule.test.ts`

- [ ] **Step 1: Add schedule types**

Add after `ReviewQueueItem` in `frontend/src/types.ts`:

```ts
export type ReviewDueStatus = 'overdue' | 'due-today' | 'upcoming'

export interface ScheduledReviewItem extends ReviewQueueItem {
  dueStatus: ReviewDueStatus
  nextReviewAt: string
  daysUntilDue: number
  scheduleReason: string
}

export interface ReviewScheduleSummary {
  overdue: number
  dueToday: number
  upcoming: number
  nextReviewAt?: string
}
```

- [ ] **Step 2: Write failing tests**

Create `frontend/src/utils/reviewSchedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import { createDefaultProgress, rememberQuestions, updateQuestionStatus } from './studyProgress'
import { buildScheduledReviewQueue, summarizeReviewSchedule } from './reviewSchedule'

const today = '2026-06-17T09:00:00'

function question(id: number, categoryName = 'Java 并发'): Question {
  return {
    id,
    title: `Question ${id}`,
    content: 'content',
    difficulty: 'MEDIUM',
    categoryName,
    categoryId: 1,
    tags: ['Java'],
    viewCount: 100,
    createTime: '2026-06-15T00:00:00',
  }
}

describe('reviewSchedule', () => {
  it('marks weak questions without review time as due today', () => {
    let progress = createDefaultProgress('2026-06-17T00:00:00')
    progress = rememberQuestions(progress, [question(1)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'weak', addedToPlan: false, reviewCount: 0 },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue[0]).toMatchObject({
      id: 1,
      dueStatus: 'due-today',
      daysUntilDue: 0,
    })
    expect(queue[0].scheduleReason).toContain('薄弱题')
  })

  it('uses 1, 3, and 7 day intervals for learning questions', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        2: { status: 'learning', addedToPlan: true, reviewCount: 2, lastReviewedAt: '2026-06-14T09:00:00' },
        3: { status: 'learning', addedToPlan: true, reviewCount: 3, lastReviewedAt: '2026-06-10T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.id)).toEqual([1, 2, 3])
    expect(queue.every(item => item.dueStatus === 'due-today')).toBe(true)
  })

  it('uses longer intervals for mastered questions', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'mastered', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-10T09:00:00' },
        2: { status: 'mastered', addedToPlan: false, reviewCount: 3, lastReviewedAt: '2026-06-03T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.daysUntilDue)).toEqual([0, 0])
    expect(queue.map(item => item.scheduleReason)).toEqual([
      '已掌握题 7 天后巩固，避免长期遗忘。',
      '稳定掌握题 14 天后回看，维持长期记忆。',
    ])
  })

  it('sorts overdue items before due today and upcoming items', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
        2: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        3: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
      },
    }

    const queue = buildScheduledReviewQueue(progress, today)

    expect(queue.map(item => item.id)).toEqual([1, 2, 3])
    expect(queue.map(item => item.dueStatus)).toEqual(['overdue', 'due-today', 'upcoming'])
  })

  it('summarizes overdue, due today, upcoming, and next review time', () => {
    let progress = createDefaultProgress()
    progress = rememberQuestions(progress, [question(1), question(2), question(3), question(4)])
    progress = {
      ...progress,
      questionStates: {
        1: { status: 'learning', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
        2: { status: 'weak', addedToPlan: false, reviewCount: 1, lastReviewedAt: '2026-06-16T09:00:00' },
        3: { status: 'learning', addedToPlan: false, reviewCount: 2, lastReviewedAt: '2026-06-16T09:00:00' },
        4: { status: 'new', addedToPlan: false, reviewCount: 0 },
      },
    }

    const summary = summarizeReviewSchedule(buildScheduledReviewQueue(progress, today))

    expect(summary).toEqual({
      overdue: 1,
      dueToday: 1,
      upcoming: 1,
      nextReviewAt: '2026-06-19T09:00:00.000Z',
    })
  })
})
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd frontend
npm run test -- reviewSchedule
```

Expected: FAIL because `./reviewSchedule` does not exist.

## Task 2: Schedule Utility

**Files:**
- Create: `frontend/src/utils/reviewSchedule.ts`

- [ ] **Step 1: Implement schedule calculation**

Create `frontend/src/utils/reviewSchedule.ts` with:

- `buildScheduledReviewQueue(progress, now = new Date().toISOString(), limit = 12)`
- `summarizeReviewSchedule(items)`
- helper functions for interval, due status, reason, fallback snapshot, date math, and sorting.

Implementation notes:

- Use local time boundaries for due status.
- If `lastReviewedAt` is missing or invalid, use `now` as the next review date for weak/learning/mastered tracked questions.
- Exclude `new` status.
- Use Chinese comments for why weak questions are fixed at 1 day and why invalid dates become due today.

- [ ] **Step 2: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- reviewSchedule
```

Expected: PASS, 5 tests passing.

## Task 3: Study Page Integration

**Files:**
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Import schedule helpers**

Replace `buildReviewQueue` import with:

```ts
import { buildScheduledReviewQueue, summarizeReviewSchedule } from '../../utils/reviewSchedule'
```

- [ ] **Step 2: Build scheduled queue and summary**

Replace:

```ts
const reviewQueue = buildReviewQueue(progress, 12)
```

with:

```ts
const reviewQueue = useMemo(() => buildScheduledReviewQueue(progress, new Date().toISOString(), 12), [progress])
const reviewSummary = useMemo(() => summarizeReviewSchedule(reviewQueue), [reviewQueue])
```

- [ ] **Step 3: Add schedule summary band**

Render a `.review-schedule-band` after `.study-plan-metrics` showing overdue, due today, upcoming, and next review date.

- [ ] **Step 4: Update queue copy**

Change the section title to “智能复习队列”. Each item should show a due badge and `item.scheduleReason`.

- [ ] **Step 5: Add CSS**

Add:

- `.review-schedule-band`
- `.review-schedule-band > div`
- `.review-due-badge`
- `.review-due-badge.overdue`
- `.review-due-badge.due-today`
- `.review-due-badge.upcoming`

## Task 4: Verification And Commit

**Files:**
- All modified implementation files.

- [ ] **Step 1: Run final verification**

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected all commands exit 0.

- [ ] **Step 2: Commit implementation**

```bash
git add -- frontend/src/types.ts frontend/src/utils/reviewSchedule.test.ts frontend/src/utils/reviewSchedule.ts frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增智能复习排期"
```

## Self-Review

- Spec coverage: intervals, due status, ordering, summary, study page UI, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: planned type and function names match usage.
