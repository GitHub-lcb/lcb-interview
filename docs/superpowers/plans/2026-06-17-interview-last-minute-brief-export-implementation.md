# 最后 24 小时面试简报导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让最后 24 小时面试简报支持导出 Markdown，用户可以免费带走进场前一天的行动清单。

**Architecture:** 在 `interviewLastMinuteBrief.ts` 中新增 Markdown 构建函数，复用 `buildInterviewLastMinuteBrief`，不改信心评分和动作排序。`InterviewLastMinuteBriefPanel` 增加复制按钮，剪贴板不可用时下载 Markdown 文件。测试覆盖纯函数和组件复制交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-last-minute-brief-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-last-minute-brief-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-last-minute-brief-export-design.md docs/superpowers/plans/2026-06-17-interview-last-minute-brief-export-implementation.md
git diff --cached --check
git commit -m "文档：设计最后24小时简报导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewLastMinuteBrief.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildInterviewLastMinuteBrief, buildInterviewLastMinuteBriefMarkdown } from './interviewLastMinuteBrief'
```

- [ ] **Step 2: Add risk-brief Markdown test**

Add a test that builds risky progress and asserts:

- `# Java 后端 最后 24 小时面试简报`
- `生成时间：2026-06-17`
- `## 简报概览`
- `最后 24 小时先压临场风险`
- `## 进场动作`
- `1 道复习债面试前必须回看`
- `入口：/practice?queue=1`
- no `undefined`

- [ ] **Step 3: Add empty-brief Markdown test**

Add a test that exports empty progress and asserts:

- `先生成第一份进场简报`
- `先建立一题真实开口样本`
- `先做一题模拟`
- no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewLastMinuteBrief
```

Expected: FAIL because `buildInterviewLastMinuteBriefMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/interviewLastMinuteBrief.ts`

- [ ] **Step 1: Add exported builder**

Add `buildInterviewLastMinuteBriefMarkdown(progress, now)` and reuse `buildInterviewLastMinuteBrief(progress, now)`.

- [ ] **Step 2: Add render helpers**

Add helpers for overview, metrics, item list, item kind labels and date formatting. Empty brief still renders its sample action.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewLastMinuteBrief
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/InterviewLastMinuteBriefPanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制简报`, and assert copied Markdown contains `最后 24 小时面试简报`, target role and a risk action.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewLastMinuteBriefPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/InterviewLastMinuteBriefPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildInterviewLastMinuteBriefMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update action UI and CSS**

Add `复制简报` small button in the existing action area. Change `.interview-last-minute-brief-action span` to direct-child styling if needed so button internals keep Ant Design styles.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewLastMinuteBriefPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/interviewLastMinuteBrief.test.ts`
- Modify: `frontend/src/utils/interviewLastMinuteBrief.ts`
- Modify: `frontend/src/components/InterviewLastMinuteBriefPanel.test.tsx`
- Modify: `frontend/src/components/InterviewLastMinuteBriefPanel.tsx`
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
git add frontend/src/utils/interviewLastMinuteBrief.test.ts frontend/src/utils/interviewLastMinuteBrief.ts frontend/src/components/InterviewLastMinuteBriefPanel.test.tsx frontend/src/components/InterviewLastMinuteBriefPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增最后24小时简报导出"
```

Expected: commit succeeds.
