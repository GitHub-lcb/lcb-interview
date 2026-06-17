# 面试前急救包导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让面试前急救包支持导出 Markdown，用户可以免费保存最后 30 分钟的急救行动清单。

**Architecture:** 在 `interviewEmergencyKit.ts` 中新增 Markdown 构建函数，复用 `buildInterviewEmergencyKit`，不改急救包排序算法。`InterviewEmergencyKitPanel` 增加复制按钮，剪贴板不可用时下载 Markdown 文件。测试覆盖纯函数结构和组件复制交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-emergency-kit-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-emergency-kit-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-emergency-kit-export-design.md docs/superpowers/plans/2026-06-17-interview-emergency-kit-export-implementation.md
git diff --cached --check
git commit -m "文档：设计面试急救包导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewEmergencyKit.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildInterviewEmergencyKit, buildInterviewEmergencyKitMarkdown } from './interviewEmergencyKit'
```

- [ ] **Step 2: Add critical-kit Markdown test**

Add:

```ts
it('exports critical emergency kit as portable markdown', () => {
  const progress = emptyProgress()
  addQuestion(progress, 1, 'weak', '2026-06-13T00:00:00.000Z')
  addQuestion(progress, 2, 'learning', NOW)
  progress.dailyPlan = [1, 2]
  progress.interviewAttempts[2] = [attempt(2, { specificity: 40 })]

  const markdown = buildInterviewEmergencyKitMarkdown(progress, NOW)

  expect(markdown).toContain('# Java 后端 面试前急救包')
  expect(markdown).toContain('生成时间：2026-06-17')
  expect(markdown).toContain('## 急救概览')
  expect(markdown).toContain('面试前先压最高风险')
  expect(markdown).toContain('预计耗时')
  expect(markdown).toContain('1 道复习债先清掉')
  expect(markdown).toContain('入口：/practice?queue=1')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 3: Add empty-kit Markdown test**

Add:

```ts
it('keeps empty emergency kit export actionable', () => {
  const markdown = buildInterviewEmergencyKitMarkdown(emptyProgress(), NOW)

  expect(markdown).toContain('先建立临场样本')
  expect(markdown).toContain('先建立一次模拟面试样本')
  expect(markdown).toContain('开始模拟面试')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewEmergencyKit
```

Expected: FAIL because `buildInterviewEmergencyKitMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/interviewEmergencyKit.ts`

- [ ] **Step 1: Add exported builder**

Add `buildInterviewEmergencyKitMarkdown(progress, now)` and reuse `buildInterviewEmergencyKit(progress, now)`.

- [ ] **Step 2: Add render helpers**

Add helpers for overview, metrics, item list, item kind labels and date formatting. Empty kit still renders its fallback action.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewEmergencyKit
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/InterviewEmergencyKitPanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制急救包`, and assert copied Markdown contains `面试前急救包`, target role and a risk action.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewEmergencyKitPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/InterviewEmergencyKitPanel.tsx`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildInterviewEmergencyKitMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update action UI**

Add `复制急救包` small button in the existing action area without changing the panel hierarchy.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewEmergencyKitPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/interviewEmergencyKit.test.ts`
- Modify: `frontend/src/utils/interviewEmergencyKit.ts`
- Modify: `frontend/src/components/InterviewEmergencyKitPanel.test.tsx`
- Modify: `frontend/src/components/InterviewEmergencyKitPanel.tsx`

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
git add frontend/src/utils/interviewEmergencyKit.test.ts frontend/src/utils/interviewEmergencyKit.ts frontend/src/components/InterviewEmergencyKitPanel.test.tsx frontend/src/components/InterviewEmergencyKitPanel.tsx
git diff --cached --check
git commit -m "功能：新增面试急救包导出"
```

Expected: commit succeeds.
