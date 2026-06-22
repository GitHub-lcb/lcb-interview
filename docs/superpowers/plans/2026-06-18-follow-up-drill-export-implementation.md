# 追问加压训练导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让模拟面试后的追问加压训练支持 Markdown 导出，用户可以免费保存单题追问压力包并继续离线复盘。

**Architecture:** 复用 `buildFollowUpDrillPack` 生成追问内容，新增 `buildFollowUpDrillMarkdown` 只负责导出排版。`FollowUpDrillPanel` 负责复制和下载降级，不改变追问生成、带入回答框和评分逻辑。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-follow-up-drill-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-follow-up-drill-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-follow-up-drill-export-design.md docs/superpowers/plans/2026-06-18-follow-up-drill-export-implementation.md
```

- [ ] **Step 2: 检查暂存区**

```bash
git diff --cached --check
```

Expected: exit 0.

- [ ] **Step 3: 提交文档**

```bash
git commit -m "文档：设计追问加压训练导出"
```

### Task 2: TDD 增加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/followUpDrill.test.ts`

- [ ] **Step 1: 写失败测试**

在 `./followUpDrill` 导入 `buildFollowUpDrillMarkdown`，增加两个测试：

```ts
it('exports follow-up drill pack as portable markdown', () => {
  const markdown = buildFollowUpDrillMarkdown(
    question,
    'HashMap 多线程下扩容会出现覆盖写和结构异常。',
    feedback(),
    '2026-06-18T00:00:00.000Z',
  )

  expect(markdown).toContain('# HashMap 为什么线程不安全？扩容时会发生什么？ 追问加压训练')
  expect(markdown).toContain('生成时间：2026-06-18')
  expect(markdown).toContain('## 题目上下文')
  expect(markdown).toContain('## 训练概览')
  expect(markdown).toContain('## 加压题单')
  expect(markdown).toContain('维度：场景细节')
  expect(markdown).toContain('答题引导：')
  expect(markdown).not.toContain('undefined')
})

it('keeps follow-up drill export actionable without a prior answer', () => {
  const markdown = buildFollowUpDrillMarkdown(question, ' ', feedback(), '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('当前回答摘要：未填写本轮回答')
  expect(markdown).toContain('## 加压题单')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 2: 运行红灯测试**

```bash
cd frontend
npm run test -- followUpDrill
```

Expected: FAIL，原因是 `buildFollowUpDrillMarkdown is not a function`。

### Task 3: 实现 Markdown 导出函数

**Files:**
- Modify: `frontend/src/utils/followUpDrill.ts`

- [ ] **Step 1: 新增导出函数**

新增 public 函数：

```ts
export function buildFollowUpDrillMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  answer: string,
  feedback: InterviewFeedback,
  now = new Date().toISOString(),
): string
```

函数内部复用 `buildFollowUpDrillPack(question, answer, feedback)`。

- [ ] **Step 2: 新增渲染 helpers**

新增私有函数：

```ts
function renderQuestionContext(...)
function renderDrillItems(...)
function labelForFeedbackLevel(...)
function summarizeAnswer(...)
function formatMarkdownDate(...)
```

- [ ] **Step 3: 运行绿灯测试**

```bash
cd frontend
npm run test -- followUpDrill
```

Expected: PASS.

### Task 4: 面板接入复制和下载降级

**Files:**
- Modify: `frontend/src/components/FollowUpDrillPanel.tsx`
- Modify: `frontend/src/styles/global.css`
- Create: `frontend/src/components/FollowUpDrillPanel.test.tsx`

- [ ] **Step 1: 写组件失败测试**

新增 `FollowUpDrillPanel.test.tsx`，断言：

```ts
await userEvent.click(screen.getByRole('button', { name: /复制追问/ }))
await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
expect(writeText.mock.calls[0][0]).toContain('追问加压训练')
expect(writeText.mock.calls[0][0]).toContain('## 加压题单')
expect(writeText.mock.calls[0][0]).toContain('HashMap 为什么线程不安全')
```

同时保留点击“带入回答框”会调用 `onPickPrompt`。

- [ ] **Step 2: 运行组件红灯测试**

```bash
cd frontend
npm run test -- FollowUpDrillPanel
```

Expected: FAIL，原因是找不到“复制追问”按钮。

- [ ] **Step 3: 接入组件**

在 `FollowUpDrillPanel.tsx`：
- 引入 `message`、`CopyOutlined` 和 `buildFollowUpDrillMarkdown`。
- 新增 `handleCopyDrill`。
- 顶部右侧使用 `.follow-up-drill-head-actions` 包裹图标和按钮。
- 复用 `copyMarkdown`、`downloadMarkdown`、`buildFileName` 降级策略。

- [ ] **Step 4: 补样式**

在 `global.css` 增加：

```css
.follow-up-drill-head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  align-items: center;
  flex: 0 0 auto;
}
```

移动端让 actions 靠左，避免按钮压缩标题。

- [ ] **Step 5: 运行定向绿灯测试**

```bash
cd frontend
npm run test -- followUpDrill FollowUpDrillPanel
```

Expected: PASS.

### Task 5: 全量验证和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 前端全量测试**

```bash
cd frontend
npm run test
npm run build
```

Expected: all exit 0.

- [ ] **Step 2: 后端测试**

```bash
cd backend
mvn test
```

Expected: exit 0.

- [ ] **Step 3: 空白字符检查**

```bash
git diff --check
```

Expected: exit 0.

- [ ] **Step 4: 提交功能**

```bash
git add frontend/src/utils/followUpDrill.test.ts frontend/src/utils/followUpDrill.ts frontend/src/components/FollowUpDrillPanel.tsx frontend/src/components/FollowUpDrillPanel.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增追问加压训练导出"
```
