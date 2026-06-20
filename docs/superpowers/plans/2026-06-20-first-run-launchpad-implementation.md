# 3 分钟首练启动台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页首屏提供“3 分钟开始有效训练”的启动台，让新用户和已有进度用户都能直接进入下一步。

**Architecture:** 新增纯函数 `buildFirstRunLaunchpad` 负责根据本地学习进度和热门题生成启动台模型；新增 `FirstRunLaunchpad` 组件负责展示、生成计划、更新目标和导航。首页只负责把热门题传入组件，不改变后端接口。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5、本地学习进度工具函数。

---

## File Structure

- Create `frontend/src/utils/firstRunLaunchpad.ts`: 首练启动台模型构建函数和类型。
- Create `frontend/src/utils/firstRunLaunchpad.test.ts`: 覆盖空状态、今日计划、薄弱修复三类决策。
- Create `frontend/src/components/FirstRunLaunchpad.tsx`: 首页启动台组件。
- Create `frontend/src/components/FirstRunLaunchpad.test.tsx`: 覆盖空状态渲染、生成计划、目标切换和导航入口。
- Modify `frontend/src/pages/Home/index.tsx`: 在 `StudyDashboard` 前接入启动台。
- Modify `frontend/src/styles/global.css`: 增加启动台响应式样式。

## Task 1: Launchpad Model

**Files:**

- Create: `frontend/src/utils/firstRunLaunchpad.ts`
- Create: `frontend/src/utils/firstRunLaunchpad.test.ts`

- [ ] **Step 1: Write the failing utility tests**

Create `frontend/src/utils/firstRunLaunchpad.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Question, StudyProgress } from '../types'
import { createDefaultProgress, rememberQuestions, toggleQuestionInPlan, updateQuestionStatus } from './studyProgress'
import { buildFirstRunLaunchpad } from './firstRunLaunchpad'

const question = (id: number, categoryName: string): Question => ({
  id,
  title: `Question ${id}`,
  content: 'answer',
  difficulty: id % 2 === 0 ? 'MEDIUM' : 'HARD',
  categoryName,
  categoryId: id,
  tags: [categoryName],
  viewCount: 100 + id,
  createTime: '2026-06-20T00:00:00.000Z',
})

const questions = [
  question(1, 'Java 并发'),
  question(2, 'Redis'),
  question(3, 'MySQL'),
  question(4, 'JVM'),
  question(5, 'Spring'),
  question(6, '系统设计'),
]

describe('buildFirstRunLaunchpad', () => {
  it('builds a first-practice queue for empty progress', () => {
    const model = buildFirstRunLaunchpad(createDefaultProgress('2026-06-20T00:00:00.000Z'), questions)

    expect(model.mode).toBe('first-run')
    expect(model.title).toBe('3 分钟开始首轮训练')
    expect(model.primaryAction.label).toBe('生成 5 题首练队列')
    expect(model.primaryAction.to).toBe('/practice?queue=1,2,3,4,5')
    expect(model.recommendedQuestionIds).toEqual([1, 2, 3, 4, 5])
    expect(model.metrics).toContainEqual({ label: '首练题', value: '5' })
  })

  it('continues an existing daily plan before suggesting new questions', () => {
    let progress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = toggleQuestionInPlan(progress, 3, true, '2026-06-20T00:02:00.000Z')
    progress = toggleQuestionInPlan(progress, 4, true, '2026-06-20T00:03:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('continue-plan')
    expect(model.title).toBe('继续今日训练')
    expect(model.primaryAction.label).toBe('继续 2 题队列')
    expect(model.primaryAction.to).toBe('/practice?queue=3,4')
    expect(model.recommendedQuestionIds).toEqual([3, 4])
  })

  it('prioritizes weak questions as a repair queue', () => {
    let progress: StudyProgress = createDefaultProgress('2026-06-20T00:00:00.000Z')
    progress = rememberQuestions(progress, questions, '2026-06-20T00:01:00.000Z')
    progress = updateQuestionStatus(progress, 2, 'weak', '2026-06-20T00:02:00.000Z')
    progress = updateQuestionStatus(progress, 5, 'learning', '2026-06-20T00:03:00.000Z')

    const model = buildFirstRunLaunchpad(progress, questions)

    expect(model.mode).toBe('repair')
    expect(model.title).toBe('先修复最影响面试的薄弱题')
    expect(model.primaryAction.label).toBe('修复 2 道风险题')
    expect(model.primaryAction.to).toBe('/practice?queue=2,5')
    expect(model.recommendedQuestionIds).toEqual([2, 5])
  })
})
```

- [ ] **Step 2: Run the failing utility test**

Run:

```bash
cd frontend
npm run test -- firstRunLaunchpad
```

Expected: FAIL because `frontend/src/utils/firstRunLaunchpad.ts` does not exist.

- [ ] **Step 3: Implement the utility**

Create `frontend/src/utils/firstRunLaunchpad.ts`:

```ts
import type { Question, StudyProgress } from '../types'
import { buildDailyPlan, buildReviewQueue } from './studyProgress'

export type FirstRunLaunchpadMode = 'first-run' | 'continue-plan' | 'repair'

export interface LaunchpadAction {
  label: string
  description: string
  to: string
  kind: 'plan' | 'practice' | 'route' | 'study'
}

export interface LaunchpadMetric {
  label: string
  value: string
}

export interface FirstRunLaunchpadModel {
  mode: FirstRunLaunchpadMode
  title: string
  summary: string
  primaryAction: LaunchpadAction
  secondaryActions: LaunchpadAction[]
  metrics: LaunchpadMetric[]
  recommendedQuestionIds: number[]
}

const FIRST_RUN_LIMIT = 5
const CONTINUE_LIMIT = 12

export function buildFirstRunLaunchpad(
  progress: StudyProgress,
  hotQuestions: Question[],
): FirstRunLaunchpadModel {
  const reviewQueue = buildReviewQueue(progress, CONTINUE_LIMIT)
  const repairIds = reviewQueue
    .filter(item => item.status === 'weak' || item.status === 'learning')
    .map(item => item.id)
    .slice(0, FIRST_RUN_LIMIT)

  if (repairIds.length > 0) {
    return {
      mode: 'repair',
      title: '先修复最影响面试的薄弱题',
      summary: '系统已经发现薄弱或学习中的题，先把这些题拉回可复述状态，比继续乱刷更有效。',
      primaryAction: {
        label: `修复 ${repairIds.length} 道风险题`,
        description: '直接进入薄弱题训练队列',
        to: buildPracticeQueuePath(repairIds),
        kind: 'practice',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '风险题', value: String(repairIds.length) },
        { label: '今日计划', value: String(progress.dailyPlan.length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      recommendedQuestionIds: repairIds,
    }
  }

  const dailyPlanIds = progress.dailyPlan.slice(0, CONTINUE_LIMIT)
  if (dailyPlanIds.length > 0) {
    return {
      mode: 'continue-plan',
      title: '继续今日训练',
      summary: '今日计划已经就绪，继续完成队列，比重新选题更容易形成闭环。',
      primaryAction: {
        label: `继续 ${dailyPlanIds.length} 题队列`,
        description: '从今日计划进入训练',
        to: buildPracticeQueuePath(dailyPlanIds),
        kind: 'practice',
      },
      secondaryActions: baseSecondaryActions(),
      metrics: [
        { label: '今日计划', value: String(dailyPlanIds.length) },
        { label: '已跟踪', value: String(Object.keys(progress.questionStates).length) },
        { label: '冲刺天数', value: String(progress.sprintDays) },
      ],
      recommendedQuestionIds: dailyPlanIds,
    }
  }

  const firstRunIds = buildDailyPlan(progress, hotQuestions, FIRST_RUN_LIMIT)
  return {
    mode: 'first-run',
    title: '3 分钟开始首轮训练',
    summary: '不用先研究题库结构，先拿 5 道高频题开口训练，系统会根据结果生成复习和补弱队列。',
    primaryAction: {
      label: '生成 5 题首练队列',
      description: '把高频题加入今日训练并开始模拟',
      to: buildPracticeQueuePath(firstRunIds),
      kind: 'plan',
    },
    secondaryActions: baseSecondaryActions(),
    metrics: [
      { label: '首练题', value: String(firstRunIds.length) },
      { label: '目标', value: progress.targetRole },
      { label: '冲刺天数', value: String(progress.sprintDays) },
    ],
    recommendedQuestionIds: firstRunIds,
  }
}

export function buildPracticeQueuePath(questionIds: number[]): string {
  const ids = [...new Set(questionIds.filter(id => Number.isFinite(id) && id > 0))]
  return ids.length > 0 ? `/practice?queue=${ids.join(',')}` : '/practice'
}

function baseSecondaryActions(): LaunchpadAction[] {
  return [
    {
      label: '按岗位选路线',
      description: '查看 Java、前端、AI、架构路线',
      to: '/routes',
      kind: 'route',
    },
    {
      label: '打开学习计划',
      description: '查看复习债和今日闭环',
      to: '/study',
      kind: 'study',
    },
  ]
}
```

- [ ] **Step 4: Verify utility test passes**

Run:

```bash
cd frontend
npm run test -- firstRunLaunchpad
```

Expected: PASS.

## Task 2: Launchpad Component

**Files:**

- Create: `frontend/src/components/FirstRunLaunchpad.tsx`
- Create: `frontend/src/components/FirstRunLaunchpad.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/FirstRunLaunchpad.test.tsx`:

```tsx
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Question, StudyProgress } from '../types'
import { createDefaultProgress, STUDY_PROGRESS_STORAGE_KEY } from '../utils/studyProgress'
import FirstRunLaunchpad from './FirstRunLaunchpad'

const navigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

const hotQuestions: Question[] = [
  { id: 1, title: 'HashMap 并发问题', content: 'answer', difficulty: 'HARD', categoryName: 'Java 集合', tags: ['Java'], viewCount: 300, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 2, title: 'Redis 缓存雪崩', content: 'answer', difficulty: 'MEDIUM', categoryName: 'Redis', tags: ['Redis'], viewCount: 240, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 3, title: 'MySQL 索引优化', content: 'answer', difficulty: 'MEDIUM', categoryName: 'MySQL', tags: ['MySQL'], viewCount: 220, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 4, title: 'JVM GC 调优', content: 'answer', difficulty: 'HARD', categoryName: 'JVM', tags: ['JVM'], viewCount: 210, createTime: '2026-06-20T00:00:00.000Z' },
  { id: 5, title: 'Spring 事务传播', content: 'answer', difficulty: 'MEDIUM', categoryName: 'Spring', tags: ['Spring'], viewCount: 200, createTime: '2026-06-20T00:00:00.000Z' },
]

function setProgress(progress: StudyProgress) {
  window.localStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(progress))
}

describe('FirstRunLaunchpad', () => {
  beforeEach(() => {
    navigate.mockReset()
    window.localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('shows the first-run action and creates a local practice queue', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '3 分钟开始首轮训练' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /生成 5 题首练队列/ }))

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/practice?queue=1,2,3,4,5'))
    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.dailyPlan).toEqual([1, 2, 3, 4, 5])
  })

  it('continues an existing plan without replacing it', async () => {
    setProgress({
      ...createDefaultProgress('2026-06-20T00:00:00.000Z'),
      dailyPlan: [2, 4],
      questionStates: {
        2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
        4: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      },
    })

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /继续 2 题队列/ }))

    expect(navigate).toHaveBeenCalledWith('/practice?queue=2,4')
  })

  it('updates the target role from the launchpad', async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <FirstRunLaunchpad hotQuestions={hotQuestions} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByText('AI 大模型'))

    const stored = JSON.parse(window.localStorage.getItem(STUDY_PROGRESS_STORAGE_KEY) ?? '{}') as StudyProgress
    expect(stored.targetRole).toBe('AI 大模型')
  })
})
```

- [ ] **Step 2: Run the failing component test**

Run:

```bash
cd frontend
npm run test -- FirstRunLaunchpad
```

Expected: FAIL because `FirstRunLaunchpad.tsx` does not exist.

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/FirstRunLaunchpad.tsx`:

```tsx
import { Button } from 'antd'
import { CalendarOutlined, PlayCircleOutlined, ReadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Question } from '../types'
import { useStudyProgress } from '../hooks/useStudyProgress'
import { buildFirstRunLaunchpad } from '../utils/firstRunLaunchpad'

interface Props {
  hotQuestions: Question[]
}

const roleOptions = ['Java 后端', '前端工程师', 'AI 大模型', '系统架构师']

export default function FirstRunLaunchpad({ hotQuestions }: Props) {
  const navigate = useNavigate()
  const { progress, setDailyPlan, updateSettings } = useStudyProgress()
  const model = useMemo(
    () => buildFirstRunLaunchpad(progress, hotQuestions),
    [hotQuestions, progress],
  )

  const runPrimaryAction = () => {
    if (model.primaryAction.kind === 'plan' && model.recommendedQuestionIds.length > 0) {
      setDailyPlan(model.recommendedQuestionIds)
    }
    navigate(model.primaryAction.to)
  }

  return (
    <section className={`first-run-launchpad mode-${model.mode}`} aria-label="3 分钟首练启动台">
      <div className="first-run-copy">
        <div className="dashboard-kicker">3 分钟首练</div>
        <h1>{model.title}</h1>
        <p>{model.summary}</p>
        <div className="first-run-role-row" aria-label="目标岗位">
          {roleOptions.map(role => (
            <button
              key={role}
              type="button"
              className={progress.targetRole === role ? 'active' : ''}
              onClick={() => updateSettings({ targetRole: role })}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="first-run-action-panel">
        <div className="first-run-metrics">
          {model.metrics.map(metric => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <Button type="primary" icon={<ThunderboltOutlined />} disabled={model.recommendedQuestionIds.length === 0} onClick={runPrimaryAction}>
          {model.primaryAction.label}
        </Button>
        <div className="first-run-secondary-actions">
          {model.secondaryActions.map(action => (
            <Button
              key={action.to}
              icon={action.kind === 'route' ? <ReadOutlined /> : <CalendarOutlined />}
              onClick={() => navigate(action.to)}
            >
              {action.label}
            </Button>
          ))}
          <Button icon={<PlayCircleOutlined />} onClick={() => navigate('/practice')}>
            直接模拟
          </Button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Verify component test passes**

Run:

```bash
cd frontend
npm run test -- FirstRunLaunchpad
```

Expected: PASS.

## Task 3: Home Integration And Styling

**Files:**

- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Integrate the launchpad**

Modify `frontend/src/pages/Home/index.tsx`:

```tsx
import FirstRunLaunchpad from '../../components/FirstRunLaunchpad'
```

Render it before `StudyDashboard`:

```tsx
<FirstRunLaunchpad hotQuestions={hotQuestions} />
<StudyDashboard hotQuestions={hotQuestions} />
```

- [ ] **Step 2: Add responsive styles**

Add to `frontend/src/styles/global.css` near the home styles:

```css
.first-run-launchpad {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: stretch;
  padding: 18px;
  background:
    linear-gradient(90deg, rgba(5, 150, 105, 0.09), transparent 52%),
    #FFFFFF;
  border: 1px solid #D1FAE5;
  border-radius: 8px;
  box-shadow: inset 4px 0 0 #059669;
}

.first-run-launchpad.mode-repair {
  border-color: #FED7AA;
  box-shadow: inset 4px 0 0 #D97706;
}

.first-run-copy {
  min-width: 0;
}

.first-run-copy h1 {
  margin: 4px 0 8px 0;
  color: #18181B;
  font-size: 28px;
}

.first-run-copy p {
  max-width: 760px;
  margin: 0;
  color: #52525B;
}

.first-run-role-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.first-run-role-row button {
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid #D4D4D8;
  border-radius: 8px;
  background: #FFFFFF;
  color: #52525B;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}

.first-run-role-row button.active,
.first-run-role-row button:hover {
  border-color: #2563EB;
  background: #EFF6FF;
  color: #1D4ED8;
}

.first-run-action-panel {
  display: grid;
  gap: 10px;
  align-content: center;
  min-width: 0;
  padding-left: 14px;
  border-left: 1px solid #E4E4E7;
}

.first-run-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.first-run-metrics div {
  min-width: 0;
  padding: 9px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}

.first-run-metrics span,
.first-run-metrics strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.first-run-metrics span {
  color: #64748B;
  font-size: 12px;
  font-weight: 800;
}

.first-run-metrics strong {
  margin-top: 3px;
  color: #0F172A;
  font-size: 18px;
}

.first-run-secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.first-run-secondary-actions .ant-btn {
  flex: 1 1 120px;
}
```

Extend the existing `@media (max-width: 760px)` grouped selector:

```css
.first-run-launchpad {
  grid-template-columns: 1fr;
}
```

Add inside the same media block:

```css
.first-run-action-panel {
  padding-top: 14px;
  padding-left: 0;
  border-top: 1px solid #E4E4E7;
  border-left: none;
}
```

Add inside `@media (max-width: 640px)`:

```css
.first-run-metrics {
  grid-template-columns: 1fr;
}

.first-run-action-panel > .ant-btn {
  width: 100%;
}
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
cd frontend
npm run test -- firstRunLaunchpad FirstRunLaunchpad
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

## Task 4: Final Checks

**Files:**

- All files above.

- [ ] **Step 1: Check diff**

Run:

```bash
git diff -- frontend/src/utils/firstRunLaunchpad.ts frontend/src/utils/firstRunLaunchpad.test.ts frontend/src/components/FirstRunLaunchpad.tsx frontend/src/components/FirstRunLaunchpad.test.tsx frontend/src/pages/Home/index.tsx frontend/src/styles/global.css
```

Expected: diff only contains the launchpad feature.

- [ ] **Step 2: Check whitespace**

Run:

```bash
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 3: Report verification**

Report:

- Utility test result.
- Component test result.
- Frontend build result.
- Any skipped visual QA reason.

## Self-Review

- Spec coverage: P1 first-run path, existing-plan continuation, repair priority, home integration, mobile constraints, and no backend dependency are covered.
- Placeholder scan: no TBD/TODO/later placeholders.
- Type consistency: `FirstRunLaunchpadModel`, `LaunchpadAction`, and route paths are defined before component use.

