# 本轮模拟面试战报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Practice 页新增当前练习队列的整体战报，让用户一眼看到本轮平均分、弱题和下一步行动。

**Architecture:** 新增一个纯前端工具函数从 `PracticeQueueItem[]` 和 `StudyProgress` 派生战报数据；新增 React 侧栏面板消费该数据；Practice 页只负责传入队列、进度和导航回调。无后端、存储和路由结构变更。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-practice-session-report-design.md`
- Create: `docs/superpowers/plans/2026-06-17-practice-session-report-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确数据输入、战报层级、主行动策略、页面位置和测试范围。

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-practice-session-report-design.md docs/superpowers/plans/2026-06-17-practice-session-report-implementation.md
git commit -m "文档：设计本轮模拟面试战报"
```

### Task 2: 工具函数 TDD

**Files:**
- Create: `frontend/src/utils/practiceSessionReport.test.ts`
- Create: `frontend/src/utils/practiceSessionReport.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Write failing tests**

覆盖空队列、部分已答、低分补弱和全答高分通过四类行为。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fail because `./practiceSessionReport` cannot be resolved.

- [ ] **Step 3: Add types and implementation**

在 `types.ts` 新增 `PracticeSessionReport` 相关类型，实现 `buildPracticeSessionReport(queue, progress)`。函数只读取当前队列题目的最新一次尝试，避免历史旧分数污染本轮判断。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: all tests pass.

### Task 3: 组件与 Practice 接入 TDD

**Files:**
- Create: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Create: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

测试面板展示战报标题、关键指标、主行动按钮，并在点击按钮时调用 `onNavigate`。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement panel and wire Practice**

新增侧栏面板并插入 Practice 页统计面板之后。按钮点击调用 `onNavigate(report.primaryAction.to)`，由 Practice 页复用已有 `navigate`。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: all tests pass.

### Task 4: 全量验证与提交

**Files:**
- All changed frontend/docs files.

- [ ] **Step 1: Run full verification**

Run:

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/types.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增本轮模拟面试战报"
```
