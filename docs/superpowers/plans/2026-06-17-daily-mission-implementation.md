# Daily Mission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a home-page daily mission board that turns local review, ability, interview, and plan state into prioritized actions.

**Architecture:** Add typed mission results and a pure `dailyMission.ts` utility first. Then add a reusable `DailyMissionPanel` component and mount it below `StudyCommandCenter` on the home page. The utility composes existing local-only helpers and does not call APIs.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, existing `StudyProgress`, `prepRoutes`, `reviewSchedule`, `abilityMap`, and `interviewReview`.

---

## File Structure

- Modify `frontend/src/types.ts`: add daily mission types.
- Create `frontend/src/utils/dailyMission.test.ts`: test empty state, overdue priority, ability queue, interview priority, dedupe.
- Create `frontend/src/utils/dailyMission.ts`: pure mission builder.
- Create `frontend/src/components/DailyMissionPanel.tsx`: home panel.
- Modify `frontend/src/pages/Home/index.tsx`: render panel.
- Modify `frontend/src/styles/global.css`: mission panel styles.

## Task 1: Types And Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/dailyMission.test.ts`

- [ ] **Step 1: Add types**

Add near study strategy types:

```ts
export type DailyMissionKind = 'review' | 'ability' | 'interview' | 'plan'

export interface DailyMissionItem {
  id: string
  kind: DailyMissionKind
  title: string
  description: string
  reason: string
  to: string
  priority: number
  metric: string
}

export interface DailyMissionPlan {
  title: string
  summary: string
  missions: DailyMissionItem[]
}
```

- [ ] **Step 2: Write failing tests**

Create `frontend/src/utils/dailyMission.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { InterviewFeedback, QuestionSnapshot, StudyProgress } from '../types'
import { prepRoutes } from '../data/freeSuperiority'
import { createDefaultProgress } from './studyProgress'
import { buildDailyMissionPlan } from './dailyMission'

const snapshot = (id: number, categoryName: string, tags: string[] = []): QuestionSnapshot => ({
  id,
  title: `Question ${id}`,
  difficulty: 'MEDIUM',
  categoryName,
  tags,
  viewCount: 10,
})

const feedback = (score: number): InterviewFeedback => ({
  score,
  level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
  criteria: [
    { key: 'coverage', label: '覆盖度', score, summary: '覆盖度' },
    { key: 'structure', label: '结构化', score: score - 10, summary: '结构化' },
    { key: 'specificity', label: '具体性', score: score - 20, summary: '具体性' },
    { key: 'risk', label: '风险意识', score: score - 30, summary: '风险意识' },
  ],
  advice: [],
  followUps: [],
})

describe('dailyMission', () => {
  it('builds startup missions for empty progress', () => {
    const plan = buildDailyMissionPlan(prepRoutes, createDefaultProgress(), '2026-06-17T09:00:00')

    expect(plan.missions.map(mission => mission.kind)).toContain('plan')
    expect(plan.missions.map(mission => mission.kind)).toContain('interview')
    expect(plan.summary).toContain('先建立')
  })

  it('puts overdue review mission first', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: { 1: snapshot(1, 'Java 并发') },
      questionStates: {
        1: { status: 'learning', addedToPlan: true, reviewCount: 1, lastReviewedAt: '2026-06-15T09:00:00' },
      },
    }

    const plan = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')

    expect(plan.missions[0]).toMatchObject({
      kind: 'review',
      to: '/study',
    })
  })

  it('creates an ability mission with a focused practice queue', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: snapshot(1, 'Java 并发'),
        2: snapshot(2, 'JVM'),
      },
      questionStates: {
        1: { status: 'weak', addedToPlan: true, reviewCount: 2 },
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
      .missions
      .find(item => item.kind === 'ability')

    expect(mission?.to).toBe('/practice?queue=1,2')
    expect(mission?.reason).toContain('岗位能力')
  })

  it('raises interview priority when recent scores are declining', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          { questionId: 1, answer: 'a', feedback: feedback(55), createdAt: '2026-06-17T12:00:00' },
          { questionId: 1, answer: 'b', feedback: feedback(58), createdAt: '2026-06-17T11:00:00' },
          { questionId: 1, answer: 'c', feedback: feedback(62), createdAt: '2026-06-17T10:00:00' },
          { questionId: 1, answer: 'd', feedback: feedback(88), createdAt: '2026-06-17T09:00:00' },
        ],
      },
    }

    const mission = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T13:00:00')
      .missions
      .find(item => item.kind === 'interview')

    expect(mission?.priority).toBeGreaterThan(80)
    expect(mission?.description).toContain('回落')
  })

  it('deduplicates repeated action targets by keeping the highest priority mission', () => {
    const progress = {
      ...createDefaultProgress(),
      dailyPlan: [1],
    }

    const plan = buildDailyMissionPlan(prepRoutes, progress, '2026-06-17T09:00:00')
    const targets = plan.missions.map(mission => mission.to)

    expect(targets.length).toBe(new Set(targets).size)
  })
})
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd frontend
npm run test -- dailyMission
```

Expected: FAIL because `./dailyMission` does not exist.

## Task 2: Mission Utility

**Files:**
- Create: `frontend/src/utils/dailyMission.ts`

- [ ] **Step 1: Implement mission builder**

Implement:

```ts
export function buildDailyMissionPlan(
  routes: PrepRoute[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): DailyMissionPlan
```

Implementation rules:

- build review mission from `buildScheduledReviewQueue`;
- build ability mission from `buildAbilityMap`;
- build interview mission from `buildInterviewReviewSummary`;
- build plan mission from `progress.dailyPlan`;
- sort by priority descending;
- dedupe by `to`, keeping the highest priority mission;
- limit to 4.

Add Chinese comments explaining why mission composition is runtime-only and why duplicate targets are removed.

- [ ] **Step 2: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- dailyMission
```

Expected: PASS, 5 tests passing.

## Task 3: Home Panel

**Files:**
- Create: `frontend/src/components/DailyMissionPanel.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create component**

The component should:

- use `useStudyProgress()`;
- call `buildDailyMissionPlan(prepRoutes, progress)`;
- render title, summary, and mission cards;
- route buttons with `useNavigate()`.

- [ ] **Step 2: Mount on home**

Render `<DailyMissionPanel />` below `StudyCommandCenter`.

- [ ] **Step 3: Add styles**

Add `.daily-mission-panel`, `.daily-mission-grid`, `.daily-mission-card`, `.daily-mission-metric`, responsive rules.

## Task 4: Verification And Commit

**Files:**
- All implementation files.

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

- [ ] **Step 2: Commit implementation**

```bash
git add -- frontend/src/types.ts frontend/src/utils/dailyMission.test.ts frontend/src/utils/dailyMission.ts frontend/src/components/DailyMissionPanel.tsx frontend/src/pages/Home/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增今日冲刺任务"
```

## Self-Review

- Spec coverage: all four mission sources, sorting, dedupe, home UI, and tests are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: names match the design.
