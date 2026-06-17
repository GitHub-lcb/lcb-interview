# 下一轮训练队列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可解释、可复制、可一键进入练习的下一轮训练队列。

**Architecture:** 新增 `nextTrainingQueue` 工具聚合现有信号，组件只负责渲染和导航。学习计划页接入面板，不改变现有数据存储。

**Tech Stack:** React 18、TypeScript、Vitest、React Testing Library、Ant Design。

---

### Task 1: 工具层红测

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/nextTrainingQueue.test.ts`

- [ ] 写测试：低分评分影响在队列第一位。
- [ ] 写测试：到期复习债、面试错因、薄弱题、学习中题、计划题按优先级进入并去重。
- [ ] 写测试：空进度返回可执行空状态。
- [ ] 写测试：Markdown 导出包含题目、原因、行动和入口。
- [ ] 运行 `npm run test -- nextTrainingQueue`，确认失败。

### Task 2: 工具层实现

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/nextTrainingQueue.ts`

- [ ] 新增 `NextTrainingQueue` 相关类型。
- [ ] 聚合 `buildDailyPlanCompletion` 的 `statusImpacts`。
- [ ] 聚合 `buildScheduledReviewQueue` 的到期/逾期项。
- [ ] 聚合 `buildInterviewMistakeLedger` 的错因关联题。
- [ ] 聚合剩余薄弱、学习中和今日计划题。
- [ ] 按题目 ID 去重并按优先级排序。
- [ ] 输出 Markdown。
- [ ] 运行聚焦测试。

### Task 3: 面板红测与实现

**Files:**
- Create: `frontend/src/components/NextTrainingQueuePanel.test.tsx`
- Create: `frontend/src/components/NextTrainingQueuePanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] 写组件测试：展示指标、队列项和主行动。
- [ ] 写组件测试：复制 Markdown。
- [ ] 运行组件测试确认失败。
- [ ] 实现面板并接入学习计划页。
- [ ] 添加轻量样式，避免移动端溢出。
- [ ] 运行聚焦测试。

### Task 4: 验证与提交

**Files:**
- Verify only

- [ ] 运行 `npm run test -- nextTrainingQueue NextTrainingQueuePanel`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 中文提交。
