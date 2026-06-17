# 今日计划评分影响说明 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让今日闭环验收和导出报告解释当天模拟面试评分如何改变今日计划。

**Architecture:** 在 `dailyPlanCompletion` 工具层新增评分影响字段，页面和 Markdown 共用该字段渲染。影响数据只从 `StudyProgress` 本地进度中派生，不新增持久化结构。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、本地学习进度工具函数。

---

### Task 1: 工具层红测

**Files:**
- Modify: `frontend/src/utils/dailyPlanCompletion.test.ts`

- [ ] 新增测试：今日计划内两道题有当天评分，计划外题和昨天评分不进入 `statusImpacts`。
- [ ] 新增测试：同一题当天多次评分只展示最新分数。
- [ ] 新增 Markdown 测试：导出包含 `## 评分影响`、题目标题、分数和计划变化说明。
- [ ] 运行 `npm run test -- dailyPlanCompletion`，确认因字段缺失失败。

### Task 2: 工具层实现

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/utils/dailyPlanCompletion.ts`

- [ ] 在类型中新增 `DailyPlanCompletionImpact`，并挂到 `DailyPlanCompletion.statusImpacts`。
- [ ] 在 `buildDailyPlanCompletion` 中筛选今日计划内评分。
- [ ] 同一题按 `createdAt` 保留最新一次。
- [ ] 复用 `describeInterviewStatusSync(score)` 生成状态。
- [ ] 新增中文说明生成逻辑和 Markdown 渲染函数。
- [ ] 运行聚焦测试。

### Task 3: 面板红测与实现

**Files:**
- Modify: `frontend/src/components/DailyPlanCompletionPanel.test.tsx`
- Modify: `frontend/src/components/DailyPlanCompletionPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] 新增组件测试：面板展示评分影响标题、题目标题和分数说明。
- [ ] 运行组件聚焦测试确认红测失败。
- [ ] 在面板指标和行动之间渲染评分影响列表。
- [ ] 添加轻量样式，保持现有验收面板风格。
- [ ] 运行组件聚焦测试。

### Task 4: 验证与提交

**Files:**
- Verify only

- [ ] 运行 `npm run test -- dailyPlanCompletion DailyPlanCompletionPanel`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 使用中文提交信息提交实现。
