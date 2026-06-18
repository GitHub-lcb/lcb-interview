# Practice Session Follow-Up Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报中展示并导出当前队列内的追问防线。

**Architecture:** 基于 `buildPracticeSessionProgressContext` 构造本轮派生学习进度，只保留当前队列题目的模拟面试尝试，再复用 `buildInterviewFollowUpDefense` 生成追问防线。Markdown 和面板共享 `buildPracticeSessionFollowUpDefense`，保持排序、空态和行动入口一致。

**Tech Stack:** React 18, TypeScript, Vitest, Ant Design 5, CSS。

---

## File Map

- Modify: `frontend/src/utils/practiceSessionReport.ts`
  - 新增 `buildPracticeSessionFollowUpDefense(queue, progress)`。
  - 新增 Markdown“本轮追问防线”章节。
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
  - 增加本轮追问防线和空态断言。
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
  - 渲染本轮追问防线模块。
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
  - 覆盖追问防线模块与题目跳转。
- Modify: `frontend/src/styles/global.css`
  - 增加追问防线紧凑样式。

## Task 1: Markdown Follow-Up Defense

- [ ] **Step 1: Write the failing Markdown test**

Add a Markdown test in `frontend/src/utils/practiceSessionReport.test.ts`:

```ts
const markdown = buildPracticeSessionReportMarkdown(
  [question(1), question(2)],
  progress({
    interviewAttempts: {
      1: [attempt(1, 62, { structure: 45 })],
    },
  }),
  NOW,
)

expect(markdown).toContain('## 本轮追问防线')
expect(markdown).toContain('Java 面试题 1')
expect(markdown).toContain('追问：')
expect(markdown).toContain('压力点：')
expect(markdown).toContain('回答引导：')
expect(markdown).toContain('入口：/practice?queue=1')
```

Update empty markdown assertions:

```ts
expect(markdown).toContain('## 本轮追问防线')
expect(markdown).toContain('暂无本轮追问防线')
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because `## 本轮追问防线` is missing.

- [ ] **Step 3: Implement utility and renderer**

In `practiceSessionReport.ts`:

```ts
import type { InterviewFollowUpDefense } from '../types'
import { buildInterviewFollowUpDefense } from './interviewFollowUpDefense'

export function buildPracticeSessionFollowUpDefense(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewFollowUpDefense {
  const queueIdSet = new Set(queue.map(item => item.id).filter(questionId => Number.isFinite(questionId) && questionId > 0))
  const context = buildPracticeSessionProgressContext(queue, progress)
  const interviewAttempts = Object.fromEntries(
    Object.entries(context.interviewAttempts).filter(([questionId]) => queueIdSet.has(Number(questionId))),
  )

  return buildInterviewFollowUpDefense({ ...context, interviewAttempts })
}
```

Render `renderSessionFollowUpDefense(queue, progress)` after `renderSessionMaterialVault`.

- [ ] **Step 4: Run green**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility test passes.

## Task 2: Panel Follow-Up Defense

- [ ] **Step 1: Write the failing panel test**

Add a test in `PracticeSessionReportPanel.test.tsx`:

```ts
const defenseBlock = screen.getByLabelText('本轮追问防线')
expect(within(defenseBlock).getByText('本轮追问防线')).toBeInTheDocument()
expect(within(defenseBlock).getByText('Java 面试题 1')).toBeInTheDocument()
expect(within(defenseBlock).getByText(/结构化/)).toBeInTheDocument()

await userEvent.click(within(defenseBlock).getByRole('button', { name: /Java 面试题 1/ }))
expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because `aria-label="本轮追问防线"` is missing.

- [ ] **Step 3: Render panel block**

Import `ThunderboltOutlined` and `buildPracticeSessionFollowUpDefense`; compute `sessionFollowUpDefense` with `useMemo`; render a compact block after the material vault:

```tsx
<div className="practice-session-report-follow-up-defense" aria-label="本轮追问防线">
  <div className="practice-session-report-follow-up-defense-head">
    <div>
      <span>本轮追问防线</span>
      <small>{sessionFollowUpDefense.summary}</small>
    </div>
    <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onNavigate(sessionFollowUpDefense.primaryAction.to)}>
      {sessionFollowUpDefense.primaryAction.label}
    </Button>
  </div>
  {sessionFollowUpDefense.items.length === 0 ? (
    <p>暂无本轮追问防线。完成一次模拟面试后，战报会自动生成可防守追问。</p>
  ) : (
    <div className="practice-session-report-follow-up-defense-list">
      {sessionFollowUpDefense.items.slice(0, 3).map(item => (
        <button key={item.id} type="button" onClick={() => onNavigate(item.to)}>
          <strong>{item.title}</strong>
          <span>{item.criterionLabel} · {item.score} 分</span>
          <small>{item.pressurePoint}</small>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Add CSS**

Add `.practice-session-report-follow-up-defense*` rules near the material vault section. Keep 8px radius, fixed gaps, truncation, and no page-level nested cards.

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
git commit -m "功能：战报显示本轮追问防线"
```
