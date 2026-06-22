# Practice Session Replay Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-session 60-second replay cards that turn evidence gaps into speakable repair scripts.

**Architecture:** Add shared types, a pure replay-card builder, Markdown rendering, and a compact panel block. The builder composes evidence gaps so diagnosis and replay stay aligned.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionReplayCardItem` and `PracticeSessionReplayCards` near the practice session report types.

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```text
## 本轮 60 秒复述卡
开场句
证据句
边界句
```

Empty scenario should contain:

```text
## 本轮 60 秒复述卡
等待生成复述卡
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because replay cards are not rendered yet.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionReplayCards`**

Use evidence gaps first, then fall back to stable answered questions.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionReplayCards(queue, progress)` after `renderSessionEvidenceGaps(queue, progress)`.

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

Render a low-score session, find `aria-label="本轮 60 秒复述卡"`, verify the first card shows opening/evidence/boundary lines, and clicking the primary action navigates to `/practice?queue=1,2`.

- [ ] **Step 2: Add UI block**

Show title, summary, up to three replay cards, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact stacked script cards with stable text wrapping and no oversized prose.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮60秒复述卡"`
