# 工作台日报闭环验收导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页复制的工作台日报也包含今日闭环验收和评分影响行动入口。

**Architecture:** `studyDashboardReport` 在构建 Markdown 时调用 `buildDailyPlanCompletion(progress, now)`，新增一个纯渲染函数输出闭环验收段。首页组件继续调用同一个 `buildStudyDashboardMarkdown`，不改组件交互。

**Tech Stack:** TypeScript、Vitest、React Testing Library、本地学习进度工具函数。

---

### Task 1: 红测

**Files:**
- Modify: `frontend/src/utils/studyDashboardReport.test.ts`
- Modify: `frontend/src/components/StudyDashboard.test.tsx`

- [ ] 在工具测试进度中加入题目快照和今日模拟评分。
- [ ] 断言 Markdown 包含“今日闭环验收”。
- [ ] 断言 Markdown 包含评分影响行动入口。
- [ ] 断言空报告包含无评分影响说明。
- [ ] 断言首页复制日报时带出同一章节。
- [ ] 运行聚焦测试确认失败。

### Task 2: 实现

**Files:**
- Modify: `frontend/src/utils/studyDashboardReport.ts`

- [ ] 导入并调用 `buildDailyPlanCompletion`。
- [ ] 新增 `renderDailyCompletion` 渲染函数。
- [ ] 将闭环验收插入概览和下一题之间。
- [ ] 有评分影响时输出行动入口，无影响时输出空状态说明。
- [ ] 运行聚焦测试。

### Task 3: 验证与提交

**Files:**
- Verify only

- [ ] 运行 `npm run test -- studyDashboardReport StudyDashboard`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 中文提交。
