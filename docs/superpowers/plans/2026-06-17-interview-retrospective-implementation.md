# Interview Retrospective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free interview retrospective panel that turns saved mock interview attempts into average score, trend, weakest criterion, recent records, and next-step guidance.

**Architecture:** Add a pure calculation utility first so scoring and trend rules are testable without React. Then add a reusable `InterviewReviewPanel` component and mount it on the home page and practice sidebar. All data stays in local `StudyProgress`; no backend or paid gate is introduced.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, existing `useStudyProgress` and localStorage study progress utilities.

---

## File Structure

- Modify `frontend/src/types.ts`: add interview retrospective result types.
- Create `frontend/src/utils/interviewReview.test.ts`: behavior-first tests for empty state, aggregates, trends, weakest criterion, and recent attempt title fallback.
- Create `frontend/src/utils/interviewReview.ts`: pure aggregation logic with Chinese comments for trend and criterion scoring.
- Create `frontend/src/components/InterviewReviewPanel.tsx`: reusable panel that renders full or compact review.
- Modify `frontend/src/pages/Home/index.tsx`: render the full review panel below `StudyCommandCenter`.
- Modify `frontend/src/pages/Practice/index.tsx`: render compact review panel in the right sidebar.
- Modify `frontend/src/styles/global.css`: add responsive panel styles.

## Task 1: Retrospective Utility

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewReview.test.ts`
- Create: `frontend/src/utils/interviewReview.ts`

- [ ] **Step 1: Add types**

Add these types near the existing interview types in `frontend/src/types.ts`:

```ts
export type InterviewTrend = 'empty' | 'improving' | 'declining' | 'stable'

export interface InterviewCriterionSummary {
  key: InterviewCriterionKey
  label: string
  averageScore: number
  attempts: number
  summary: string
}

export interface InterviewReviewAttempt extends InterviewAttempt {
  question?: QuestionSnapshot
}

export interface InterviewReviewSummary {
  totalAttempts: number
  answeredQuestions: number
  averageScore: number
  bestScore: number
  latestScore?: number
  trend: InterviewTrend
  weakestCriterion?: InterviewCriterionSummary
  criteria: InterviewCriterionSummary[]
  recentAttempts: InterviewReviewAttempt[]
  recommendation: string
}
```

- [ ] **Step 2: Write failing tests**

Create `frontend/src/utils/interviewReview.test.ts` with tests for:

```ts
import { describe, expect, it } from 'vitest'
import type { InterviewCriterionKey, InterviewFeedback, StudyProgress } from '../types'
import { createDefaultProgress } from './studyProgress'
import { buildInterviewReviewSummary } from './interviewReview'

function criterion(key: InterviewCriterionKey, score: number) {
  const labels: Record<InterviewCriterionKey, string> = {
    coverage: '覆盖度',
    structure: '结构化',
    specificity: '具体性',
    risk: '风险意识',
  }
  return { key, label: labels[key], score, summary: `${labels[key]} ${score}` }
}

function feedback(score: number, overrides: Partial<InterviewFeedback> = {}): InterviewFeedback {
  return {
    score,
    level: score >= 80 ? 'strong' : score >= 60 ? 'pass' : 'needs-work',
    criteria: [
      criterion('coverage', score),
      criterion('structure', Math.max(0, score - 10)),
      criterion('specificity', Math.max(0, score - 20)),
      criterion('risk', Math.max(0, score - 30)),
    ],
    advice: [],
    followUps: [],
    ...overrides,
  }
}

function attempt(questionId: number, score: number, createdAt: string) {
  return { questionId, answer: `answer ${score}`, feedback: feedback(score), createdAt }
}

describe('interviewReview', () => {
  it('returns an empty retrospective when there are no interview attempts', () => {
    const summary = buildInterviewReviewSummary(createDefaultProgress())

    expect(summary.trend).toBe('empty')
    expect(summary.totalAttempts).toBe(0)
    expect(summary.recommendation).toContain('先完成')
  })

  it('aggregates attempts across questions and attaches recent question snapshots', () => {
    const progress: StudyProgress = {
      ...createDefaultProgress(),
      questionSnapshots: {
        1: { id: 1, title: 'HashMap 为什么线程不安全？', difficulty: 'MEDIUM', categoryName: 'Java 集合', tags: [], viewCount: 10 },
        2: { id: 2, title: 'Redis 缓存击穿怎么处理？', difficulty: 'HARD', categoryName: 'Redis', tags: [], viewCount: 12 },
      },
      interviewAttempts: {
        1: [attempt(1, 80, '2026-06-17T10:00:00')],
        2: [attempt(2, 60, '2026-06-17T11:00:00'), attempt(2, 90, '2026-06-17T12:00:00')],
      },
    }

    const summary = buildInterviewReviewSummary(progress)

    expect(summary.totalAttempts).toBe(3)
    expect(summary.answeredQuestions).toBe(2)
    expect(summary.averageScore).toBe(77)
    expect(summary.bestScore).toBe(90)
    expect(summary.latestScore).toBe(90)
    expect(summary.recentAttempts[0].question?.title).toBe('Redis 缓存击穿怎么处理？')
  })

  it('detects improving and declining score trends', () => {
    const improving = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          attempt(1, 88, '2026-06-17T12:00:00'),
          attempt(1, 82, '2026-06-17T11:00:00'),
          attempt(1, 80, '2026-06-17T10:00:00'),
          attempt(1, 60, '2026-06-17T09:00:00'),
        ],
      },
    })
    const declining = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          attempt(1, 55, '2026-06-17T12:00:00'),
          attempt(1, 58, '2026-06-17T11:00:00'),
          attempt(1, 62, '2026-06-17T10:00:00'),
          attempt(1, 82, '2026-06-17T09:00:00'),
        ],
      },
    })

    expect(improving.trend).toBe('improving')
    expect(declining.trend).toBe('declining')
  })

  it('finds the weakest criterion by average score', () => {
    const summary = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        1: [
          {
            ...attempt(1, 70, '2026-06-17T12:00:00'),
            feedback: feedback(70, { criteria: [
              criterion('coverage', 80),
              criterion('structure', 78),
              criterion('specificity', 42),
              criterion('risk', 70),
            ] }),
          },
        ],
      },
    })

    expect(summary.weakestCriterion?.key).toBe('specificity')
    expect(summary.recommendation).toContain('具体性')
  })

  it('uses fallback titles for recent attempts without remembered snapshots', () => {
    const summary = buildInterviewReviewSummary({
      ...createDefaultProgress(),
      interviewAttempts: {
        99: [attempt(99, 66, '2026-06-17T12:00:00')],
      },
    })

    expect(summary.recentAttempts[0].question?.title).toBe('题目 #99')
  })
})
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewReview
```

Expected: FAIL because `./interviewReview` does not exist.

- [ ] **Step 4: Implement the utility**

Create `frontend/src/utils/interviewReview.ts`:

```ts
import type {
  InterviewAttempt,
  InterviewCriterion,
  InterviewCriterionKey,
  InterviewCriterionSummary,
  InterviewReviewAttempt,
  InterviewReviewSummary,
  InterviewTrend,
  QuestionSnapshot,
  StudyProgress,
} from '../types'

const TREND_THRESHOLD = 5
const RECENT_ATTEMPT_LIMIT = 3

export function buildInterviewReviewSummary(progress: StudyProgress): InterviewReviewSummary {
  const attempts = flattenAttempts(progress)

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      answeredQuestions: 0,
      averageScore: 0,
      bestScore: 0,
      trend: 'empty',
      criteria: [],
      recentAttempts: [],
      recommendation: '先完成一次模拟面试评分，系统会自动生成表达复盘。',
    }
  }

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0)
  const criteria = summarizeCriteria(attempts.flatMap(attempt => attempt.feedback.criteria))
  const weakestCriterion = criteria[0]

  return {
    totalAttempts: attempts.length,
    answeredQuestions: new Set(attempts.map(attempt => attempt.questionId)).size,
    averageScore: Math.round(totalScore / attempts.length),
    bestScore: Math.max(...attempts.map(attempt => attempt.feedback.score)),
    latestScore: attempts[0].feedback.score,
    trend: resolveTrend(attempts),
    weakestCriterion,
    criteria,
    recentAttempts: attempts.slice(0, RECENT_ATTEMPT_LIMIT),
    recommendation: buildRecommendation(resolveTrend(attempts), weakestCriterion),
  }
}

function flattenAttempts(progress: StudyProgress): InterviewReviewAttempt[] {
  return Object.values(progress.interviewAttempts)
    .flat()
    .map(attempt => ({
      ...attempt,
      question: progress.questionSnapshots[attempt.questionId] ?? fallbackSnapshot(attempt.questionId),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function resolveTrend(attempts: InterviewAttempt[]): InterviewTrend {
  if (attempts.length < 4) {
    return 'stable'
  }

  const recentAverage = average(attempts.slice(0, 3).map(attempt => attempt.feedback.score))
  const previousAverage = average(attempts.slice(3, 6).map(attempt => attempt.feedback.score))
  const diff = recentAverage - previousAverage

  // 5 分以内的波动很可能来自题目难度差异，不把它误判成真实能力变化。
  if (diff >= TREND_THRESHOLD) {
    return 'improving'
  }
  if (diff <= -TREND_THRESHOLD) {
    return 'declining'
  }
  return 'stable'
}

function summarizeCriteria(criteria: InterviewCriterion[]): InterviewCriterionSummary[] {
  const buckets = new Map<InterviewCriterionKey, { label: string; total: number; attempts: number; summaries: string[] }>()

  for (const item of criteria) {
    const current = buckets.get(item.key) ?? { label: item.label, total: 0, attempts: 0, summaries: [] }
    current.total += item.score
    current.attempts += 1
    current.summaries.push(item.summary)
    buckets.set(item.key, current)
  }

  // 维度复盘按平均分升序，最低维度就是下一轮训练最值得补的短板。
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      averageScore: Math.round(bucket.total / bucket.attempts),
      attempts: bucket.attempts,
      summary: bucket.summaries[0] ?? '',
    }))
    .sort((a, b) => a.averageScore - b.averageScore)
}

function buildRecommendation(
  trend: InterviewTrend,
  weakestCriterion?: InterviewCriterionSummary,
): string {
  if (!weakestCriterion) {
    return '继续提交模拟回答，积累更多评分后会定位表达短板。'
  }
  if (trend === 'improving') {
    return `最近表现正在上升，下一轮优先把「${weakestCriterion.label}」补到 80 分以上。`
  }
  if (trend === 'declining') {
    return `最近表现回落，先放慢节奏复盘「${weakestCriterion.label}」，再进入下一题。`
  }
  return `下一轮重点提升「${weakestCriterion.label}」，把答案从知道概念推进到可面试表达。`
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function fallbackSnapshot(questionId: number): QuestionSnapshot {
  return {
    id: questionId,
    title: `题目 #${questionId}`,
    difficulty: 'MEDIUM',
    categoryName: '未分组',
    tags: [],
    viewCount: 0,
  }
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewReview
```

Expected: PASS, 6 tests passing.

## Task 2: Reusable Panel

**Files:**
- Create: `frontend/src/components/InterviewReviewPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel component**

Create `InterviewReviewPanel.tsx` that:

- calls `buildInterviewReviewSummary(progress)`;
- uses `useNavigate()` for the primary action;
- renders an empty state when `totalAttempts === 0`;
- renders average score, trend label, total attempts, answered question count, best score, weakest criterion, recommendation, and recent attempts;
- hides recent attempts when `compact` is true.

- [ ] **Step 2: Add styles**

Add `.interview-review-panel`, `.interview-review-score`, `.interview-review-metrics`, `.interview-review-recent`, and responsive rules to `global.css`.

- [ ] **Step 3: Verify compile**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build succeed.

## Task 3: Page Integration

**Files:**
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/pages/Practice/index.tsx`

- [ ] **Step 1: Home integration**

Import `InterviewReviewPanel` in `Home/index.tsx` and render:

```tsx
<InterviewReviewPanel progress={progress} />
```

below `StudyCommandCenter`. Use `const { progress, rememberQuestions } = useStudyProgress()`.

- [ ] **Step 2: Practice integration**

Import `InterviewReviewPanel` in `Practice/index.tsx` and render:

```tsx
<InterviewReviewPanel progress={progress} compact />
```

inside `.practice-side`, after `.practice-stat-panel` and before `.practice-queue-panel`.

- [ ] **Step 3: Final verification**

Run:

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected:

- frontend tests pass;
- frontend build passes;
- backend tests pass;
- whitespace check has no errors.

- [ ] **Step 4: Commit**

```bash
git add -- frontend/src/types.ts frontend/src/utils/interviewReview.test.ts frontend/src/utils/interviewReview.ts frontend/src/components/InterviewReviewPanel.tsx frontend/src/pages/Home/index.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增模拟面试复盘"
```

## Self-Review

- Spec coverage: utility, panel, home integration, practice integration, empty state, trend and weakest criterion are all covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: all names match the spec and planned files.
