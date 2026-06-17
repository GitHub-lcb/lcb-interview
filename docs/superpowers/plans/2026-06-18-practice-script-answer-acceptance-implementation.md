# 模拟面试脚本追问回答验收 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/practice` 回答框下方新增追问回答验收，让用户从本题面试官脚本带入追问后，能实时知道这段追问回答是否可提交评分。

**Architecture:** 新增 `frontend/src/utils/practiceScriptAnswerAcceptance.ts` 纯函数，复用 `buildPracticeInterviewerScript` 生成当前脚本并匹配回答草稿中的追问。新增 `PracticeScriptAnswerAcceptancePanel` 展示分数、状态、下一步动作和四个验收项。`Practice` 页面传入当前题、历史 attempts 和 answerDraft。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-script-answer-acceptance-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-script-answer-acceptance-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-script-answer-acceptance-design.md docs/superpowers/plans/2026-06-18-practice-script-answer-acceptance-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试脚本追问回答验收"
```

### Task 2: TDD 纯函数

**Files:**
- Create: `frontend/src/utils/practiceScriptAnswerAcceptance.test.ts`
- Create: `frontend/src/utils/practiceScriptAnswerAcceptance.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下行为：

```ts
expect(analyzePracticeScriptAnswerAcceptance(question(), [], '普通回答').level).toBe('idle')
expect(analyzePracticeScriptAnswerAcceptance(question(), [], `追问：${prompt}\n\n我的回答：`).level).toBe('empty')
expect(analyzePracticeScriptAnswerAcceptance(question(), attempts, completeAnswer).level).toBe('passed')
expect(analyzePracticeScriptAnswerAcceptance(question(), attempts, partialAnswer).nextAction).toContain('补项目动作')
expect(JSON.stringify(result)).not.toContain('undefined')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceScriptAnswerAcceptance
```

Expected: FAIL because `practiceScriptAnswerAcceptance` module does not exist.

- [ ] **Step 3: 实现纯函数**

导出：

```ts
export type PracticeScriptAnswerAcceptanceLevel = 'idle' | 'empty' | 'draft' | 'ready' | 'passed'
export type PracticeScriptAnswerAcceptanceItemKey = 'direct' | 'evidence' | 'pressure' | 'criterion'

export interface PracticeScriptAnswerAcceptanceItem {
  key: PracticeScriptAnswerAcceptanceItemKey
  label: string
  covered: boolean
  evidence: string
  guidance: string
}

export interface PracticeScriptAnswerAcceptance {
  score: number
  level: PracticeScriptAnswerAcceptanceLevel
  title: string
  summary: string
  nextAction: string
  matchedPrompt?: string
  criterionLabel?: string
  items: PracticeScriptAnswerAcceptanceItem[]
}
```

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceScriptAnswerAcceptance
```

Expected: PASS.

### Task 3: TDD 面板

**Files:**
- Create: `frontend/src/components/PracticeScriptAnswerAcceptancePanel.test.tsx`
- Create: `frontend/src/components/PracticeScriptAnswerAcceptancePanel.tsx`

- [ ] **Step 1: 写失败测试**

测试内容：

```tsx
render(<PracticeScriptAnswerAcceptancePanel question={question()} attempts={[]} answer="普通回答" />)
expect(screen.getByLabelText('追问回答验收')).toBeInTheDocument()
expect(screen.getByText('先从本题面试官脚本选择追问')).toBeInTheDocument()

render(<PracticeScriptAnswerAcceptancePanel question={question()} attempts={attempts} answer={completeAnswer} />)
expect(screen.getByText('100')).toBeInTheDocument()
expect(screen.getByText('可以提交评分')).toBeInTheDocument()
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeScriptAnswerAcceptancePanel
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: 实现面板**

使用 `Progress`、`CheckCircleOutlined`、`ExclamationCircleOutlined`，沿用回答检查面板布局展示分数、标题、总结、下一步动作和四个验收项。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeScriptAnswerAcceptancePanel
```

Expected: PASS.

### Task 4: Practice 接入

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 页面接入**

导入组件：

```ts
import PracticeScriptAnswerAcceptancePanel from '../../components/PracticeScriptAnswerAcceptancePanel'
```

在 `PracticeAnswerReadinessPanel` 后插入：

```tsx
<PracticeScriptAnswerAcceptancePanel
  question={current}
  attempts={currentAttempts}
  answer={answerDraft}
/>
```

- [ ] **Step 2: 补样式**

新增 `.practice-script-answer-acceptance-panel`、`.practice-script-answer-acceptance-score`、`.practice-script-answer-acceptance-main`、`.practice-script-answer-acceptance-items`，移动端复用回答检查面板单列布局。

- [ ] **Step 3: 定向测试**

```bash
cd frontend
npm run test -- practiceScriptAnswerAcceptance PracticeScriptAnswerAcceptancePanel
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
git add frontend/src/utils/practiceScriptAnswerAcceptance.test.ts frontend/src/utils/practiceScriptAnswerAcceptance.ts frontend/src/components/PracticeScriptAnswerAcceptancePanel.test.tsx frontend/src/components/PracticeScriptAnswerAcceptancePanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试脚本追问回答验收"
```
