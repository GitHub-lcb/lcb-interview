# 面试前冲刺简报导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown export and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让面试前冲刺简报支持导出 Markdown，用户可以免费保存每天的优势、风险和热身题清单。

**Architecture:** 在 `interviewBrief.ts` 中新增 Markdown 构建函数，复用 `buildInterviewBrief`，不改风险和热身算法。`InterviewBriefPanel` 增加复制按钮，剪贴板不可用时下载 Markdown 文件。测试覆盖纯函数结构和组件复制交互。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有学习路线和本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-brief-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-brief-export-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确 Markdown 字段、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify and commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-brief-export-design.md docs/superpowers/plans/2026-06-17-interview-brief-export-implementation.md
git diff --cached --check
git commit -m "文档：设计面试冲刺简报导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewBrief.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildInterviewBrief, buildInterviewBriefMarkdown } from './interviewBrief'
```

- [ ] **Step 2: Add risk-brief Markdown test**

Build progress with one overdue weak question and one mastered question, then assert:

- `# Java 后端工程师 面试前冲刺简报`
- `生成时间：2026-06-17`
- `## 简报概览`
- `面试前先控风险`
- `## 可主动表达`
- `## 必须规避`
- `## 开口热身`
- `复习逾期会拖累临场稳定性`
- `入口：/study`
- no `undefined`

- [ ] **Step 3: Add empty Markdown test**

Export empty progress and assert:

- `面试简报待生成`
- `还没有学习轨迹`
- `进入题库`
- no `undefined`

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewBrief
```

Expected: FAIL because `buildInterviewBriefMarkdown` does not exist.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/interviewBrief.ts`

- [ ] **Step 1: Add exported builder**

Add `buildInterviewBriefMarkdown(routes, progress, now)` and reuse `buildInterviewBrief(routes, progress, now)`.

- [ ] **Step 2: Add render helpers**

Add helpers for overview, section item rendering and date formatting. Empty sections render a stable placeholder.

- [ ] **Step 3: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewBrief
```

Expected: PASS.

### Task 4: TDD 添加面板复制测试

**Files:**
- Modify: `frontend/src/components/InterviewBriefPanel.test.tsx`

- [ ] **Step 1: Add component test**

Stub `navigator.clipboard.writeText`, click `复制简报`, and assert copied Markdown contains target role and the brief title.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewBriefPanel
```

Expected: FAIL because the copy button does not exist.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/InterviewBriefPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add `CopyOutlined`, `message`, and `buildInterviewBriefMarkdown`.

- [ ] **Step 2: Add copy handler**

Use clipboard-first, download-fallback behavior consistent with other Markdown export buttons.

- [ ] **Step 3: Update header UI and CSS**

Add a head action container with `复制简报` and the existing primary button.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewBriefPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/interviewBrief.test.ts`
- Modify: `frontend/src/utils/interviewBrief.ts`
- Modify: `frontend/src/components/InterviewBriefPanel.test.tsx`
- Modify: `frontend/src/components/InterviewBriefPanel.tsx`
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
git add frontend/src/utils/interviewBrief.test.ts frontend/src/utils/interviewBrief.ts frontend/src/components/InterviewBriefPanel.test.tsx frontend/src/components/InterviewBriefPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增面试冲刺简报导出"
```

Expected: commit succeeds.
