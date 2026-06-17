# 单题评分闭环导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让练习页单题评分闭环支持导出 Markdown，用户可以免费保存本题得分证据、下一步动作和重答 Prompt。

**Architecture:** 在 `practiceFeedbackClosure.ts` 中新增 Markdown 构建函数，复用 `buildPracticeFeedbackClosure`。在 `PracticeFeedbackClosurePanel` 增加复制按钮和降级下载。新增组件测试覆盖剪贴板交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有模拟面试评分闭环算法。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-practice-feedback-closure-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-practice-feedback-closure-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-practice-feedback-closure-export-design.md docs/superpowers/plans/2026-06-17-practice-feedback-closure-export-implementation.md
git diff --cached --check
git commit -m "文档：设计单题评分闭环导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/practiceFeedbackClosure.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildPracticeFeedbackClosure, buildPracticeFeedbackClosureMarkdown } from './practiceFeedbackClosure'
```

- [ ] **Step 2: Add low-score Markdown test**

Add a test that exports a low-score answer and asserts:

- title contains `单题评分闭环`
- generated date is stable
- summary contains `先修复最低分维度`
- criteria contain `结构化`
- actions contain `重答结构化` and `标记薄弱`
- markdown contains `## 原始回答`
- markdown does not contain `undefined`

- [ ] **Step 3: Add short-answer Markdown test**

Add a test that exports a short answer and asserts:

- action contains `补场景后重答`
- prompt contains `项目场景`
- markdown stays actionable and has no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- practiceFeedbackClosure
```

Expected: FAIL because `buildPracticeFeedbackClosureMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/practiceFeedbackClosure.ts`

- [ ] **Step 1: Add exported builder**

Add `buildPracticeFeedbackClosureMarkdown(question, answer, feedback, now)` and reuse `buildPracticeFeedbackClosure`.

- [ ] **Step 2: Add render helpers**

Add helpers for summary, criteria, metrics, actions and original answer. Empty answer renders `暂无回答`。

- [ ] **Step 3: Add date helper**

Use the same ISO-date fallback style as existing export helpers.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- practiceFeedbackClosure
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/PracticeFeedbackClosurePanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制闭环`, and assert copied Markdown contains `单题评分闭环`、question title and `重答结构化`.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- PracticeFeedbackClosurePanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/PracticeFeedbackClosurePanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildPracticeFeedbackClosureMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update header UI**

Add `复制闭环` small button next to the primary action chip without changing the main panel hierarchy.

- [ ] **Step 4: Add CSS**

Add `.practice-feedback-closure-head-actions` to keep chip and button compact and right-aligned.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- PracticeFeedbackClosurePanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/practiceFeedbackClosure.test.ts`
- Modify: `frontend/src/utils/practiceFeedbackClosure.ts`
- Modify: `frontend/src/components/PracticeFeedbackClosurePanel.test.tsx`
- Modify: `frontend/src/components/PracticeFeedbackClosurePanel.tsx`
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
git add frontend/src/utils/practiceFeedbackClosure.test.ts frontend/src/utils/practiceFeedbackClosure.ts frontend/src/components/PracticeFeedbackClosurePanel.test.tsx frontend/src/components/PracticeFeedbackClosurePanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增单题评分闭环导出"
```

Expected: commit succeeds.
