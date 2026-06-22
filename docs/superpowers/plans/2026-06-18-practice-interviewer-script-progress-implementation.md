# 模拟面试本题面试官脚本进度 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/practice` 的本题面试官脚本中显示每一步追问的作答进度、通过状态和下一问。

**Architecture:** 新增 `frontend/src/utils/practiceInterviewerScriptProgress.ts` 纯函数，基于 `buildPracticeInterviewerScript` 和 `analyzePracticeScriptAnswerAcceptance` 从 `InterviewAttempt[]` 推导脚本步骤状态。扩展 `PracticeInterviewerScriptPanel`，在现有脚本面板中展示进度条、状态标签和动态按钮文案，不修改后端与存储结构。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-interviewer-script-progress-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-interviewer-script-progress-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-interviewer-script-progress-design.md docs/superpowers/plans/2026-06-18-practice-interviewer-script-progress-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试本题面试官脚本进度"
```

### Task 2: TDD 纯函数

**Files:**
- Create: `frontend/src/utils/practiceInterviewerScriptProgress.test.ts`
- Create: `frontend/src/utils/practiceInterviewerScriptProgress.ts`

- [ ] **Step 1: 写失败测试**

覆盖以下行为：

```ts
expect(buildPracticeInterviewerScriptProgress(question(), []).steps.every(item => item.status === 'pending')).toBe(true)
expect(buildPracticeInterviewerScriptProgress(question(), [passedAttempt]).steps[0].status).toBe('passed')
expect(buildPracticeInterviewerScriptProgress(question(), [weakAttempt]).steps[0].status).toBe('attempted')
expect(buildPracticeInterviewerScriptProgress(question(), [newWeakAttempt, oldPassedAttempt]).steps[0].status).toBe('attempted')
expect(JSON.stringify(progress)).not.toContain('undefined')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- practiceInterviewerScriptProgress
```

Expected: FAIL because `practiceInterviewerScriptProgress` module does not exist.

- [ ] **Step 3: 实现纯函数**

导出：

```ts
export type PracticeInterviewerScriptStepStatus = 'pending' | 'attempted' | 'passed'

export interface PracticeInterviewerScriptProgressStep {
  step: PracticeInterviewerScriptStep
  status: PracticeInterviewerScriptStepStatus
  attemptCount: number
  latestAttemptAt?: string
  acceptanceScore?: number
}

export interface PracticeInterviewerScriptProgress {
  totalSteps: number
  passedCount: number
  attemptedCount: number
  progressPercent: number
  summary: string
  nextStep?: PracticeInterviewerScriptStep
  steps: PracticeInterviewerScriptProgressStep[]
}
```

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- practiceInterviewerScriptProgress
```

Expected: PASS.

### Task 3: TDD 面板接入

**Files:**
- Modify: `frontend/src/components/PracticeInterviewerScriptPanel.test.tsx`
- Modify: `frontend/src/components/PracticeInterviewerScriptPanel.tsx`

- [ ] **Step 1: 写失败测试**

新增测试：

```tsx
render(<PracticeInterviewerScriptPanel question={question()} attempts={[passedFollowUpAttempt]} onUsePrompt={vi.fn()} />)
expect(screen.getByText('脚本进度 1 / 3')).toBeInTheDocument()
expect(screen.getByText('已通过')).toBeInTheDocument()
```

新增未通过状态测试：

```tsx
render(<PracticeInterviewerScriptPanel question={question()} attempts={[weakFollowUpAttempt]} onUsePrompt={vi.fn()} />)
expect(screen.getByRole('button', { name: /继续修复/ })).toBeInTheDocument()
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: FAIL because panel does not render progress yet.

- [ ] **Step 3: 实现面板**

导入 `Progress` 和 `buildPracticeInterviewerScriptProgress`，在脚本标题区后渲染进度条，并在步骤顶部渲染状态标签。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: PASS.

### Task 4: 样式

**Files:**
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: 补进度条和状态样式**

新增 `.practice-interviewer-script-progress`、`.practice-interviewer-script-status`、`.practice-interviewer-script-step.status-passed`、`.practice-interviewer-script-step.status-attempted`。

- [ ] **Step 2: 定向验证**

```bash
cd frontend
npm run test -- practiceInterviewerScriptProgress PracticeInterviewerScriptPanel
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
git add frontend/src/utils/practiceInterviewerScriptProgress.test.ts frontend/src/utils/practiceInterviewerScriptProgress.ts frontend/src/components/PracticeInterviewerScriptPanel.test.tsx frontend/src/components/PracticeInterviewerScriptPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试本题面试官脚本进度"
```
