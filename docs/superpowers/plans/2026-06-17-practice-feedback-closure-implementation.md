# 面试后闭环教练 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在模拟面试评分后新增即时闭环教练，让用户知道下一步该重答、追问、标弱、掌握还是看答案。

**Architecture:** 新增一个纯前端工具函数从题目、答案和评分结果生成闭环动作；新增 React 面板消费该函数；Practice 页把动作映射到已有回调。无需后端和存储结构变更。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-practice-feedback-closure-design.md`
- Create: `docs/superpowers/plans/2026-06-17-practice-feedback-closure-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和计划，明确数据输入、动作策略、页面位置和测试范围。

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-practice-feedback-closure-design.md docs/superpowers/plans/2026-06-17-practice-feedback-closure-implementation.md
git commit -m "文档：设计面试后闭环教练"
```

### Task 2: 工具函数 TDD

**Files:**
- Create: `frontend/src/utils/practiceFeedbackClosure.test.ts`
- Create: `frontend/src/utils/practiceFeedbackClosure.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Write failing tests**

覆盖低分修复、可追问状态、高分掌握和短答案补场景。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- practiceFeedbackClosure
```

Expected: fail because `./practiceFeedbackClosure` cannot be resolved.

- [ ] **Step 3: Add types and implementation**

在 `types.ts` 新增 `PracticeFeedbackClosure` 相关类型，实现 `buildPracticeFeedbackClosure`。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- practiceFeedbackClosure
```

Expected: all tests pass.

### Task 3: 组件与 Practice 接入 TDD

**Files:**
- Create: `frontend/src/components/PracticeFeedbackClosurePanel.test.tsx`
- Create: `frontend/src/components/PracticeFeedbackClosurePanel.tsx`
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

测试面板展示标题、指标、动作按钮，并点击重答按钮触发回调。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- PracticeFeedbackClosurePanel
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement panel and wire Practice**

新增面板，接入评分区之后、追问面板之前，动作回调复用 Practice 现有函数。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- PracticeFeedbackClosurePanel
```

Expected: all tests pass.

### Task 4: 全量验证与提交

**Files:**
- All changed frontend/docs files.

- [ ] **Step 1: Run full verification**

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

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/types.ts frontend/src/utils/practiceFeedbackClosure.test.ts frontend/src/utils/practiceFeedbackClosure.ts frontend/src/components/PracticeFeedbackClosurePanel.test.tsx frontend/src/components/PracticeFeedbackClosurePanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增面试后闭环教练"
```

