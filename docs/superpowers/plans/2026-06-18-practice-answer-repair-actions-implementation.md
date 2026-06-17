# 模拟面试回答结构缺口一键修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/practice` 的实时结构检查能把当前最优先缺口转成一键重答模板，用户点击后直接回到回答框修正表达。

**Architecture:** 新增 `frontend/src/utils/practiceAnswerRepairAction.ts` 纯函数，根据当前题、回答和 `analyzePracticeAnswerReadiness` 结果生成修复动作。扩展 `PracticeAnswerReadinessPanel` 支持 `onUseRepairTemplate` 回调和主按钮。`Practice` 页面只负责把模板写入 `answerDraft` 并清空旧评分。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-answer-repair-actions-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-answer-repair-actions-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-answer-repair-actions-design.md docs/superpowers/plans/2026-06-18-practice-answer-repair-actions-implementation.md
```

- [ ] **Step 2: 检查缓存区空白问题**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试回答结构缺口修复"
```

### Task 2: TDD 纯函数修复动作

**Files:**
- Create: `frontend/src/utils/practiceAnswerRepairAction.test.ts`
- Create: `frontend/src/utils/practiceAnswerRepairAction.ts`

- [ ] **Step 1: 写失败测试**

测试内容：
- 缺场景回答生成 `scenario` 动作和“补项目场景”按钮文案。
- 空回答生成 `conclusion` 动作。
- 完整回答生成 `compress` 动作。
- 模板保留原回答，不出现 `undefined`。

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceAnswerRepairAction
```

Expected: FAIL because `practiceAnswerRepairAction` module does not exist.

- [ ] **Step 3: 实现最小纯函数**

实现：
- `buildPracticeAnswerRepairAction(question, answer)`
- `buildRepairTemplate(question, answer, actionKey)`
- `sanitizeText(value, fallback)`

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceAnswerRepairAction
```

Expected: PASS.

### Task 3: TDD 面板交互

**Files:**
- Modify: `frontend/src/components/PracticeAnswerReadinessPanel.test.tsx`
- Modify: `frontend/src/components/PracticeAnswerReadinessPanel.tsx`

- [ ] **Step 1: 写失败测试**

在现有测试中新增：
- 缺场景回答渲染“补项目场景”按钮。
- 点击按钮后 `onUseRepairTemplate` 收到包含原回答和题目标题的模板。

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeAnswerReadinessPanel
```

Expected: FAIL because component does not expose repair action button.

- [ ] **Step 3: 实现面板按钮**

实现：
- 引入 `Button` 和 `ToolOutlined`。
- 调用 `buildPracticeAnswerRepairAction(question, answer)`。
- 如果传入 `onUseRepairTemplate`，展示主按钮。
- 点击后调用 `onUseRepairTemplate(action.template)`。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeAnswerReadinessPanel
```

Expected: PASS.

### Task 4: Practice 页面接入

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 接入回调**

在 `Practice` 中新增：

```ts
const useRepairTemplate = (template: string) => {
  setAnswerDraft(template)
  setFeedback(null)
}
```

传给：

```tsx
<PracticeAnswerReadinessPanel
  question={current}
  answer={answerDraft}
  onUseRepairTemplate={useRepairTemplate}
/>
```

- [ ] **Step 2: 补样式**

为 `.practice-answer-readiness-action` 增加右对齐、移动端满宽样式。

- [ ] **Step 3: 定向测试**

```bash
cd frontend
npm run test -- practiceAnswerRepairAction PracticeAnswerReadinessPanel
```

Expected: PASS.

### Task 5: 全量验证和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 全量前端测试**

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
git add frontend/src/utils/practiceAnswerRepairAction.test.ts frontend/src/utils/practiceAnswerRepairAction.ts frontend/src/components/PracticeAnswerReadinessPanel.test.tsx frontend/src/components/PracticeAnswerReadinessPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试回答结构缺口修复"
```
