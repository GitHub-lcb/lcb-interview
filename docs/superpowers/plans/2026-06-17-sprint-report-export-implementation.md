# 面试冲刺报告导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为学习计划页新增完全本地生成的 Markdown 面试冲刺报告，并提供复制/下载降级入口。

**Architecture:** 新增 `sprintReport` 纯函数复用健康雷达和面试简报结果；新增 `SprintReportActions` 组件负责复制和下载降级；学习计划页只做组件插入。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、本地学习进度工具。

---

### Task 1: Markdown 报告生成器

**Files:**
- Create: `frontend/src/utils/sprintReport.test.ts`
- Create: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

覆盖非空进度报告、空状态报告、热身题和下一步行动。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- sprintReport`

Expected: FAIL because `./sprintReport` does not exist.

- [ ] **Step 3: Implement generator**

实现 `buildSprintReportMarkdown(routes, progress, now)`，复用 `buildPrepHealthReport` 与 `buildInterviewBrief`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- sprintReport`

Expected: PASS.

### Task 2: 学习计划页复制入口

**Files:**
- Create: `frontend/src/components/SprintReportActions.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create component**

组件生成 Markdown，复制成功用 `message.success`，复制失败或剪贴板不可用时下载 `.md` 文件并提示。

- [ ] **Step 2: Insert into StudyPlan**

在学习计划页头部行动区加入 `<SprintReportActions progress={progress} />`。

- [ ] **Step 3: Add styles**

补充 `.sprint-report-actions` 和按钮布局样式，确保移动端不溢出。

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
git add docs/superpowers/specs/2026-06-17-sprint-report-export-design.md docs/superpowers/plans/2026-06-17-sprint-report-export-implementation.md frontend/src/utils/sprintReport.test.ts frontend/src/utils/sprintReport.ts frontend/src/components/SprintReportActions.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增面试冲刺报告导出"
```

