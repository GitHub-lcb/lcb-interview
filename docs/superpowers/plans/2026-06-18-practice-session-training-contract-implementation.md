# Practice Session Training Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a next-round training contract that turns the current session report into a clear goal, queue, acceptance rule, and evidence reference for the next practice round.

**Architecture:** Frontend-only derived data. Add typed contract items, compute them in `practiceSessionReport.ts`, render a compact block in `PracticeSessionReportPanel`, and export the same section in Markdown.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Utility RED Test

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add Markdown test**

Assert the report contains:

```ts
expect(markdown).toContain('## 下一轮训练契约')
expect(markdown).toContain('目标分')
expect(markdown).toContain('训练题组')
expect(markdown).toContain('验收口径')
expect(markdown).toContain('复盘证据')
expect(markdown).toContain('主行动：')
```

- [ ] **Step 2: Add empty assertion**

```ts
expect(markdown).toContain('等待生成训练契约')
```

- [ ] **Step 3: Verify RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the contract section does not exist yet.

### Task 2: Component RED Test

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] **Step 1: Add rendering and navigation test**

Render a blocked session and assert:

```ts
const contractBlock = screen.getByLabelText('下一轮训练契约')
expect(within(contractBlock).getByText('下一轮训练契约')).toBeInTheDocument()
expect(within(contractBlock).getByText('目标分')).toBeInTheDocument()
expect(within(contractBlock).getByText('训练题组')).toBeInTheDocument()
expect(within(contractBlock).getByText('验收口径')).toBeInTheDocument()
expect(within(contractBlock).getByText('复盘证据')).toBeInTheDocument()
```

Click the primary action and expect navigation to `/practice?queue=1,2`.

### Task 3: Implement Data And Markdown

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Add types**

Add `PracticeSessionTrainingContractStatus`, `PracticeSessionTrainingContractItem`, and `PracticeSessionTrainingContract`.

- [ ] **Step 2: Add builder**

Implement `buildPracticeSessionTrainingContract(queue, progress, now)` using report, pass gate, pass evidence, and next training queue.

- [ ] **Step 3: Add Markdown renderer**

Insert `renderSessionTrainingContract(queue, progress, now)` after pass evidence and before next training.

### Task 4: Render Panel And Styles

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Memoize contract**

Add `sessionTrainingContract`.

- [ ] **Step 2: Render compact contract list**

Show title, summary, 4 contract items and primary action.

- [ ] **Step 3: Add responsive styles**

Use two-column desktop grid and one-column mobile grid.

### Task 5: Verify And Commit

- [ ] Run focused tests.
- [ ] Run full frontend tests.
- [ ] Run production build.
- [ ] Run `git diff --check`.
- [ ] Commit with `功能：战报显示下一轮训练契约`。
