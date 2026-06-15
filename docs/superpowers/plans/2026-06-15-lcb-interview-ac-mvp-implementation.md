# LCB Interview A+C MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved A+C MVP: a high-quality answer experience plus local personalized study planning.

**Architecture:** Keep the backend data model unchanged and implement the MVP primarily in the React frontend. Add a small frontend test harness for pure logic, store per-user study progress in `localStorage`, and make page components consume the shared study state through a hook. Preserve existing APIs and rely on the enriched `QuestionVO` fields already returned by the backend.

**Tech Stack:** React 18, Vite 5, TypeScript 5.3, Ant Design 5, Vitest, Spring Boot backend verification.

---

## File Structure

- Modify `frontend/package.json`: add `test` scripts and lightweight test dependencies.
- Create `frontend/vitest.config.ts`: jsdom test environment.
- Modify `frontend/src/types.ts`: add study progress and answer quality types.
- Create `frontend/src/utils/studyProgress.ts`: localStorage parsing, state updates, daily plan, progress summary.
- Create `frontend/src/utils/studyProgress.test.ts`: unit tests for progress persistence and plan generation.
- Create `frontend/src/utils/answerQuality.ts`: answer score, quick answer fallback, follow-up generation, mistake hint.
- Create `frontend/src/utils/answerQuality.test.ts`: unit tests for answer quality helpers.
- Create `frontend/src/hooks/useStudyProgress.ts`: React hook wrapping the progress utility.
- Create `frontend/src/components/StudyStatusBadge.tsx`: reusable status badge.
- Create `frontend/src/components/StudyActionButtons.tsx`: reusable add-to-plan/weak/mastered actions.
- Create `frontend/src/components/StudyDashboard.tsx`: homepage study cockpit.
- Create `frontend/src/components/AnswerQualityPanel.tsx`: question detail side panel.
- Modify `frontend/src/pages/Home/index.tsx`: add study cockpit and fix visible Chinese copy.
- Modify `frontend/src/pages/Home/HotQuestions.tsx`: show study status and fix visible Chinese copy.
- Modify `frontend/src/pages/QuestionDetail/index.tsx`: two-column detail layout, action buttons, quality side panel.
- Modify `frontend/src/pages/QuestionDetail/ContentView.tsx`: answer-quality module labels and graceful fallbacks.
- Modify `frontend/src/pages/QuestionList/index.tsx`: show study status and quick actions.
- Modify `frontend/src/pages/SearchResult/index.tsx`: show study status and quick actions.
- Modify `frontend/src/styles/global.css`: compact tool-surface styles and responsive detail layout.

## Task 1: Frontend Test Harness

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Add frontend test scripts and dependencies**

Modify `frontend/package.json` scripts and devDependencies to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "jsdom": "^25.0.1",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^2.1.8"
  }
}
```

Run:

```bash
cd frontend
npm install
```

Expected: `package-lock.json` updates and install completes.

- [ ] **Step 2: Create Vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
  },
})
```

- [ ] **Step 3: Verify harness starts**

Run:

```bash
cd frontend
npm run test
```

Expected: Vitest starts and reports no test files or zero tests depending on Vitest output.

## Task 2: Study Progress Core

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/studyProgress.ts`
- Create: `frontend/src/utils/studyProgress.test.ts`

- [ ] **Step 1: Add study types**

Append these exports to `frontend/src/types.ts`:

```ts
export type StudyQuestionStatus = 'new' | 'learning' | 'mastered' | 'weak'

export interface QuestionStudyState {
  status: StudyQuestionStatus
  addedToPlan: boolean
  lastReviewedAt?: string
  reviewCount: number
}

export interface StudyProgress {
  targetRole: string
  sprintDays: number
  questionStates: Record<number, QuestionStudyState>
  dailyPlan: number[]
  updatedAt: string
}

export interface StudySummary {
  totalTracked: number
  mastered: number
  weak: number
  learning: number
  masteryRate: number
}

export interface WeakArea {
  categoryId?: number
  categoryName: string
  score: number
  weakCount: number
  learningCount: number
  masteredCount: number
}
```

- [ ] **Step 2: Write failing study progress tests**

Create `frontend/src/utils/studyProgress.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import {
  buildDailyPlan,
  createDefaultProgress,
  getQuestionState,
  parseStudyProgress,
  summarizeProgress,
  toggleQuestionInPlan,
  updateQuestionStatus,
  weakAreasFromQuestions,
} from './studyProgress'

const baseQuestion = (id: number, categoryName: string): Question => ({
  id,
  title: `Question ${id}`,
  content: 'content',
  difficulty: 'MEDIUM',
  categoryName,
  categoryId: categoryName === 'Java 并发' ? 1 : 2,
  tags: [],
  viewCount: 0,
  createTime: '2026-06-15T00:00:00',
})

describe('studyProgress', () => {
  it('resets corrupted localStorage payloads to default progress', () => {
    const progress = parseStudyProgress('{broken json')

    expect(progress.targetRole).toBe('Java 后端')
    expect(progress.sprintDays).toBe(21)
    expect(progress.dailyPlan).toEqual([])
  })

  it('updates question status and review metadata immutably', () => {
    const progress = createDefaultProgress()
    const next = updateQuestionStatus(progress, 10, 'weak', '2026-06-15T10:00:00')

    expect(progress.questionStates[10]).toBeUndefined()
    expect(next.questionStates[10]).toEqual({
      status: 'weak',
      addedToPlan: false,
      lastReviewedAt: '2026-06-15T10:00:00',
      reviewCount: 1,
    })
  })

  it('toggles daily plan membership without duplicates', () => {
    const progress = createDefaultProgress()
    const added = toggleQuestionInPlan(progress, 10, true, '2026-06-15T10:00:00')
    const addedAgain = toggleQuestionInPlan(added, 10, true, '2026-06-15T10:01:00')
    const removed = toggleQuestionInPlan(addedAgain, 10, false, '2026-06-15T10:02:00')

    expect(addedAgain.dailyPlan).toEqual([10])
    expect(addedAgain.questionStates[10].addedToPlan).toBe(true)
    expect(removed.dailyPlan).toEqual([])
    expect(removed.questionStates[10].addedToPlan).toBe(false)
  })

  it('builds a daily plan with weak questions first', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 1, 'mastered', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 3, 'learning', '2026-06-15T10:00:00')

    const plan = buildDailyPlan(progress, [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
      baseQuestion(4, 'MySQL'),
    ], 3)

    expect(plan).toEqual([2, 3, 4])
  })

  it('summarizes mastery and weak areas from tracked questions', () => {
    let progress = createDefaultProgress()
    progress = updateQuestionStatus(progress, 1, 'weak', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 2, 'learning', '2026-06-15T10:00:00')
    progress = updateQuestionStatus(progress, 3, 'mastered', '2026-06-15T10:00:00')

    const questions = [
      baseQuestion(1, 'Java 并发'),
      baseQuestion(2, 'Java 并发'),
      baseQuestion(3, 'JVM'),
    ]

    expect(getQuestionState(progress, 99).status).toBe('new')
    expect(summarizeProgress(progress).masteryRate).toBe(33)
    expect(weakAreasFromQuestions(progress, questions)[0].categoryName).toBe('Java 并发')
  })
})
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
cd frontend
npm run test -- studyProgress
```

Expected: FAIL because `studyProgress.ts` does not exist.

- [ ] **Step 4: Implement study progress utility**

Create `frontend/src/utils/studyProgress.ts`:

```ts
import type {
  Question,
  QuestionStudyState,
  StudyProgress,
  StudyQuestionStatus,
  StudySummary,
  WeakArea,
} from '../types'

export const STUDY_PROGRESS_STORAGE_KEY = 'lcb-interview-study-progress'
export const STUDY_PROGRESS_EVENT = 'lcb-study-progress-change'

const DEFAULT_ROLE = 'Java 后端'
const DEFAULT_SPRINT_DAYS = 21

export function createDefaultProgress(now = new Date().toISOString()): StudyProgress {
  return {
    targetRole: DEFAULT_ROLE,
    sprintDays: DEFAULT_SPRINT_DAYS,
    questionStates: {},
    dailyPlan: [],
    updatedAt: now,
  }
}

export function parseStudyProgress(raw: string | null): StudyProgress {
  if (!raw) {
    return createDefaultProgress()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StudyProgress>
    if (!parsed || typeof parsed !== 'object') {
      return createDefaultProgress()
    }
    return {
      targetRole: typeof parsed.targetRole === 'string' ? parsed.targetRole : DEFAULT_ROLE,
      sprintDays: typeof parsed.sprintDays === 'number' ? parsed.sprintDays : DEFAULT_SPRINT_DAYS,
      questionStates: parsed.questionStates && typeof parsed.questionStates === 'object'
        ? parsed.questionStates as Record<number, QuestionStudyState>
        : {},
      dailyPlan: Array.isArray(parsed.dailyPlan)
        ? [...new Set(parsed.dailyPlan.filter(id => typeof id === 'number'))]
        : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return createDefaultProgress()
  }
}

export function readStudyProgress(storage: Storage = window.localStorage): StudyProgress {
  return parseStudyProgress(storage.getItem(STUDY_PROGRESS_STORAGE_KEY))
}

export function writeStudyProgress(progress: StudyProgress, storage: Storage = window.localStorage): void {
  storage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
  window.dispatchEvent(new Event(STUDY_PROGRESS_EVENT))
}

export function getQuestionState(progress: StudyProgress, questionId: number): QuestionStudyState {
  return progress.questionStates[questionId] ?? {
    status: 'new',
    addedToPlan: progress.dailyPlan.includes(questionId),
    reviewCount: 0,
  }
}

export function updateQuestionStatus(
  progress: StudyProgress,
  questionId: number,
  status: StudyQuestionStatus,
  now = new Date().toISOString(),
): StudyProgress {
  const current = getQuestionState(progress, questionId)
  return {
    ...progress,
    questionStates: {
      ...progress.questionStates,
      [questionId]: {
        ...current,
        status,
        lastReviewedAt: now,
        reviewCount: current.reviewCount + 1,
      },
    },
    updatedAt: now,
  }
}

export function toggleQuestionInPlan(
  progress: StudyProgress,
  questionId: number,
  added: boolean,
  now = new Date().toISOString(),
): StudyProgress {
  const current = getQuestionState(progress, questionId)
  const dailyPlan = added
    ? [...new Set([...progress.dailyPlan, questionId])]
    : progress.dailyPlan.filter(id => id !== questionId)
  return {
    ...progress,
    dailyPlan,
    questionStates: {
      ...progress.questionStates,
      [questionId]: {
        ...current,
        addedToPlan: added,
        status: current.status === 'new' && added ? 'learning' : current.status,
      },
    },
    updatedAt: now,
  }
}

export function buildDailyPlan(progress: StudyProgress, candidates: Question[], limit = 5): number[] {
  const known = new Set(progress.dailyPlan)
  const ranked = [...candidates]
    .filter(q => !known.has(q.id) || getQuestionState(progress, q.id).status !== 'mastered')
    .sort((a, b) => rankQuestion(progress, a) - rankQuestion(progress, b))
    .map(q => q.id)
  return [...new Set([...progress.dailyPlan, ...ranked])].slice(0, limit)
}

function rankQuestion(progress: StudyProgress, question: Question): number {
  const state = getQuestionState(progress, question.id)
  if (state.status === 'weak') {
    return 0
  }
  if (state.status === 'learning') {
    return 1
  }
  if (state.status === 'new') {
    return 2
  }
  return 3
}

export function summarizeProgress(progress: StudyProgress): StudySummary {
  const states = Object.values(progress.questionStates)
  const mastered = states.filter(s => s.status === 'mastered').length
  const weak = states.filter(s => s.status === 'weak').length
  const learning = states.filter(s => s.status === 'learning').length
  const totalTracked = states.length
  return {
    totalTracked,
    mastered,
    weak,
    learning,
    masteryRate: totalTracked === 0 ? 0 : Math.round((mastered / totalTracked) * 100),
  }
}

export function weakAreasFromQuestions(progress: StudyProgress, questions: Question[]): WeakArea[] {
  const buckets = new Map<string, WeakArea>()
  for (const question of questions) {
    const state = getQuestionState(progress, question.id)
    if (state.status === 'new') {
      continue
    }
    const key = question.categoryName || `分类 ${question.categoryId ?? '未分组'}`
    const current = buckets.get(key) ?? {
      categoryId: question.categoryId,
      categoryName: key,
      score: 0,
      weakCount: 0,
      learningCount: 0,
      masteredCount: 0,
    }
    if (state.status === 'weak') {
      current.weakCount += 1
      current.score += 3
    }
    if (state.status === 'learning') {
      current.learningCount += 1
      current.score += 2
    }
    if (state.status === 'mastered') {
      current.masteredCount += 1
      current.score -= 1
    }
    buckets.set(key, current)
  }
  return [...buckets.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
cd frontend
npm run test -- studyProgress
```

Expected: PASS.

## Task 3: Answer Quality Core

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/answerQuality.ts`
- Create: `frontend/src/utils/answerQuality.test.ts`

- [ ] **Step 1: Add answer quality types**

Append to `frontend/src/types.ts`:

```ts
export interface AnswerQualityResult {
  score: number
  level: 'excellent' | 'good' | 'needs-work'
  completedFields: string[]
  missingFields: string[]
}
```

- [ ] **Step 2: Write failing answer quality tests**

Create `frontend/src/utils/answerQuality.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Question } from '../types'
import {
  calculateAnswerQuality,
  generateFollowUps,
  getMistakeHint,
  getQuickAnswer,
} from './answerQuality'

const question = (patch: Partial<Question>): Question => ({
  id: 1,
  title: 'HashMap 为什么线程不安全？',
  content: '第一段标准答案。\n\n第二段更多解释。',
  difficulty: 'MEDIUM',
  categoryName: 'Java 集合',
  categoryId: 1,
  tags: ['Java', '集合'],
  viewCount: 0,
  createTime: '2026-06-15T00:00:00',
  ...patch,
})

describe('answerQuality', () => {
  it('uses summary as the quick answer when present', () => {
    expect(getQuickAnswer(question({ summary: '30 秒回答' }))).toBe('30 秒回答')
  })

  it('falls back to the first content paragraph for quick answer', () => {
    expect(getQuickAnswer(question({ summary: undefined }))).toBe('第一段标准答案。')
  })

  it('scores complete answers higher than incomplete answers', () => {
    const complete = calculateAnswerQuality(question({
      summary: 'summary',
      principle: 'principle',
      comparison: 'comparison',
      scenario: 'scenario',
      risk: 'risk',
      projectExp: 'project',
      codeExamples: '[{"lang":"java","title":"demo","code":"class A {}","description":"demo"}]',
      diagrams: '[{"type":"mermaid","alt":"flow","content":"graph TD","caption":"flow"}]',
    }))
    const incomplete = calculateAnswerQuality(question({ content: 'short' }))

    expect(complete.score).toBeGreaterThan(incomplete.score)
    expect(complete.level).toBe('excellent')
    expect(incomplete.missingFields).toContain('项目落地')
  })

  it('generates category-aware follow-up questions', () => {
    const followUps = generateFollowUps(question({}))

    expect(followUps).toHaveLength(3)
    expect(followUps.join(' ')).toContain('HashMap')
  })

  it('uses risk as the mistake hint before generic fallback', () => {
    expect(getMistakeHint(question({ risk: '不要只背死循环。' }))).toBe('不要只背死循环。')
    expect(getMistakeHint(question({ risk: undefined }))).toContain('不要只背结论')
  })
})
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
cd frontend
npm run test -- answerQuality
```

Expected: FAIL because `answerQuality.ts` does not exist.

- [ ] **Step 4: Implement answer quality utility**

Create `frontend/src/utils/answerQuality.ts`:

```ts
import type { AnswerQualityResult, Question } from '../types'

const FIELD_WEIGHTS: Array<[keyof Question, string, number]> = [
  ['summary', '30 秒口径', 12],
  ['content', '标准回答', 20],
  ['principle', '原理深挖', 16],
  ['comparison', '对比分析', 10],
  ['scenario', '适用场景', 10],
  ['risk', '风险误区', 12],
  ['projectExp', '项目落地', 14],
  ['codeExamples', '代码示例', 3],
  ['diagrams', '图解', 3],
]

export function getQuickAnswer(question: Question): string {
  if (question.summary?.trim()) {
    return question.summary.trim()
  }
  const content = question.content || question.answer || ''
  return stripMarkdown(content).split(/\n\s*\n/)[0]?.trim() || '这道题还缺少快速回答，请先阅读标准答案。'
}

export function calculateAnswerQuality(question: Question): AnswerQualityResult {
  let score = 0
  const completedFields: string[] = []
  const missingFields: string[] = []

  for (const [field, label, weight] of FIELD_WEIGHTS) {
    const value = question[field]
    if (typeof value === 'string' && value.trim().length > 0) {
      score += weight
      completedFields.push(label)
    } else {
      missingFields.push(label)
    }
  }

  const clamped = Math.max(0, Math.min(100, score))
  return {
    score: clamped,
    level: clamped >= 85 ? 'excellent' : clamped >= 60 ? 'good' : 'needs-work',
    completedFields,
    missingFields,
  }
}

export function generateFollowUps(question: Question): string[] {
  const subject = extractSubject(question.title)
  const category = question.categoryName || '这个知识点'
  return [
    `${subject} 的底层机制是什么？`,
    `如果面试官结合项目追问 ${subject}，你会怎么落地回答？`,
    `${category} 中还有哪些容易和 ${subject} 混淆的点？`,
  ]
}

export function getMistakeHint(question: Question): string {
  if (question.risk?.trim()) {
    return stripMarkdown(question.risk).split(/\n\s*\n/)[0].trim()
  }
  return '不要只背结论，要补充原因、适用边界和项目中的取舍。'
}

function extractSubject(title: string): string {
  return title
    .replace(/[？?。！!]/g, '')
    .replace(/为什么|是什么|如何|怎么|请解释|说说/g, '')
    .trim() || title
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .trim()
}
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
cd frontend
npm run test -- answerQuality
```

Expected: PASS.

## Task 4: Study Hook and Shared UI Components

**Files:**
- Create: `frontend/src/hooks/useStudyProgress.ts`
- Create: `frontend/src/components/StudyStatusBadge.tsx`
- Create: `frontend/src/components/StudyActionButtons.tsx`
- Create: `frontend/src/components/AnswerQualityPanel.tsx`

- [ ] **Step 1: Create study hook**

Create `frontend/src/hooks/useStudyProgress.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { StudyProgress, StudyQuestionStatus } from '../types'
import {
  STUDY_PROGRESS_EVENT,
  getQuestionState,
  readStudyProgress,
  toggleQuestionInPlan,
  updateQuestionStatus,
  writeStudyProgress,
} from '../utils/studyProgress'

export function useStudyProgress() {
  const [progress, setProgress] = useState<StudyProgress>(() => readStudyProgress())

  useEffect(() => {
    const refresh = () => setProgress(readStudyProgress())
    window.addEventListener('storage', refresh)
    window.addEventListener(STUDY_PROGRESS_EVENT, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(STUDY_PROGRESS_EVENT, refresh)
    }
  }, [])

  const save = useCallback((next: StudyProgress) => {
    writeStudyProgress(next)
    setProgress(next)
  }, [])

  const setStatus = useCallback((questionId: number, status: StudyQuestionStatus) => {
    save(updateQuestionStatus(readStudyProgress(), questionId, status))
  }, [save])

  const setInPlan = useCallback((questionId: number, added: boolean) => {
    save(toggleQuestionInPlan(readStudyProgress(), questionId, added))
  }, [save])

  return useMemo(() => ({
    progress,
    getState: (questionId: number) => getQuestionState(progress, questionId),
    setStatus,
    setInPlan,
  }), [progress, setInPlan, setStatus])
}
```

- [ ] **Step 2: Create status badge**

Create `frontend/src/components/StudyStatusBadge.tsx`:

```tsx
import type { StudyQuestionStatus } from '../types'

const meta: Record<StudyQuestionStatus, { label: string; bg: string; color: string }> = {
  new: { label: '未学', bg: '#F4F4F5', color: '#71717A' },
  learning: { label: '学习中', bg: '#EFF6FF', color: '#2563EB' },
  weak: { label: '薄弱', bg: '#FEF2F2', color: '#DC2626' },
  mastered: { label: '已掌握', bg: '#ECFDF5', color: '#059669' },
}

interface Props {
  status: StudyQuestionStatus
  addedToPlan?: boolean
}

export default function StudyStatusBadge({ status, addedToPlan }: Props) {
  const item = meta[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 6,
      background: item.bg,
      color: item.color,
      fontSize: 12,
      fontWeight: 600,
      lineHeight: 1.5,
      whiteSpace: 'nowrap',
    }}>
      {item.label}{addedToPlan ? ' · 今日' : ''}
    </span>
  )
}
```

- [ ] **Step 3: Create action buttons**

Create `frontend/src/components/StudyActionButtons.tsx`:

```tsx
import { Button, Space } from 'antd'
import { CheckOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import type { QuestionStudyState } from '../types'

interface Props {
  questionId: number
  state: QuestionStudyState
  onPlanChange: (questionId: number, added: boolean) => void
  onMarkWeak: (questionId: number) => void
  onMarkMastered: (questionId: number) => void
  compact?: boolean
}

export default function StudyActionButtons({
  questionId,
  state,
  onPlanChange,
  onMarkWeak,
  onMarkMastered,
  compact = false,
}: Props) {
  return (
    <Space size={compact ? 4 : 8} wrap>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<PlusOutlined />}
        type={state.addedToPlan ? 'primary' : 'default'}
        onClick={(event) => {
          event.stopPropagation()
          onPlanChange(questionId, !state.addedToPlan)
        }}
      >
        {state.addedToPlan ? '已在今日计划' : '加入今日计划'}
      </Button>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<WarningOutlined />}
        danger={state.status === 'weak'}
        onClick={(event) => {
          event.stopPropagation()
          onMarkWeak(questionId)
        }}
      >
        标记薄弱
      </Button>
      <Button
        size={compact ? 'small' : 'middle'}
        icon={<CheckOutlined />}
        onClick={(event) => {
          event.stopPropagation()
          onMarkMastered(questionId)
        }}
      >
        已掌握
      </Button>
    </Space>
  )
}
```

- [ ] **Step 4: Create answer quality panel**

Create `frontend/src/components/AnswerQualityPanel.tsx`:

```tsx
import { Progress } from 'antd'
import type { Question } from '../types'
import { calculateAnswerQuality, generateFollowUps, getMistakeHint } from '../utils/answerQuality'

interface Props {
  question: Question
}

export default function AnswerQualityPanel({ question }: Props) {
  const quality = calculateAnswerQuality(question)
  const followUps = generateFollowUps(question)

  return (
    <aside className="answer-quality-panel">
      <section className="quality-score-card">
        <div className="panel-kicker">答案质量</div>
        <div className="quality-score">{quality.score}</div>
        <Progress percent={quality.score} showInfo={false} strokeColor={quality.score >= 85 ? '#059669' : '#2563EB'} />
        <div className="panel-muted">
          {quality.level === 'excellent' ? '结构完整，可直接复述' : quality.level === 'good' ? '可用，建议补齐弱项' : '缺少关键面试模块'}
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-title">面试官追问</div>
        <ol className="panel-list">
          {followUps.map(item => <li key={item}>{item}</li>)}
        </ol>
      </section>

      <section className="panel-card warning">
        <div className="panel-title">不要这么答</div>
        <p>{getMistakeHint(question)}</p>
      </section>

      {quality.missingFields.length > 0 && (
        <section className="panel-card">
          <div className="panel-title">可补强模块</div>
          <div className="missing-field-list">
            {quality.missingFields.slice(0, 4).map(field => <span key={field}>{field}</span>)}
          </div>
        </section>
      )}
    </aside>
  )
}
```

- [ ] **Step 5: Run TypeScript check**

Run:

```bash
cd frontend
npm run build
```

Expected: build may fail because CSS classes and page integrations are not present yet, but TypeScript should identify only references that Task 5 and Task 6 will wire.

## Task 5: Question Detail 2.0

**Files:**
- Modify: `frontend/src/pages/QuestionDetail/index.tsx`
- Modify: `frontend/src/pages/QuestionDetail/ContentView.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update ContentView labels and quick answer module**

Modify `ContentView` to:
- Rename summary label to `30 秒口径`.
- Rename content label to `标准回答`.
- Rename principle label to `原理深挖`.
- Rename projectExp label to `项目落地`.
- Use `getQuickAnswer(question)` when `summary` is missing.
- Keep `parseJson` fallback behavior.

The first two sections should be opened by default. Use this section array shape:

```tsx
const sections: { key: string; label: string; content: React.ReactNode; defaultOpen?: boolean }[] = []

sections.push({
  key: 'quick-answer',
  label: '30 秒口径',
  defaultOpen: true,
  content: <div className="quick-answer-box">{getQuickAnswer(question)}</div>,
})
```

- [ ] **Step 2: Update QuestionDetail layout**

Modify `QuestionDetail` to import:

```tsx
import AnswerQualityPanel from '../../components/AnswerQualityPanel'
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
```

Inside the component after `q` is loaded:

```tsx
const { getState, setInPlan, setStatus } = useStudyProgress()
const studyState = q ? getState(q.id) : undefined
```

Render:

```tsx
<div className="question-detail-shell">
  <main className="question-detail-main">
    <header className="question-detail-header">
      <h1>{q.title}</h1>
      <div className="question-meta-row">
        <span>{q.categoryName}</span>
        <span className={`difficulty-tag ${q.difficulty.toLowerCase()}`}>{difficultyLabels[q.difficulty] || q.difficulty}</span>
        {studyState && <StudyStatusBadge status={studyState.status} addedToPlan={studyState.addedToPlan} />}
      </div>
      {studyState && (
        <StudyActionButtons
          questionId={q.id}
          state={studyState}
          onPlanChange={setInPlan}
          onMarkWeak={(id) => setStatus(id, 'weak')}
          onMarkMastered={(id) => setStatus(id, 'mastered')}
        />
      )}
    </header>
    <div className="magazine-card content-card">
      <ContentView question={q} />
    </div>
  </main>
  <AnswerQualityPanel question={q} />
</div>
```

- [ ] **Step 3: Add responsive detail CSS**

Append to `frontend/src/styles/global.css`:

```css
.question-detail-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px;
  align-items: start;
}

.question-detail-main {
  min-width: 0;
}

.question-detail-header {
  margin-bottom: 18px;
}

.question-detail-header h1 {
  font-size: 24px;
  margin: 0 0 12px 0;
}

.question-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
}

.content-card {
  padding: 0;
  overflow: hidden;
}

.quick-answer-box {
  background: #EFF6FF;
  color: #1E3A8A;
  border-left: 3px solid #2563EB;
  border-radius: 8px;
  padding: 14px 18px;
  line-height: 1.8;
}

.answer-quality-panel {
  position: sticky;
  top: 76px;
  display: grid;
  gap: 12px;
}

.quality-score-card,
.panel-card {
  background: #FFFFFF;
  border: 1px solid #E4E4E7;
  border-radius: 8px;
  padding: 14px;
}

.quality-score-card {
  background: #0F172A;
  color: #FFFFFF;
}

.panel-kicker,
.panel-muted {
  font-size: 12px;
  color: #94A3B8;
}

.quality-score {
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
  margin: 8px 0;
}

.panel-title {
  font-weight: 700;
  color: #18181B;
  margin-bottom: 8px;
}

.quality-score-card .panel-title {
  color: #FFFFFF;
}

.panel-list {
  margin: 0;
  padding-left: 18px;
  color: #52525B;
  font-size: 13px;
}

.panel-card.warning {
  background: #FFF7ED;
  border-color: #FED7AA;
}

.panel-card.warning p {
  color: #7C2D12;
  font-size: 13px;
  margin: 0;
}

.missing-field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.missing-field-list span {
  background: #F4F4F5;
  color: #52525B;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
}

@media (max-width: 900px) {
  .question-detail-shell {
    grid-template-columns: 1fr;
  }

  .answer-quality-panel {
    position: static;
    order: -1;
  }
}
```

- [ ] **Step 4: Verify detail page build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes.

## Task 6: Homepage Study Dashboard

**Files:**
- Create: `frontend/src/components/StudyDashboard.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create StudyDashboard**

Create `frontend/src/components/StudyDashboard.tsx`:

```tsx
import { Button, Progress } from 'antd'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildDailyPlan, summarizeProgress, weakAreasFromQuestions } from '../utils/studyProgress'

interface Props {
  hotQuestions: Question[]
}

export default function StudyDashboard({ hotQuestions }: Props) {
  const navigate = useNavigate()
  const { progress, setInPlan } = useStudyProgress()
  const summary = summarizeProgress(progress)
  const recommendedPlan = useMemo(() => buildDailyPlan(progress, hotQuestions, 5), [hotQuestions, progress])
  const weakAreas = useMemo(() => weakAreasFromQuestions(progress, hotQuestions), [hotQuestions, progress])

  const planQuestions = recommendedPlan
    .map(id => hotQuestions.find(q => q.id === id))
    .filter((q): q is Question => Boolean(q))

  return (
    <section className="study-dashboard">
      <div className="study-hero">
        <div>
          <div className="dashboard-kicker">备考工作台</div>
          <h1>{progress.targetRole} · {progress.sprintDays} 天冲刺</h1>
          <p>今天只做最值得做的题：先补薄弱点，再巩固高频题。</p>
        </div>
        <div className="mastery-card">
          <span>掌握度</span>
          <strong>{summary.masteryRate}%</strong>
          <Progress percent={summary.masteryRate} showInfo={false} strokeColor="#059669" />
        </div>
      </div>

      <div className="study-dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-title">今日计划</div>
          {planQuestions.length === 0 ? (
            <p className="dashboard-empty">先浏览题目并标记薄弱或加入计划，系统会开始推荐。</p>
          ) : (
            <div className="daily-plan-list">
              {planQuestions.map((q, index) => (
                <button key={q.id} onClick={() => navigate(`/question/${q.id}`)}>
                  <span>{index + 1}</span>
                  <b>{q.title}</b>
                </button>
              ))}
            </div>
          )}
          {hotQuestions[0] && (
            <Button onClick={() => setInPlan(hotQuestions[0].id, true)} size="small">
              把热门第一题加入计划
            </Button>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-title">弱点雷达</div>
          {weakAreas.length === 0 ? (
            <p className="dashboard-empty">标记薄弱题后，这里会按分类显示短板。</p>
          ) : (
            <div className="weak-area-list">
              {weakAreas.map(area => (
                <div key={area.categoryName}>
                  <div>
                    <span>{area.categoryName}</span>
                    <strong>{area.score}</strong>
                  </div>
                  <Progress percent={Math.min(100, area.score * 20)} showInfo={false} strokeColor="#DC2626" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Update Home to pass hot questions into dashboard**

Modify `frontend/src/pages/Home/index.tsx` to load hot questions once and pass them into both `StudyDashboard` and `HotQuestions`:

```tsx
import { useEffect, useState } from 'react'
import Alert from 'antd/es/alert'
import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'
import StudyDashboard from '../../components/StudyDashboard'
import { getHotQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function Home() {
  const [hotQuestions, setHotQuestions] = useState<Question[]>([])
  const [hotError, setHotError] = useState(false)

  useEffect(() => {
    getHotQuestions(10)
      .then(setHotQuestions)
      .catch(() => setHotError(true))
  }, [])

  return (
    <div>
      <StudyDashboard hotQuestions={hotQuestions} />

      <div style={{ marginTop: 32, marginBottom: 40 }}>
        <h2 className="section-title" style={{ fontSize: 24 }}>题库入口</h2>
        <p className="section-subtitle">按技术方向进入系统刷题。</p>
        <CategoryGrid />
      </div>

      <hr className="magazine-divider" />

      <div>
        <h2 className="section-title" style={{ fontSize: 24 }}>热门题目排行</h2>
        <p className="section-subtitle">优先挑高频题加入今日计划。</p>
        {hotError && <Alert type="warning" showIcon message="热门题目加载失败，题库入口仍可使用。" />}
        <HotQuestions questions={hotQuestions} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Modify HotQuestions props**

Change `frontend/src/pages/Home/HotQuestions.tsx` to accept `questions` from Home instead of fetching internally:

```tsx
interface Props {
  questions: Question[]
}

export default function HotQuestions({ questions }: Props) {
  const navigate = useNavigate()
  const { getState } = useStudyProgress()
  if (questions.length === 0) {
    return <Empty description="暂无热门题目" />
  }
  ...
}
```

Each row should render:

```tsx
const state = getState(q.id)
<StudyStatusBadge status={state.status} addedToPlan={state.addedToPlan} />
```

- [ ] **Step 4: Add dashboard CSS**

Append:

```css
.study-dashboard {
  display: grid;
  gap: 16px;
}

.study-hero,
.dashboard-card {
  background: #FFFFFF;
  border: 1px solid #E4E4E7;
  border-radius: 8px;
}

.study-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 20px;
  padding: 22px;
  align-items: center;
}

.dashboard-kicker {
  font-size: 12px;
  font-weight: 700;
  color: #2563EB;
  margin-bottom: 6px;
}

.study-hero h1 {
  margin: 0;
  font-size: 28px;
}

.study-hero p {
  margin: 8px 0 0 0;
}

.mastery-card {
  background: #F8FAFC;
  border-radius: 8px;
  padding: 14px;
}

.mastery-card span {
  color: #64748B;
  font-size: 12px;
}

.mastery-card strong {
  display: block;
  font-size: 32px;
  color: #0F172A;
}

.study-dashboard-grid {
  display: grid;
  grid-template-columns: 1.1fr .9fr;
  gap: 16px;
}

.dashboard-card {
  padding: 16px;
}

.dashboard-card-title {
  font-weight: 800;
  margin-bottom: 12px;
}

.dashboard-empty {
  font-size: 13px;
  color: #71717A;
  margin: 0 0 12px 0;
}

.daily-plan-list {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.daily-plan-list button {
  border: 1px solid #E4E4E7;
  background: #FAFAF9;
  border-radius: 8px;
  padding: 10px;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  text-align: left;
  cursor: pointer;
}

.daily-plan-list span {
  color: #2563EB;
  font-weight: 800;
}

.daily-plan-list b {
  color: #18181B;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weak-area-list {
  display: grid;
  gap: 10px;
}

.weak-area-list > div > div {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

@media (max-width: 760px) {
  .study-hero,
  .study-dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 5: Verify homepage build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes.

## Task 7: List and Search Study State Integration

**Files:**
- Modify: `frontend/src/pages/QuestionList/index.tsx`
- Modify: `frontend/src/pages/SearchResult/index.tsx`
- Modify: `frontend/src/pages/Home/CategoryGrid.tsx`

- [ ] **Step 1: Update QuestionList cards**

Import:

```tsx
import StudyActionButtons from '../../components/StudyActionButtons'
import StudyStatusBadge from '../../components/StudyStatusBadge'
import { useStudyProgress } from '../../hooks/useStudyProgress'
```

Inside the component:

```tsx
const { getState, setInPlan, setStatus } = useStudyProgress()
```

For each question:

```tsx
const studyState = getState(q.id)
```

Render `StudyStatusBadge` next to difficulty and `StudyActionButtons` below tags with `compact`.

- [ ] **Step 2: Update SearchResult cards**

Use the same imports and state handling as QuestionList. Each search card should show category, status, and compact actions:

```tsx
<div className="search-card-meta">
  <span>{q.categoryName}</span>
  <StudyStatusBadge status={studyState.status} addedToPlan={studyState.addedToPlan} />
</div>
<StudyActionButtons
  compact
  questionId={q.id}
  state={studyState}
  onPlanChange={setInPlan}
  onMarkWeak={(id) => setStatus(id, 'weak')}
  onMarkMastered={(id) => setStatus(id, 'mastered')}
/>
```

- [ ] **Step 3: Fix visible Chinese copy in touched files**

Replace mojibake visible strings in touched files:

```ts
const difficultyLabels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' }
```

Use:
- `加载失败`
- `重试`
- `暂无题目`
- `全部题库`
- `题目列表`
- `共 ${total} 道题目`
- `搜索结果`
- `浏览全部题目`

- [ ] **Step 4: Verify list/search build**

Run:

```bash
cd frontend
npm run build
```

Expected: build passes and visible copy in modified files is readable Chinese.

## Task 8: Verification and Browser QA

**Files:**
- No source changes unless verification finds a focused defect.

- [ ] **Step 1: Run frontend unit tests**

```bash
cd frontend
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run frontend production build**

```bash
cd frontend
npm run build
```

Expected: build passes. Existing Vite chunk warning is acceptable unless new dependencies make it materially worse.

- [ ] **Step 3: Run backend tests**

```bash
cd backend
mvn test
```

Expected: existing backend tests pass.

- [ ] **Step 4: Start app locally**

Start backend if database is available:

```bash
cd backend
mvn spring-boot:run
```

Start frontend:

```bash
cd frontend
npm run dev
```

Expected: frontend runs at `http://localhost:3000`.

- [ ] **Step 5: Browser QA**

Open `http://localhost:3000` and verify:

- 首页 shows `备考工作台`, target role, mastery card, daily plan, weak radar, category grid, hot questions.
- Open a question detail page.
- Click `加入今日计划`; refresh; status remains.
- Click `标记薄弱`; return home; weak radar updates.
- Click `已掌握`; mastery percentage updates.
- Open category list and search result; study status is visible.
- At mobile width around 390px, detail page stacks without text overlap.

- [ ] **Step 6: Inspect diff**

```bash
git status --short
git diff --stat
```

Expected: only planned frontend files, test config, package files, and already-approved spec/plan docs changed.

## Self-Review

- Spec coverage: homepage dashboard, question detail quality modules, list/search status, localStorage persistence, broken localStorage fallback, no backend table changes, and build/test verification are all represented.
- Placeholder scan: plan contains no `TBD`, no `TODO`, and no unbounded "add appropriate" steps.
- Type consistency: `StudyProgress`, `QuestionStudyState`, `StudyQuestionStatus`, `AnswerQualityResult`, and helper function names are defined before use and reused consistently.
- Scope control: account system, backend progress persistence, community, membership, payment, and AI mock interviews remain outside this phase.
