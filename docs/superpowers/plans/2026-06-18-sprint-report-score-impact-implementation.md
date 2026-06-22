# 冲刺报告评分影响说明 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让总冲刺报告在今日闭环段解释当天模拟面试评分造成的计划变化。

**Architecture:** `sprintReport` 已经通过 `buildDailyPlanCompletion` 获取今日闭环数据，直接渲染 `statusImpacts` 即可。保持单向依赖，不在冲刺报告里重新读取或计算评分规则。

**Tech Stack:** TypeScript、Vitest、Markdown 报告生成工具。

---

### Task 1: 红测

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`

- [ ] 在已有综合报告测试中断言“今日计划闭环”包含评分影响。
- [ ] 新增计划外评分不进入影响的断言。
- [ ] 在空报告测试中断言无评分影响时有空状态说明。
- [ ] 运行 `npm run test -- sprintReport`，确认失败。

### Task 2: 实现

**Files:**
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] 在 `renderDailyCompletionSection` 中根据 `completion.statusImpacts` 生成评分影响行。
- [ ] 有影响时输出题目、分数、说明和题目 ID。
- [ ] 无影响时输出空状态说明。
- [ ] 运行聚焦测试。

### Task 3: 验证与提交

**Files:**
- Verify only

- [ ] 运行 `npm run test -- sprintReport`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `git diff --check`。
- [ ] 使用中文提交信息提交。
