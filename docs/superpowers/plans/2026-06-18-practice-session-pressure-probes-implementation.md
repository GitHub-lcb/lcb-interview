# Practice Session Pressure Probes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current-session pressure probe cards that turn replay scripts into three interviewer-style follow-up questions.

**Architecture:** Extend the existing practice session report pipeline with shared types, a pure builder, Markdown rendering, and one compact panel block. The builder composes `buildPracticeSessionReplayCards` so probes stay aligned with replay cards and remain local/free.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Ant Design 5.

---

### Task 1: Add Types And RED Utility Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Add interfaces**

Add `PracticeSessionPressureProbeItem` and `PracticeSessionPressureProbes` near the practice session report types.

```ts
export type PracticeSessionPressureProbeStatus = 'empty' | 'pressure' | 'ready'

export interface PracticeSessionPressureProbeItem {
  id: string
  questionId: number
  title: string
  probe: string
  riskSignal: string
  answerGuide: string
  to: string
  priority: number
}

export interface PracticeSessionPressureProbes {
  status: PracticeSessionPressureProbeStatus
  title: string
  summary: string
  totalCount: number
  items: PracticeSessionPressureProbeItem[]
  primaryAction: PracticeSessionReportAction
}
```

- [ ] **Step 2: Add failing Markdown tests**

Add one low-score scenario and one empty scenario in `frontend/src/utils/practiceSessionReport.test.ts`.

```ts
expect(markdown).toContain('## 本轮压力追问卡')
expect(markdown).toContain('落地证据追问')
expect(markdown).toContain('失败边界追问')
expect(markdown).toContain('技术取舍追问')
expect(markdown).toContain('主行动：开始压力追问')
```

Empty scenario should contain:

```ts
expect(markdown).toContain('## 本轮压力追问卡')
expect(markdown).toContain('等待生成压力追问')
```

- [ ] **Step 3: Confirm RED**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because pressure probes are not rendered yet.

### Task 2: Implement Builder And Markdown

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Export `buildPracticeSessionPressureProbes`**

Compose replay cards and return three pressure probes when replay cards exist. Use fixed probe templates for landing evidence, failure boundary, and technical tradeoff.

- [ ] **Step 2: Render Markdown**

Insert `renderSessionPressureProbes(queue, progress)` after `renderSessionReplayChecklist(queue, progress)`.

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

Render a low-score session, find `aria-label="本轮压力追问卡"`, verify the three probe names and primary action.

- [ ] **Step 2: Add UI block**

Show title, summary, probe items, risk signal, answer guide, and primary action button.

- [ ] **Step 3: Add CSS**

Use compact rows with stable wrapping, restrained border color, and clear risk/guide hierarchy.

### Task 4: Verify And Commit

- [ ] Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`
- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with `git commit -m "功能：战报显示本轮压力追问卡"`
