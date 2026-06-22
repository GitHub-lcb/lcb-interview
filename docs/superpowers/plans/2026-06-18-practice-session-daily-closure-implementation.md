# 本轮战报今日闭环快照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报里显示今日闭环验收快照，让用户完成一轮后立刻知道今天是否闭环。

**Architecture:** `practiceSessionReport` 复用本轮队列上下文补齐函数，再调用 `buildDailyPlanCompletion`。面板只渲染闭环摘要和主行动，完整验收仍保留在学习计划页。

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

## Files

- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

## Task 1: Markdown 今日闭环快照

- [ ] **Step 1: Write the failing test**

在 `practiceSessionReport.test.ts` 的 Markdown 测试中加入：

```ts
expect(markdown).toContain('## 今日闭环快照')
expect(markdown).toContain('完成率：')
expect(markdown).toContain('主行动：')
expect(markdown).toContain('评分影响：')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- practiceSessionReport`

Expected: FAIL because no daily closure section exists.

- [ ] **Step 3: Implement Markdown section**

在 `practiceSessionReport.ts` 中：

- 引入 `DailyPlanCompletion` 和 `buildDailyPlanCompletion`。
- 新增 `buildPracticeSessionDailyCompletion(queue, progress, now)`。
- 新增 `renderSessionDailyClosure(queue, progress, now)`。
- 在 Markdown 数组中插入该章节。

- [ ] **Step 4: Run focused test**

Run: `npm run test -- practiceSessionReport`

Expected: PASS.

## Task 2: 面板今日闭环快照

- [ ] **Step 1: Write the failing test**

在 `PracticeSessionReportPanel.test.tsx` 中加入：

```ts
expect(screen.getByText('今日闭环')).toBeInTheDocument()
expect(screen.getByText(/完成率/)).toBeInTheDocument()
expect(screen.getByRole('button', { name: /继续今日队列|生成今日计划|查看冲刺报告/ })).toBeInTheDocument()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- PracticeSessionReportPanel`

Expected: FAIL because the panel does not render daily closure.

- [ ] **Step 3: Implement panel block**

在 `PracticeSessionReportPanel.tsx` 中：

- 计算 `buildPracticeSessionDailyCompletion(queue, progress, progress.updatedAt)`。
- 渲染标题、完成率、风险数、模拟样本数和主行动按钮。

- [ ] **Step 4: Add styling**

在 `global.css` 中新增 `.practice-session-report-daily-closure*` 样式。

- [ ] **Step 5: Focused verification**

Run: `npm run test -- practiceSessionReport PracticeSessionReportPanel`

Expected: PASS.

## Task 3: Full verification and commit

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with Chinese message:

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示今日闭环快照"
```
