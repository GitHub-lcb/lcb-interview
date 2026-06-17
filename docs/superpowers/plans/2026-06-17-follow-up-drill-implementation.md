# 追问加压训练 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在练习页新增本地追问加压训练，让评分结果可以直接进入下一轮追问作答。

**Architecture:** 新增 `followUpDrill` 纯函数生成追问训练包；新增 `FollowUpDrillPanel` 负责展示和选择追问；`Practice` 页面只维护回答框状态和选择回调。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有面试评分反馈结构。

---

### Task 1: 追问包生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/followUpDrill.test.ts`
- Create: `frontend/src/utils/followUpDrill.ts`

- [ ] **Step 1: Write failing tests**

覆盖低分维度优先、空追问兜底、HashMap 技术域追问、强答案进阶追问和去重限制。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- followUpDrill`

Expected: FAIL because `./followUpDrill` does not exist.

- [ ] **Step 3: Implement generator**

新增 `FollowUpDrillItem`、`FollowUpDrillPack` 类型，实现 `buildFollowUpDrillPack(question, answer, feedback)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- followUpDrill`

Expected: PASS.

### Task 2: 练习页接入

**Files:**
- Create: `frontend/src/components/FollowUpDrillPanel.tsx`
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Create panel**

展示追问卡片，点击“带入回答框”调用 `onPickPrompt(prompt)`。

- [ ] **Step 2: Insert into Practice feedback**

在评分结果面板后渲染 `<FollowUpDrillPanel question={current} answer={answerDraft} feedback={feedback} onPickPrompt={...} />`。

- [ ] **Step 3: Add CSS**

新增 `.follow-up-drill-panel`、`.follow-up-drill-grid`、`.follow-up-drill-card` 和移动端单列规则。

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
git add docs/superpowers/specs/2026-06-17-follow-up-drill-design.md docs/superpowers/plans/2026-06-17-follow-up-drill-implementation.md frontend/src/types.ts frontend/src/utils/followUpDrill.test.ts frontend/src/utils/followUpDrill.ts frontend/src/components/FollowUpDrillPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增追问加压训练"
```

