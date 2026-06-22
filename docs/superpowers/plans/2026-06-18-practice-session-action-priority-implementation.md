# Practice Session Action Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-session action priority block that turns several report sections into a short ordered execution list.

**Architecture:** Add shared types, a pure priority builder, Markdown rendering, and a compact panel block. The builder composes existing session report helpers instead of recalculating domain signals.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionActionPriorityItem` and `PracticeSessionActionPriorities` near the practice session report types.

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```text
## 本轮行动优先级
1. 补齐决策阻断
2. 继续复测
3. 回炉场景细节
```

Empty scenario should contain:

```text
## 本轮行动优先级
等待建立行动队列
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the action priority section does not exist.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionActionPriorities`**

Compose decision, recovery acceptance, ability radar and next training queue. Return at most three unique labels.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionActionPriorities(queue, progress, now)` after `renderSessionInterviewerDecision(queue, progress)`.

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

Render a low-score session, find `aria-label="本轮行动优先级"`, verify the first action is `补齐决策阻断`, and clicking it navigates to `/practice?queue=1,2`.

- [ ] **Step 2: Add UI block**

Show title, summary, up to three buttons, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact grid/list styling with 8px radius and stable text clamping.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮行动优先级"`
