# Practice Session Material Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报中展示并导出当前队列内的高分表达素材。

**Architecture:** 复用 `buildPracticeSessionProgressContext` 生成战报派生上下文，再调用 `buildInterviewMaterialVault` 提取素材，并按当前练习队列过滤。Markdown 和面板都使用同一个 `buildPracticeSessionMaterialVault` 导出函数，避免 UI 与导出逻辑分叉。

**Tech Stack:** React 18, TypeScript, Vitest, Ant Design 5, CSS。

---

## File Map

- Modify: `frontend/src/utils/practiceSessionReport.ts`
  - 新增 `buildPracticeSessionMaterialVault(queue, progress)`。
  - 在 Markdown 战报中新增“本轮高分素材”章节。
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
  - 为普通战报和空队列战报增加素材快照断言。
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
  - 在今日闭环与下一轮训练之间渲染本轮素材快照。
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
  - 覆盖素材快照可见性与素材项导航。
- Modify: `frontend/src/styles/global.css`
  - 新增素材快照紧凑样式。

## Task 1: Markdown Material Snapshot

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Write the failing Markdown test**

In `frontend/src/utils/practiceSessionReport.test.ts`, update the portable markdown report test:

```ts
expect(markdown).toContain('## 本轮高分素材')
expect(markdown).toContain('本轮高分素材')
expect(markdown).toContain('Java 面试题 1')
expect(markdown).toContain('得分：')
expect(markdown).toContain('片段：')
```

Update the empty markdown test:

```ts
expect(markdown).toContain('## 本轮高分素材')
expect(markdown).toContain('暂无本轮高分素材')
```

- [ ] **Step 2: Run the focused red test**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because `## 本轮高分素材` is missing.

- [ ] **Step 3: Add the minimal utility implementation**

In `practiceSessionReport.ts`:

```ts
import type { InterviewMaterialVault } from '../types'
import { buildInterviewMaterialVault } from './interviewMaterialVault'

export function buildPracticeSessionMaterialVault(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): InterviewMaterialVault {
  const queueIdSet = new Set(queue.map(item => item.id))
  const vault = buildInterviewMaterialVault(buildPracticeSessionProgressContext(queue, progress))

  if (queueIdSet.size === 0) {
    return { ...vault, snippets: [] }
  }

  const snippets = vault.snippets.filter(snippet => queueIdSet.has(snippet.questionId))
  return {
    ...vault,
    totalSamples: snippets.length,
    snippets,
  }
}
```

Then render `renderSessionMaterialVault(queue, progress)` between `renderSessionDailyClosure` and `renderSessionNextTraining`.

- [ ] **Step 4: Run the focused green test**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: `practiceSessionReport.test.ts` passes.

## Task 2: Panel Material Snapshot

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write the failing panel test**

In `PracticeSessionReportPanel.test.tsx`, add expectations to the first render test:

```ts
expect(screen.getByText('本轮高分素材')).toBeInTheDocument()
expect(screen.getByText(/高分素材/)).toBeInTheDocument()
```

Add one click assertion for the first material item if a high-score answer exists in the fixture:

```ts
await user.click(screen.getByText('Java 面试题 1'))
expect(onNavigate).toHaveBeenCalledWith('/question/1')
```

- [ ] **Step 2: Run the focused red test**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because the material snapshot block is missing.

- [ ] **Step 3: Render the material snapshot**

In `PracticeSessionReportPanel.tsx`, import `buildPracticeSessionMaterialVault`, compute it with `useMemo`, then render:

```tsx
<div className="practice-session-report-material-vault" aria-label="本轮高分素材">
  <div className="practice-session-report-material-vault-head">
    <div>
      <span>本轮高分素材</span>
      <small>{sessionMaterialVault.summary}</small>
    </div>
    <Button size="small" icon={<HighlightOutlined />} onClick={() => onNavigate(sessionMaterialVault.primaryAction.to)}>
      {sessionMaterialVault.primaryAction.label}
    </Button>
  </div>
  {sessionMaterialVault.snippets.length === 0 ? (
    <p>暂无本轮高分素材。完成 80 分以上模拟回答后，战报会自动沉淀可复用表达。</p>
  ) : (
    <div className="practice-session-report-material-vault-list">
      {sessionMaterialVault.snippets.slice(0, 3).map(snippet => (
        <button key={snippet.id} type="button" onClick={() => onNavigate(snippet.to)}>
          <strong>{snippet.title}</strong>
          <span>{snippet.label} · {snippet.score} 分</span>
          <small>{snippet.content}</small>
        </button>
      ))}
    </div>
  )}
</div>
```

Add `HighlightOutlined` to the existing icon import.

- [ ] **Step 4: Add compact CSS**

Add `.practice-session-report-material-vault*` rules near the other report panel sections. Keep 8px radius, fixed gaps, text truncation, and no nested page cards.

- [ ] **Step 5: Run focused green tests**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: both files pass.

## Task 3: Verify And Commit

**Files:**
- Verify all changed files from Task 1 and Task 2.

- [ ] **Step 1: Run full test suite**

```bash
cd frontend
npm run test
```

Expected: all Vitest files pass.

- [ ] **Step 2: Run production build**

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run whitespace check**

```bash
git diff --check
```

Expected: no whitespace errors. CRLF warnings are acceptable for this repository.

- [ ] **Step 4: Commit with Chinese message**

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮高分素材"
```
