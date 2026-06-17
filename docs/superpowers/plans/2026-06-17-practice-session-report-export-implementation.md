# 本轮模拟面试战报导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for export behavior and UI interaction, and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让练习页“本轮模拟面试战报”支持一键导出 Markdown，用户可以免费保存、分享和复盘一轮模拟面试表现。

**Architecture:** 在 `practiceSessionReport.ts` 中新增 Markdown 构建函数，复用现有 `buildPracticeSessionReport`。在 `PracticeSessionReportPanel` 增加复制按钮，剪贴板失败时下载 Markdown 文件。UI 保持侧栏紧凑布局。

**Tech Stack:** React 18、Ant Design 5、TypeScript、Vitest、Testing Library、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-practice-session-report-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-practice-session-report-export-implementation.md`

- [ ] **Step 1: Add design and implementation plan docs**

写入设计和计划，明确 Markdown 内容、UI 按钮、剪贴板降级和测试范围。

- [ ] **Step 2: Verify docs staged diff**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-practice-session-report-export-design.md docs/superpowers/plans/2026-06-17-practice-session-report-export-implementation.md
git diff --cached --check
git diff --cached --stat
```

Expected: only two docs are staged, no whitespace errors.

- [ ] **Step 3: Commit docs**

Run:

```bash
git commit -m "文档：设计本轮模拟面试战报导出"
```

Expected: commit succeeds.

### Task 2: TDD 添加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`

- [ ] **Step 1: Import Markdown builder**

Change import:

```ts
import { buildPracticeSessionReport, buildPracticeSessionReportMarkdown } from './practiceSessionReport'
```

- [ ] **Step 2: Add risk-session Markdown test**

Add:

```ts
it('exports a portable markdown report for the current practice session', () => {
  const markdown = buildPracticeSessionReportMarkdown(
    [question(1), question(2), question(3, { status: 'weak' })],
    progress({
      questionStates: {
        3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
      },
      interviewAttempts: {
        1: [attempt(1, 62, { structure: 60 })],
        2: [attempt(2, 55, { structure: 45 })],
      },
    }),
    NOW,
  )

  expect(markdown).toContain('# Java 后端 本轮模拟面试战报')
  expect(markdown).toContain('生成时间：2026-06-17')
  expect(markdown).toContain('## 本轮摘要')
  expect(markdown).toContain('状态：本轮优先补弱')
  expect(markdown).toContain('低分/薄弱题：1, 2, 3')
  expect(markdown).toContain('## 核心指标')
  expect(markdown).toContain('最弱项：结构化')
  expect(markdown).toContain('## 题目队列')
  expect(markdown).toContain('Java 面试题 2')
  expect(markdown).toContain('最近评分 55 分')
  expect(markdown).toContain('## 下一步行动')
  expect(markdown).toContain('/practice?queue=1,2,3')
})
```

- [ ] **Step 3: Add empty Markdown test**

Add:

```ts
it('keeps empty session markdown actionable', () => {
  const markdown = buildPracticeSessionReportMarkdown([], progress(), NOW)

  expect(markdown).toContain('先选择一组面试题')
  expect(markdown).toContain('当前还没有练习队列')
  expect(markdown).toContain('暂无题目')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 4: Verify RED**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: FAIL because `buildPracticeSessionReportMarkdown` does not exist yet.

### Task 3: 实现 Markdown 构建函数

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.ts`

- [ ] **Step 1: Add exported builder**

Add:

```ts
export function buildPracticeSessionReportMarkdown(
  queue: PracticeQueueItem[],
  progress: StudyProgress,
  now = new Date().toISOString(),
): string {
  const report = buildPracticeSessionReport(queue, progress)
  return [
    `# ${progress.targetRole} 本轮模拟面试战报`,
    '',
    `生成时间：${formatDate(now)}`,
    `队列题数：${queue.length}`,
    '',
    renderSessionSummary(report),
    renderSessionMetrics(report.metrics),
    renderSessionQueue(queue, progress),
    renderSessionAction(report.primaryAction),
  ].join('\n')
}
```

- [ ] **Step 2: Add render helpers**

Add helpers:

```ts
function renderSessionSummary(report: PracticeSessionReport): string {
  return [
    '## 本轮摘要',
    `- 状态：${report.title}`,
    `- 说明：${report.summary}`,
    `- 已答：${report.answeredCount}/${report.totalCount}`,
    `- 平均分：${report.averageScore}`,
    `- 通过数：${report.passCount}`,
    `- 低分/薄弱题：${formatQuestionIds(report.weakQuestionIds)}`,
    '',
  ].join('\n')
}
```

```ts
function renderSessionMetrics(metrics: PracticeSessionReportMetric[]): string {
  return [
    '## 核心指标',
    ...metrics.map(metric => `- ${metric.label}：${metric.value}，${metric.detail}`),
    '',
  ].join('\n')
}
```

```ts
function renderSessionQueue(queue: PracticeQueueItem[], progress: StudyProgress): string {
  const lines = queue.length > 0
    ? queue.map((item, index) => {
      const latestScore = latestAttemptForQuestion(progress, item.id)?.feedback.score
      const status = progress.questionStates[item.id]?.status ?? item.status
      return `- ${index + 1}. ${item.title}：${item.categoryName}，${item.difficulty}，来源 ${item.source}，状态 ${status}，最近评分 ${formatScore(latestScore)}`
    })
    : ['- 暂无题目，先从学习计划、弱题或题库进入模拟面试。']

  return [
    '## 题目队列',
    ...lines,
    '',
  ].join('\n')
}
```

```ts
function renderSessionAction(action: PracticeSessionReportAction): string {
  return [
    '## 下一步行动',
    `- ${action.label}：${action.description}（${action.to}）`,
    '',
  ].join('\n')
}
```

- [ ] **Step 3: Add formatting helpers**

Add:

```ts
function formatQuestionIds(questionIds: number[]): string {
  return questionIds.length > 0 ? questionIds.join(', ') : '暂无'
}

function formatScore(score?: number): string {
  return typeof score === 'number' ? `${score} 分` : '暂无'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Verify GREEN for utility**

Run:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: PASS for utility tests.

### Task 4: TDD 添加复制按钮交互测试

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`

- [ ] **Step 1: Add clipboard interaction assertion**

Inside the existing component test, add:

```ts
const writeText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
})
```

Then after initial assertions:

```ts
await userEvent.click(screen.getByRole('button', { name: /复制战报/ }))
expect(writeText).toHaveBeenCalledWith(expect.stringContaining('# Java 后端 本轮模拟面试战报'))
expect(writeText).toHaveBeenCalledWith(expect.stringContaining('本轮正在推进'))
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: FAIL because the copy button does not exist yet.

### Task 5: 实现面板复制按钮

**Files:**
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Update imports**

Add:

```ts
import { CopyOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { buildPracticeSessionReport, buildPracticeSessionReportMarkdown } from '../utils/practiceSessionReport'
```

- [ ] **Step 2: Add copy handler**

Inside component:

```ts
const handleCopyReport = async () => {
  const markdown = buildPracticeSessionReportMarkdown(queue, progress)
  const copied = await copyMarkdown(markdown)
  if (copied) {
    message.success('本轮模拟面试战报已复制')
    return
  }
  downloadMarkdown(markdown, buildFileName(progress.targetRole))
  message.warning('剪贴板不可用，已下载 Markdown 战报')
}
```

- [ ] **Step 3: Add header action UI**

Replace the standalone status `<span>` with:

```tsx
<div className="practice-session-report-head-actions">
  <span>{levelLabels[report.level]}</span>
  <Button size="small" icon={<CopyOutlined />} onClick={handleCopyReport}>
    复制战报
  </Button>
</div>
```

- [ ] **Step 4: Add local export helpers**

Add `copyMarkdown`, `downloadMarkdown`, `buildFileName` below the component using the same fallback pattern as sprint report export.

- [ ] **Step 5: Update CSS**

Add:

```css
.practice-session-report-head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.practice-session-report-head-actions > span {
  padding: 5px 8px;
  border-radius: 6px;
  background: #F8FAFC;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
```

Change `.practice-session-report-head > span` selector to the new action selector or remove it.

- [ ] **Step 6: Verify GREEN for component**

Run:

```bash
cd frontend
npm run test -- PracticeSessionReportPanel
```

Expected: PASS.

### Task 6: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/practiceSessionReport.test.ts`
- Modify: `frontend/src/utils/practiceSessionReport.ts`
- Modify: `frontend/src/components/PracticeSessionReportPanel.test.tsx`
- Modify: `frontend/src/components/PracticeSessionReportPanel.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Full verification**

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

Expected: frontend tests, production build, backend tests and diff check all succeed.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增本轮模拟面试战报导出"
```

Expected: commit succeeds with only export implementation staged.
