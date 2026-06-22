# 今日作战简报导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让今日作战简报支持导出 Markdown，用户可以免费保存当天题单、训练原因和入口。

**Architecture:** 在 `dailyPlanBrief.ts` 中新增 Markdown 构建函数，复用 `buildDailyPlanBrief`，不改计划拆解逻辑。`DailyPlanBriefPanel` 增加复制按钮，剪贴板不可用时下载 Markdown 文件。测试覆盖纯函数导出和组件复制交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-daily-plan-brief-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-daily-plan-brief-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-18-daily-plan-brief-export-design.md docs/superpowers/plans/2026-06-18-daily-plan-brief-export-implementation.md
git diff --cached --check
git commit -m "文档：设计今日作战简报导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/dailyPlanBrief.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildDailyPlanBrief, buildDailyPlanBriefMarkdown } from './dailyPlanBrief'
```

- [ ] **Step 2: Add planned-day Markdown test**

Create progress with `dailyPlan = [2, 1]`, one weak overdue review debt and one new candidate, then assert:

- `# Java 后端 今日作战简报`
- `生成时间：2026-06-17`
- `## 作战概览`
- `今日计划已拆解`
- `## 指标`
- `## 今日题单`
- `入口：/question/1`
- no `undefined`

- [ ] **Step 3: Add empty Markdown test**

Export default progress and assert:

- `今日计划待生成`
- `今日计划还未生成`
- no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- dailyPlanBrief
```

Expected: FAIL because `buildDailyPlanBriefMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/dailyPlanBrief.ts`

- [ ] **Step 1: Add exported builder**

Add `buildDailyPlanBriefMarkdown(progress, candidates, now)` and reuse `buildDailyPlanBrief(progress, candidates, now)`.

- [ ] **Step 2: Add render helpers**

Add helpers for overview, metrics, item list and date formatting. Empty plan renders a stable next action.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- dailyPlanBrief
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/DailyPlanBriefPanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制简报`, and assert copied Markdown contains `今日作战简报` and a question title.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- DailyPlanBriefPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/DailyPlanBriefPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `Button`, `message`, and `buildDailyPlanBriefMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update header UI and CSS**

Add a head action container with status text and `复制简报` button.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- DailyPlanBriefPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/dailyPlanBrief.test.ts`
- Modify: `frontend/src/utils/dailyPlanBrief.ts`
- Modify: `frontend/src/components/DailyPlanBriefPanel.test.tsx`
- Modify: `frontend/src/components/DailyPlanBriefPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Full verification**

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

Expected: all verification commands succeed.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/utils/dailyPlanBrief.test.ts frontend/src/utils/dailyPlanBrief.ts frontend/src/components/DailyPlanBriefPanel.test.tsx frontend/src/components/DailyPlanBriefPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增今日作战简报导出"
```

Expected: commit succeeds.
