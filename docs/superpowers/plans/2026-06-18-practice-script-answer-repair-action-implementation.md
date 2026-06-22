# 模拟面试脚本追问回答修复动作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/practice` 的追问回答验收补上一键修复模板，让用户看到缺口后能直接生成可编辑补答草稿。

**Architecture:** 新增 `frontend/src/utils/practiceScriptAnswerRepairAction.ts` 纯函数，读取 `analyzePracticeScriptAnswerAcceptance` 的结果并生成最优先修复动作。扩展 `PracticeScriptAnswerAcceptancePanel` 增加可选 `onUseRepairTemplate` 回调和按钮。`Practice` 页面复用现有 `useRepairTemplate` 把模板写回回答框。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-script-answer-repair-action-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-script-answer-repair-action-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-script-answer-repair-action-design.md docs/superpowers/plans/2026-06-18-practice-script-answer-repair-action-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试脚本追问回答修复动作"
```

### Task 2: TDD 纯函数

**Files:**
- Create: `frontend/src/utils/practiceScriptAnswerRepairAction.test.ts`
- Create: `frontend/src/utils/practiceScriptAnswerRepairAction.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下行为：

```ts
expect(buildPracticeScriptAnswerRepairAction(question(), [], '普通回答').key).toBe('insert-prompt')
expect(buildPracticeScriptAnswerRepairAction(question(), [], partialAnswer).key).toBe('evidence')
expect(buildPracticeScriptAnswerRepairAction(question(), attempts, pressureMissingAnswer).key).toBe('pressure')
expect(buildPracticeScriptAnswerRepairAction(question(), attempts, passedAnswer).key).toBe('compress')
expect(JSON.stringify(action)).not.toContain('undefined')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceScriptAnswerRepairAction
```

Expected: FAIL because `practiceScriptAnswerRepairAction` module does not exist.

- [ ] **Step 3: 实现纯函数**

导出：

```ts
export type PracticeScriptAnswerRepairActionKey =
  | PracticeScriptAnswerAcceptanceItemKey
  | 'insert-prompt'
  | 'compress'

export interface PracticeScriptAnswerRepairAction {
  key: PracticeScriptAnswerRepairActionKey
  label: string
  description: string
  template: string
}
```

模板应保留 `追问：...` 和 `我的回答：` 结构。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceScriptAnswerRepairAction
```

Expected: PASS.

### Task 3: TDD 面板按钮

**Files:**
- Modify: `frontend/src/components/PracticeScriptAnswerAcceptancePanel.test.tsx`
- Modify: `frontend/src/components/PracticeScriptAnswerAcceptancePanel.tsx`

- [ ] **Step 1: 写失败测试**

新增测试：

```tsx
const onUseRepairTemplate = vi.fn()
render(<PracticeScriptAnswerAcceptancePanel question={question()} attempts={[]} answer={partialAnswer} onUseRepairTemplate={onUseRepairTemplate} />)
await userEvent.click(screen.getByRole('button', { name: /补项目证据/ }))
expect(onUseRepairTemplate.mock.calls[0][0]).toContain('追问：')
expect(onUseRepairTemplate.mock.calls[0][0]).toContain('项目证据')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeScriptAnswerAcceptancePanel
```

Expected: FAIL because the panel does not expose repair button yet.

- [ ] **Step 3: 实现按钮**

导入 `ToolOutlined`、`Button` 和 `buildPracticeScriptAnswerRepairAction`，新增可选 prop：

```ts
onUseRepairTemplate?: (template: string) => void
```

在下一步动作旁渲染小按钮，点击后回调 `repairAction.template`。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeScriptAnswerAcceptancePanel
```

Expected: PASS.

### Task 4: Practice 接入和样式

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 页面传入回调**

```tsx
<PracticeScriptAnswerAcceptancePanel
  question={current}
  attempts={currentAttempts}
  answer={answerDraft}
  onUseRepairTemplate={useRepairTemplate}
/>
```

- [ ] **Step 2: 补按钮布局样式**

新增 `.practice-script-answer-acceptance-next-row`，保持按钮和下一步动作在紧凑空间内可换行。

- [ ] **Step 3: 定向测试**

```bash
cd frontend
npm run test -- practiceScriptAnswerRepairAction PracticeScriptAnswerAcceptancePanel
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
git add frontend/src/utils/practiceScriptAnswerRepairAction.test.ts frontend/src/utils/practiceScriptAnswerRepairAction.ts frontend/src/components/PracticeScriptAnswerAcceptancePanel.test.tsx frontend/src/components/PracticeScriptAnswerAcceptancePanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试脚本追问回答修复动作"
```
