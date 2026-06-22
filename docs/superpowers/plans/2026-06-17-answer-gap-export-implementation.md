# 答案差距校准导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让练习页答案差距校准支持导出 Markdown，用户可以免费保存单题回答缺口和重写提纲。

**Architecture:** 在 `answerGap.ts` 中新增 Markdown 构建函数，复用 `buildAnswerGapReport`。在 `AnswerGapPanel` 增加复制按钮和降级下载。新增组件测试覆盖剪贴板交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有答案差距算法。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-answer-gap-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-answer-gap-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-answer-gap-export-design.md docs/superpowers/plans/2026-06-17-answer-gap-export-implementation.md
git diff --cached --check
git commit -m "文档：设计答案差距校准导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/answerGap.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildAnswerGapMarkdown, buildAnswerGapReport } from './answerGap'
```

- [ ] **Step 2: Add shallow-answer Markdown test**

Add:

```ts
it('exports answer gap calibration as portable markdown', () => {
  const markdown = buildAnswerGapMarkdown(
    question(),
    'HashMap 多线程不安全，因为 put 和 resize 没有同步保护，可以用 ConcurrentHashMap。',
    '2026-06-17T00:00:00.000Z',
  )

  expect(markdown).toContain('# HashMap 为什么线程不安全？ 答案差距校准')
  expect(markdown).toContain('生成时间：2026-06-17')
  expect(markdown).toContain('## 校准摘要')
  expect(markdown).toContain('风险误区')
  expect(markdown).toContain('项目落地')
  expect(markdown).toContain('## 模块明细')
  expect(markdown).toContain('## 重写提纲')
})
```

- [ ] **Step 3: Add empty-answer Markdown test**

Add:

```ts
it('keeps blank answer markdown actionable', () => {
  const markdown = buildAnswerGapMarkdown(question(), ' ', '2026-06-17T00:00:00.000Z')

  expect(markdown).toContain('分数：0')
  expect(markdown).toContain('先完成基础回答')
  expect(markdown).toContain('回答为空')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- answerGap
```

Expected: FAIL because `buildAnswerGapMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/answerGap.ts`

- [ ] **Step 1: Add exported builder**

Add:

```ts
export function buildAnswerGapMarkdown(
  question: Question,
  rawAnswer: string,
  now = new Date().toISOString(),
): string {
  const report = buildAnswerGapReport(question, rawAnswer)
  return [
    `# ${question.title} 答案差距校准`,
    '',
    `生成时间：${formatDate(now)}`,
    `分类：${question.categoryName}`,
    `难度：${question.difficulty}`,
    '',
    renderSummary(report),
    renderModules(report.modules),
    renderPriorityModules(report.missingModules),
    renderRewriteOutline(report.rewriteOutline),
  ].join('\n')
}
```

- [ ] **Step 2: Add render helpers**

Add helpers for summary, modules, priority modules and outline. Ensure empty priority modules render `- 暂无缺失模块，继续压缩表达并补项目例子。`.

- [ ] **Step 3: Add date helper**

Add:

```ts
function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- answerGap
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Create: `frontend/src/components/AnswerGapPanel.test.tsx`

- [ ] **Step 1: Create component test**

Create a test that renders `AnswerGapPanel`, stubs `navigator.clipboard.writeText`, clicks `复制校准`, and asserts copied Markdown contains `答案差距校准` and the question title.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- AnswerGapPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/AnswerGapPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `Button`, `message`, `CopyOutlined`, and `buildAnswerGapMarkdown`.

- [ ] **Step 2: Add copy handler**

Use the same clipboard-first, download-fallback behavior as other Markdown export buttons.

- [ ] **Step 3: Update header UI**

Add `复制校准` small button next to the score chip without changing the main panel hierarchy.

- [ ] **Step 4: Add CSS**

Add `.answer-gap-head-actions` to stack score and button in a compact right-aligned group.

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- AnswerGapPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/answerGap.test.ts`
- Modify: `frontend/src/utils/answerGap.ts`
- Create: `frontend/src/components/AnswerGapPanel.test.tsx`
- Modify: `frontend/src/components/AnswerGapPanel.tsx`
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
git add frontend/src/utils/answerGap.test.ts frontend/src/utils/answerGap.ts frontend/src/components/AnswerGapPanel.test.tsx frontend/src/components/AnswerGapPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增答案差距校准导出"
```

Expected: commit succeeds.
