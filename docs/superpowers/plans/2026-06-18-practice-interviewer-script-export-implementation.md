# 模拟面试本题面试官脚本导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/practice` 的本题面试官脚本支持 Markdown 复制和下载兜底，用户可以免费保存单题追问流程。

**Architecture:** 在 `frontend/src/utils/practiceInterviewerScript.ts` 中新增 `buildPracticeInterviewerScriptMarkdown(question, attempts, now)`，复用 `buildPracticeInterviewerScript` 结果，不重复业务判断。扩展 `PracticeInterviewerScriptPanel` 增加复制按钮和剪贴板降级下载逻辑，页面接入不变。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-practice-interviewer-script-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-practice-interviewer-script-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-practice-interviewer-script-export-design.md docs/superpowers/plans/2026-06-18-practice-interviewer-script-export-implementation.md
```

- [ ] **Step 2: 检查缓存区**

```bash
git diff --cached --check
```

Expected: no output.

- [ ] **Step 3: 中文提交文档**

```bash
git commit -m "文档：设计模拟面试本题面试官脚本导出"
```

### Task 2: TDD Markdown 函数

**Files:**
- Modify: `frontend/src/utils/practiceInterviewerScript.test.ts`
- Modify: `frontend/src/utils/practiceInterviewerScript.ts`

- [ ] **Step 1: 写失败测试**

在测试文件中导入 `buildPracticeInterviewerScriptMarkdown`，新增：

```ts
const markdown = buildPracticeInterviewerScriptMarkdown(question(), [attempt(86, {})], NOW)
expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 本题面试官脚本')
expect(markdown).toContain('生成时间：2026-06-18')
expect(markdown).toContain('## 追问步骤')
expect(markdown).toContain('方案对比')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- src/utils/practiceInterviewerScript.test.ts
```

Expected: FAIL because `buildPracticeInterviewerScriptMarkdown` is not exported.

- [ ] **Step 3: 实现 Markdown 函数**

新增：

```ts
export function buildPracticeInterviewerScriptMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  attempts: InterviewAttempt[],
  now = new Date().toISOString(),
): string
```

内部复用 `buildPracticeInterviewerScript(question, attempts)`，并增加 `formatMarkdownDate`。

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- src/utils/practiceInterviewerScript.test.ts
```

Expected: PASS.

### Task 3: TDD 面板复制

**Files:**
- Modify: `frontend/src/components/PracticeInterviewerScriptPanel.test.tsx`
- Modify: `frontend/src/components/PracticeInterviewerScriptPanel.tsx`

- [ ] **Step 1: 写失败测试**

新增：

```tsx
const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
render(<PracticeInterviewerScriptPanel question={question()} attempts={[attempt(86, NOW)]} onUsePrompt={vi.fn()} />)
await userEvent.click(screen.getByRole('button', { name: /复制脚本/ }))
expect(writeText.mock.calls[0][0]).toContain('本题面试官脚本')
```

- [ ] **Step 2: 运行红灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: FAIL because the copy button does not exist.

- [ ] **Step 3: 实现复制按钮**

引入 `CopyOutlined`、`message` 和 `buildPracticeInterviewerScriptMarkdown`，新增：

```ts
const handleCopyScript = async () => {
  const markdown = buildPracticeInterviewerScriptMarkdown(question, attempts)
  const copied = await copyMarkdown(markdown)
  if (copied) {
    message.success('本题面试官脚本已复制')
    return
  }
  downloadMarkdown(markdown, buildFileName(question.title))
  message.warning('剪贴板不可用，已下载 Markdown 脚本')
}
```

- [ ] **Step 4: 运行绿灯**

```bash
cd frontend
npm run test -- PracticeInterviewerScriptPanel
```

Expected: PASS.

### Task 4: 全量验证和提交

- [ ] **Step 1: 定向测试**

```bash
cd frontend
npm run test -- practiceInterviewerScript PracticeInterviewerScriptPanel
```

Expected: PASS.

- [ ] **Step 2: 前端测试**

```bash
cd frontend
npm run test
```

Expected: all tests pass.

- [ ] **Step 3: 前端构建**

```bash
cd frontend
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: 后端测试**

```bash
cd backend
mvn test
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: 空白检查**

```bash
git diff --check
```

Expected: no output except possible Windows LF/CRLF warnings.

- [ ] **Step 6: 中文提交功能**

```bash
git add frontend/src/utils/practiceInterviewerScript.test.ts frontend/src/utils/practiceInterviewerScript.ts frontend/src/components/PracticeInterviewerScriptPanel.test.tsx frontend/src/components/PracticeInterviewerScriptPanel.tsx
git diff --cached --check
git commit -m "功能：新增模拟面试本题面试官脚本导出"
```
