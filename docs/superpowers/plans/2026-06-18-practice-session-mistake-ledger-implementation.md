# Practice Session Mistake Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报中展示并导出当前队列限定的错因账本与三步修复计划。

**Architecture:** `practiceSessionReport.ts` 新增 `buildPracticeSessionMistakeLedger(queue, progress)`，先用现有上下文补齐队列题目信息，再过滤成只包含当前队列的 `StudyProgress`，最后复用 `buildInterviewMistakeLedger` 和 `buildInterviewRecoveryPlan`。Markdown 和面板共用同一账本与计划，避免导出与页面排序不一致。

**Tech Stack:** React 18, TypeScript, Vitest, Ant Design 5, CSS。

---

## File Map

- Modify: `frontend/src/utils/practiceSessionReport.ts`
  - 新增本轮错因账本构建函数。
  - 新增 Markdown“本轮错因账本”章节。
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
  - 增加错因账本 Markdown、空态和队列过滤断言。
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
  - 渲染本轮错因账本模块。
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
  - 覆盖错因账本模块和错因项跳转。
- Modify: `frontend/src/styles/global.css`
  - 增加 `.practice-session-report-mistake-ledger*` 样式。

## Task 1: Markdown Mistake Ledger

- [ ] **Step 1: Write the failing Markdown test**

Add a behavior test in `frontend/src/utils/practiceSessionReport.test.ts`:

```ts
it('exports mistake ledger from the current session queue', () => {
  const markdown = buildPracticeSessionReportMarkdown(
    [question(1), question(2)],
    progress({
      interviewAttempts: {
        1: [attempt(1, 58, { specificity: 35 })],
        3: [attempt(3, 40, { risk: 20 })],
      },
    }),
    NOW,
  )

  expect(markdown).toContain('## 本轮错因账本')
  expect(markdown).toContain('场景细节反复失分')
  expect(markdown).toContain('影响题目：1')
  expect(markdown).toContain('修复计划：三步修复首要错因')
  expect(markdown).toContain('入口：/practice?queue=1')
  expect(markdown).not.toContain('边界风险反复失分')
})
```

Update empty markdown assertions:

```ts
expect(markdown).toContain('## 本轮错因账本')
expect(markdown).toContain('暂无本轮错因账本')
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because `## 本轮错因账本` is missing.

- [ ] **Step 3: Implement queue-filtered ledger builder**

In `frontend/src/utils/practiceSessionReport.ts`, import:

```ts
import type { InterviewMistakeLedger } from '../types'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
```

Add:

```ts
export function buildPracticeSessionMistakeLedger(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewMistakeLedger {
  const queueIdSet = new Set(queue.map(item => item.id).filter(questionId => Number.isFinite(questionId) && questionId > 0))
  const context = buildPracticeSessionProgressContext(queue, progress)

  return buildInterviewMistakeLedger({
    ...context,
    dailyPlan: context.dailyPlan.filter(questionId => queueIdSet.has(questionId)),
    questionStates: filterRecordByQuestionIds(context.questionStates, queueIdSet),
    questionSnapshots: filterRecordByQuestionIds(context.questionSnapshots, queueIdSet),
    interviewAttempts: filterRecordByQuestionIds(context.interviewAttempts, queueIdSet),
  })
}
```

Add a generic private helper:

```ts
function filterRecordByQuestionIds<T>(record: Record<number, T>, questionIds: Set<number>): Record<number, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([questionId]) => questionIds.has(Number(questionId))),
  ) as Record<number, T>
}
```

- [ ] **Step 4: Render Markdown**

Add `renderSessionMistakeLedger(queue, progress)` after `renderSessionScriptCommand(queue, progress)`:

```ts
function renderSessionMistakeLedger(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const ledger = buildPracticeSessionMistakeLedger(queue, progress)
  const recoveryPlan = buildInterviewRecoveryPlan(ledger)
  const lines = [
    '## 本轮错因账本',
    `- 状态：${ledger.title}`,
    `- 摘要：${ledger.summary}`,
    `- 问题数：${ledger.totalProblems}`,
    `- 修复计划：${recoveryPlan.title}，${recoveryPlan.totalMinutes} 分钟`,
    `- 主行动：${ledger.primaryAction.label}，${ledger.primaryAction.description}（${ledger.primaryAction.to}）`,
    '',
  ]

  if (ledger.items.length === 0) {
    return [...lines, '- 暂无本轮错因账本。完成一次模拟面试后，战报会自动定位错因。', ''].join('\n')
  }

  ledger.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.label}`,
      `   - 类型：${item.type}`,
      `   - 平均分：${item.averageScore}`,
      `   - 影响题目：${formatQuestionIds(item.affectedQuestionIds)}`,
      `   - 最近题目：${item.latestQuestionTitle}`,
      `   - 动作：${item.actionLabel}`,
      `   - 入口：${item.to}`,
    )
  })

  lines.push('', '修复计划：')
  recoveryPlan.steps.slice(0, 3).forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}，${step.durationMinutes} 分钟，入口：${step.to}`)
  })

  return [...lines, ''].join('\n')
}
```

- [ ] **Step 5: Run green**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility test passes.

## Task 2: Panel Mistake Ledger

- [ ] **Step 1: Write the failing panel test**

Add a test in `frontend/src/components/PracticeSessionReportPanel.test.tsx`:

```ts
it('renders mistake ledger from the current session queue', async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()

  render(
    <PracticeSessionReportPanel
      queue={[question(1), question(2)]}
      progress={{
        ...progress(),
        interviewAttempts: {
          1: [attempt(1, 58, 58, { specificity: 35 })],
        },
      }}
      onNavigate={onNavigate}
    />,
  )

  const ledgerBlock = screen.getByLabelText('本轮错因账本')
  expect(within(ledgerBlock).getByText('本轮错因账本')).toBeInTheDocument()
  expect(within(ledgerBlock).getByText('场景细节反复失分')).toBeInTheDocument()
  expect(within(ledgerBlock).getByText(/三步修复首要错因/)).toBeInTheDocument()

  await user.click(within(ledgerBlock).getByRole('button', { name: /场景细节反复失分/ }))
  expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
})
```

If the existing `attempt` helper cannot override all criterion scores, update it to accept an optional scores object while preserving existing call sites.

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because `aria-label="本轮错因账本"` is missing.

- [ ] **Step 3: Render panel block**

Import `WarningOutlined`, `buildPracticeSessionMistakeLedger`, and `buildInterviewRecoveryPlan`.

Compute:

```tsx
const sessionMistakeLedger = useMemo(
  () => buildPracticeSessionMistakeLedger(queue, progress),
  [progress, queue],
)
const sessionRecoveryPlan = useMemo(
  () => buildInterviewRecoveryPlan(sessionMistakeLedger),
  [sessionMistakeLedger],
)
```

Render after the script command block:

```tsx
<div className="practice-session-report-mistake-ledger" aria-label="本轮错因账本">
  <div className="practice-session-report-mistake-ledger-head">
    <div>
      <span>本轮错因账本</span>
      <small>{sessionMistakeLedger.summary}</small>
    </div>
    <Button size="small" icon={<WarningOutlined />} onClick={() => onNavigate(sessionMistakeLedger.primaryAction.to)}>
      {sessionMistakeLedger.primaryAction.label}
    </Button>
  </div>
  <div className="practice-session-report-mistake-ledger-metrics">
    <div><span>问题</span><strong>{sessionMistakeLedger.totalProblems}</strong></div>
    <div><span>计划</span><strong>{sessionRecoveryPlan.totalMinutes} 分钟</strong></div>
  </div>
  {sessionMistakeLedger.items.length === 0 ? (
    <p>暂无本轮错因账本。完成一次模拟面试后，战报会自动定位错因。</p>
  ) : (
    <div className="practice-session-report-mistake-ledger-list">
      {sessionMistakeLedger.items.slice(0, 3).map(item => (
        <button key={item.id} type="button" onClick={() => onNavigate(item.to)}>
          <strong>{item.label}</strong>
          <span>{item.averageScore} 平均分 · {item.affectedQuestionIds.length} 道题</span>
          <small>{item.latestQuestionTitle}</small>
        </button>
      ))}
    </div>
  )}
  <div className="practice-session-report-mistake-ledger-plan">
    <span>{sessionRecoveryPlan.title}</span>
    <small>{sessionRecoveryPlan.steps[0]?.description ?? sessionRecoveryPlan.summary}</small>
  </div>
</div>
```

- [ ] **Step 4: Add CSS**

Add `.practice-session-report-mistake-ledger*` rules near the script command section. Keep 8px radius, tight metrics, truncation and no nested page cards.

- [ ] **Step 5: Run focused green**

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: both test files pass.

## Task 3: Verify And Commit

- [ ] **Step 1: Full tests**

```bash
cd frontend
npm run test
```

- [ ] **Step 2: Build**

```bash
cd frontend
npm run build
```

- [ ] **Step 3: Whitespace**

```bash
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮错因账本"
```
