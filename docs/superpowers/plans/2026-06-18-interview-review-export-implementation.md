# 模拟面试复盘导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“免费模拟面试复盘”支持 Markdown 导出，用户可以保存表达趋势、分数、短板维度和最近模拟记录。

**Architecture:** 复用 `buildInterviewReviewSummary` 的结构化结果新增 `buildInterviewReviewMarkdown`。面板只负责复制和下载降级，不改变趋势判断和推荐语算法。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-interview-review-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-interview-review-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-interview-review-export-design.md docs/superpowers/plans/2026-06-18-interview-review-export-implementation.md
```

- [ ] **Step 2: 检查暂存区**

```bash
git diff --cached --check
```

Expected: exit 0。

- [ ] **Step 3: 提交文档**

```bash
git commit -m "文档：设计模拟面试复盘导出"
```

### Task 2: TDD 增加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/interviewReview.test.ts`

- [ ] **Step 1: 写失败测试**

在测试文件中从 `./interviewReview` 导入 `buildInterviewReviewMarkdown`，增加两条测试：

```ts
it('exports interview review as portable markdown', () => {
  const progress: StudyProgress = {
    ...createDefaultProgress('2026-06-17T00:00:00.000Z'),
    targetRole: 'Java 后端',
    questionSnapshots: {
      1: {
        id: 1,
        title: 'HashMap 为什么线程不安全？',
        difficulty: 'MEDIUM',
        categoryName: 'Java 集合',
        tags: ['Java'],
        viewCount: 10,
      },
    },
    interviewAttempts: {
      1: [
        attempt(1, 66, '2026-06-17T12:00:00'),
        attempt(1, 88, '2026-06-17T11:00:00'),
      ],
    },
  }

  const markdown = buildInterviewReviewMarkdown(progress, '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('# Java 后端 模拟面试复盘')
  expect(markdown).toContain('生成时间：2026-06-18')
  expect(markdown).toContain('## 复盘概览')
  expect(markdown).toContain('## 当前短板')
  expect(markdown).toContain('## 维度均分')
  expect(markdown).toContain('## 最近记录')
  expect(markdown).toContain('入口：/question/1')
  expect(markdown).not.toContain('undefined')
})

it('keeps empty interview review export actionable', () => {
  const markdown = buildInterviewReviewMarkdown(createDefaultProgress(), '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('开始模拟面试')
  expect(markdown).toContain('入口：/practice')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 2: 运行红灯测试**

```bash
cd frontend
npm run test -- interviewReview
```

Expected: FAIL，原因是 `buildInterviewReviewMarkdown is not a function`。

### Task 3: 实现 Markdown 导出函数

**Files:**
- Modify: `frontend/src/utils/interviewReview.ts`

- [ ] **Step 1: 新增导出函数**

新增 `buildInterviewReviewMarkdown(progress, now)`，内部调用 `buildInterviewReviewSummary(progress)`。

- [ ] **Step 2: 新增渲染 helpers**

新增以下私有函数：

```ts
function renderReviewOverview(summary: InterviewReviewSummary): string
function renderWeakestCriterion(summary: InterviewReviewSummary): string
function renderCriteria(criteria: InterviewCriterionSummary[]): string
function renderRecentAttempts(attempts: InterviewReviewAttempt[]): string
function renderReviewNextStep(summary: InterviewReviewSummary): string
function labelForTrend(trend: InterviewTrend): string
function formatMarkdownDate(value: string): string
```

- [ ] **Step 3: 运行绿灯测试**

```bash
cd frontend
npm run test -- interviewReview
```

Expected: PASS。

### Task 4: 面板接入复制和下载降级

**Files:**
- Modify: `frontend/src/components/InterviewReviewPanel.tsx`
- Modify: `frontend/src/styles/global.css`
- Create or Modify: `frontend/src/components/InterviewReviewPanel.test.tsx`

- [ ] **Step 1: 面板接入**

在 `InterviewReviewPanel.tsx` 中：
- 引入 `message`、`CopyOutlined`、`buildInterviewReviewMarkdown`。
- 增加 `handleCopyReview`。
- 在空状态和有记录状态的标题区展示“复制复盘”按钮。
- 复制成功提示“模拟面试复盘已复制”，失败下载 Markdown。

- [ ] **Step 2: 样式接入**

在 `global.css` 中新增 `.interview-review-heading-actions`，支持按钮换行和 compact 模式。

- [ ] **Step 3: 组件测试**

新增组件测试，渲染带面试记录的 `InterviewReviewPanel`，点击“复制复盘”，断言剪贴板内容包含“模拟面试复盘”、“复盘概览”和 `/question/1`。

### Task 5: 全量校验和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 定向验证**

```bash
cd frontend
npm run test -- interviewReview InterviewReviewPanel
```

Expected: PASS。

- [ ] **Step 2: 全量验证**

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected: all exit 0。

- [ ] **Step 3: 提交功能**

```bash
git add frontend/src/utils/interviewReview.test.ts frontend/src/utils/interviewReview.ts frontend/src/components/InterviewReviewPanel.tsx frontend/src/components/InterviewReviewPanel.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试复盘导出"
```
