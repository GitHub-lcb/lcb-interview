# 面试前冲刺简报 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页新增本地生成的面试前冲刺简报，帮助用户在临近面试时快速定位优势、风险和热身题。

**Architecture:** 新增 `interviewBrief` 纯函数聚合已有本地进度工具，新增 `InterviewBriefPanel` 只做展示和跳转，`StudyPlan` 页面负责插入组件。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有学习进度和路线工具。

---

### Task 1: 简报算法

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewBrief.test.ts`
- Create: `frontend/src/utils/interviewBrief.ts`

- [ ] **Step 1: Write failing tests**

覆盖空进度、掌握分类排序、逾期风险、热身队列去重和面试回落。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewBrief`

Expected: FAIL because `./interviewBrief` does not exist.

- [ ] **Step 3: Implement algorithm**

新增 `InterviewBriefReport`、`InterviewBriefItem`、`InterviewBriefAction` 类型，并实现 `buildInterviewBrief(routes, progress, now)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- interviewBrief`

Expected: PASS.

### Task 2: 学习计划页集成

**Files:**
- Create: `frontend/src/components/InterviewBriefPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel component**

组件接收 `progress`，调用 `buildInterviewBrief(prepRoutes, progress)`，展示标题、摘要、行动按钮、优势、风险和热身题。

- [ ] **Step 2: Insert panel**

在 `StudyPlan` 的设置区之后插入 `<InterviewBriefPanel progress={progress} />`。

- [ ] **Step 3: Add CSS**

新增 `.interview-brief-panel`、`.interview-brief-grid`、`.interview-brief-card` 和移动端单列规则。

### Task 3: Verification and commit

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend; npm run test`

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend; npm run build`

Expected: build succeeds.

- [ ] **Step 3: Run backend tests**

Run: `cd backend; mvn test`

Expected: all backend tests pass.

- [ ] **Step 4: Run whitespace check**

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-interview-brief-design.md docs/superpowers/plans/2026-06-17-interview-brief-implementation.md frontend/src/types.ts frontend/src/utils/interviewBrief.test.ts frontend/src/utils/interviewBrief.ts frontend/src/components/InterviewBriefPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增面试前冲刺简报"
```

