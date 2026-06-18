# Practice Session Pass Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pass-evidence package that explains why the current practice session can or cannot advance.

**Architecture:** Frontend-only derived data. Add typed evidence items, compute them in `practiceSessionReport.ts`, render a compact block in `PracticeSessionReportPanel`, and include the same section in Markdown export.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Utility RED Test

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add Markdown test**

Assert the report contains:

```ts
expect(markdown).toContain('## 本轮过线证据包')
expect(markdown).toContain('评分证据')
expect(markdown).toContain('完成证据')
expect(markdown).toContain('弱项证据')
expect(markdown).toContain('提交证据')
expect(markdown).toContain('主行动：')
```

- [ ] **Step 2: Add empty-state assertion**

```ts
expect(markdown).toContain('等待生成过线证据包')
```

- [ ] **Step 3: Verify RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the section is missing.

### Task 2: Component RED Test

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] **Step 1: Add rendering and navigation test**

Render a blocked session and assert:

```ts
const evidenceBlock = screen.getByLabelText('本轮过线证据包')
expect(within(evidenceBlock).getByText('本轮过线证据包')).toBeInTheDocument()
expect(within(evidenceBlock).getByText('评分证据')).toBeInTheDocument()
expect(within(evidenceBlock).getByText('完成证据')).toBeInTheDocument()
expect(within(evidenceBlock).getByText('弱项证据')).toBeInTheDocument()
expect(within(evidenceBlock).getByText('提交证据')).toBeInTheDocument()
```

Click the primary action and expect navigation to `/practice?queue=1,2`.

### Task 3: Implement Data And Markdown

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Add types**

Add `PracticeSessionPassEvidenceStatus`, `PracticeSessionPassEvidenceItem`, and `PracticeSessionPassEvidence`.

- [ ] **Step 2: Add builder**

Implement `buildPracticeSessionPassEvidence(queue, progress)` using existing report, radar, retry drafts, and pass gate results.

- [ ] **Step 3: Add Markdown renderer**

Insert `renderSessionPassEvidence(queue, progress)` after pass gate and before next training.

### Task 4: Render Panel And Styles

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Memoize evidence package**

Add `sessionPassEvidence`.

- [ ] **Step 2: Render compact evidence list**

Show title, summary, 4 evidence rows and primary action.

- [ ] **Step 3: Add responsive styles**

Use a two-column desktop grid and one-column mobile grid.

### Task 5: Verify And Commit

- [ ] Run focused tests.
- [ ] Run full frontend tests.
- [ ] Run production build.
- [ ] Commit with `功能：战报显示本轮过线证据包`。
