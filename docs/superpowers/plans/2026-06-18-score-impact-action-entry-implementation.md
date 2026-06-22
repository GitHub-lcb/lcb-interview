# 评分影响行动入口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把评分影响从解释文本升级为可点击、可导出的下一步行动。

**Architecture:** 在 `DailyPlanCompletionImpact` 中补充行动字段，`dailyPlanCompletion` 工具层统一生成，面板、今日闭环 Markdown 和冲刺报告只负责渲染。

**Tech Stack:** React 18、TypeScript、Vitest、React Testing Library、Ant Design 图标。

---

### Task 1: 红测

**Files:**
- Modify: `frontend/src/utils/dailyPlanCompletion.test.ts`
- Modify: `frontend/src/components/DailyPlanCompletionPanel.test.tsx`
- Modify: `frontend/src/utils/sprintReport.test.ts`

- [ ] 断言弱项评分影响包含 `actionLabel: 重答补强` 和 `/practice?queue=<id>`。
- [ ] 断言高分评分影响包含 `actionLabel: 沉淀题目` 和 `/question/<id>`。
- [ ] 断言今日闭环 Markdown 输出行动入口。
- [ ] 断言面板展示行动文案。
- [ ] 断言冲刺报告输出行动入口。
- [ ] 运行聚焦测试确认失败。

### Task 2: 实现

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/dailyPlanCompletion.ts`
- Modify: `frontend/src/components/DailyPlanCompletionPanel.tsx`
- Modify: `frontend/src/styles/global.css`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] 扩展 `DailyPlanCompletionImpact` 类型。
- [ ] 在 `buildScoreImpacts` 中按状态生成 `actionLabel` 和 `to`。
- [ ] 今日闭环 Markdown 输出“行动”和“入口”。
- [ ] 冲刺报告评分影响行输出“行动”和“入口”。
- [ ] 面板评分影响项改为按钮，点击走 `navigate(impact.to)`。
- [ ] 保持移动端布局不溢出。

### Task 3: 验证与提交

**Files:**
- Verify only

- [ ] 运行 `npm run test -- dailyPlanCompletion DailyPlanCompletionPanel sprintReport`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 中文提交。
