# 最后 24 小时面试简报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页和冲刺报告中新增最后 24 小时面试简报，把本地学习轨迹压缩成临场可执行清单。

**Architecture:** 新增一个纯前端工具函数负责聚合急救包、复习排期、错因账本和面试表现；新增一个 React 面板消费该函数；冲刺报告复用同一结果生成 Markdown。所有状态继续保存在本地进度中，不新增后端接口。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5。

---

### Task 1: 设计文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-last-minute-brief-design.md`
- Create: `docs/superpowers/plans/2026-06-17-last-minute-brief-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和本计划，明确目标、数据流、页面位置、报告导出和测试范围。

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-last-minute-brief-design.md docs/superpowers/plans/2026-06-17-last-minute-brief-implementation.md
git commit -m "文档：设计最后24小时面试简报"
```

### Task 2: 工具函数 TDD

**Files:**
- Create: `frontend/src/utils/interviewLastMinuteBrief.test.ts`
- Create: `frontend/src/utils/interviewLastMinuteBrief.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Write failing tests**

测试空状态、高风险状态、错因禁忌和 ready 状态。先引用尚不存在的 `buildInterviewLastMinuteBrief`。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewLastMinuteBrief
```

Expected: fail because `./interviewLastMinuteBrief` cannot be resolved.

- [ ] **Step 3: Add types and implementation**

在 `types.ts` 新增 `InterviewLastMinuteBrief` 相关类型。实现工具函数，最多输出 5 个条目，主动作来自最高优先级条目，路径使用 `buildDailyPracticePath`。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewLastMinuteBrief
```

Expected: all tests pass.

### Task 3: 页面面板 TDD

**Files:**
- Create: `frontend/src/components/InterviewLastMinuteBriefPanel.test.tsx`
- Create: `frontend/src/components/InterviewLastMinuteBriefPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

测试面板渲染“最后 24 小时面试简报”、信心分、主按钮和关键条目。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewLastMinuteBriefPanel
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement panel and CSS**

新增面板组件，接入 `StudyPlan`，补充响应式样式。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewLastMinuteBriefPanel
```

Expected: all tests pass.

### Task 4: 报告导出 TDD

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Extend report tests**

断言 Markdown 包含 `## 最后 24 小时面试简报`、信心分和主条目。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- sprintReport
```

Expected: fail because report section is absent.

- [ ] **Step 3: Reuse utility in report**

在 `buildSprintReportMarkdown` 中构建 last-minute brief，并在急救包后渲染新 section。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- sprintReport
```

Expected: all tests pass.

### Task 5: 全量验证与提交

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
git add frontend/src/types.ts frontend/src/utils/interviewLastMinuteBrief.test.ts frontend/src/utils/interviewLastMinuteBrief.ts frontend/src/components/InterviewLastMinuteBriefPanel.test.tsx frontend/src/components/InterviewLastMinuteBriefPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css frontend/src/utils/sprintReport.test.ts frontend/src/utils/sprintReport.ts
git commit -m "功能：新增最后24小时面试简报"
```

