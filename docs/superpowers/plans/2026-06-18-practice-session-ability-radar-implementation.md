# Practice Session Ability Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a current-session ability radar that turns interview criterion scores into an actionable weak-ability summary.

**Architecture:** Add shared TypeScript types, a pure utility builder, Markdown rendering, and a compact panel block inside `PracticeSessionReportPanel`. The feature stays scoped to the current practice queue and reuses existing `StudyProgress` and `InterviewAttempt` records.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And Failing Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add shared radar interfaces to `types.ts`**

Add `PracticeSessionAbilityRadarStatus`, `PracticeSessionAbilityRadarItem`, and `PracticeSessionAbilityRadar` near the existing practice session report types.

- [ ] **Step 2: Write failing utility tests**

Add a test that builds a two-question queue where `specificity` is the weakest dimension. Assert Markdown contains:

```text
## 本轮薄弱能力雷达
最弱维度：场景细节
平均分：55
影响题：1, 2
主行动：回炉场景细节
```

Add an empty-session assertion that Markdown still contains `## 本轮薄弱能力雷达` and `等待本轮开口样本`.

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: test fails because `buildPracticeSessionAbilityRadar` and the Markdown section do not exist yet.

### Task 2: Implement Ability Radar Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionAbilityRadar`**

The builder should:

- Use only current queue question IDs.
- Use the latest attempt per question.
- Aggregate `coverage`, `structure`, `specificity`, and `risk`.
- Track low-score question IDs where the criterion score is below 70.
- Pick the weakest item by lowest average score, then by low-score count.

- [ ] **Step 2: Render Markdown section**

Insert `renderSessionAbilityRadar(queue, progress)` after `renderSessionRecoveryAcceptance(queue, progress)` and before next training.

- [ ] **Step 3: Run focused utility tests**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility tests pass.

### Task 3: Render Radar In Session Report Panel

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing panel test**

Add a test that renders two attempted questions, finds `aria-label="本轮薄弱能力雷达"`, verifies `场景细节`, `55`, and clicks `回炉场景细节`. Expected navigation: `/practice?queue=1,2`.

- [ ] **Step 2: Add panel block**

Use `useMemo` to build the radar. Render title, summary, weakest metric, four criterion chips, and a small Ant Design button using an existing icon.

- [ ] **Step 3: Add CSS**

Use a compact 8px-radius block. Keep neutral palette with status accents and fixed grid tracks so numbers do not shift layout.

- [ ] **Step 4: Run focused component tests**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: focused tests pass.

### Task 4: Full Verification And Commit

**Files:**
- Verify all changed frontend files.

- [ ] **Step 1: Run full frontend tests**

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

- [ ] **Step 3: Run diff whitespace check**

```bash
git diff --check
```

Expected: exit code 0. Existing LF/CRLF warnings are acceptable.

- [ ] **Step 4: Commit with Chinese message**

```bash
git add docs/superpowers/specs/2026-06-18-practice-session-ability-radar-design.md docs/superpowers/plans/2026-06-18-practice-session-ability-radar-implementation.md frontend/src/types.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮薄弱能力雷达"
```
