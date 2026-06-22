# Practice Session Retry Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-session retry drafts that turn replay cards and guardrails into copy-ready answer drafts for the next submission.

**Architecture:** Extend the practice session report pipeline with shared types, a pure builder, Markdown rendering, and one compact panel block. The builder composes `buildPracticeSessionReplayCards` and `buildPracticeSessionRiskGuardrails` so drafts stay aligned with current weak points and local/free training.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionRetryDraftItem` and `PracticeSessionRetryDrafts` near the practice session report types.

```ts
export type PracticeSessionRetryDraftStatus = 'empty' | 'repair' | 'ready'

export interface PracticeSessionRetryDraftItem {
  id: string
  questionId: number
  title: string
  conclusionLine: string
  evidenceLine: string
  boundaryLine: string
  closingLine: string
  fullDraft: string
  to: string
  priority: number
}

export interface PracticeSessionRetryDrafts {
  status: PracticeSessionRetryDraftStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionRetryDraftItem[]
  primaryAction: PracticeSessionReportAction
}
```

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```ts
expect(markdown).toContain('## 本轮二次提交稿')
expect(markdown).toContain('结论句：')
expect(markdown).toContain('证据句：')
expect(markdown).toContain('边界句：')
expect(markdown).toContain('收束句：')
expect(markdown).toContain('主行动：使用二次提交稿')
```

Empty scenario should contain:

```ts
expect(markdown).toContain('## 本轮二次提交稿')
expect(markdown).toContain('等待生成二次提交稿')
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because retry drafts are not rendered yet.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionRetryDrafts`**

Compose replay cards and risk guardrails, then turn up to three replay cards into retry drafts.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionRetryDrafts(queue, progress)` after `renderSessionRiskGuardrails(queue, progress)`.

- [ ] **Step 3: Run focused utility tests**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility tests pass.

### Task 3: Render Panel Block

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add failing panel test**

Render a low-score session, find `aria-label="本轮二次提交稿"`, verify the draft lines and primary action.

- [ ] **Step 2: Add UI block**

Show title, summary, draft lines, full draft preview, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact draft rows with stable wrapping and clear conclusion/evidence/boundary hierarchy.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮二次提交稿"`
