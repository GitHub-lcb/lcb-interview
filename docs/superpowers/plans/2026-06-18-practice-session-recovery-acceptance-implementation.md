# Practice Session Recovery Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报中展示并导出当前队列限定的错因复测验收状态。

**Architecture:** `practiceSessionReport.ts` 抽出队列限定进度 helper，`buildPracticeSessionMistakeLedger` 和新增 `buildPracticeSessionRecoveryAcceptance` 共用该 helper。验收门禁复用 `buildInterviewRecoveryAcceptance(sessionProgress, ledger)`，Markdown 和面板共享同一结果。

**Tech Stack:** React 18, TypeScript, Vitest, Ant Design 5, CSS。

---

## File Map

- Modify: `frontend/src/utils/practiceSessionReport.ts`
  - 新增 `buildPracticeSessionRecoveryAcceptance(queue, progress)`。
  - 抽出 `buildPracticeSessionScopedProgress(queue, progress)` 私有 helper。
  - 新增 Markdown“本轮错因验收”章节。
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
  - 增加错因验收 Markdown 和空态断言。
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
  - 渲染本轮错因验收模块。
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
  - 覆盖验收模块展示和主行动跳转。
- Modify: `frontend/src/styles/global.css`
  - 增加 `.practice-session-report-recovery-acceptance*` 样式。

## Task 1: Markdown Recovery Acceptance

- [ ] **Step 1: Write the failing Markdown test**

Add a behavior test in `frontend/src/utils/practiceSessionReport.test.ts`:

```ts
it('exports recovery acceptance for the current session queue', () => {
  const markdown = buildPracticeSessionReportMarkdown(
    [question(1), question(2)],
    progress({
      interviewAttempts: {
        1: [attempt(1, 58, { specificity: 35 })],
        2: [attempt(2, 82, { specificity: 82 })],
      },
    }),
    NOW,
  )

  expect(markdown).toContain('## 本轮错因验收')
  expect(markdown).toContain('最新复测仍未过线')
  expect(markdown).toContain('通过：1 / 2')
  expect(markdown).toContain('失败题：1')
  expect(markdown).toContain('待复测：暂无')
  expect(markdown).toContain('主行动：继续复测')
})
```

Update empty markdown assertions:

```ts
expect(markdown).toContain('## 本轮错因验收')
expect(markdown).toContain('等待建立验收样本')
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because `## 本轮错因验收` is missing.

- [ ] **Step 3: Extract scoped progress helper**

In `practiceSessionReport.ts`, extract the queue filtering currently inside `buildPracticeSessionMistakeLedger`:

```ts
function buildPracticeSessionScopedProgress(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): StudyProgress {
  const queueIdSet = new Set(queue.map(item => item.id).filter(questionId => Number.isFinite(questionId) && questionId > 0))
  const context = buildPracticeSessionProgressContext(queue, progress)

  return {
    ...context,
    dailyPlan: context.dailyPlan.filter(questionId => queueIdSet.has(questionId)),
    questionStates: filterRecordByQuestionIds(context.questionStates, queueIdSet),
    questionSnapshots: filterRecordByQuestionIds(context.questionSnapshots, queueIdSet),
    interviewAttempts: filterRecordByQuestionIds(context.interviewAttempts, queueIdSet),
  }
}
```

Update `buildPracticeSessionMistakeLedger`:

```ts
return buildInterviewMistakeLedger(buildPracticeSessionScopedProgress(queue, progress))
```

- [ ] **Step 4: Implement recovery acceptance builder and Markdown**

Import:

```ts
import type { InterviewRecoveryAcceptance } from '../types'
import { buildInterviewRecoveryAcceptance } from './interviewRecoveryAcceptance'
```

Add:

```ts
export function buildPracticeSessionRecoveryAcceptance(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewRecoveryAcceptance {
  const scopedProgress = buildPracticeSessionScopedProgress(queue, progress)
  const ledger = buildInterviewMistakeLedger(scopedProgress)
  return buildInterviewRecoveryAcceptance(scopedProgress, ledger)
}
```

Render after `renderSessionMistakeLedger(queue, progress)`:

```ts
function renderSessionRecoveryAcceptance(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const acceptance = buildPracticeSessionRecoveryAcceptance(queue, progress)

  return [
    '## 本轮错因验收',
    `- 状态：${acceptance.title}`,
    `- 摘要：${acceptance.summary}`,
    `- 通过：${acceptance.passedCount} / ${acceptance.totalCount}`,
    `- 失败题：${formatQuestionIds(acceptance.failedQuestionIds)}`,
    `- 待复测：${formatQuestionIds(acceptance.pendingQuestionIds)}`,
    `- 主行动：${acceptance.primaryAction.label}，${acceptance.primaryAction.description}（${acceptance.primaryAction.to}）`,
    '',
  ].join('\n')
}
```

- [ ] **Step 5: Run green**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility test passes.

## Task 2: Panel Recovery Acceptance

- [ ] **Step 1: Write the failing panel test**

Add a test in `frontend/src/components/PracticeSessionReportPanel.test.tsx`:

```ts
it('renders recovery acceptance from the current session queue', async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()

  render(
    <PracticeSessionReportPanel
      queue={[question(1), question(2)]}
      progress={{
        ...progress(),
        interviewAttempts: {
          1: [attempt(1, 58, 58, { specificity: 35 })],
          2: [attempt(2, 82, 82, { specificity: 82 })],
        },
      }}
      onNavigate={onNavigate}
    />,
  )

  const acceptanceBlock = screen.getByLabelText('本轮错因验收')
  expect(within(acceptanceBlock).getByText('本轮错因验收')).toBeInTheDocument()
  expect(within(acceptanceBlock).getByText('最新复测仍未过线')).toBeInTheDocument()
  expect(within(acceptanceBlock).getByText('1 / 2')).toBeInTheDocument()

  await user.click(within(acceptanceBlock).getByRole('button', { name: /继续复测/ }))
  expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1,2')
})
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because `aria-label="本轮错因验收"` is missing.

- [ ] **Step 3: Render panel block**

Import and compute:

```tsx
const sessionRecoveryAcceptance = useMemo(
  () => buildPracticeSessionRecoveryAcceptance(queue, progress),
  [progress, queue],
)
```

Render after the mistake ledger block:

```tsx
<div className={`practice-session-report-recovery-acceptance status-${sessionRecoveryAcceptance.status}`} aria-label="本轮错因验收">
  <div>
    <span>本轮错因验收</span>
    <strong>{sessionRecoveryAcceptance.title}</strong>
    <small>{sessionRecoveryAcceptance.summary}</small>
  </div>
  <div className="practice-session-report-recovery-acceptance-metrics">
    <div><span>通过</span><strong>{sessionRecoveryAcceptance.passedCount} / {sessionRecoveryAcceptance.totalCount}</strong></div>
    <div><span>失败</span><strong>{sessionRecoveryAcceptance.failedQuestionIds.length}</strong></div>
    <div><span>待复测</span><strong>{sessionRecoveryAcceptance.pendingQuestionIds.length}</strong></div>
  </div>
  <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onNavigate(sessionRecoveryAcceptance.primaryAction.to)}>
    {sessionRecoveryAcceptance.primaryAction.label}
  </Button>
</div>
```

- [ ] **Step 4: Add CSS**

Add `.practice-session-report-recovery-acceptance*` rules near the mistake ledger section. Use status classes for border color only; keep metrics compact and text clamped.

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
git commit -m "功能：战报显示本轮错因验收"
```
