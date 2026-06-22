# 本轮战报下一轮训练建议 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已有下一轮训练队列接入本轮模拟面试战报，让用户完成一轮后能直接进入下一轮高优先级训练。

**Architecture:** 复用 `frontend/src/utils/nextTrainingQueue.ts` 的纯函数。`practiceSessionReport` 负责 Markdown 导出，`PracticeSessionReportPanel` 负责页面展示和导航，样式追加到全局样式文件。

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Testing Library.

---

## Files

- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

## Task 1: Markdown 下一轮训练建议

- [ ] **Step 1: Write the failing test**

在 `frontend/src/utils/practiceSessionReport.test.ts` 的 Markdown 测试中断言：

```ts
expect(markdown).toContain('## 下一轮训练建议')
expect(markdown).toContain('开始下一轮训练')
expect(markdown).toContain('入口：/practice?queue=')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- practiceSessionReport`

Expected: FAIL because the Markdown report has no next-training section.

- [ ] **Step 3: Implement Markdown rendering**

在 `frontend/src/utils/practiceSessionReport.ts` 中引入 `buildNextTrainingQueue` 和 `formatNextTrainingQueueItemMeta`，新增 `renderSessionNextTraining(progress, now)`，并插入到补弱动作前。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- practiceSessionReport`

Expected: PASS.

## Task 2: 面板下一轮训练入口

- [ ] **Step 1: Write the failing test**

在 `frontend/src/components/PracticeSessionReportPanel.test.tsx` 中断言：

```ts
expect(screen.getByText('下一轮训练')).toBeInTheDocument()
expect(screen.getByText('Java 面试题 1')).toBeInTheDocument()
await userEvent.click(screen.getByRole('button', { name: /开始下一轮训练/ }))
expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('/practice?queue='))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- PracticeSessionReportPanel`

Expected: FAIL because the panel has no next-training block.

- [ ] **Step 3: Implement panel rendering**

在 `frontend/src/components/PracticeSessionReportPanel.tsx` 中计算 `buildNextTrainingQueue(progress, undefined, 3)`，渲染摘要、主按钮和最多 3 个题目按钮。

- [ ] **Step 4: Add styling**

在 `frontend/src/styles/global.css` 中追加 `.practice-session-report-next-training*` 样式，保持紧凑、可扫描、按钮文本不溢出。

- [ ] **Step 5: Run focused tests**

Run: `npm run test -- practiceSessionReport PracticeSessionReportPanel`

Expected: PASS.

## Task 3: Full verification and commit

- [ ] Run `npm run test`
- [ ] Run `npm run build`
- [ ] Run `git diff --check`
- [ ] Commit with Chinese message:

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报接入下一轮训练"
```
