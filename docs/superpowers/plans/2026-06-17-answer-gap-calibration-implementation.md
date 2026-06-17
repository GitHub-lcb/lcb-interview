# 答案差距校准 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在练习页新增用户回答与标准答案的差距校准，帮助用户把评分反馈沉淀成可复述答案。

**Architecture:** 新增 `answerGap` 纯函数分析本地题目详情和用户回答；新增 `AnswerGapPanel` 展示差距报告；`Practice` 页面只负责找到当前题目详情并渲染面板。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有题目详情数据。

---

### Task 1: 差距分析器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/answerGap.test.ts`
- Create: `frontend/src/utils/answerGap.ts`

- [ ] **Step 1: Write failing tests**

覆盖空回答、漏风险/项目模块、完整回答高分、Markdown 清理、空标准模块不扣分。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- answerGap`

Expected: FAIL because `./answerGap` does not exist.

- [ ] **Step 3: Implement analyzer**

新增 `AnswerGapModule`、`AnswerGapReport` 类型，实现 `buildAnswerGapReport(question, answer)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- answerGap`

Expected: PASS.

### Task 2: 练习页接入

**Files:**
- Create: `frontend/src/components/AnswerGapPanel.tsx`
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel**

展示差距总分、缺失模块和重写提纲。

- [ ] **Step 2: Insert into Practice**

在评分结果和追问加压训练后渲染 `<AnswerGapPanel question={currentQuestionDetail} answer={answerDraft} />`。

- [ ] **Step 3: Add CSS**

新增 `.answer-gap-panel`、`.answer-gap-grid`、`.answer-gap-module` 和移动端单列规则。

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
git add docs/superpowers/specs/2026-06-17-answer-gap-calibration-design.md docs/superpowers/plans/2026-06-17-answer-gap-calibration-implementation.md frontend/src/types.ts frontend/src/utils/answerGap.test.ts frontend/src/utils/answerGap.ts frontend/src/components/AnswerGapPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增答案差距校准"
```

