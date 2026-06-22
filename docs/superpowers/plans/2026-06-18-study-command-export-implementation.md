# 备考指挥中心导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页备考指挥中心支持 Markdown 导出，用户可以免费保存每日总览、最大短板和下一步行动。

**Architecture:** 新增 `buildStudyCommandMarkdown(progress, now)`，内部复用 `buildStudyStrategy(progress)` 输出报告内容。`StudyCommandCenter` 只负责复制和下载降级，不改变就绪分算法和导航行为。

**Tech Stack:** React 18、TypeScript、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-18-study-command-export-design.md`
- Create: `docs/superpowers/plans/2026-06-18-study-command-export-implementation.md`

- [ ] **Step 1: 暂存文档**

```bash
git add docs/superpowers/specs/2026-06-18-study-command-export-design.md docs/superpowers/plans/2026-06-18-study-command-export-implementation.md
```

- [ ] **Step 2: 检查暂存区**

```bash
git diff --cached --check
```

Expected: exit 0.

- [ ] **Step 3: 提交文档**

```bash
git commit -m "文档：设计备考指挥中心导出"
```

### Task 2: TDD 增加 Markdown 导出测试

**Files:**
- Modify: `frontend/src/utils/studyStrategy.test.ts`

- [ ] **Step 1: 写失败测试**

导入 `buildStudyCommandMarkdown`，增加：

```ts
it('exports study command center as portable markdown', () => {
  const progress: StudyProgress = {
    ...createDefaultProgress(),
    targetRole: 'Java 后端',
    sprintDays: 21,
    questionStates: {
      1: { status: 'mastered', addedToPlan: false, reviewCount: 3 },
      2: { status: 'learning', addedToPlan: true, reviewCount: 1 },
      3: { status: 'weak', addedToPlan: true, reviewCount: 2 },
    },
    dailyPlan: [2, 3],
    interviewAttempts: {
      1: [{ questionId: 1, answer: '结构化回答', feedback: attempt(86), createdAt: '2026-06-18T00:00:00.000Z' }],
    },
  }

  const markdown = buildStudyCommandMarkdown(progress, '2026-06-18T00:00:00.000Z')

  expect(markdown).toContain('# Java 后端 备考指挥中心')
  expect(markdown).toContain('生成时间：2026-06-18')
  expect(markdown).toContain('## 指挥概览')
  expect(markdown).toContain('## 就绪因子')
  expect(markdown).toContain('## 下一步行动')
  expect(markdown).toContain('路径：')
  expect(markdown).not.toContain('undefined')
})
```

- [ ] **Step 2: 运行红灯测试**

```bash
cd frontend
npm run test -- studyStrategy
```

Expected: FAIL，原因是 `buildStudyCommandMarkdown is not a function`。

### Task 3: 实现 Markdown 导出函数

**Files:**
- Modify: `frontend/src/utils/studyStrategy.ts`

- [ ] **Step 1: 新增导出函数**

新增：

```ts
export function buildStudyCommandMarkdown(
  progress: StudyProgress,
  now = new Date().toISOString(),
): string
```

- [ ] **Step 2: 新增 helpers**

新增 `renderCommandOverview`、`renderCommandFactors`、`renderCommandActions`、`formatMarkdownDate`，所有内容都从 `buildStudyStrategy(progress)` 和 `progress` 派生。

- [ ] **Step 3: 运行绿灯测试**

```bash
cd frontend
npm run test -- studyStrategy
```

Expected: PASS.

### Task 4: 面板接入复制入口

**Files:**
- Modify: `frontend/src/components/StudyCommandCenter.tsx`
- Modify: `frontend/src/styles/global.css`
- Create: `frontend/src/components/StudyCommandCenter.test.tsx`

- [ ] **Step 1: 写组件失败测试**

新增组件测试，断言点击“复制指挥”后剪贴板内容包含“备考指挥中心”、“## 指挥概览”、“## 就绪因子”和“## 下一步行动”。

- [ ] **Step 2: 运行组件红灯测试**

```bash
cd frontend
npm run test -- StudyCommandCenter
```

Expected: FAIL，原因是找不到“复制指挥”按钮。

- [ ] **Step 3: 接入组件**

在 `StudyCommandCenter.tsx` 中：
- 引入 `message`、`CopyOutlined` 和 `buildStudyCommandMarkdown`。
- 新增 `handleCopyCommand`。
- 在 `.command-main-header` 右侧放置 `.command-main-actions`，包含风险徽标和复制按钮。
- 复用 `copyMarkdown`、`downloadMarkdown`、`buildFileName` 降级策略。

- [ ] **Step 4: 补样式**

为 `.command-main-actions` 添加 flex、gap、wrap、按钮对齐样式，移动端靠左。

- [ ] **Step 5: 运行定向绿灯测试**

```bash
cd frontend
npm run test -- studyStrategy StudyCommandCenter
```

Expected: PASS.

### Task 5: 全量验证和提交

**Files:**
- All changed frontend files.

- [ ] **Step 1: 全量验证**

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected: all exit 0.

- [ ] **Step 2: 提交功能**

```bash
git add frontend/src/utils/studyStrategy.test.ts frontend/src/utils/studyStrategy.ts frontend/src/components/StudyCommandCenter.tsx frontend/src/components/StudyCommandCenter.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增备考指挥中心导出"
```
