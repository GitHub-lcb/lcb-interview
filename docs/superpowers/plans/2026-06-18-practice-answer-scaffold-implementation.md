# 模拟面试答题脚手架 Implementation Plan

**Goal:** 让 `/practice` 页面在用户提交评分之前提供结构化口述提纲和可带入输入框的回答模板，把空白作答升级为可训练、可评分、可追问的面试表达草稿。

**Architecture:** 新增 `frontend/src/utils/practiceAnswerScaffold.ts` 纯函数模块，接收当前 `PracticeQueueItem` 与目标岗位并生成结构化脚手架和 Markdown。新增 `PracticeAnswerScaffoldPanel` 负责展示、复制和带入回答框。`Practice` 页面只负责把当前题、目标岗位和 `setAnswerDraft` 串起来。

## Task 1: 文档提交

新增设计文档和实施计划，明确答题前脚手架的结构、UI 位置、领域提示和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-practice-answer-scaffold-design.md docs/superpowers/plans/2026-06-18-practice-answer-scaffold-implementation.md
git diff --cached --check
git commit -m "文档：设计模拟面试答题脚手架"
```

## Task 2: TDD 增加纯函数测试

新增 `frontend/src/utils/practiceAnswerScaffold.test.ts`：

- Java 集合题生成四段结构：
  - `conclusion`
  - `mechanism`
  - `scenario`
  - `risk`
- 模板包含题目标题和目标岗位。
- Java 集合领域提示包含 `ConcurrentHashMap`。
- 空目标岗位兜底为“目标岗位”。
- 输出不包含 `undefined`。

先运行：

```bash
npm run test -- practiceAnswerScaffold
```

预期失败：模块或 `buildPracticeAnswerScaffold` 尚不存在。

## Task 3: 实现答题脚手架纯函数

新增 `frontend/src/utils/practiceAnswerScaffold.ts`：

- `buildPracticeAnswerScaffold(question, targetRole)`
- `buildPracticeAnswerScaffoldMarkdown(question, targetRole, now)`
- `resolveDomainHints(question)`
- `formatMarkdownDate(value)`
- `sanitizeText(value, fallback)`
- `buildAnswerTemplate(question, targetRole, hints)`

再次运行：

```bash
npm run test -- practiceAnswerScaffold
```

预期通过。

## Task 4: TDD 增加面板交互测试

新增 `frontend/src/components/PracticeAnswerScaffoldPanel.test.tsx`：

- 渲染面板后能看到“答题脚手架”和四个结构点。
- 点击“带入回答框”后调用 `onUseTemplate`，模板包含当前题和目标岗位。
- mock `navigator.clipboard.writeText`，点击“复制脚手架”后写入 Markdown。

先运行：

```bash
npm run test -- PracticeAnswerScaffoldPanel
```

预期失败：组件尚不存在。

## Task 5: 实现面板并接入 Practice 页

新增 `frontend/src/components/PracticeAnswerScaffoldPanel.tsx`：

- 使用 `FormOutlined`、`CopyOutlined`、`EditOutlined`。
- 展示四段结构提示。
- 成功复制提示“答题脚手架已复制”。
- 剪贴板失败时下载 `{题目标题}-答题脚手架.md`。

修改 `frontend/src/pages/Practice/index.tsx`：

- 引入 `PracticeAnswerScaffoldPanel`。
- 在题目卡片和回答输入框之间插入脚手架面板。
- 增加 `useAnswerScaffold(template)`，设置回答草稿并清空旧评分。

修改 `frontend/src/styles/global.css`：

- 新增脚手架面板、标题、按钮、四段网格和移动端样式。
- 保持 8px 圆角以内，和练习页现有面板风格一致。

再次运行：

```bash
npm run test -- PracticeAnswerScaffoldPanel
```

预期通过。

## Task 6: 全量校验和提交

运行：

```bash
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add frontend/src/utils/practiceAnswerScaffold.test.ts frontend/src/utils/practiceAnswerScaffold.ts frontend/src/components/PracticeAnswerScaffoldPanel.test.tsx frontend/src/components/PracticeAnswerScaffoldPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试答题脚手架"
```
