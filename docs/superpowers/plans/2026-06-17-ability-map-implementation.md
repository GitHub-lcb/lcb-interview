# Ability Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free home-page ability map that summarizes readiness for each prep route and links users into focused practice.

**Architecture:** Add ability map result types and a pure `abilityMap.ts` utility first. Then create a reusable home panel that consumes `useStudyProgress()` and existing `prepRoutes`. The panel does not fetch data; it only reads local snapshots and routes to existing `/practice` or `/routes`.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, existing `prepRoutes` and `StudyProgress`.

---

## File Structure

- Modify `frontend/src/types.ts`: add ability map types.
- Create `frontend/src/utils/abilityMap.test.ts`: test route matching, scoring, next queue, and sorting.
- Create `frontend/src/utils/abilityMap.ts`: pure route ability calculation.
- Create `frontend/src/components/AbilityMapPanel.tsx`: home page ability panel.
- Modify `frontend/src/pages/Home/index.tsx`: render ability panel.
- Modify `frontend/src/styles/global.css`: add ability panel styles and responsive behavior.

## Task 1: Types And Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/abilityMap.test.ts`

- [ ] **Step 1: Add types**

Add near study strategy / review types:

```ts
export type AbilityReadinessLevel = 'empty' | 'weak' | 'building' | 'ready'

export interface AbilityMapItem {
  routeId: string
  title: string
  role: string
  readinessScore: number
  readinessLevel: AbilityReadinessLevel
  remembered: number
  mastered: number
  weak: number
  learning: number
  nextQuestionIds: number[]
  summary: string
}
```

- [ ] **Step 2: Write failing tests**

Create `frontend/src/utils/abilityMap.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PrepRoute } from '../data/freeSuperiority'
import type { StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildAbilityMap } from './abilityMap'

const routes: PrepRoute[] = [
  {
    id: 'java-backend',
    title: 'Java 后端冲刺路线',
    role: 'Java 后端',
    duration: '21 天',
    summary: 'Java 后端能力',
    stages: [],
    categories: ['Java 并发', 'JVM'],
    actions: [],
  },
  {
    id: 'ai',
    title: 'AI 应用开发路线',
    role: 'AI 应用工程师',
    duration: '14 天',
    summary: 'AI 能力',
    stages: [],
    categories: ['AI 大模型'],
    actions: [],
  },
]

function progressWithSnapshots(): StudyProgress {
  return {
    ...createDefaultProgress(),
    questionSnapshots: {
      1: { id: 1, title: '线程池参数', difficulty: 'MEDIUM', categoryName: 'Java 并发', tags: [], viewCount: 10 },
      2: { id: 2, title: 'JVM GC', difficulty: 'HARD', categoryName: '虚拟机', tags: ['JVM'], viewCount: 20 },
      3: { id: 3, title: 'RAG 检索', difficulty: 'MEDIUM', categoryName: 'AI 大模型', tags: ['RAG'], viewCount: 30 },
      4: { id: 4, title: '无关题', difficulty: 'EASY', categoryName: 'HR', tags: [], viewCount: 5 },
    },
    questionStates: {
      1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      2: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      3: { status: 'learning', addedToPlan: true, reviewCount: 1 },
    },
  }
}

describe('abilityMap', () => {
  it('returns empty ability items when there are no remembered snapshots', () => {
    const items = buildAbilityMap(routes, createDefaultProgress())

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      routeId: 'java-backend',
      readinessScore: 0,
      readinessLevel: 'empty',
      remembered: 0,
    })
  })

  it('matches route categories against question category names and tags', () => {
    const java = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'java-backend')

    expect(java?.remembered).toBe(2)
    expect(java?.mastered).toBe(1)
    expect(java?.weak).toBe(1)
  })

  it('calculates readiness with mastered, learning, weak, and new weights', () => {
    const ai = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'ai')

    expect(ai?.readinessScore).toBe(60)
    expect(ai?.readinessLevel).toBe('building')
  })

  it('excludes mastered questions from next practice ids', () => {
    const java = buildAbilityMap(routes, progressWithSnapshots()).find(item => item.routeId === 'java-backend')

    expect(java?.nextQuestionIds).toEqual([2])
  })

  it('sorts weaker ability areas before stronger areas', () => {
    const items = buildAbilityMap(routes, progressWithSnapshots())

    expect(items.map(item => item.routeId)).toEqual(['java-backend', 'ai'])
  })
})
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd frontend
npm run test -- abilityMap
```

Expected: FAIL because `./abilityMap` does not exist.

## Task 2: Ability Utility

**Files:**
- Create: `frontend/src/utils/abilityMap.ts`

- [ ] **Step 1: Implement utility**

Create `buildAbilityMap(routes, progress)`:

- match snapshots by route categories against `categoryName` and `tags`;
- score mastered=100, learning=60, weak=25, new=10;
- derive readiness level;
- produce summary text;
- build `nextQuestionIds` from non-mastered route questions, prioritizing weak, learning, then new;
- sort weakest or emptiest ability areas first.

- [ ] **Step 2: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- abilityMap
```

Expected: PASS, 5 tests passing.

## Task 3: Home Panel

**Files:**
- Create: `frontend/src/components/AbilityMapPanel.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel**

The panel should:

- call `useStudyProgress()`;
- calculate `buildAbilityMap(prepRoutes, progress)`;
- show route title, role, readiness score, covered/weak/learning/mastered metrics, summary;
- route button to `/practice?queue=...` when `nextQuestionIds` exists, otherwise `/routes`.

- [ ] **Step 2: Add home integration**

Render `<AbilityMapPanel />` below `InterviewReviewPanel`.

- [ ] **Step 3: Add styles**

Add `.ability-map-panel`, `.ability-map-grid`, `.ability-map-card`, `.ability-map-metrics`, and responsive rules.

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
git add -- frontend/src/types.ts frontend/src/utils/abilityMap.test.ts frontend/src/utils/abilityMap.ts frontend/src/components/AbilityMapPanel.tsx frontend/src/pages/Home/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增岗位能力地图"
```

## Self-Review

- Spec coverage: matching, scoring, next queue, sorting, and home UI are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: function and type names match planned usage.
