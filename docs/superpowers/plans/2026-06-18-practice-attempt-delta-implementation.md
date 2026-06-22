# 模拟面试本题重答验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/practice` 为当前题展示最近两次模拟面试评分对比，让用户确认重答是否真的提升，并一键带入下一次重答提示。

**Architecture:** 新增 `frontend/src/utils/practiceAttemptDelta.ts` 纯函数，接收当前题和本题 `InterviewAttempt[]`，生成趋势、总分差、维度差和主动作。新增 `PracticeAttemptDeltaPanel` 展示结果并把主动作 prompt 回传给 `Practice`。`Practice` 页面只负责传入当前题的本地 attempts 并写回回答框。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-attempt-delta-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-attempt-delta-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-attempt-delta-design.md docs/superpowers/plans/2026-06-18-practice-attempt-delta-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试本题重答验收"
```

### Task 2: TDD 纯函数

**Files:**
- Create: `frontend/src/utils/practiceAttemptDelta.test.ts`
- Create: `frontend/src/utils/practiceAttemptDelta.ts`

- [ ] **Step 1: 写失败测试**

覆盖：
- 空记录
- 单次记录
- 分数提升
- 分数回落
- 不输出 `undefined`

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceAttemptDelta
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: 实现纯函数**

实现：
- `buildPracticeAttemptDelta(question, attempts)`
- `buildCriterionDeltas(latest, previous)`
- `resolveLevel(scoreDelta, attempts)`
- `buildPrimaryAction(question, result)`

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceAttemptDelta
```

Expected: PASS.

### Task 3: TDD 面板

**Files:**
- Create: `frontend/src/components/PracticeAttemptDeltaPanel.test.tsx`
- Create: `frontend/src/components/PracticeAttemptDeltaPanel.tsx`

- [ ] **Step 1: 写失败测试**

覆盖：
- 两次记录时渲染“本题重答验收”、趋势和分差。
- 点击主按钮后回调收到重答 prompt。

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeAttemptDeltaPanel
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: 实现面板**

使用 `Button`、`Progress`、`RiseOutlined`、`FallOutlined`，展示趋势、分差、维度条目和主按钮。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeAttemptDeltaPanel
```

Expected: PASS.

### Task 4: Practice 接入

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 页面接入**

在 `Practice` 中新增：

```ts
const currentAttempts = current ? progress.interviewAttempts[current.id] ?? [] : []
const startAttemptDeltaPrompt = (prompt: string) => {
  setAnswerDraft(prompt)
  setFeedback(null)
}
```

侧栏中插入：

```tsx
<PracticeAttemptDeltaPanel
  question={current}
  attempts={currentAttempts}
  onUsePrompt={startAttemptDeltaPrompt}
/>
```

- [ ] **Step 2: 补样式**

新增 `.practice-attempt-delta-panel`、`.practice-attempt-delta-metrics`、`.practice-attempt-delta-criteria` 等样式。

- [ ] **Step 3: 定向测试**

```bash
cd frontend
npm run test -- practiceAttemptDelta PracticeAttemptDeltaPanel
```

Expected: PASS.

### Task 5: 全量验证和提交

- [ ] **Step 1: 前端测试**

```bash
cd frontend
npm run test
```

Expected: all tests pass.

- [ ] **Step 2: 前端构建**

```bash
cd frontend
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: 后端测试**

```bash
cd backend
mvn test
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: 空白检查**

```bash
git diff --check
```

Expected: no output except possible Windows LF/CRLF warnings.

- [ ] **Step 5: 中文提交功能**

```bash
git add frontend/src/utils/practiceAttemptDelta.test.ts frontend/src/utils/practiceAttemptDelta.ts frontend/src/components/PracticeAttemptDeltaPanel.test.tsx frontend/src/components/PracticeAttemptDeltaPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试本题重答验收"
```
