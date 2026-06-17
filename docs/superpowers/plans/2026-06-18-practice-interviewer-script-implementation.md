# 模拟面试本题面试官脚本 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/practice` 侧栏为当前题生成连续三步面试官追问脚本，让用户基于最近评分直接进入免费加压模拟。

**Architecture:** 新增 `frontend/src/utils/practiceInterviewerScript.ts` 纯函数，根据当前题、最近两次 `InterviewAttempt[]` 和评分维度生成脚本状态、总时长和步骤。新增 `PracticeInterviewerScriptPanel` 负责展示脚本并把单步追问 prompt 回传给 Practice 页面。`Practice` 只传入当前题 attempts 并把 prompt 写入回答框。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-interviewer-script-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-interviewer-script-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-interviewer-script-design.md docs/superpowers/plans/2026-06-18-practice-interviewer-script-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试本题面试官脚本"
```

### Task 2: TDD 纯函数

**Files:**
- Create: `frontend/src/utils/practiceInterviewerScript.test.ts`
- Create: `frontend/src/utils/practiceInterviewerScript.ts`

- [ ] **Step 1: 写失败测试**

测试内容：

```ts
expect(buildPracticeInterviewerScript(question(), []).level).toBe('warmup')
expect(buildPracticeInterviewerScript(question(), [attempt(52, { specificity: 35 })]).steps[0].criterionKey).toBe('specificity')
expect(buildPracticeInterviewerScript(question(), [attempt(86, {})]).level).toBe('advanced')
expect(buildPracticeInterviewerScript(question(), [
  attempt(58, { specificity: 38 }, '2026-06-18T08:00:00.000Z'),
  attempt(70, { specificity: 72 }, '2026-06-18T07:00:00.000Z'),
]).level).toBe('regression')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceInterviewerScript
```

Expected: FAIL because `practiceInterviewerScript` module does not exist.

- [ ] **Step 3: 实现纯函数**

导出：

```ts
export type PracticeInterviewerScriptLevel = 'warmup' | 'repair' | 'pressure' | 'advanced' | 'regression'

export interface PracticeInterviewerScriptStep {
  id: string
  criterionKey: FollowUpDrillCriterionKey
  criterionLabel: string
  title: string
  prompt: string
  pressurePoint: string
  answerHint: string
  durationSeconds: number
}

export interface PracticeInterviewerScript {
  level: PracticeInterviewerScriptLevel
  title: string
  summary: string
  totalSeconds: number
  steps: PracticeInterviewerScriptStep[]
  primaryPrompt: string
}
```

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceInterviewerScript
```

Expected: PASS.

### Task 3: TDD 面板

**Files:**
- Create: `frontend/src/components/PracticeInterviewerScriptPanel.test.tsx`
- Create: `frontend/src/components/PracticeInterviewerScriptPanel.tsx`

- [ ] **Step 1: 写失败测试**

测试内容：

```tsx
render(<PracticeInterviewerScriptPanel question={question()} attempts={[attempt(86, {})]} onUsePrompt={onUsePrompt} />)
expect(screen.getByLabelText('本题面试官脚本')).toBeInTheDocument()
expect(screen.getByText(/进阶/)).toBeInTheDocument()
await userEvent.click(screen.getAllByRole('button', { name: /带入回答框/ })[0])
expect(onUsePrompt.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: FAIL because component does not exist.

- [ ] **Step 3: 实现面板**

使用 `Button`、`ClockCircleOutlined`、`ThunderboltOutlined`，展示标题、摘要、总时长和三个步骤。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: PASS.

### Task 4: Practice 接入

**Files:**
- Modify: `frontend/src/pages/Practice/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 页面接入**

导入组件：

```ts
import PracticeInterviewerScriptPanel from '../../components/PracticeInterviewerScriptPanel'
```

新增回填函数：

```ts
const startInterviewerScriptAnswer = (prompt: string) => {
  setAnswerDraft(`追问：${prompt}\n\n我的回答：`)
  setFeedback(null)
}
```

侧栏中插入：

```tsx
<PracticeInterviewerScriptPanel
  question={current}
  attempts={currentAttempts}
  onUsePrompt={startInterviewerScriptAnswer}
/>
```

- [ ] **Step 2: 补样式**

新增 `.practice-interviewer-script-panel`、`.practice-interviewer-script-head`、`.practice-interviewer-script-steps`、`.practice-interviewer-script-step`。

- [ ] **Step 3: 定向测试**

```bash
cd frontend
npm run test -- practiceInterviewerScript PracticeInterviewerScriptPanel
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
git add frontend/src/utils/practiceInterviewerScript.test.ts frontend/src/utils/practiceInterviewerScript.ts frontend/src/components/PracticeInterviewerScriptPanel.test.tsx frontend/src/components/PracticeInterviewerScriptPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试本题面试官脚本"
```
