# 单题答案质量导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让题目详情页的答案质量面板支持 Markdown 导出，用户可以免费保存单题表达质量、追问和补强模块。

**Architecture:** 复用 `calculateAnswerQuality`、`generateFollowUps`、`getQuickAnswer` 和 `getMistakeHint` 新增 `buildAnswerQualityMarkdown`。面板只负责复制和下载降级，不改变质量评分规则。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-answer-quality-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-answer-quality-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-answer-quality-export-design.md docs/superpowers/plans/2026-06-18-answer-quality-export-implementation.md
```

- [ ] **Step 2: 检查暂存区**

```bash
git diff --cached --check
```

Expected: exit 0。

- [ ] **Step 3: 提交文档**

```bash
git commit -m "文档：设计答案质量导出"
```

### Task 2: TDD 增加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/answerQuality.test.ts`

- [ ] **Step 1: 写失败测试**

从 `./answerQuality` 导入 `buildAnswerQualityMarkdown`，增加两条测试：

```ts
it('exports answer quality as portable markdown', () => {
  const markdown = buildAnswerQualityMarkdown(question({
    title: 'HashMap 为什么线程不安全？',
    categoryName: 'Java 集合',
    summary: 'HashMap 线程不安全主要来自并发扩容和覆盖写。',
    principle: '并发修改会破坏桶和链表结构。',
    risk: '不要只说没有加锁，要说明边界。',
  }), '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('# HashMap 为什么线程不安全？ 答案质量卡')
  expect(markdown).toContain('生成时间：2026-06-18')
  expect(markdown).toContain('## 质量概览')
  expect(markdown).toContain('## 已覆盖模块')
  expect(markdown).toContain('## 可补强模块')
  expect(markdown).toContain('## 面试官追问')
  expect(markdown).toContain('## 误区提醒')
  expect(markdown).not.toContain('undefined')
})

it('keeps incomplete answer quality export actionable', () => {
  const markdown = buildAnswerQualityMarkdown(question({ summary: undefined, risk: undefined }), '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('可补强模块')
  expect(markdown).toContain('不要只背结论')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 2: 运行红灯测试**

```bash
cd frontend
npm run test -- answerQuality
```

Expected: FAIL，原因是 `buildAnswerQualityMarkdown is not a function`。

### Task 3: 实现 Markdown 导出函数

**Files:**
- Modify: `frontend/src/utils/answerQuality.ts`

- [ ] **Step 1: 新增导出函数**

新增 `buildAnswerQualityMarkdown(question, now)`，内部复用现有质量评分和追问函数。

- [ ] **Step 2: 新增渲染 helpers**

新增以下私有函数：

```ts
function renderQualityOverview(question: Question, quality: AnswerQualityResult): string
function renderFieldList(title: string, fields: string[], emptyText: string): string
function renderFollowUps(question: Question): string
function renderMistakeHint(question: Question): string
function labelForQualityLevel(level: AnswerQualityResult['level']): string
function formatMarkdownDate(value: string): string
```

- [ ] **Step 3: 运行绿灯测试**

```bash
cd frontend
npm run test -- answerQuality
```

Expected: PASS。

### Task 4: 面板接入复制和下载降级

**Files:**
- Modify: `frontend/src/components/AnswerQualityPanel.tsx`
- Modify: `frontend/src/styles/global.css`
- Create: `frontend/src/components/AnswerQualityPanel.test.tsx`

- [ ] **Step 1: 面板接入**

在 `AnswerQualityPanel.tsx` 中：
- 引入 `Button`、`message`、`CopyOutlined` 和 `buildAnswerQualityMarkdown`。
- 增加 `handleCopyQuality`。
- 在质量卡顶部增加“复制质量”按钮。
- 复制成功提示“答案质量卡已复制”，失败下载 Markdown。

- [ ] **Step 2: 样式接入**

在 `global.css` 中新增 `.quality-score-card-head`，让标题和复制按钮稳定排列。

- [ ] **Step 3: 组件测试**

新增组件测试，点击“复制质量”，断言剪贴板内容包含“答案质量卡”、“质量概览”和“面试官追问”。

### Task 5: 全量校验和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 定向验证**

```bash
cd frontend
npm run test -- answerQuality AnswerQualityPanel
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
git add frontend/src/utils/answerQuality.test.ts frontend/src/utils/answerQuality.ts frontend/src/components/AnswerQualityPanel.tsx frontend/src/components/AnswerQualityPanel.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增答案质量导出"
```
