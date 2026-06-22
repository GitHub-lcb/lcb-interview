# Practice Session Script Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本轮模拟面试战报中展示并导出当前队列的面试官脚本总控。

**Architecture:** `practiceSessionReport.ts` 新增 `buildPracticeSessionScriptCommand(queue, progress)`，逐题复用 `buildPracticeInterviewerScriptProgress`，再派生总进度、状态、主行动和高优先级题目清单。Markdown 和 `PracticeSessionReportPanel` 共用同一个总控模型，避免导出内容和页面内容不一致。

**Tech Stack:** React 18, TypeScript, Vitest, Ant Design 5, CSS。

---

## File Map

- Modify: `frontend/src/utils/practiceSessionReport.ts`
  - 新增本轮脚本总控类型、构建函数和 Markdown 渲染函数。
  - 在战报 Markdown 中把“本轮脚本总控”插入到“本轮追问防线”和“下一轮训练建议”之间。
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
  - 增加脚本总控 Markdown 用例、空态用例和当前队列过滤用例。
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
  - 计算并渲染本轮脚本总控模块。
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
  - 覆盖总控模块展示、主行动跳转和题目跳转。
- Modify: `frontend/src/styles/global.css`
  - 增加 `.practice-session-report-script-command*` 样式。

## Task 1: Markdown Script Command

- [ ] **Step 1: Write the failing Markdown tests**

Add import in `frontend/src/utils/practiceSessionReport.test.ts`:

```ts
import { buildPracticeInterviewerScript } from './practiceInterviewerScript'
```

Add a local helper near existing test helpers:

```ts
function answerFor(prompt: string, body: string): string {
  return `追问：${prompt}\n\n我的回答：${body}`
}

function passedScriptBody(): string {
  return [
    '结论：这个问题需要先说明机制，再补充项目证据。',
    '在线上项目中我会用错误率、耗时和吞吐指标验证。',
    '面试官继续追问时，我会补充风险边界和替代方案。',
  ].join('\n')
}
```

Add the behavior test:

```ts
it('exports script command from the current session queue', () => {
  const currentQueue = [question(1), question(2)]
  const prompt = buildPracticeInterviewerScript(currentQueue[0], []).steps[0].prompt
  const markdown = buildPracticeSessionReportMarkdown(
    currentQueue,
    progress({
      interviewAttempts: {
        1: [
          attempt(1, 82, {
            answer: answerFor(prompt, passedScriptBody()),
          }),
        ],
        3: [
          attempt(3, 95, {
            answer: '这道题不在当前队列，不应该出现在本轮脚本总控。',
          }),
        ],
      },
    }),
    NOW,
  )

  expect(markdown).toContain('## 本轮脚本总控')
  expect(markdown).toContain('总进度：1 / 6（17%）')
  expect(markdown).toContain('Java 面试题 1')
  expect(markdown).toContain('脚本阶段：')
  expect(markdown).toContain('下一问：')
  expect(markdown).toContain('入口：/practice?queue=1')
  expect(markdown).not.toContain('Java 面试题 3')
})
```

Update the empty markdown test:

```ts
expect(markdown).toContain('## 本轮脚本总控')
expect(markdown).toContain('暂无本轮脚本总控')
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: fails because `## 本轮脚本总控` is missing.

- [ ] **Step 3: Implement the script command model**

In `frontend/src/utils/practiceSessionReport.ts`, import the existing progress builder:

```ts
import {
  buildPracticeInterviewerScriptProgress,
  type PracticeInterviewerScriptProgress,
} from './practiceInterviewerScriptProgress'
```

Add local types:

```ts
type PracticeSessionScriptCommandStatus = 'empty' | 'pending' | 'active' | 'repair' | 'complete'

interface PracticeSessionScriptCommandItem {
  questionId: number
  title: string
  to: string
  status: Exclude<PracticeSessionScriptCommandStatus, 'empty'>
  scriptTitle: string
  summary: string
  totalSteps: number
  passedCount: number
  attemptedCount: number
  progressPercent: number
  nextPrompt: string
}

interface PracticeSessionScriptCommand {
  status: PracticeSessionScriptCommandStatus
  title: string
  summary: string
  totalSteps: number
  passedCount: number
  attemptedQuestionCount: number
  progressPercent: number
  primaryAction: PracticeSessionReportAction
  items: PracticeSessionScriptCommandItem[]
}
```

Export the builder:

```ts
export function buildPracticeSessionScriptCommand(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
): PracticeSessionScriptCommand {
  const items = queue.map((question, index) => {
    const scriptProgress = buildPracticeInterviewerScriptProgress(question, progress.interviewAttempts[question.id] ?? [])
    return buildPracticeSessionScriptCommandItem(question, index, scriptProgress)
  })
  const totalSteps = items.reduce((total, item) => total + item.totalSteps, 0)
  const passedCount = items.reduce((total, item) => total + item.passedCount, 0)
  const attemptedQuestionCount = items.filter(item => item.attemptedCount > 0).length
  const status = resolveScriptCommandStatus(items)
  const sortedItems = [...items].sort(compareScriptCommandItems)
  const primaryItem = sortedItems[0]

  return {
    status,
    title: resolveScriptCommandTitle(status),
    summary: resolveScriptCommandSummary(status, passedCount, totalSteps, attemptedQuestionCount),
    totalSteps,
    passedCount,
    attemptedQuestionCount,
    progressPercent: totalSteps > 0 ? Math.round((passedCount / totalSteps) * 100) : 0,
    primaryAction: buildScriptCommandPrimaryAction(status, primaryItem),
    items: sortedItems,
  }
}
```

Add helper functions to compute item status, sorting, title, summary, and primary action. Keep helpers private to `practiceSessionReport.ts`.

- [ ] **Step 4: Render Markdown**

Add `renderSessionScriptCommand(queue, progress)` after `renderSessionFollowUpDefense(queue, progress)`:

```ts
function renderSessionScriptCommand(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const command = buildPracticeSessionScriptCommand(queue, progress)
  const lines = [
    '## 本轮脚本总控',
    `- 状态：${command.title}`,
    `- 总进度：${command.passedCount} / ${command.totalSteps}（${command.progressPercent}%）`,
    `- 修复中：${command.items.filter(item => item.status === 'repair').length} 道`,
    `- 主行动：${command.primaryAction.label}，${command.primaryAction.description}（${command.primaryAction.to}）`,
    '',
  ]

  if (command.items.length === 0) {
    return [...lines, '- 暂无本轮脚本总控。先建立练习队列，再完成本题面试官脚本。', ''].join('\n')
  }

  command.items.slice(0, 5).forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.title}`,
      `   - 脚本阶段：${item.scriptTitle}`,
      `   - 进度：${item.passedCount} / ${item.totalSteps}（${item.progressPercent}%）`,
      `   - 状态：${scriptCommandItemStatusLabel(item.status)}`,
      `   - 下一问：${item.nextPrompt || '本题脚本已通过，可以复练或沉淀素材。'}`,
      `   - 入口：${item.to}`,
    )
  })

  return [...lines, ''].join('\n')
}
```

- [ ] **Step 5: Run green**

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: utility test passes.

## Task 2: Panel Script Command

- [ ] **Step 1: Write the failing panel test**

Add a test in `frontend/src/components/PracticeSessionReportPanel.test.tsx`:

```ts
it('renders script command from the current session queue', async () => {
  const user = userEvent.setup()
  const onNavigate = vi.fn()
  const currentQueue = [queueItem(1), queueItem(2)]
  const prompt = buildPracticeInterviewerScript(currentQueue[0], []).steps[0].prompt

  render(
    <PracticeSessionReportPanel
      queue={currentQueue}
      progress={progress({
        interviewAttempts: {
          1: [
            attempt(1, 82, {
              answer: answerFor(prompt, passedScriptBody()),
            }),
          ],
        },
      })}
      onNavigate={onNavigate}
    />,
  )

  const commandBlock = screen.getByLabelText('本轮脚本总控')
  expect(within(commandBlock).getByText('本轮脚本总控')).toBeInTheDocument()
  expect(within(commandBlock).getAllByText('Java 面试题 1').length).toBeGreaterThan(0)
  expect(within(commandBlock).getByText(/1 \/ 3/)).toBeInTheDocument()

  await user.click(within(commandBlock).getAllByRole('button', { name: /Java 面试题 1/ })[0])
  expect(onNavigate).toHaveBeenCalledWith('/practice?queue=1')
})
```

- [ ] **Step 2: Run red**

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: fails because `aria-label="本轮脚本总控"` is missing.

- [ ] **Step 3: Render the panel block**

Import and compute:

```tsx
const sessionScriptCommand = useMemo(
  () => buildPracticeSessionScriptCommand(queue, progress),
  [progress, queue],
)
```

Render after the follow-up defense block:

```tsx
<div className="practice-session-report-script-command" aria-label="本轮脚本总控">
  <div className="practice-session-report-script-command-head">
    <div>
      <span>本轮脚本总控</span>
      <small>{sessionScriptCommand.summary}</small>
    </div>
    <Button size="small" icon={<ThunderboltOutlined />} onClick={() => onNavigate(sessionScriptCommand.primaryAction.to)}>
      {sessionScriptCommand.primaryAction.label}
    </Button>
  </div>
  {sessionScriptCommand.items.length === 0 ? (
    <p>暂无本轮脚本总控。先建立练习队列，再完成本题面试官脚本。</p>
  ) : (
    <div className="practice-session-report-script-command-list">
      {sessionScriptCommand.items.slice(0, 3).map(item => (
        <button key={item.questionId} type="button" onClick={() => onNavigate(item.to)}>
          <strong>{item.title}</strong>
          <span>{item.scriptTitle} · {item.passedCount} / {item.totalSteps}</span>
          <small>{item.nextPrompt || item.summary}</small>
        </button>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 4: Add CSS**

Add `.practice-session-report-script-command*` rules near the follow-up defense section. Use 8px radius, fixed spacing, truncation and subdued neutral colors so it reads as a control panel rather than another decorative card.

- [ ] **Step 5: Run focused green**

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: both test files pass.

## Task 3: Verify And Commit

- [ ] **Step 1: Full tests**

```bash
cd frontend
npm run test
```

- [ ] **Step 2: Build**

```bash
cd frontend
npm run build
```

- [ ] **Step 3: Whitespace**

```bash
git diff --check
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git commit -m "功能：战报显示本轮脚本总控"
```
