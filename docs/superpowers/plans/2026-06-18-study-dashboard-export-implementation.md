# 备考工作台日报导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页备考工作台支持 Markdown 日报导出，用户可以免费保存当天执行清单、下一题和弱点分类。

**Architecture:** 新增 `frontend/src/utils/studyDashboardReport.ts`，复用 `summarizeProgress`、`resolvePlanQuestions`、`buildDailyPlan`、`weakAreasFromQuestions` 和 `getQuestionState` 生成日报。`StudyDashboard` 负责复制和下载降级，不改变今日计划生成逻辑。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-study-dashboard-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-study-dashboard-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-study-dashboard-export-design.md docs/superpowers/plans/2026-06-18-study-dashboard-export-implementation.md
```

- [ ] **Step 2: 检查暂存区**

```bash
git diff --cached --check
```

Expected: exit 0.

- [ ] **Step 3: 提交文档**

```bash
git commit -m "文档：设计备考工作台日报导出"
```

### Task 2: TDD 增加工具层红灯测试

**Files:**
- Create: `frontend/src/utils/studyDashboardReport.test.ts`

- [ ] **Step 1: 写失败测试**

新增测试导入 `buildStudyDashboardMarkdown`，构造 3 道热门题和一份本地进度，断言 Markdown 包含日报标题、概览、下一题、今日计划题单、弱点雷达和路径。

- [ ] **Step 2: 运行红灯测试**

```bash
cd frontend
npm run test -- studyDashboardReport
```

Expected: FAIL，原因是 `Cannot find module './studyDashboardReport'`。

### Task 3: 实现日报工具

**Files:**
- Create: `frontend/src/utils/studyDashboardReport.ts`

- [ ] **Step 1: 新增导出函数**

```ts
export function buildStudyDashboardMarkdown(
  progress: StudyProgress,
  hotQuestions: Question[],
  now = new Date().toISOString(),
): string
```

- [ ] **Step 2: 新增渲染 helpers**

新增 `renderOverview`、`renderNextQuestion`、`renderPlanQuestions`、`renderWeakAreas`、`formatMarkdownDate`。

- [ ] **Step 3: 运行绿灯测试**

```bash
cd frontend
npm run test -- studyDashboardReport
```

Expected: PASS.

### Task 4: 接入 StudyDashboard

**Files:**
- Modify: `frontend/src/components/StudyDashboard.tsx`
- Create: `frontend/src/components/StudyDashboard.test.tsx`

- [ ] **Step 1: 写组件红灯测试**

注入 localStorage 进度，渲染 `StudyDashboard hotQuestions={questions}`，点击“复制日报”，断言剪贴板内容包含目标岗位和日报章节。

- [ ] **Step 2: 运行组件红灯测试**

```bash
cd frontend
npm run test -- StudyDashboard
```

Expected: FAIL，原因是找不到“复制日报”按钮。

- [ ] **Step 3: 组件接入**

在 `StudyDashboard.tsx` 引入 `message`、`CopyOutlined` 和 `buildStudyDashboardMarkdown`，新增 `handleCopyDashboard`，在 `.study-hero-actions` 放入按钮。

- [ ] **Step 4: 运行定向绿灯测试**

```bash
cd frontend
npm run test -- studyDashboardReport StudyDashboard
```

Expected: PASS.

### Task 5: 全量验证和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 验证**

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected: all exit 0.

- [ ] **Step 2: 提交功能**

```bash
git add frontend/src/utils/studyDashboardReport.test.ts frontend/src/utils/studyDashboardReport.ts frontend/src/components/StudyDashboard.tsx frontend/src/components/StudyDashboard.test.tsx
git diff --cached --check
git commit -m "功能：新增备考工作台日报导出"
```
