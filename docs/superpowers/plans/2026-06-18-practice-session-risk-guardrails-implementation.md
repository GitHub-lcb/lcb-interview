# Practice Session Risk Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-session risk guardrails that tell users which answer patterns will lose points and how to replace them before retrying.

**Architecture:** Extend the practice session report pipeline with shared types, a pure builder, Markdown rendering, and one compact panel block. The builder composes `buildPracticeSessionPressureProbes` so guardrails stay connected to the current replay and pressure probes.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionRiskGuardrailItem` and `PracticeSessionRiskGuardrails` near the practice session report types.

```ts
export type PracticeSessionRiskGuardrailStatus = 'empty' | 'warning' | 'ready'

export interface PracticeSessionRiskGuardrailItem {
  id: string
  label: string
  avoid: string
  reason: string
  replacement: string
  to: string
  priority: number
}

export interface PracticeSessionRiskGuardrails {
  status: PracticeSessionRiskGuardrailStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionRiskGuardrailItem[]
  primaryAction: PracticeSessionReportAction
}
```

- [ ] **Step 2: Add failing Markdown tests**

Low-score scenario should contain:

```ts
expect(markdown).toContain('## 本轮失分禁区')
expect(markdown).toContain('禁止空讲概念')
expect(markdown).toContain('禁止跳过失败边界')
expect(markdown).toContain('禁止只背标准答案')
expect(markdown).toContain('主行动：避开失分禁区')
```

Empty scenario should contain:

```ts
expect(markdown).toContain('## 本轮失分禁区')
expect(markdown).toContain('等待生成失分禁区')
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because risk guardrails are not rendered yet.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionRiskGuardrails`**

Compose pressure probes and return three guardrails when probes exist.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionRiskGuardrails(queue, progress)` after `renderSessionPressureProbes(queue, progress)`.

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

Render a low-score session, find `aria-label="本轮失分禁区"`, verify the three guardrail names and primary action.

- [ ] **Step 2: Add UI block**

Show title, summary, guardrails, replacement guidance, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact rows with clear avoid/replacement hierarchy and stable wrapping.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮失分禁区"`
