# Practice Session Pass Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-session pass gate that tells users whether the session can move forward and which gate blocks it.

**Architecture:** Keep the feature as a frontend-only derived report block. Add typed pass-gate data, derive it in `practiceSessionReport.ts`, render it in `PracticeSessionReportPanel`, and include it in Markdown export.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

### Task 1: Add Failing Utility Tests

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Write tests before production code**

Add a Markdown export test that expects:

```ts
expect(markdown).toContain('## 本轮通过门槛')
expect(markdown).toContain('全题完成')
expect(markdown).toContain('平均分达标')
expect(markdown).toContain('弱项清零')
expect(markdown).toContain('二次提交稿就绪')
expect(markdown).toContain('主行动：')
```

Add an empty-state assertion:

```ts
expect(markdown).toContain('等待生成通过门槛')
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the Markdown section does not exist yet.

### Task 2: Add Failing Component Test

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] **Step 1: Write the rendering and navigation test**

Render a queue with two answered attempts and assert:

```ts
const gateBlock = screen.getByLabelText('本轮通过门槛')
expect(within(gateBlock).getByText('本轮通过门槛')).toBeInTheDocument()
expect(within(gateBlock).getByText('全题完成')).toBeInTheDocument()
expect(within(gateBlock).getByText('平均分达标')).toBeInTheDocument()
expect(within(gateBlock).getByText('弱项清零')).toBeInTheDocument()
expect(within(gateBlock).getByText('二次提交稿就绪')).toBeInTheDocument()
```

Click the primary action and expect navigation to `/practice?queue=1,2` for a blocked session.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because the labeled block does not exist.

### Task 3: Implement Typed Pass Gate Data

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Add types**

Add `PracticeSessionPassGateStatus`, `PracticeSessionPassGateItem`, and `PracticeSessionPassGate`.

- [ ] **Step 2: Add builder**

Implement `buildPracticeSessionPassGate(queue, progress)`:

- Return `empty` when no attempts exist.
- Build four gate items: answered, average score, weak cleanup, retry draft.
- Use `ready` only when all four gates are passed.
- Pick the first blocked item as the summary and primary action.

- [ ] **Step 3: Add Markdown renderer**

Insert `renderSessionPassGate(queue, progress)` after retry drafts and before next training.

### Task 4: Render The Panel Block

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Use the builder**

Add a memoized `sessionPassGate`.

- [ ] **Step 2: Render the block**

Place it between retry drafts and next training. Include title, summary, gate list, and primary button.

- [ ] **Step 3: Style the block**

Add compact grid/list styles with stable dimensions and no nested cards.

### Task 5: Verify And Commit

**Files:**
- All modified files.

- [ ] **Step 1: Run focused tests**

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

- [ ] **Step 2: Run full frontend test suite**

```bash
cd frontend
npm run test
```

- [ ] **Step 3: Build**

```bash
cd frontend
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮通过门槛"
```
