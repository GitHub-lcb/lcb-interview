# 本轮模拟面试补弱动作清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给本轮模拟面试战报增加可执行的补弱动作清单。

**Architecture:** 在 `practiceSessionReport.ts` 内基于当前队列和本地进度派生 `repairActions`，类型定义放在 `types.ts`，组件只负责展示和导航。Markdown 导出复用同一份派生数据，避免 UI 和导出逻辑分叉。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest。

---

### Task 1: 数据模型和工具函数测试

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`
- Test: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Write the failing test**

在 `practiceSessionReport.test.ts` 的风险战报用例后追加断言：

```ts
expect(report.repairActions[0]).toMatchObject({
  questionId: 2,
  title: 'Java 面试题 2',
  criterionLabel: '结构化',
  to: '/practice?question=2',
})
expect(report.repairActions[0].reason).toContain('55 分')
expect(report.repairActions[0].action).toContain('结构')
expect(report.repairActions.some(action => action.questionId === 3)).toBe(true)
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- practiceSessionReport`

Expected: FAIL because `repairActions` does not exist.

- [ ] **Step 3: Implement the model**

Add `PracticeSessionRepairAction` to `types.ts`, add `repairActions` to `PracticeSessionReport`, and build actions in `practiceSessionReport.ts` from low-score or weak items.

- [ ] **Step 4: Run the target test**

Run: `npm run test -- practiceSessionReport`

Expected: PASS.

### Task 2: Markdown 导出

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`
- Test: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the markdown test:

```ts
expect(markdown).toContain('## 补弱动作清单')
expect(markdown).toContain('Java 面试题 2')
expect(markdown).toContain('结构化')
expect(markdown).toContain('/practice?question=2')
```

- [ ] **Step 2: Run the failing test**

Run: `npm run test -- practiceSessionReport`

Expected: FAIL because markdown does not render repair actions.

- [ ] **Step 3: Implement markdown rendering**

Add `renderSessionRepairActions(report.repairActions)` between metrics and queue sections.

- [ ] **Step 4: Run the target test**

Run: `npm run test -- practiceSessionReport`

Expected: PASS.

### Task 3: 面板展示

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] **Step 1: Write the failing component test**

Add a low-score queue item and assert:

```ts
expect(screen.getByText('本轮补弱动作')).toBeInTheDocument()
expect(screen.getByText(/Java 面试题 1/)).toBeInTheDocument()
expect(screen.getByText(/结构化/)).toBeInTheDocument()
```

- [ ] **Step 2: Run the failing component test**

Run: `npm run test -- PracticeSessionReportPanel`

Expected: FAIL because the panel does not render repair actions.

- [ ] **Step 3: Implement panel rendering**

Render up to 3 `report.repairActions` as compact cards under the metric grid. Each card shows title, reason and action. Add restrained CSS under `.practice-session-report-repairs`.

- [ ] **Step 4: Run the target component test**

Run: `npm run test -- PracticeSessionReportPanel`

Expected: PASS.

### Task 4: Verification and commit

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run: `npm run test -- practiceSessionReport PracticeSessionReportPanel`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/utils/practiceSessionReport.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/styles/global.css
git commit -m "功能：新增模拟面试战报补弱动作"
```

## Self-Review

- Spec coverage: 数据模型、UI、Markdown、无后端、无浏览器验证均已覆盖。
- Placeholder scan: 无 TBD/TODO/后续补充。
- Type consistency: `PracticeSessionRepairAction`、`repairActions`、`criterionLabel` 在测试、类型和实现中保持一致。
