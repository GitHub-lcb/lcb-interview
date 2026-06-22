# Practice Session Interviewer Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a current-session interviewer decision card that converts practice results into an actionable pass/hold/reject-style verdict.

**Architecture:** Add shared types, a pure decision builder in `practiceSessionReport.ts`, Markdown rendering, and a compact UI block in `PracticeSessionReportPanel`. The builder reuses existing report and ability radar calculations.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add shared interfaces**

Add `PracticeSessionInterviewerDecisionStatus`, `PracticeSessionInterviewerDecisionEvidence`, and `PracticeSessionInterviewerDecision` near the other practice session report types.

- [ ] **Step 2: Add failing Markdown tests**

Add a low-score test that expects:

```text
## 本轮面试官决策卡
暂不建议通过
阻断项：场景细节平均 55 分
主行动：补齐决策阻断
```

Extend the empty-session Markdown test to expect:

```text
## 本轮面试官决策卡
等待面试样本
```

- [ ] **Step 3: Confirm RED**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because the decision section does not exist.

### Task 2: Implement Decision Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionInterviewerDecision`**

The builder should call `buildPracticeSessionReport(queue, progress)` and `buildPracticeSessionAbilityRadar(queue, progress)`, then derive status, evidence, blockers and action.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionInterviewerDecision(queue, progress)` after `renderSessionAbilityRadar(queue, progress)` and before next training.

- [ ] **Step 3: Run focused utility tests**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility tests pass.

### Task 3: Render Decision Card In Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add failing panel test**

Render a low-score queue and assert `aria-label="本轮面试官决策卡"`, `暂不建议通过`, `场景细节平均 55 分`, and button navigation to `/practice?queue=1,2`.

- [ ] **Step 2: Add the UI block**

Use `useMemo`, show verdict, summary, evidence chips, blockers, and a small primary action button.

- [ ] **Step 3: Add CSS**

Use compact 8px-radius styles with status accents. Keep text clamped and grid dimensions stable.

- [ ] **Step 4: Run focused component tests**

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: focused tests pass.

### Task 4: Verify And Commit

- [ ] **Step 1: Run full tests**

```bash
cd frontend
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run production build**

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run diff check**

```bash
git diff --check
```

Expected: exit code 0. Existing LF/CRLF warnings are acceptable.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-practice-session-interviewer-decision-design.md docs/superpowers/plans/2026-06-18-practice-session-interviewer-decision-implementation.md frontend/src/types.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮面试官决策卡"
```
