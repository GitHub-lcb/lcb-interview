# Practice Session Evidence Gap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-session evidence gap block that turns low scoring feedback dimensions into concrete interviewer probes and repair hints.

**Architecture:** Add shared types, a pure evidence-gap builder, Markdown rendering, and a compact panel block. The builder uses only current queue attempts so exported reports and UI stay deterministic.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionEvidenceGapItem` and `PracticeSessionEvidenceGaps` near the practice session report types.

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```text
## 本轮证据缺口
面试官追问
修复提示
```

Empty scenario should contain:

```text
## 本轮证据缺口
等待生成证据缺口
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the evidence gap section does not exist.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionEvidenceGaps`**

Collect current queue attempts, score low dimensions, sort by risk, and return up to three gaps.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionEvidenceGaps(queue, progress)` after `renderSessionActionPriorities(queue, progress, now)`.

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

Render a low-score session, find `aria-label="本轮证据缺口"`, verify the first gap exposes a追问 and a修复提示, and clicking the primary action navigates to `/practice?queue=1,2`.

- [ ] **Step 2: Add UI block**

Show title, summary, up to three evidence gap cards, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact evidence cards with 8px radius, stable two-line text, and no nested card styling.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮证据缺口"`
