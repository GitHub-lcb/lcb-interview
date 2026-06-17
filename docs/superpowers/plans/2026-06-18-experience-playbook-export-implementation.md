# 真实面试场景包导出 Implementation Plan

**Goal:** 让 `/experiences` 页面支持 Markdown 导出，把真实面试场景组、追问主题和行动入口变成可复制的面试训练包。

**Architecture:** 新增 `frontend/src/utils/experiencePlaybook.ts` 纯函数模块，接收 `ExperienceSet[]` 和目标岗位。`Experiences` 页面只负责复制和下载降级。

## Task 1: 文档提交

新增设计文档和实施计划，明确导出结构、按钮位置、空状态和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-experience-playbook-export-design.md docs/superpowers/plans/2026-06-18-experience-playbook-export-implementation.md
git diff --cached --check
git commit -m "文档：设计真实面试场景包导出"
```

## Task 2: TDD 增加纯函数导出测试

新增 `frontend/src/utils/experiencePlaybook.test.ts`：

- 非空场景组导出：
  - 标题包含目标岗位和“真实面试场景包”。
  - 包含生成日期、场景总览、场景题单、追问主题和行动入口。
  - 不包含 `undefined`。
- 空场景组导出：
  - 包含“暂无面试场景组”。
  - 包含 `/practice` 兜底入口。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- experiencePlaybook
```

预期失败：模块或 `buildExperiencePlaybookMarkdown` 尚不存在。

## Task 3: 实现场景包导出函数

新增 `frontend/src/utils/experiencePlaybook.ts`：

- `buildExperiencePlaybookMarkdown(experienceSets, targetRole, now)`
- `renderExperienceOverview(experienceSets)`
- `renderExperienceItems(experienceSets)`
- `renderActions(actions)`
- `formatMarkdownDate(value)`
- `sanitizeMarkdownValue(value)`

再次运行：

```bash
npm run test -- experiencePlaybook
```

预期通过。

## Task 4: TDD 增加页面复制测试

新增 `frontend/src/pages/Experiences/index.test.tsx`：

- 向 `localStorage` 写入 `targetRole`。
- mock `navigator.clipboard.writeText`。
- 渲染 `/experiences` 页面并点击“复制场景包”。
- 断言写入 Markdown 包含“真实面试场景包”“场景题单”和 `/practice`。

先运行：

```bash
npm run test -- Experiences
```

预期失败：按钮尚不存在。

## Task 5: 页面接入复制和下载降级

修改 `frontend/src/pages/Experiences/index.tsx`：

- 引入 `message`、`CopyOutlined`、`useStudyProgress` 和 `buildExperiencePlaybookMarkdown`。
- 增加 `handleCopyExperiencePlaybook`。
- 在头部说明下增加“复制场景包”按钮。
- 剪贴板成功提示复制成功，失败下载 Markdown。

复用 `prep-hero-actions` 样式，不新增冗余布局。

再次运行：

```bash
npm run test -- Experiences
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
git add frontend/src/utils/experiencePlaybook.test.ts frontend/src/utils/experiencePlaybook.ts frontend/src/pages/Experiences/index.tsx frontend/src/pages/Experiences/index.test.tsx
git diff --cached --check
git commit -m "功能：新增真实面试场景包导出"
```
