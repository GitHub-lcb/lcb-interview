# Practice Session Replay Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-session replay acceptance checklist that lets users self-check a 60-second replay before submitting again.

**Architecture:** Add shared types, a pure checklist builder, Markdown rendering, and a compact panel block. The builder composes replay cards so replay and acceptance stay aligned.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionReplayChecklistItem` and `PracticeSessionReplayChecklist` near the practice session report types.

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```text
## 本轮复述验收清单
结论先行
证据可追问
风险有边界
```

Empty scenario should contain:

```text
## 本轮复述验收清单
等待生成验收清单
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because replay checklist is not rendered yet.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionReplayChecklist`**

Compose replay cards and return static acceptance items when cards exist.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionReplayChecklist(queue, progress)` after `renderSessionReplayCards(queue, progress)`.

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

Render a low-score session, find `aria-label="本轮复述验收清单"`, verify the checklist items and primary action.

- [ ] **Step 2: Add UI block**

Show title, summary, checklist items, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact checklist rows with stable text wrapping and restrained styling.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮复述验收清单"`
