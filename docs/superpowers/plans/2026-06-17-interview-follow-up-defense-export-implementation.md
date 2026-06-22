# 面试追问防线导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让面试追问防线支持导出 Markdown，用户可以免费保存今天最该防守的追问、压力点和回答引导。

**Architecture:** 在 `interviewFollowUpDefense.ts` 中新增 Markdown 构建函数，复用 `buildInterviewFollowUpDefense`。在 `InterviewFollowUpDefensePanel` 增加复制按钮和降级下载。新增组件测试覆盖剪贴板交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-follow-up-defense-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-follow-up-defense-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-follow-up-defense-export-design.md docs/superpowers/plans/2026-06-17-interview-follow-up-defense-export-implementation.md
git diff --cached --check
git commit -m "文档：设计面试追问防线导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewFollowUpDefense.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildInterviewFollowUpDefense, buildInterviewFollowUpDefenseMarkdown } from './interviewFollowUpDefense'
```

- [ ] **Step 2: Add risk-defense Markdown test**

Add a test that exports a risk defense and asserts:

- title contains `面试追问防线`
- generated date is stable
- metrics contain `防线追问`
- items contain a question title, prompt, pressure point and `/practice?queue=`
- markdown does not contain `undefined`

- [ ] **Step 3: Add empty-defense Markdown test**

Add a test that exports empty progress and asserts:

- `追问防线待建立`
- `暂无追问防线`
- `先做一题模拟`
- no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewFollowUpDefense
```

Expected: FAIL because `buildInterviewFollowUpDefenseMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/interviewFollowUpDefense.ts`

- [ ] **Step 1: Add exported builder**

Add `buildInterviewFollowUpDefenseMarkdown(progress, now)` and reuse `buildInterviewFollowUpDefense(progress)`。

- [ ] **Step 2: Add render helpers**

Add helpers for overview, metrics, defense items and date formatting. Empty items render a clear next action.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewFollowUpDefense
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/InterviewFollowUpDefensePanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制防线`, and assert copied Markdown contains `面试追问防线`、target role and a defense item title.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewFollowUpDefensePanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/InterviewFollowUpDefensePanel.tsx`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildInterviewFollowUpDefenseMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update header UI**

Add `复制防线` small button in the existing action area without changing the main panel hierarchy.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewFollowUpDefensePanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/interviewFollowUpDefense.test.ts`
- Modify: `frontend/src/utils/interviewFollowUpDefense.ts`
- Modify: `frontend/src/components/InterviewFollowUpDefensePanel.test.tsx`
- Modify: `frontend/src/components/InterviewFollowUpDefensePanel.tsx`

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
git add frontend/src/utils/interviewFollowUpDefense.test.ts frontend/src/utils/interviewFollowUpDefense.ts frontend/src/components/InterviewFollowUpDefensePanel.test.tsx frontend/src/components/InterviewFollowUpDefensePanel.tsx
git diff --cached --check
git commit -m "功能：新增面试追问防线导出"
```

Expected: commit succeeds.
