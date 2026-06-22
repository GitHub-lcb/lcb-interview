# 高分表达素材库导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让高分表达素材库支持导出 Markdown，用户可以免费保存高分话术、项目场景和风险边界素材。

**Architecture:** 在 `interviewMaterialVault.ts` 中新增 Markdown 构建函数，复用 `buildInterviewMaterialVault`。在 `InterviewMaterialVaultPanel` 增加复制按钮和降级下载。新增组件测试覆盖剪贴板交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-material-vault-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-material-vault-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-material-vault-export-design.md docs/superpowers/plans/2026-06-17-interview-material-vault-export-implementation.md
git diff --cached --check
git commit -m "文档：设计高分表达素材库导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewMaterialVault.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildInterviewMaterialVault, buildInterviewMaterialVaultMarkdown } from './interviewMaterialVault'
```

- [ ] **Step 2: Add ready-vault Markdown test**

Add a test that exports a ready vault and asserts:

- title contains `高分表达素材库`
- generated date is stable
- metrics contain `高分样本`
- snippets contain material title and `项目场景`
- next action contains `/study`
- markdown does not contain `undefined`

- [ ] **Step 3: Add empty-vault Markdown test**

Add a test that exports an empty vault and asserts:

- `高分表达素材待沉淀`
- `暂无高分素材`
- `先做一题模拟`
- no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewMaterialVault
```

Expected: FAIL because `buildInterviewMaterialVaultMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/interviewMaterialVault.ts`

- [ ] **Step 1: Add exported builder**

Add `buildInterviewMaterialVaultMarkdown(progress, now)` and reuse `buildInterviewMaterialVault(progress)`。

- [ ] **Step 2: Add render helpers**

Add helpers for overview, metrics, snippets and date formatting. Empty snippets render a clear next action.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewMaterialVault
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/InterviewMaterialVaultPanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制素材`, and assert copied Markdown contains `高分表达素材库`、target role and a material title.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewMaterialVaultPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/InterviewMaterialVaultPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildInterviewMaterialVaultMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update header UI**

Add `复制素材` small button in the existing action area without changing the main panel hierarchy.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewMaterialVaultPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/interviewMaterialVault.test.ts`
- Modify: `frontend/src/utils/interviewMaterialVault.ts`
- Modify: `frontend/src/components/InterviewMaterialVaultPanel.test.tsx`
- Modify: `frontend/src/components/InterviewMaterialVaultPanel.tsx`
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
git add frontend/src/utils/interviewMaterialVault.test.ts frontend/src/utils/interviewMaterialVault.ts frontend/src/components/InterviewMaterialVaultPanel.test.tsx frontend/src/components/InterviewMaterialVaultPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增高分表达素材库导出"
```

Expected: commit succeeds.
